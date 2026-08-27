"""Admin back-office endpoints: overview, customers, accounts, ledger,
payout approvals, loans, KYC reviews, support inbox, broadcasts, audit."""
import routing
import authx
import store
from api_user import (acct_brief, enrich_tx, safe_int, user_tx_query,
                      check_maintenance)
from routing import route, ApiError


def _require_admin(ctx):
    if ctx["user"].get("role") != "admin":
        raise ApiError("Admin access required.", 403)


def _user_row(db, u):
    accts = store.user_accounts(db, u["id"])
    bal = round(sum(store.fx_to_usd(db, a["balance"], a["currency"]) for a in accts), 2)
    return {
        "id": u["id"], "name": u["name"], "email": u["email"],
        "role": u.get("role", "user"), "hue": u.get("hue", 0),
        "country": u.get("country"), "phone": u.get("phone"),
        "kyc_status": u.get("kyc_status", "unverified"),
        "suspended": bool(u.get("suspended")),
        "restricted": bool(u.get("restricted")),
        "joined_at": u.get("joined_at"), "last_login_at": u.get("last_login_at"),
        "accounts": len(accts), "balance_usd": bal,
    }


# --------------------------------------------------------------- overview --
@route("GET", "/api/admin/overview", auth="admin")
def overview(ctx):
    db = ctx["db"]
    now = store.now_ms()
    day = store.DAY_MS
    today0 = now - (now % day)

    users = db["users"]
    customers = [u for u in users if u.get("role") != "admin"]
    deposits = round(sum(store.fx_to_usd(db, a["balance"], a["currency"]) for a in db["accounts"]), 2)

    loan_out = 0.0
    for l in db["loans"]:
        if l["status"] == "active":
            due = l["monthly_payment"] * l["term_months"]
            loan_out += max(0.0, due - l.get("paid_total", 0))

    # 14-day volume (USD-eq, signed by direction)
    vol_in = [0.0] * 14
    vol_out = [0.0] * 14
    signups = [0] * 14
    acct_by_id = {a["id"]: a for a in db["accounts"]}
    for t in db["transactions"]:
        d = int((today0 - (t.get("created_at", 0) - (t.get("created_at", 0) % day))) // day)
        if not (0 <= d < 14):
            continue
        a = acct_by_id.get(t.get("account_id"))
        usd = abs(store.fx_to_usd(db, t["amount"], a["currency"])) if a else 0
        if t["amount"] > 0 and t["status"] == "completed":
            vol_in[d] += usd
        elif t["amount"] < 0 and t["status"] == "completed":
            vol_out[d] += usd
    for u in users:
        d = int((today0 - (u.get("joined_at", 0) - (u.get("joined_at", 0) % day))) // day)
        if 0 <= d < 14:
            signups[d] += 1

    pend_payouts = [t for t in db["transactions"]
                    if t["type"] == "transfer_out" and t["status"] == "pending"]
    pend_topups = [t for t in db["transactions"]
                   if t["type"] == "deposit" and t["status"] == "pending"]
    pend_loans = [l for l in db["loans"] if l["status"] == "pending"]
    pend_kyc = [u for u in users if u.get("kyc_status") == "pending"]
    open_msgs = [m for m in db["messages"] if m.get("status") == "open"]

    recent_audit = sorted(db["audit"], key=lambda a: a["ts"], reverse=True)[:8]
    latest_users = sorted(customers, key=lambda u: u["joined_at"], reverse=True)[:5]

    return {
        "kpis": {
            "customers": len(customers),
            "new_week": sum(1 for u in customers if now - u.get("joined_at", now) <= 7 * day),
            "verified_pct": int(round(100 * sum(1 for u in customers
                                                if u.get("kyc_status") == "verified")
                                     / max(1, len(customers)))),
            "frozen": sum(1 for u in users if u.get("suspended")),
            "deposits_usd": deposits,
            "loan_book_usd": round(loan_out, 2),
            "volume_today_in": round(vol_in[0], 2),
            "volume_today_out": round(vol_out[0], 2),
        },
        "charts": {
            "vol_in": [round(x, 2) for x in reversed(vol_in)],
            "vol_out": [round(x, 2) for x in reversed(vol_out)],
            "signups": list(reversed(signups)),
        },
        "queues": {
            "payouts": len(pend_payouts), "topups": len(pend_topups),
            "loans": len(pend_loans), "kyc": len(pend_kyc),
            "messages": len(open_msgs),
            "declined_open": sum(1 for l in db.get("declined_logs", [])
                                 if not l.get("resolved")),
        },
        "recent_audit": recent_audit,
        "latest_users": [_user_row(db, u) for u in latest_users],
    }


# ---------------------------------------------------------------- users ----
@route("GET", "/api/admin/users", auth="admin")
def users_list(ctx):
    db = ctx["db"]
    q = (ctx["query"].get("q") or "").strip().lower()
    status = ctx["query"].get("status") or ""
    page = safe_int(ctx["query"].get("page"), 1, 1)
    rows = [u for u in db["users"] if u.get("role") != "admin"]
    if q:
        rows = [u for u in rows if q in u["name"].lower() or q in u["email"].lower()]
    if status == "frozen":
        rows = [u for u in rows if u.get("suspended") or u.get("restricted")]
    elif status == "active":
        rows = [u for u in rows if not u.get("suspended") and not u.get("restricted")]
    elif status == "pending_kyc":
        rows = [u for u in rows if u.get("kyc_status") == "pending"]
    elif status == "unverified":
        rows = [u for u in rows if u.get("kyc_status") == "unverified"]
    elif status == "verified":
        rows = [u for u in rows if u.get("kyc_status") == "verified"]
    rows.sort(key=lambda u: u["joined_at"], reverse=True)
    per = 10
    pages = max(1, (len(rows) + per - 1) // per)
    page = min(page, pages)
    return {"users": [_user_row(db, u) for u in rows[(page - 1) * per: page * per]],
            "meta": {"total": len(rows), "page": page, "pages": pages}}


@route("GET", "/api/admin/users/{id}", auth="admin")
def user_detail(ctx):
    db = ctx["db"]
    uid = int(ctx["params"]["id"])
    u = store.find_user(db, uid)
    if not u:
        raise ApiError("Customer not found.", 404)
    accts = store.user_accounts(db, uid)
    acct_ids = {a["id"] for a in accts}
    txs = sorted([t for t in db["transactions"] if t.get("account_id") in acct_ids],
                 key=lambda t: t["created_at"], reverse=True)[:12]
    loans = [dict(l) for l in db["loans"] if l["user_id"] == uid]
    cards = [{"id": c["id"], "label": c["label"], "last4": c["last4"], "masked": c["masked"],
              "type": c["type"], "status": c["status"], "frozen": c.get("frozen")}
             for c in db["cards"] if c["user_id"] == uid]
    sess = sum(1 for s in db["sessions"] if s.get("user_id") == uid)
    return {"user": _user_row(db, u),
            "profile": {"phone": u.get("phone"), "address": u.get("address"),
                        "kyc_doc": u.get("kyc_doc"), "kyc_note": u.get("kyc_note"),
                        "kyc_submitted_at": u.get("kyc_submitted_at")},
            "accounts": [acct_brief(a) for a in accts],
            "transactions": [enrich_tx(db, t) for t in txs],
            "loans": loans, "cards": cards, "sessions": sess}


@route("PUT", "/api/admin/users/{id}", auth="admin")
def user_update(ctx):
    db = ctx["db"]
    u = store.find_user(db, int(ctx["params"]["id"]))
    if not u:
        raise ApiError("Customer not found.", 404)
    b = ctx["body"]
    if "name" in b and len((b.get("name") or "").strip()) >= 2:
        u["name"] = b["name"].strip()[:60]
    if "email" in b:
        em = (b.get("email") or "").strip().lower()
        other = store.find_user_by_email(db, em)
        if other and other["id"] != u["id"]:
            raise ApiError("Another account already uses that email.")
        u["email"] = em
    if "phone" in b:
        u["phone"] = (b.get("phone") or "").strip()[:24]
    if "country" in b:
        u["country"] = (b.get("country") or "").strip()[:40]
    store.audit(db, ctx["user"], "admin.user_update", "user:%d" % u["id"])
    return {"user": _user_row(db, u)}


@route("POST", "/api/admin/users/{id}/adjust", auth="admin")
def adjust_balance(ctx):
    check_maintenance(ctx)
    db = ctx["db"]
    u = store.find_user(db, int(ctx["params"]["id"]))
    if not u:
        raise ApiError("Customer not found.", 404)
    b = ctx["body"]
    acct = store.find_account(db, b.get("account_id"))
    if not acct or acct["user_id"] != u["id"]:
        raise ApiError("Pick one of the customer's accounts.")
    try:
        amt = store.r2(float(b.get("amount")))
    except (TypeError, ValueError):
        raise ApiError("Enter a signed amount (e.g. 250 or -100).")
    if amt == 0:
        raise ApiError("Amount cannot be zero.")
    reason = (b.get("reason") or "").strip()
    if len(reason) < 3:
        raise ApiError("A reason is required for every adjustment.")
    t = store.post(db, acct, amt, "adjustment",
                   counterparty="Zentra Operations", note=reason[:160])
    store.notify(db, u["id"], "Balance adjusted",
                 "%s%s on your %s account · %s"
                 % ("+" if amt > 0 else "", store.fmt_money(amt, acct["currency"]),
                    acct["label"], reason))
    store.audit(db, ctx["user"], "admin.adjust_balance", "txn:%d" % t["id"],
                severity="critical", user=u["email"], amount=amt,
                currency=acct["currency"], reason=reason)
    return {"transaction": enrich_tx(db, t), "account": acct_brief(acct)}


@route("POST", "/api/admin/users/{id}/freeze", auth="admin")
def freeze_user(ctx):
    db = ctx["db"]
    u = store.find_user(db, int(ctx["params"]["id"]))
    if not u:
        raise ApiError("Customer not found.", 404)
    if u.get("role") == "admin":
        raise ApiError("Admins can't be frozen here.", 400)
    frozen = bool(ctx["body"].get("frozen", True))
    u["suspended"] = frozen
    killed = 0
    if frozen:
        killed = authx.revoke_user_sessions(db, u["id"])
        store.audit(db, ctx["user"], "admin.freeze_user", "user:%d" % u["id"],
                    severity="warn")
        store.notify(db, u["id"], "Account frozen",
                     "Your account has been temporarily frozen. Contact support for help.")
    else:
        store.audit(db, ctx["user"], "admin.unfreeze_user", "user:%d" % u["id"])
        store.notify(db, u["id"], "Account restored",
                     "Good news — your account is active again.")
    return {"ok": True, "sessions_killed": killed}


@route("POST", "/api/admin/users/{id}/restrict", auth="admin")
def restrict_user(ctx):
    """Freeze all transactions but leave login intact (HTTP 423 blocks money moves)."""
    db = ctx["db"]
    u = store.find_user(db, int(ctx["params"]["id"]))
    if not u:
        raise ApiError("Customer not found.", 404)
    if u.get("role") == "admin":
        raise ApiError("Admins can't be restricted here.", 400)
    restricted = bool(ctx["body"].get("restricted", True))
    reason = (ctx["body"].get("reason") or "").strip()[:140]
    u["restricted"] = restricted
    if restricted:
        # silent freeze: the customer is NOT told — they find out when a
        # transaction declines at the PIN step. Attempts accumulate in the
        # Declined log and the team is escalated on the third one.
        u["restricted_at"] = store.now_ms()
        store.log_declined(db, u["id"], "account",
                           reason or "Account restricted by Zentra")
        store.audit(db, ctx["user"], "admin.restrict_user", "user:%d" % u["id"],
                    severity="warn", reason=reason)
    else:
        store.audit(db, ctx["user"], "admin.unrestrict_user", "user:%d" % u["id"])
        store.notify(db, u["id"], "Account restored",
                     "Good news — the restriction on your account has been lifted. "
                     "All transactions work normally again.",
                     link="#/app/accounts")
    return {"ok": True, "restricted": restricted}


@route("GET", "/api/admin/declined-logs", auth="admin")
def declined_logs(ctx):
    db = ctx["db"]
    logs = list(reversed(db.get("declined_logs", [])))
    resolved = ctx["query"].get("resolved")
    if resolved in ("0", "1"):
        want = resolved == "1"
        logs = [l for l in logs if bool(l.get("resolved")) == want]
    q = (ctx["query"].get("q") or "").strip().lower()
    if q:
        def _match(l):
            u = store.find_user(db, l["user_id"]) or {}
            hay = " ".join([l["ref"], l["kind"], l["reason"], l["tx_ref"] or "",
                            u.get("name", ""), u.get("email", "")]).lower()
            return q in hay
        logs = [l for l in logs if _match(l)]
    rows = []
    for l in logs[:200]:
        u = store.find_user(db, l["user_id"]) or {}
        since = (u.get("restricted_at") or 0) if u.get("restricted") else 0
        tries = sum(1 for g in db.get("declined_logs", [])
                    if g["user_id"] == l["user_id"] and g["kind"] == "attempt"
                    and g["created_at"] >= since)
        rows.append({
            "id": l["id"], "ref": l["ref"], "kind": l["kind"], "reason": l["reason"],
            "message": l.get("message", ""), "tx_ref": l.get("tx_ref", ""),
            "resolved": bool(l.get("resolved")), "mailed": bool(l.get("mailed")),
            "created_at": l["created_at"],
            "user_name": u.get("name", "Deleted user"),
            "user_email": u.get("email", ""),
            "attempts": tries,
            "mail_locked": l["kind"] == "attempt" and not l.get("resolved") and tries < 3,
        })
    open_n = sum(1 for l in db.get("declined_logs", []) if not l.get("resolved"))
    return {"logs": rows, "open": open_n,
            "total": len(db.get("declined_logs", []))}


@route("POST", "/api/admin/declined-logs/{id}/mail", auth="admin")
def declined_mail(ctx):
    """Send the customer a branded email from alerts@zentra.bank about this decline."""
    db = ctx["db"]
    entry = next((l for l in db.get("declined_logs", []) if l["id"] == int(ctx["params"]["id"])), None)
    if not entry:
        raise ApiError("Declined log entry not found.", 404)
    subject = (ctx["body"].get("subject") or "").strip()[:120]
    body = (ctx["body"].get("body") or "").strip()[:1000]
    if len(body) < 10:
        raise ApiError("Write the message you want to send.")
    u = store.find_user(db, entry["user_id"])
    if not u:
        raise ApiError("That customer no longer exists.", 404)
    if entry["kind"] == "attempt":
        since = (u.get("restricted_at") or 0) if u.get("restricted") else 0
        tries = sum(1 for l in db.get("declined_logs", [])
                    if l["user_id"] == entry["user_id"] and l["kind"] == "attempt"
                    and l["created_at"] >= since)
        if tries < 3:
            raise ApiError(
                "The customer has only hit %d declined tr%s — the branded email "
                "unlocks on the third try." % (tries, "y" if tries == 1 else "ies"), 409)
    store.notify(db, u["id"], subject or "Important: action required on your account",
                 body, link="#/app/support")
    entry["mailed"] = True
    entry["mail_subject"] = subject
    store.audit(db, ctx["user"], "admin.decline_mail", "user:%d" % u["id"],
                severity="warn", ref=entry["ref"])
    return {"ok": True}


@route("POST", "/api/admin/declined-logs/{id}/resolve", auth="admin")
def declined_resolve(ctx):
    db = ctx["db"]
    entry = next((l for l in db.get("declined_logs", []) if l["id"] == int(ctx["params"]["id"])), None)
    if not entry:
        raise ApiError("Declined log entry not found.", 404)
    entry["resolved"] = True
    store.audit(db, ctx["user"], "admin.decline_resolve", "log:%s" % entry["ref"])
    return {"ok": True}


@route("POST", "/api/admin/users/{id}/role", auth="admin")
def change_role(ctx):
    db = ctx["db"]
    u = store.find_user(db, int(ctx["params"]["id"]))
    if not u:
        raise ApiError("User not found.", 404)
    role = ctx["body"].get("role")
    if role not in ("user", "admin"):
        raise ApiError("Unknown role.")
    if u["id"] == ctx["user"]["id"] and role != "admin":
        raise ApiError("You can't demote yourself.")
    if u.get("role") == "admin" and role != "admin":
        admins = [x for x in db["users"] if x.get("role") == "admin"]
        if len(admins) <= 1:
            raise ApiError("At least one admin must remain.")
    u["role"] = role
    store.audit(db, ctx["user"], "admin.change_role", "user:%d" % u["id"],
                severity="critical", role=role)
    return {"ok": True}


@route("POST", "/api/admin/users/{id}/kyc", auth="admin")
def review_kyc(ctx):
    db = ctx["db"]
    u = store.find_user(db, int(ctx["params"]["id"]))
    if not u:
        raise ApiError("Customer not found.", 404)
    decision = ctx["body"].get("decision")
    note = (ctx["body"].get("note") or "").strip()[:160]
    if u.get("kyc_status") != "pending":
        raise ApiError("This customer has no pending verification.")
    if decision == "approve":
        u["kyc_status"] = "verified"
        store.notify(db, u["id"], "Identity verified ✅",
                     "Your identity check passed — every feature is now unlocked.")
        store.audit(db, ctx["user"], "admin.kyc_approve", "user:%d" % u["id"])
    elif decision == "reject":
        u["kyc_status"] = "rejected"
        u["kyc_note"] = note or "Document unreadable — please resubmit."
        store.notify(db, u["id"], "Verification needs attention",
                     "We couldn't verify your document: %s" % u["kyc_note"])
        store.audit(db, ctx["user"], "admin.kyc_reject", "user:%d" % u["id"], severity="warn")
    else:
        raise ApiError("Decision must be approve or reject.")
    u["kyc_reviewed_at"] = store.now_ms()
    return {"ok": True, "kyc_status": u["kyc_status"]}


@route("DELETE", "/api/admin/users/{id}", auth="admin")
def delete_user(ctx):
    db = ctx["db"]
    uid = int(ctx["params"]["id"])
    u = store.find_user(db, uid)
    if not u:
        raise ApiError("Customer not found.", 404)
    if u.get("role") == "admin":
        raise ApiError("Admin accounts can't be deleted.", 400)
    if uid == ctx["user"]["id"]:
        raise ApiError("You can't delete your own account.", 400)
    db["users"] = [x for x in db["users"] if x["id"] != uid]
    gone_accts = {a["id"] for a in db["accounts"] if a["user_id"] == uid}
    db["accounts"] = [a for a in db["accounts"] if a["user_id"] != uid]
    db["cards"] = [c for c in db["cards"] if c["user_id"] != uid]
    db["beneficiaries"] = [b for b in db["beneficiaries"] if b["user_id"] != uid]
    db["loans"] = [l for l in db["loans"] if l["user_id"] != uid]
    db["notifications"] = [n for n in db["notifications"] if n["user_id"] != uid]
    db["messages"] = [m for m in db["messages"] if m.get("user_id") != uid]
    db["sessions"] = [s for s in db["sessions"] if s.get("user_id") != uid]
    db["transactions"] = [t for t in db["transactions"] if t.get("account_id") not in gone_accts]
    store.audit(db, ctx["user"], "admin.delete_user", "user:%d" % uid,
                severity="critical", email=u["email"])
    return {"ok": True}


# -------------------------------------------------------------- accounts ---
@route("GET", "/api/admin/accounts", auth="admin")
def accounts_list(ctx):
    db = ctx["db"]
    q = (ctx["query"].get("q") or "").strip().lower()
    rows = []
    for a in db["accounts"]:
        owner = store.find_user(db, a["user_id"])
        if not owner:
            continue
        row = acct_brief(a)
        row["frozen"] = bool(a.get("frozen"))     # admin-only view
        row["owner_name"] = owner["name"]
        row["owner_email"] = owner["email"]
        row["usd_eq"] = store.fx_to_usd(db, a["balance"], a["currency"])
        if q and not (q in owner["name"].lower() or q in owner["email"].lower()
                      or q in a["number"].lower().replace(" ", "") or q in a["label"].lower()):
            continue
        rows.append(row)
    rows.sort(key=lambda r: -r["usd_eq"])
    return {"accounts": rows[:80],
            "total_usd": round(sum(r["usd_eq"] for r in rows), 2)}


@route("POST", "/api/admin/accounts/{id}/freeze", auth="admin")
def freeze_account(ctx):
    db = ctx["db"]
    a = store.find_account(db, int(ctx["params"]["id"]))
    if not a:
        raise ApiError("Account not found.", 404)
    a["frozen"] = bool(ctx["body"].get("frozen", True))
    store.notify(db, a["user_id"], "Account %s" % ("frozen" if a["frozen"] else "unfrozen"),
                 "Your %s account was %s by the bank."
                 % (a["label"], "frozen" if a["frozen"] else "unfrozen"))
    store.audit(db, ctx["user"], "admin.freeze_account" if a["frozen"] else "admin.unfreeze_account",
                "account:%d" % a["id"], severity="warn")
    return {"ok": True, "frozen": a["frozen"]}


# ----------------------------------------------------------- transactions ---
@route("GET", "/api/admin/transactions", auth="admin")
def all_transactions(ctx):
    db = ctx["db"]
    q = (ctx["query"].get("q") or "").strip().lower()
    type_ = ctx["query"].get("type") or None
    status = ctx["query"].get("status") or None
    page = safe_int(ctx["query"].get("page"), 1, 1)
    acct_by_id = {a["id"]: a for a in db["accounts"]}
    user_by_id = {u["id"]: u for u in db["users"]}
    rows = list(db["transactions"])
    if type_:
        rows = [t for t in rows if t["type"] == type_]
    if status:
        rows = [t for t in rows if t["status"] == status]
    if q:
        def match(t):
            u = user_by_id.get(t["user_id"])
            parts = [t.get("ref") or "", t.get("note") or "", t.get("counterparty") or ""]
            if u:
                parts += [u["name"], u["email"]]
            return any(q in p.lower() for p in parts)
        rows = [t for t in rows if match(t)]
    rows.sort(key=lambda t: (t["created_at"], t["id"]), reverse=True)
    per = min(200, safe_int(ctx["query"].get("per"), 15, 1) or 15)
    pages = max(1, (len(rows) + per - 1) // per)
    page = min(page, pages)
    out = []
    for t in rows[(page - 1) * per: page * per]:
        d = enrich_tx(db, t, acct_by_id)
        u = user_by_id.get(t["user_id"])
        d["user_name"] = u["name"] if u else "?"
        d["user_email"] = u["email"] if u else "?"
        out.append(d)
    return {"transactions": out, "meta": {"total": len(rows), "page": page, "pages": pages}}


@route("POST", "/api/admin/transactions/{id}/reverse", auth="admin")
def reverse_transaction(ctx):
    check_maintenance(ctx)
    db = ctx["db"]
    tid = int(ctx["params"]["id"])
    reason = (ctx["body"].get("reason") or "").strip()
    if len(reason) < 3:
        raise ApiError("A reversal reason is required.")
    orig, rev = store.reverse_tx(db, tid, reason)
    if not orig:
        raise ApiError("Only completed or pending transactions can be reversed.")
    u = store.find_user(db, orig["user_id"])
    if u:
        store.notify(db, u["id"], "Transaction reversed",
                     "%s of %s was reversed · %s"
                     % (orig["ref"], store.fmt_money(orig["amount"], orig["currency"]), reason))
    store.audit(db, ctx["user"], "admin.reverse_tx", "txn:%d" % tid,
                severity="critical", reason=reason, ref=orig["ref"])
    return {"ok": True}


@route("POST", "/api/admin/transactions/{id}/review", auth="admin")
def review_pending_tx(ctx):
    """Approve or decline ANY pending transaction (holds, queued payouts)."""
    check_maintenance(ctx)
    db = ctx["db"]
    tid = int(ctx["params"]["id"])
    decision = ctx["body"].get("decision")
    reason = (ctx["body"].get("reason") or "").strip()[:140]
    target = next((t for t in db["transactions"] if t["id"] == tid), None)
    if not target or target.get("status") != "pending":
        raise ApiError("Pending transaction not found — it may already be resolved.", 404)
    u = store.find_user(db, target["user_id"])
    amt = store.fmt_money(abs(target["amount"]) - (target.get("fee") or 0), target["currency"])
    if decision == "approve":
        store.complete_pending(db, tid, approve=True)
        if u:
            store.notify(db, u["id"], "Transaction approved",
                         "%s (%s) has been approved and completed · ref %s"
                         % (amt, target.get("counterparty") or "transfer", target["ref"]),
                         link="#/app/statements")
        store.audit(db, ctx["user"], "admin.tx_approve", "txn:%d" % tid,
                    severity="critical", amount=abs(target["amount"]), ref=target["ref"])
    elif decision == "reject":
        if len(reason) < 3:
            raise ApiError("Give the customer a short reason for declining.")
        message = (ctx["body"].get("message") or "").strip()[:1000]
        store.complete_pending(db, tid, approve=False, reason=reason)
        log = store.log_declined(db, target["user_id"], "transaction", reason,
                                 message=message, tx_ref=target["ref"])
        if u:
            store.notify(db, u["id"], "Transaction declined",
                         "%s was declined and any hold released to your balance · %s"
                         % (amt, reason),
                         link="#/app/statements")
            if message:
                store.notify(db, u["id"],
                             "Important: action required on your account",
                             message, link="#/app/support",
                             created_at=None)
                log["mailed"] = True
                log["mail_subject"] = "Important: action required on your account"
        store.audit(db, ctx["user"], "admin.tx_decline", "txn:%d" % tid,
                    severity="warn", reason=reason, ref=target["ref"])
    else:
        raise ApiError("Decision must be approve or reject.")
    return {"ok": True}


# ---------------------------------------------------------- payout queue ---
@route("GET", "/api/admin/payouts", auth="admin")
def payout_queue(ctx):
    db = ctx["db"]
    acct_by_id = {a["id"]: a for a in db["accounts"]}
    user_by_id = {u["id"]: u for u in db["users"]}
    rows = []
    for t in db["transactions"]:
        if t["type"] == "transfer_out" and t["method"] == "external" \
                and t["status"] in ("pending", "rejected"):
            a = acct_by_id.get(t.get("account_id"))
            u = user_by_id.get(t.get("user_id"))
            d = dict(t)
            d["user_name"] = u["name"] if u else "?"
            d["user_email"] = u["email"] if u else "?"
            d["account_label"] = a["label"] if a else "?"
            d["currency"] = a["currency"] if a else "USD"
            rows.append(d)
    rows.sort(key=lambda t: t["created_at"], reverse=True)
    return {"payouts": rows[:50]}


@route("POST", "/api/admin/payouts/{id}/review", auth="admin")
def review_payout(ctx):
    db = ctx["db"]
    tid = int(ctx["params"]["id"])
    decision = ctx["body"].get("decision")
    reason = (ctx["body"].get("reason") or "").strip()[:140]
    target = next((t for t in db["transactions"]
                   if t["id"] == tid and t["type"] == "transfer_out"
                   and t["method"] == "external" and t["status"] == "pending"), None)
    if not target:
        raise ApiError("Pending payout not found.", 404)
    u = store.find_user(db, target["user_id"])
    amt = store.fmt_money(abs(target["amount"]) - (target.get("fee") or 0), target["currency"])
    if decision == "approve":
        store.complete_pending(db, tid, approve=True)
        if u:
            store.notify(db, u["id"], "Payout approved",
                         "%s to %s is on its way." % (amt, target.get("counterparty")))
        store.audit(db, ctx["user"], "admin.payout_approve", "txn:%d" % tid,
                    severity="critical", amount=abs(target["amount"]))
    elif decision == "reject":
        reason = (ctx["body"].get("reason") or ctx["body"].get("note") or "").strip()[:140]
        store.complete_pending(db, tid, approve=False, reason=reason or "Rejected by bank")
        message = (ctx["body"].get("message") or "").strip()[:1000]
        log = store.log_declined(db, target["user_id"], "transaction",
                                 reason or "Payout rejected", message=message,
                                 tx_ref=target["ref"])
        if u:
            store.notify(db, u["id"], "Payout rejected",
                         "%s was returned to your account · %s"
                         % (amt, reason or "contact support"))
            if message:
                store.notify(db, u["id"], "Important: action required on your account",
                             message, link="#/app/support")
                log["mailed"] = True
                log["mail_subject"] = "Important: action required on your account"
        store.audit(db, ctx["user"], "admin.payout_reject", "txn:%d" % tid,
                    severity="warn", reason=reason)
    else:
        raise ApiError("Decision must be approve or reject.")
    return {"ok": True}


# ----------------------------------------------------------------- loans ---
@route("GET", "/api/admin/loans", auth="admin")
def loans_list(ctx):
    db = ctx["db"]
    status = ctx["query"].get("status") or ""
    user_by_id = {u["id"]: u for u in db["users"]}
    acct_by_id = {a["id"]: a for a in db["accounts"]}
    rows = []
    for l in db["loans"]:
        if status and l["status"] != status:
            continue
        d = dict(l)
        u = user_by_id.get(l["user_id"])
        d["user_name"] = u["name"] if u else "?"
        d["user_email"] = u["email"] if u else "?"
        d["due_total"] = store.r2(l["monthly_payment"] * l["term_months"])
        d["remaining"] = store.r2(max(0.0, d["due_total"] - l.get("paid_total", 0)))
        a = acct_by_id.get(l.get("account_id"))
        d["account_label"] = a["label"] if a else "—"
        d["currency"] = a["currency"] if a else "USD"
        rows.append(d)
    rows.sort(key=lambda l: ({"pending": 0, "active": 1}.get(l["status"], 2), -l["created_at"]))
    return {"loans": rows[:80], "apr": db["settings"].get("loan_apr")}


@route("POST", "/api/admin/loans/{id}/review", auth="admin")
def review_loan(ctx):
    check_maintenance(ctx)
    db = ctx["db"]
    loan = store.find_loan(db, int(ctx["params"]["id"]))
    if not loan:
        raise ApiError("Loan not found.", 404)
    if loan["status"] != "pending":
        raise ApiError("Only pending loans can be reviewed.")
    decision = ctx["body"].get("decision")
    note = (ctx["body"].get("note") or "").strip()[:140]
    u = store.find_user(db, loan["user_id"])
    acct = store.find_account(db, loan.get("account_id"))
    if decision == "approve":
        if not acct:
            raise ApiError("The customer's disbursement account no longer exists.")
        if acct.get("frozen"):
            raise ApiError("Disbursement account is frozen — unfreeze it first.")
        loan["status"] = "active"
        loan["disbursed_at"] = store.now_ms()
        loan["review_note"] = note
        loan["next_due_at"] = store.now_ms() + 30 * store.DAY_MS
        store.post(db, acct, loan["principal"], "loan_disbursement",
                   counterparty="Zentra Loans", note="Loan #%d disbursed · %dm @ %.1f%%"
                   % (loan["id"], loan["term_months"], loan["apr"]))
        if u:
            store.notify(db, u["id"], "Loan approved 🎉",
                         "%s has been deposited into %s."
                         % (store.fmt_money(loan["principal"], acct["currency"]), acct["label"]))
        store.audit(db, ctx["user"], "admin.loan_approve", "loan:%d" % loan["id"],
                    severity="critical", amount=loan["principal"])
    elif decision == "reject":
        loan["status"] = "rejected"
        loan["reviewed_at"] = store.now_ms()
        loan["review_note"] = note or "Application declined."
        if u:
            store.notify(db, u["id"], "Loan application declined",
                         "Reason: %s" % loan["review_note"])
        store.audit(db, ctx["user"], "admin.loan_reject", "loan:%d" % loan["id"], severity="warn")
    else:
        raise ApiError("Decision must be approve or reject.")
    return {"ok": True}


# ------------------------------------------------------------- messages ----
@route("GET", "/api/admin/messages", auth="admin")
def messages_list(ctx):
    rows = sorted(ctx["db"]["messages"], key=lambda m: m["created_at"], reverse=True)
    return {"messages": rows[:60]}


@route("POST", "/api/admin/messages/{id}", auth="admin")
def message_update(ctx):
    db = ctx["db"]
    mid = int(ctx["params"]["id"])
    msg = next((m for m in db["messages"] if m["id"] == mid), None)
    if not msg:
        raise ApiError("Message not found.", 404)
    b = ctx["body"]
    reply = (b.get("reply") or "").strip()[:600]
    if reply:
        msg["reply"] = reply
        msg["replied_at"] = store.now_ms()
        if msg.get("user_id"):
            store.notify(db, msg["user_id"], "Support replied",
                         "Re “%s”: %s" % (msg.get("subject")[:40], reply[:120]))
    if b.get("resolve") is not None:
        msg["status"] = "resolved" if b["resolve"] else "open"
        if msg["status"] == "resolved":
            msg["resolved_at"] = store.now_ms()
    store.audit(db, ctx["user"], "admin.message_reply" if reply else "admin.message_update",
                "message:%d" % mid)
    return {"message": msg}


# ------------------------------------------------------------ broadcast ----
@route("GET", "/api/admin/broadcasts", auth="admin")
def broadcasts_list(ctx):
    rows = sorted(ctx["db"]["broadcasts"], key=lambda b: b["created_at"], reverse=True)
    return {"broadcasts": rows[:30]}


@route("POST", "/api/admin/broadcasts", auth="admin")
def broadcast(ctx):
    db = ctx["db"]
    title = (ctx["body"].get("title") or "").strip()
    body = (ctx["body"].get("body") or "").strip()
    audience = ctx["body"].get("audience") or "all"
    if len(title) < 3 or len(body) < 3:
        raise ApiError("Give the announcement a title and a message.")
    recipients = [u for u in db["users"]
                  if not u.get("suspended") and (audience == "all" or u.get("kyc_status") == "verified")]
    for u in recipients:
        store.notify(db, u["id"], title, body)
    rec = {"id": store.nid(), "title": title[:80], "body": body[:400],
           "audience": audience, "recipients": len(recipients),
           "sent_by": ctx["user"]["email"], "created_at": store.now_ms()}
    db["broadcasts"].append(rec)
    store.audit(db, ctx["user"], "admin.broadcast", rec["id"],
                title=title, recipients=len(recipients))
    return {"broadcast": rec}


# ----------------------------------------------------------------- audit ----
@route("GET", "/api/admin/deliveries", auth="admin")
def deliveries_list(ctx):
    """Outbound email delivery log (System console)."""
    db = ctx["db"]
    rows = [{"id": d.get("id"), "to": d.get("to"), "subject": d.get("subject"),
             "ok": d.get("ok"), "created_at": d.get("created_at")}
            for d in db.get("deliveries", [])]
    rows.sort(key=lambda r: r.get("created_at", 0), reverse=True)
    counts = {"sent": sum(1 for d in db.get("deliveries", []) if d.get("ok") is True),
              "failed": sum(1 for d in db.get("deliveries", []) if d.get("ok") is False),
              "skipped": sum(1 for d in db.get("deliveries", []) if d.get("ok") is None)}
    return {"deliveries": rows[:200], "counts": counts}


@route("GET", "/api/admin/audit", auth="admin")
def audit_log(ctx):
    db = ctx["db"]
    q = (ctx["query"].get("q") or "").strip().lower()
    sev = ctx["query"].get("severity") or ""
    page = safe_int(ctx["query"].get("page"), 1, 1)
    rows = list(reversed(db["audit"]))
    if sev:
        rows = [a for a in rows if a["severity"] == sev]
    if q:
        rows = [a for a in rows
                if q in a.get("action", "").lower() or q in a.get("actor", "").lower()
                or q in str(a.get("target", "")).lower()]
    per = 20
    pages = max(1, (len(rows) + per - 1) // per)
    page = min(page, pages)
    return {"audit": rows[(page - 1) * per: page * per],
            "meta": {"total": len(rows), "page": page, "pages": pages}}
