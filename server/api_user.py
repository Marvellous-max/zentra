"""User banking endpoints: accounts, transfers, exchange, cards, payments,
loans, statements, KYC, profile, sessions, notifications."""
import calendar
import io
import random
import re
import time

import authx
import routing
import store
from api_auth import open_account
from routing import route, ApiError


# ------------------------------------------------------------- helpers ----
def get_own_account(ctx, acct_id):
    db = ctx["db"]
    try:
        acct_id = int(acct_id)
    except (TypeError, ValueError):
        raise ApiError("Choose an account.")
    acct = store.find_account(db, acct_id)
    if not acct or acct["user_id"] != ctx["user"]["id"]:
        raise ApiError("Account not found.", 404)
    return acct


def parse_amount(raw, minv=0.01, maxv=10_000_000):
    try:
        amt = store.r2(float(str(raw).replace(",", "")))
    except (TypeError, ValueError):
        raise ApiError("Enter a valid amount.")
    if amt < minv:
        raise ApiError("Minimum amount is %s." % store.fmt_money(minv))
    if amt > maxv:
        raise ApiError("Amount is too large.")
    return amt


def check_maintenance(ctx):
    if ctx["db"]["settings"].get("maintenance_mode"):
        raise ApiError("Zentra is in scheduled maintenance — money moves are paused. Try again soon.", 503)


def check_flags(ctx, key, label):
    if not ctx["db"]["settings"].get(key, True):
        raise ApiError("%s is temporarily disabled by the bank." % label, 503)


def kyc_gate(ctx, amount_usd):
    db = ctx["db"]
    threshold = float(db["settings"].get("kyc_required_over", 0) or 0)
    if threshold and amount_usd > threshold and ctx["user"].get("kyc_status") != "verified":
        raise ApiError("Transfers over %s require identity verification. Verify your ID in Settings → Verification."
                       % store.fmt_money(threshold))


def guard_account(ctx, acct):
    """A frozen account never announces itself: money moves look normal until
    the PIN step, then decline (423) exactly like a restricted profile."""
    if acct.get("frozen"):
        store.log_declined(ctx["db"], ctx["user"]["id"], "attempt",
                           "Funding account under review — transaction blocked")
        raise ApiError(
            "Transaction declined — we couldn't complete this request right now.", 423)


def enforce_active(ctx):
    """Restricted customers can sign in and browse silently; every money move is
    declined (423). No customer notification — they discover it at the PIN step.
    Each attempt is logged for the back office; on the THIRD attempt since the
    restriction began, the bank's internal team is escalated so an administrator
    sends the branded restoration email from the Declined log."""
    u = ctx["user"]
    if not u.get("restricted"):
        return
    db = ctx["db"]
    since = u.get("restricted_at") or 0
    prior = sum(1 for l in db.get("declined_logs", [])
                if l["user_id"] == u["id"] and l["kind"] == "attempt"
                and l["created_at"] >= since)
    entry = store.log_declined(db, u["id"], "attempt",
                               "Account restricted by Zentra — transaction blocked")
    if prior >= 2:                       # this is attempt #3 (or more) → escalate once
        entry["escalated"] = True
        already = any(l.get("escalated") for l in db.get("declined_logs", [])
                      if l is not entry and l["user_id"] == u["id"]
                      and l["created_at"] >= since)
        if not already:
            store.notify_admins(db, "3rd declined attempt — customer needs email",
                                "%s (%s) has hit three declined attempts on a "
                                "restricted account. Send restoration instructions "
                                "from the Declined log." % (u.get("name"), u.get("email")))
    raise ApiError(
        "Transaction declined — your account is currently restricted. "
        "Our team will email you the steps to restore it.", 423)


def require_pin(ctx):
    """Authorize outgoing money moves with the customer's 4-digit transaction PIN."""
    pin = str((ctx["body"] or {}).get("pin") or "").strip()
    if len(pin) != 4 or not pin.isdigit():
        raise ApiError("Enter your 4-digit transaction PIN to authorize this.")
    if not store.verify_pin(ctx["user"], pin):
        raise ApiError("That PIN doesn't match — transaction not authorized.", 403)


def daily_left(db, acct):
    limit = float(db["settings"].get("daily_transfer_limit", 0) or 0)
    if not limit:
        return None
    spent = store.spent_today_usd(db, acct)
    return max(0.0, store.usd_to(db, limit, "USD")) - spent


def acct_brief(a):
    # note: deliberately no "frozen" field — a frozen account must be
    # invisible to the customer (silent freeze, declines at the PIN step)
    return {"id": a["id"], "label": a["label"], "currency": a["currency"],
            "kind": a.get("kind", "checking"), "number": a["number"],
            "balance": a["balance"],
            "created_at": a.get("created_at"), "apy": None}


def enrich_tx(db, t, accounts_by_id=None):
    d = dict(t)
    if accounts_by_id is None:
        accounts_by_id = {a["id"]: a for a in db["accounts"]}
    a = accounts_by_id.get(t.get("account_id"))
    d["account_label"] = a["label"] if a else "?"
    d["account_currency"] = a["currency"] if a else "USD"
    return d


def safe_int(raw, default, lo=None, hi=None):
    try:
        v = int(raw)
    except (TypeError, ValueError):
        return default
    if lo is not None:
        v = max(lo, v)
    if hi is not None:
        v = min(hi, v)
    return v


def user_tx_query(db, uid, q=None, type_=None, status=None, account_id=None, page=1, per=12):
    rows = [t for t in db["transactions"] if t["user_id"] == uid]
    if account_id:
        rows = [t for t in rows if str(t.get("account_id")) == str(account_id)]
    if type_:
        rows = [t for t in rows if t.get("type") == type_]
    if status:
        rows = [t for t in rows if t.get("status") == status]
    if q:
        ql = q.lower()
        rows = [t for t in rows if ql in (t.get("counterparty") or "").lower()
                or ql in (t.get("note") or "").lower() or ql in (t.get("ref") or "").lower()]
    rows.sort(key=lambda t: (t["created_at"], t["id"]), reverse=True)
    total = len(rows)
    pages = max(1, (total + per - 1) // per)
    page = max(1, min(page, pages))
    return rows[(page - 1) * per: page * per], {"total": total, "page": page, "pages": pages}


# ---------------------------------------------------------------- boot ----
@route("GET", "/api/user/bootstrap", auth="user")
def bootstrap(ctx):
    """Everything the app shell needs on load."""
    db = ctx["db"]
    u = ctx["user"]
    accts = store.user_accounts(db, u["id"])
    unread = sum(1 for n in db["notifications"] if n["user_id"] == u["id"] and not n.get("read"))
    s = db["settings"]
    return {
        "user": store.public_user(u),
        "restricted": bool(u.get("restricted")),
        "unread": unread,
        "accounts": [acct_brief(a) for a in accts],
        "site_name": s["site_name"],
        "support_email": s["support_email"],
        "maintenance": bool(s.get("maintenance_mode")),
        "flags": {k: bool(s.get(k, True)) for k in
                  ("deposits_enabled", "transfers_internal_enabled", "transfers_external_enabled",
                   "payments_enabled", "exchange_enabled", "loans_enabled", "cards_enabled")},
        "fees": {"transfer_fee_pct": s.get("transfer_fee_pct"),
                 "external_fee_pct": s.get("external_fee_pct"),
                 "external_fee_min": s.get("external_fee_min"),
                 "exchange_fee_pct": s.get("exchange_fee_pct"),
                 "external_auto_limit": s.get("external_auto_limit")},
        "limits": {"max_single": s.get("max_transfer_single"),
                   "daily": s.get("daily_transfer_limit")},
        "currencies": store.CURRENCIES,
        "fx": s.get("fx", {}),
        "apy": s.get("savings_apy"),
        "routing_number": store.ROUTING_NUMBER,
        "alerts_email": store.ALERTS_EMAIL,
    }


@route("GET", "/api/user/overview", auth="user")
def overview(ctx):
    db = ctx["db"]
    u = ctx["user"]
    accts = store.user_accounts(db, u["id"])
    by_id = {a["id"]: a for a in accts}
    now = store.now_ms()
    lt = time.localtime(now / 1000)
    month_start = int(time.mktime((lt.tm_year, lt.tm_mon, 1, 0, 0, 0, 0, 0, -1)) * 1000)

    txs = [t for t in db["transactions"] if t["user_id"] == u["id"]]
    income = spend = 0.0
    by_cat = {}
    for t in txs:
        if t.get("status") not in ("completed",):
            continue
        usd = abs(store.fx_to_usd(db, t["amount"], by_id[t["account_id"]]["currency"])) if t.get("account_id") in by_id else 0
        if t["type"] in ("fee",):
            continue
        if t["amount"] > 0:
            if t["created_at"] >= month_start:
                income += usd
        elif t["amount"] < 0 and t["created_at"] >= month_start:
            spend += usd
            cat = t.get("category") or ("Transfers" if t["type"].startswith("transfer")
                                        else t["type"].replace("_", " ").title())
            by_cat[cat] = round(by_cat.get(cat, 0) + usd, 2)

    # 30-day balance history (USD-equivalent across all accounts)
    days = 30
    day_ms = store.DAY_MS
    today0 = now - (now % day_ms)
    series = []
    deltas = {}
    for t in txs:
        if t.get("status") not in ("completed", "reversed"):
            continue
        if t.get("account_id") in by_id and t["status"] == "completed":
            d = int((today0 - (t["created_at"] - (t["created_at"] % day_ms))) // day_ms)
            if 0 <= d < days:
                deltas[d] = round(deltas.get(d, 0) + store.fx_to_usd(
                    db, t["amount"], by_id[t["account_id"]]["currency"]), 2)
    total_now = sum(store.fx_to_usd(db, a["balance"], a["currency"]) for a in accts)
    running = total_now
    for d in range(0, days):
        series.append(round(running, 2))
        running -= deltas.get(d, 0.0)
    series.reverse()

    recent = sorted([t for t in txs], key=lambda t: (t["created_at"], t["id"]), reverse=True)[:8]
    loans = [l for l in db["loans"] if l["user_id"] == u["id"]]
    return {
        "totals": {
            "balance_usd": round(total_now, 2),
            "income_month": round(income, 2), "spend_month": round(spend, 2),
            "savings": round(sum(store.fx_to_usd(db, a["balance"], a["currency"])
                                 for a in accts if a.get("kind") == "savings"), 2),
        },
        "spend_by_category": sorted([{"name": k, "value": v} for k, v in by_cat.items()],
                                    key=lambda x: -x["value"])[:6],
        "history": series,
        "recent": [enrich_tx(db, t, by_id) for t in recent],
        "accounts": [acct_brief(a) for a in accts],
        "counts": {
            "active_loans": sum(1 for l in loans if l["status"] == "active"),
            "cards": sum(1 for c in db["cards"] if c["user_id"] == u["id"]),
        },
    }


# -------------------------------------------------------------- accounts --
@route("GET", "/api/user/accounts", auth="user")
def list_accounts(ctx):
    db = ctx["db"]
    accts = store.user_accounts(db, ctx["user"]["id"])
    out = []
    for a in accts:
        b = acct_brief(a)
        b["card_count"] = sum(1 for c in db["cards"] if c.get("account_id") == a["id"])
        out.append(b)
    return {"accounts": out}


@route("POST", "/api/user/accounts", auth="user")
def create_account(ctx):
    check_maintenance(ctx)
    db = ctx["db"]
    mine = store.user_accounts(db, ctx["user"]["id"])
    if len(mine) >= 6:
        raise ApiError("You can hold up to 6 accounts. Please contact support for more.")
    kind = ctx["body"].get("kind") or "checking"
    currency = ctx["body"].get("currency") or "USD"
    label = (ctx["body"].get("label") or "").strip() or \
            ("Savings" if kind == "savings" else "Everyday Checking")
    if currency not in store.CURRENCIES:
        raise ApiError("Unsupported currency.")
    if kind not in ("checking", "savings"):
        raise ApiError("Unsupported account type.")
    acct = open_account(db, ctx["user"], label[:40], kind, currency)
    store.notify(db, ctx["user"]["id"], "%s account opened" % acct["label"],
                 "Account %s is ready to use." % acct["number"])
    store.audit(db, ctx["user"], "account.open", "account:%d" % acct["id"],
                label=acct["label"], currency=currency, kind=kind)
    return {"account": acct_brief(acct)}


# --------------------------------------------------------------- deposit --
@route("GET", "/api/user/deposit-options", auth="user")
def deposit_options(ctx):
    db = ctx["db"]
    s = db["settings"]
    return {"min_deposit": s.get("min_deposit"), "enabled": bool(s.get("deposits_enabled", True))}


@route("POST", "/api/user/deposits", auth="user")
def deposit(ctx):
    enforce_active(ctx)
    check_maintenance(ctx)
    check_flags(ctx, "deposits_enabled", "Deposits")
    db = ctx["db"]
    acct = get_own_account(ctx, ctx["body"].get("account_id"))
    guard_account(ctx, acct)
    amt = parse_amount(ctx["body"].get("amount"), float(db["settings"].get("min_deposit", 5)))
    method = ctx["body"].get("method") or "bank"
    if method not in ("card", "bank", "mobile"):
        method = "bank"
    labels = {"card": "Card top-up", "bank": "Bank transfer", "mobile": "Mobile money"}
    # deposits are credits: held as PENDING until an administrator approves them
    t = store.post(db, acct, amt, "deposit", status="pending", counterparty=labels[method],
                   note="Top-up request · %s" % method, method=method)
    store.notify_admins(db, "Deposit approval needed",
                        "%s requested a %s top-up of %s into %s."
                        % (ctx["user"]["name"], labels[method].lower(),
                           store.fmt_money(amt, acct["currency"]), acct["label"]))
    store.notify(db, ctx["user"]["id"], "Top-up pending approval",
                 "%s into %s is being reviewed — you'll be notified once it lands."
                 % (store.fmt_money(amt, acct["currency"]), acct["label"]),
                 link="#/app/statements")
    store.audit(db, ctx["user"], "deposit.request", "txn:%d" % t["id"], severity="warn",
                amount=amt, currency=acct["currency"], method=method)
    return {"pending": True, "transaction": enrich_tx(db, t), "account": acct_brief(acct)}


# -------------------------------------------------------------- transfers --
def _find_dest_by_email(db, email, currency, self_uid):
    user = store.find_user_by_email(db, email)
    if not user:
        return None, None, "No Zentra customer found with that email."
    if user["id"] == self_uid:
        return None, None, "Use “Between my accounts” to move money to yourself."
    for a in db["accounts"]:
        if a["user_id"] == user["id"] and a["currency"] == currency and not a.get("frozen") \
                and a.get("kind", "checking") == "checking":
            return user, a, None
    for a in db["accounts"]:
        if a["user_id"] == user["id"] and a["currency"] == currency:
            return user, a, None
    return user, None, ("%s has no %s account to receive transfers." % (user["name"], currency))


@route("POST", "/api/user/transfers", auth="user")
def transfer(ctx):
    enforce_active(ctx)
    check_maintenance(ctx)
    db = ctx["db"]
    b = ctx["body"]
    mode = b.get("mode")  # own | zentra | external
    acct = get_own_account(ctx, b.get("from_account_id"))
    guard_account(ctx, acct)
    amt = parse_amount(b.get("amount"))
    note = (b.get("note") or "").strip()
    require_pin(ctx)

    if mode == "own":
        check_flags(ctx, "transfers_internal_enabled", "Internal transfers")
        dest = get_own_account(ctx, b.get("to_account_id"))
        guard_account(ctx, dest)
        if dest["id"] == acct["id"]:
            raise ApiError("Pick two different accounts.")
        if dest["currency"] != acct["currency"]:
            raise ApiError("Currencies differ — use Exchange instead.")
        pair = store.pair_id()
        out = store.post(db, acct, -amt, "transfer_out", counterparty=dest["label"],
                         note=note or "To %s" % dest["label"], pair=pair)
        inn = store.post(db, dest, amt, "transfer_in", counterparty=acct["label"],
                         note=note or "From %s" % acct["label"], pair=pair)
        store.audit(db, ctx["user"], "transfer.internal", "txn:%d" % out["id"], amount=amt,
                    currency=acct["currency"])
        return {"ok": True, "account": acct_brief(acct), "transactions": [enrich_tx(db, out), enrich_tx(db, inn)]}

    if mode == "zentra":
        check_flags(ctx, "transfers_internal_enabled", "Internal transfers")
        dest_user, dest, err = _find_dest_by_email(db, (b.get("to_email") or "").strip().lower(),
                                                   acct["currency"], ctx["user"]["id"])
        if err:
            raise ApiError(err)
        # verify the recipient account number the customer entered
        to_num = "".join(str(b.get("to_account_number") or "").split())
        if not re.fullmatch(r"\d{9,16}", to_num):
            raise ApiError("Enter the recipient's account number (digits only, 9–16).")
        if to_num != dest["number"].replace(" ", ""):
            raise ApiError("That account number doesn't match our records for this customer.")
        to_bank = (b.get("to_bank_name") or "").strip()[:40] or "Zentra Bank"
        fee = store.r2(amt * float(db["settings"].get("transfer_fee_pct", 0)) / 100.0)
        kyc_gate(ctx, store.fx_to_usd(db, amt, acct["currency"]))
        left = daily_left(db, acct)
        if left is not None and store.fx_to_usd(db, amt + fee, acct["currency"]) > left:
            raise ApiError("Daily transfer limit reached (%s remaining)." %
                           store.fmt_money(max(left, 0), acct["currency"]))
        single = float(db["settings"].get("max_transfer_single", 0) or 0)
        if single and store.fx_to_usd(db, amt, acct["currency"]) > single:
            raise ApiError("Single-transfer limit is %s." % store.fmt_money(single))
        need = amt + fee
        if acct["balance"] < need:
            raise ApiError("Insufficient funds — you need %s incl. fees."
                           % store.fmt_money(need, acct["currency"]))
        name = dest_user["name"].split()[0].title()
        pair = store.pair_id()
        out = store.post(db, acct, -need, "transfer_out", counterparty=name,
                         note=note or "To %s" % name, method="internal",
                         fee=fee, pair=pair,
                         extra={"dest_bank": to_bank, "dest_account": dest["number"]})
        inn = store.post(db, dest, amt, "transfer_in", counterparty=_first(ctx["user"]["name"]),
                         note=note or "From %s" % _first(ctx["user"]["name"]), method="internal", pair=pair)
        store.notify(db, dest_user["id"], "Money received",
                     "%s sent you %s." % (_first(ctx["user"]["name"]),
                                          store.fmt_money(amt, dest["currency"])),
                     link="#/app/statements")
        store.notify(db, ctx["user"]["id"], "Transfer sent",
                     "%s to %s · %s completed." % (store.fmt_money(amt, acct["currency"]), name, to_bank),
                     link="#/app/statements")
        store.audit(db, ctx["user"], "transfer.zentra", "txn:%d" % out["id"], amount=amt,
                    currency=acct["currency"], to=dest_user["email"],
                    bank=to_bank, acct_last4=dest["number"].replace(" ", "")[-4:])
        return {"ok": True, "account": acct_brief(acct), "transactions": [enrich_tx(db, out), enrich_tx(db, inn)]}

    if mode == "external":
        check_flags(ctx, "transfers_external_enabled", "External transfers")
        s = db["settings"]
        ben_name = (b.get("beneficiary_name") or "").strip()
        ben_bank = (b.get("beneficiary_bank") or "").strip() or "External bank"
        ben_num = (b.get("beneficiary_number") or "").strip()
        ben_id = b.get("beneficiary_id")
        if ben_id:
            ben = next((x for x in db["beneficiaries"]
                        if x["id"] == int(ben_id) and x["user_id"] == ctx["user"]["id"]), None)
            if not ben:
                raise ApiError("Beneficiary not found.")
            ben_name, ben_bank, ben_num = ben["name"], ben["bank"], ben["account_number"]
        if not (ben_name and ben_num):
            raise ApiError("Beneficiary name and account number are required.")
        fee = max(store.r2(amt * float(s.get("external_fee_pct", 0)) / 100.0),
                  float(s.get("external_fee_min", 0) or 0))
        kyc_gate(ctx, store.fx_to_usd(db, amt, acct["currency"]))
        single = float(s.get("max_transfer_single", 0) or 0)
        if single and store.fx_to_usd(db, amt, acct["currency"]) > single:
            raise ApiError("Single-transfer limit is %s." % store.fmt_money(single))
        left = daily_left(db, acct)
        if left is not None and store.fx_to_usd(db, amt + fee, acct["currency"]) > left:
            raise ApiError("Daily transfer limit reached (%s remaining)." %
                           store.fmt_money(max(left, 0), acct["currency"]))
        if acct["balance"] < amt + fee:
            raise ApiError("Insufficient funds — you need %s incl. fees."
                           % store.fmt_money(amt + fee, acct["currency"]))
        auto = float(s.get("external_auto_limit", 0) or 0)
        goes_pending = store.fx_to_usd(db, amt, acct["currency"]) > auto
        status = "pending" if goes_pending else "completed"
        out = store.post(db, acct, -(amt + fee), "transfer_out", status=status,
                         counterparty=ben_name, note=note or "To %s · %s" % (ben_name, ben_bank),
                         method="external", fee=fee,
                         extra={"ext_bank": ben_bank[:60], "ext_number": ben_num[-4:]})
        if goes_pending:
            store.notify_admins(db, "Payout approval needed",
                                "%s requested an external payout of %s to %s."
                                % (ctx["user"]["name"], store.fmt_money(amt, acct["currency"]), ben_name))
            store.notify(db, ctx["user"]["id"], "Payout pending approval",
                         "Your transfer of %s to %s is being reviewed by our team — "
                         "typical approval within a few hours."
                         % (store.fmt_money(amt, acct["currency"]), ben_name),
                         link="#/app/statements")
            store.audit(db, ctx["user"], "payout.request", "txn:%d" % out["id"], amount=amt,
                        severity="warn", to=ben_name)
        else:
            store.notify(db, ctx["user"]["id"], "Payout sent",
                         "%s was sent to %s." % (store.fmt_money(amt, acct["currency"]), ben_name),
                         link="#/app/statements")
            store.audit(db, ctx["user"], "payout.sent", "txn:%d" % out["id"], amount=amt, to=ben_name)
        return {"ok": True, "pending": goes_pending, "account": acct_brief(acct),
                "transactions": [enrich_tx(db, out)]}

    raise ApiError("Unknown transfer type.")


def _first(name):
    return (name or "").split()[0].title()


@route("GET", "/api/user/beneficiaries", auth="user")
def list_beneficiaries(ctx):
    db = ctx["db"]
    rows = [b for b in db["beneficiaries"] if b["user_id"] == ctx["user"]["id"]]
    return {"beneficiaries": rows}


@route("POST", "/api/user/beneficiaries", auth="user")
def add_beneficiary(ctx):
    b = ctx["body"]
    name = (b.get("name") or "").strip()
    bank = (b.get("bank") or "").strip() or "External bank"
    num = (b.get("account_number") or "").strip()
    if len(name) < 2 or len(num) < 4:
        raise ApiError("Beneficiary needs at least a name and account number.")
    rec = {"id": store.nid(), "user_id": ctx["user"]["id"], "name": name[:60],
           "bank": bank[:60], "account_number": num[:34],
           "created_at": store.now_ms()}
    ctx["db"]["beneficiaries"].append(rec)
    return {"beneficiary": rec}


@route("DELETE", "/api/user/beneficiaries/{id}", auth="user")
def del_beneficiary(ctx):
    db = ctx["db"]
    bid = int(ctx["params"]["id"])
    db["beneficiaries"] = [x for x in db["beneficiaries"]
                           if not (x["id"] == bid and x["user_id"] == ctx["user"]["id"])]
    return {"ok": True}


# --------------------------------------------------------------- exchange --
@route("GET", "/api/user/exchange/quote", auth="user")
def quote(ctx):
    db = ctx["db"]
    fx = db["settings"]["fx"]
    try:
        frm = ctx["query"].get("from", "USD")
        to = ctx["query"].get("to", "EUR")
        amt = float(ctx["query"].get("amount", "100"))
    except ValueError:
        raise ApiError("Invalid quote parameters.")
    if frm not in fx or to not in fx:
        raise ApiError("Unsupported currency.")
    rate = fx[to] / fx[frm]
    fee_pct = float(db["settings"].get("exchange_fee_pct", 0))
    gross = store.r2(amt * rate)
    fee = store.r2(gross * fee_pct / 100.0)
    return {"rate": round(rate, 6), "gross": gross, "fee": fee,
            "net": store.r2(gross - fee), "fee_pct": fee_pct}


@route("POST", "/api/user/exchange", auth="user")
def exchange(ctx):
    enforce_active(ctx)
    check_maintenance(ctx)
    check_flags(ctx, "exchange_enabled", "Currency exchange")
    db = ctx["db"]
    b = ctx["body"]
    src = get_own_account(ctx, b.get("from_account_id"))
    dst = get_own_account(ctx, b.get("to_account_id"))
    guard_account(ctx, src)
    guard_account(ctx, dst)
    if src["id"] == dst["id"]:
        raise ApiError("Pick two different accounts.")
    if src["currency"] == dst["currency"]:
        raise ApiError("Use Transfer between accounts of the same currency.")
    amt = parse_amount(b.get("amount"))
    if src["balance"] < amt:
        raise ApiError("Insufficient funds.")
    fx = db["settings"]["fx"]
    rate = fx[dst["currency"]] / fx[src["currency"]]
    fee_pct = float(db["settings"].get("exchange_fee_pct", 0))
    gross = store.r2(amt * rate)
    net = store.r2(gross * (1 - fee_pct / 100.0))
    pair = store.pair_id()
    out = store.post(db, src, -amt, "exchange_out", counterparty="%s wallet" % dst["currency"],
                     note="Exchanged @ %.4f" % rate, pair=pair)
    inn = store.post(db, dst, net, "exchange_in", counterparty="%s wallet" % src["currency"],
                     note="Exchanged @ %.4f (fee %.2f%%)" % (rate, fee_pct), fee=store.r2(gross - net),
                     pair=pair)
    store.notify(db, ctx["user"]["id"], "Exchange completed",
                 "%s → %s @ %.4f" % (store.fmt_money(amt, src["currency"]),
                                     store.fmt_money(net, dst["currency"]), rate))
    store.audit(db, ctx["user"], "exchange", "txn:%d" % out["id"], amount=amt,
                frm=src["currency"], to=dst["currency"], rate=round(rate, 4))
    return {"ok": True, "account": acct_brief(src), "transactions": [enrich_tx(db, out), enrich_tx(db, inn)],
            "rate": round(rate, 6)}


# ----------------------------------------------------------- transactions --
@route("GET", "/api/user/transactions", auth="user")
def transactions(ctx):
    db = ctx["db"]
    q = ctx["query"]
    rows, meta = user_tx_query(db, ctx["user"]["id"],
                               q=q.get("q"), type_=q.get("type") or None,
                               status=q.get("status") or None,
                               account_id=q.get("account_id") or None,
                               page=safe_int(q.get("page"), 1, 1),
                               per=min(safe_int(q.get("per"), 12, 1), 50))
    return {"transactions": [enrich_tx(db, t) for t in rows], "meta": meta}


@route("GET", "/api/user/statement.csv", auth="user")
def statement_csv(ctx):
    db = ctx["db"]
    q = ctx["query"]
    acct = get_own_account(ctx, q.get("account_id"))
    month = q.get("month") or ""
    rows = [t for t in db["transactions"] if t.get("account_id") == acct["id"]]
    if len(month) == 7 and month[4] == "-":
        y, m = int(month[:4]), int(month[5:7])
        start = time.mktime((y, m, 1, 0, 0, 0, 0, 0, -1))
        end_year, end_month = (y + 1, 1) if m == 12 else (y, m + 1)
        end = time.mktime((end_year, end_month, 1, 0, 0, 0, 0, 0, -1))
        rows = [t for t in rows if start * 1000 <= t["created_at"] < end * 1000]
    rows.sort(key=lambda t: (t["created_at"], t["id"]))

    def csv_esc(v):
        v = str(v or "")
        return '"' + v.replace('"', '""') + '"' if ('"' in v or "," in v) else v

    buf = io.StringIO()
    buf.write("Date,Reference,Description,Category,Type,Amount,Balance\r\n")
    for t in rows:
        desc = (t.get("counterparty") or "") + ((" — " + t["note"]) if t.get("note") else "")
        buf.write("%s,%s,%s,%s,%s,%s,%s\r\n" % (
            store.fmt_dt(t["created_at"]), t["ref"], csv_esc(desc),
            csv_esc(t.get("category") or t["type"]), t["status"],
            "%.2f" % t["amount"], "%.2f" % (t.get("balance_after") if t.get("balance_after") is not None else 0)))
    store.audit(db, ctx["user"], "statement.download", "account:%d" % acct["id"], month=month)
    fname = "zentra-statement-%s-%s.csv" % (acct["number"].replace(" ", ""), month or "all")
    return routing.RawResponse(buf.getvalue(), "text/csv; charset=utf-8",
                               disposition='attachment; filename="%s"' % fname)


# ------------------------------------------------------------------ cards --
def card_view(c, reveal=False):
    d = {k: c[k] for k in ("id", "account_id", "label", "brand", "masked", "last4",
                           "exp_month", "exp_year", "frozen", "type", "status", "created_at")}
    d["limit_monthly"] = c.get("limit_monthly")
    if reveal:
        d["number"] = c["number"]
        d["cvv"] = c["cvv"]
    return d


@route("GET", "/api/user/cards", auth="user")
def cards(ctx):
    db = ctx["db"]
    mine = [card_view(c) for c in db["cards"] if c["user_id"] == ctx["user"]["id"]]
    return {"cards": mine, "max_virtual": db["settings"].get("max_virtual_cards", 3),
            "issue_fee": db["settings"].get("card_issue_fee", 0),
            "enabled": bool(db["settings"].get("cards_enabled", True))}


@route("POST", "/api/user/cards", auth="user")
def new_card(ctx):
    enforce_active(ctx)
    check_maintenance(ctx)
    check_flags(ctx, "cards_enabled", "Card issuing")
    db = ctx["db"]
    b = ctx["body"]
    acct = get_own_account(ctx, b.get("account_id"))
    guard_account(ctx, acct)
    ctype = b.get("type") or "virtual"
    if ctype not in ("virtual", "physical"):
        raise ApiError("Unknown card type.")
    virtuals = sum(1 for c in db["cards"] if c["user_id"] == ctx["user"]["id"]
                   and c["type"] == "virtual" and c["status"] == "active")
    if ctype == "virtual" and virtuals >= int(db["settings"].get("max_virtual_cards", 3)):
        raise ApiError("You already hold %d active virtual cards." % virtuals)
    fee = float(db["settings"].get("card_issue_fee", 0) or 0) if ctype == "physical" else 0.0
    if fee and acct["balance"] < fee:
        raise ApiError("Physical cards cost a %s issue fee — insufficient funds."
                       % store.fmt_money(fee, acct["currency"]))
    num = store.gen_card_number()
    now_t = time.gmtime()
    year = now_t.tm_year + 4
    card = {
        "id": store.nid(), "user_id": ctx["user"]["id"], "account_id": acct["id"],
        "label": ((b.get("label") or ("Travel" if ctype == "virtual" else "Metal")).strip() or "Card")[:24],
        "brand": "VISA", "number": num,
        "masked": "\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 " + num[-4:],
        "last4": num[-4:], "exp_month": "%02d" % ((now_t.tm_mon % 12) + 1),
        "exp_year": str(year)[-4:], "cvv": "%03d" % random.randint(100, 999),
        "frozen": False, "type": ctype,
        "status": "ordered" if ctype == "physical" else "active",
        "limit_monthly": None, "created_at": store.now_ms(),
    }
    db["cards"].append(card)
    if fee:
        store.post(db, acct, -fee, "fee", counterparty="Zentra Bank",
                   note="Physical card issue fee")
    store.notify(db, ctx["user"]["id"], "Card issued",
                 "Your %s card \u2022%s is ready." % (ctype, card["last4"]))
    store.audit(db, ctx["user"], "card.issue", "card:%d" % card["id"], type=ctype)
    return {"card": card_view(card, reveal=True), "account": acct_brief(acct)}


@route("POST", "/api/user/cards/{id}/freeze", auth="user")
def freeze_card(ctx):
    db = ctx["db"]
    card = store.find_card(db, int(ctx["params"]["id"]))
    if not card or card["user_id"] != ctx["user"]["id"]:
        raise ApiError("Card not found.", 404)
    frozen = bool(ctx["body"].get("frozen", True))
    card["frozen"] = frozen
    store.audit(db, ctx["user"], "card.freeze" if frozen else "card.unfreeze",
                "card:%d" % card["id"])
    return {"card": card_view(card)}


@route("PUT", "/api/user/cards/{id}/limit", auth="user")
def card_limit(ctx):
    db = ctx["db"]
    card = store.find_card(db, int(ctx["params"]["id"]))
    if not card or card["user_id"] != ctx["user"]["id"]:
        raise ApiError("Card not found.", 404)
    raw = ctx["body"].get("limit_monthly")
    card["limit_monthly"] = None if raw in (None, "", 0) else parse_amount(raw, 1)
    return {"card": card_view(card)}


# ------------------------------------------------------------- payments ---
BILL_CATEGORIES = [
    {"key": "electricity", "name": "Electricity", "icon": "zap"},
    {"key": "water", "name": "Water & Sewage", "icon": "droplet"},
    {"key": "internet", "name": "Internet & TV", "icon": "wifi"},
    {"key": "airtime", "name": "Phone Airtime", "icon": "smartphone"},
    {"key": "rent", "name": "Rent", "icon": "home"},
    {"key": "insurance", "name": "Insurance", "icon": "shield"},
    {"key": "education", "name": "Education", "icon": "book"},
    {"key": "charity", "name": "Charity", "icon": "heart"},
]


@route("GET", "/api/user/pay/catalog", auth="user")
def pay_catalog(ctx):
    db = ctx["db"]
    mine = {}
    for t in db["transactions"]:
        if t["user_id"] == ctx["user"]["id"] and t["type"] == "payment" and t.get("counterparty"):
            mine.setdefault(t["counterparty"], {"name": t["counterparty"],
                                                "category": t.get("category"),
                                                "count": 0})
            mine[t["counterparty"]]["count"] += 1
    return {"categories": BILL_CATEGORIES, "recent_payees": list(mine.values()),
            "enabled": bool(db["settings"].get("payments_enabled", True))}


@route("POST", "/api/user/payments", auth="user")
def pay_bill(ctx):
    enforce_active(ctx)
    check_maintenance(ctx)
    check_flags(ctx, "payments_enabled", "Bill payments")
    db = ctx["db"]
    b = ctx["body"]
    acct = get_own_account(ctx, b.get("account_id"))
    guard_account(ctx, acct)
    amt = parse_amount(b.get("amount"))
    biller = (b.get("biller") or "").strip()
    category = (b.get("category") or "").strip() or "other"
    ref_no = (b.get("customer_ref") or "").strip()
    if not biller:
        raise ApiError("Who are you paying? Enter the biller name.")
    require_pin(ctx)
    if acct["balance"] < amt:
        raise ApiError("Insufficient funds.")
    t = store.post(db, acct, -amt, "payment", counterparty=biller[:80], category=category[:30],
                   note=("Customer ref %s" % ref_no) if ref_no else "", method="bill")
    store.notify(db, ctx["user"]["id"], "Payment successful",
                 "%s paid to %s." % (store.fmt_money(amt, acct["currency"]), biller),
                 link="#/app/statements")
    store.audit(db, ctx["user"], "payment.bill", "txn:%d" % t["id"], amount=amt, biller=biller)
    return {"transaction": enrich_tx(db, t), "account": acct_brief(acct)}


# ----------------------------------------------------------------- loans ---
def loan_amortize(principal, apr_pct, months):
    r = apr_pct / 100.0 / 12.0
    if r <= 0:
        return principal / months
    return principal * r * (1 + r) ** months / (((1 + r) ** months) - 1)


def loan_view(db, l):
    d = dict(l)
    d["paid_total"] = store.r2(l.get("paid_total", 0))
    d["due_total"] = store.r2(l["monthly_payment"] * l["term_months"])
    d["remaining"] = store.r2(max(0.0, d["due_total"] - d["paid_total"]))
    d["progress"] = int(min(100, round(d["paid_total"] / d["due_total"] * 100))) if d["due_total"] else 0
    acct = store.find_account(db, l.get("account_id"))
    d["account_label"] = acct["label"] if acct else "—"
    return d


@route("GET", "/api/user/loans", auth="user")
def my_loans(ctx):
    db = ctx["db"]
    rows = [loan_view(db, l) for l in db["loans"] if l["user_id"] == ctx["user"]["id"]]
    rows.sort(key=lambda l: l["created_at"], reverse=True)
    s = db["settings"]
    return {"loans": rows, "apr": s.get("loan_apr"), "min_loan": s.get("min_loan"),
            "max_loan": s.get("max_loan"), "terms": s.get("loan_terms_months", [12]),
            "enabled": bool(s.get("loans_enabled", True))}


@route("POST", "/api/user/loans", auth="user")
def request_loan(ctx):
    enforce_active(ctx)
    check_maintenance(ctx)
    check_flags(ctx, "loans_enabled", "Loans")
    db = ctx["db"]
    if ctx["user"].get("kyc_status") != "verified":
        raise ApiError("Identity verification is required before requesting a loan. "
                       "Verify in Settings → Verification.")
    b = ctx["body"]
    acct = get_own_account(ctx, b.get("account_id"))
    guard_account(ctx, acct)
    amt = parse_amount(b.get("amount"), float(db["settings"].get("min_loan", 500)),
                       float(db["settings"].get("max_loan", 50000)))
    term = int(b.get("term_months") or 12)
    terms = [int(x) for x in db["settings"].get("loan_terms_months", [12])]
    if term not in terms:
        term = terms[0] if terms else 12
    purpose = (b.get("purpose") or "").strip()[:120]
    apr = float(db["settings"].get("loan_apr", 9.9))
    monthly = store.r2(loan_amortize(amt, apr, term))
    loan = {
        "id": store.nid(), "user_id": ctx["user"]["id"], "account_id": acct["id"],
        "principal": amt, "apr": apr, "term_months": term,
        "monthly_payment": monthly, "purpose": purpose,
        "status": "pending", "paid_total": 0.0,
        "created_at": store.now_ms(), "reviewed_at": None, "review_note": "",
    }
    db["loans"].append(loan)
    store.notify_admins(db, "New loan request",
                        "%s requested %s over %dm @ %.1f%%."
                        % (ctx["user"]["name"], store.fmt_money(amt, acct["currency"]), term, apr))
    store.notify(db, ctx["user"]["id"], "Loan request submitted",
                 "We're reviewing your request for %s — you'll be notified shortly."
                 % store.fmt_money(amt, acct["currency"]))
    store.audit(db, ctx["user"], "loan.request", "loan:%d" % loan["id"], amount=amt, term=term,
                severity="warn")
    return {"loan": loan_view(db, loan)}


@route("POST", "/api/user/loans/{id}/pay", auth="user")
def repay_loan(ctx):
    check_maintenance(ctx)
    db = ctx["db"]
    loan = store.find_loan(db, int(ctx["params"]["id"]))
    if not loan or loan["user_id"] != ctx["user"]["id"]:
        raise ApiError("Loan not found.", 404)
    if loan["status"] != "active":
        raise ApiError("This loan isn't in repayment yet.")
    view = loan_view(db, loan)
    b = ctx["body"]
    acct = get_own_account(ctx, b.get("account_id") or loan.get("account_id"))
    guard_account(ctx, acct)
    amt = parse_amount(b.get("amount"))
    amt = min(amt, view["remaining"])
    if amt <= 0:
        raise ApiError("This loan is already settled.")
    if acct["balance"] < amt:
        raise ApiError("Insufficient funds.")
    store.post(db, acct, -amt, "loan_payment", counterparty="Zentra Loans",
               note="Repayment · loan #%d" % loan["id"])
    loan["paid_total"] = store.r2(loan.get("paid_total", 0) + amt)
    if loan["paid_total"] >= view["due_total"] - 0.005:
        loan["status"] = "repaid"
        loan["closed_at"] = store.now_ms()
        store.notify(db, ctx["user"]["id"], "Loan settled 🎉",
                     "Loan #%d is fully repaid. Congratulations!" % loan["id"])
    store.audit(db, ctx["user"], "loan.repay", "loan:%d" % loan["id"], amount=amt)
    return {"loan": loan_view(db, loan), "account": acct_brief(acct)}


# --------------------------------------------- withdraw pending requests --
@route("POST", "/api/user/requests/{id}/cancel", auth="user")
def cancel_request(ctx):
    """Customer withdraws their own request while it is still awaiting approval.

    Covers pending top-ups (nothing moved yet) and pending external payouts
    (the held amount + fee flows back into the balance immediately).
    """
    enforce_active(ctx)
    db = ctx["db"]
    try:
        tid = int(ctx["params"]["id"])
    except (TypeError, ValueError):
        raise ApiError("Bad request id.", 400)
    t = next((x for x in db["transactions"] if x["id"] == tid), None)
    acct = store.find_account(db, t["account_id"]) if t else None
    if not t or not acct or acct["user_id"] != ctx["user"]["id"]:
        raise ApiError("Request not found.", 404)
    if t["status"] != "pending":
        raise ApiError("This request has already been processed and can no longer be cancelled.", 400)

    cur = t.get("currency") or acct["currency"]
    amt = store.fmt_money(abs(t["amount"]) - (t.get("fee") or 0), cur)
    store.complete_pending(db, t["id"], approve=False)   # refunds outgoing holds
    t["status"] = "cancelled"                            # customer-initiated ≠ rejected
    t["note"] = ((t.get("note") or "") + " · cancelled by you")[:200]
    t["cancelled_at"] = store.now_ms()

    if t["type"] == "deposit":
        store.notify_admins(db, "Top-up request withdrawn",
                            "%s withdrew their %s top-up request before review."
                            % (ctx["user"]["name"], amt))
        store.notify(db, ctx["user"]["id"], "Top-up request cancelled",
                     "Your %s top-up request was cancelled. Nothing left your account."
                     % amt, link="#/app/statements")
        store.audit(db, ctx["user"], "deposit.cancel", "txn:%d" % t["id"],
                    severity="info", amount=abs(t["amount"]))
    else:
        store.notify_admins(db, "Payout request withdrawn",
                            "%s cancelled their pending %s payout to %s — held funds "
                            "returned to their balance." % (ctx["user"]["name"], amt,
                                                            t.get("counterparty") or "external bank"))
        store.notify(db, ctx["user"]["id"], "Payout cancelled",
                     "Your %s payout to %s was cancelled and the funds are back in your %s."
                     % (amt, t.get("counterparty") or "external bank", acct["label"]),
                     link="#/app/statements")
        store.audit(db, ctx["user"], "payout.cancel", "txn:%d" % t["id"],
                    severity="info", amount=abs(t["amount"]))
    return {"ok": True, "transaction": enrich_tx(db, t), "account": acct_brief(acct)}


@route("POST", "/api/user/loans/{id}/cancel", auth="user")
def cancel_loan_request(ctx):
    """Customer withdraws a loan application that is still under review."""
    enforce_active(ctx)
    db = ctx["db"]
    try:
        lid = int(ctx["params"]["id"])
    except (TypeError, ValueError):
        raise ApiError("Bad loan id.", 400)
    loan = store.find_loan(db, lid)
    if not loan or loan["user_id"] != ctx["user"]["id"]:
        raise ApiError("Loan not found.", 404)
    if loan["status"] != "pending":
        raise ApiError("Only applications still under review can be withdrawn.", 400)
    acct = store.find_account(db, loan["account_id"])
    cur = acct["currency"] if acct else "USD"
    loan["status"] = "cancelled"
    loan["closed_at"] = store.now_ms()
    amt = store.fmt_money(loan["principal"], cur)
    store.notify_admins(db, "Loan application withdrawn",
                        "%s withdrew their %s loan application before review."
                        % (ctx["user"]["name"], amt))
    store.notify(db, ctx["user"]["id"], "Loan application withdrawn",
                 "Your %s loan application was withdrawn — nothing was owed or disbursed." % amt,
                 link="#/app/loans")
    store.audit(db, ctx["user"], "loan.cancel", "loan:%d" % loan["id"],
                severity="info", amount=loan["principal"])
    return {"ok": True, "loan": loan}


# ------------------------------------------------------------------- kyc --
@route("POST", "/api/user/kyc", auth="user")
def submit_kyc(ctx):
    b = ctx["body"]
    doc_type = (b.get("doc_type") or "").strip()
    doc_name = (b.get("doc_name") or "").strip()
    if doc_type not in ("passport", "drivers_license", "national_id"):
        raise ApiError("Choose a document type.")
    if len(doc_name) < 3:
        raise ApiError("Attach a document image (file name required in this demo).")
    u = ctx["user"]
    if u.get("kyc_status") == "verified":
        return {"user": store.public_user(u)}
    u["kyc_status"] = "pending"
    u["kyc_doc"] = "%s:%s" % (doc_type, doc_name[:80])
    u["kyc_note"] = ""
    u["kyc_submitted_at"] = store.now_ms()
    store.notify_admins(ctx["db"], "KYC review needed",
                        "%s submitted a %s for verification." % (u["name"], doc_type.replace("_", " ")))
    store.notify(ctx["db"], u["id"], "Documents received",
                 "We're verifying your identity — this usually takes under a day.")
    store.audit(ctx["db"], u, "kyc.submit", "user:%d" % u["id"], doc=doc_type)
    return {"user": store.public_user(u)}


# --------------------------------------------------------------- profile --
@route("PUT", "/api/user/profile", auth="user")
def update_profile(ctx):
    b = ctx["body"]
    u = ctx["user"]
    name = (b.get("name") or u["name"]).strip()
    if len(name) < 2:
        raise ApiError("Name looks too short.")
    u["name"] = name[:60]
    u["phone"] = (b.get("phone") or "").strip()[:24]
    u["address"] = (b.get("address") or "").strip()[:140]
    u["country"] = (b.get("country") or "").strip()[:40]
    prefs = b.get("prefs")
    if isinstance(prefs, dict):
        u["prefs"] = {"email_alerts": bool(prefs.get("email_alerts", True)),
                      "push_alerts": bool(prefs.get("push_alerts", True))}
    store.audit(ctx["db"], u, "profile.update", "user:%d" % u["id"])
    return {"user": store.public_user(u)}


@route("PUT", "/api/user/password", auth="user")
def change_password(ctx):
    import authx as ax
    b = ctx["body"]
    cur = b.get("current") or ""
    new = b.get("new") or ""
    if not ax.verify_password(cur, ctx["user"]["password"]):
        raise ApiError("Your current password is incorrect.")
    if not _valid_pw(new):
        raise ApiError("New password must be 8+ characters and mix letters with numbers.")
    ctx["user"]["password"] = ax.hash_password(new)
    store.audit(ctx["db"], ctx["user"], "auth.password_change", "user:%d" % ctx["user"]["id"],
                severity="warn")
    return {"ok": True}


@route("PUT", "/api/user/pin", auth="user")
def change_pin(ctx):
    b = ctx["body"]
    cur = str(b.get("current") or "").strip()
    new = str(b.get("new") or "").strip()
    if not store.verify_pin(ctx["user"], cur):
        raise ApiError("Your current transaction PIN is incorrect.", 403)
    if not (len(new) == 4 and new.isdigit()):
        raise ApiError("New PIN must be exactly 4 digits.")
    if new == cur:
        raise ApiError("Pick a PIN different from your current one.")
    ctx["user"]["tx_pin"] = store.hash_pin(new)
    store.audit(ctx["db"], ctx["user"], "auth.pin_change", "user:%d" % ctx["user"]["id"],
                severity="warn")
    store.notify(ctx["db"], ctx["user"]["id"], "Transaction PIN changed",
                 "Your 4-digit transaction PIN was updated. If this wasn't you, "
                 "contact support immediately.", link="#/app/settings")
    return {"ok": True}


def _valid_pw(pw):
    return bool(pw) and len(pw) >= 8 and any(c.isdigit() for c in pw) and any(c.isalpha() for c in pw)


# --------------------------------------------------------------- sessions --
@route("GET", "/api/user/sessions", auth="user")
def my_sessions(ctx):
    db = ctx["db"]
    rows = [{"id": s["token"][:12], "device": s.get("device"), "ip": s.get("ip"),
             "created_at": s.get("created_at"), "last_seen": s.get("last_seen"),
             "current": s.get("token") == ctx.get("token")}
            for s in db["sessions"] if s.get("user_id") == ctx["user"]["id"]]
    rows.sort(key=lambda s: (-bool(s["current"]), -(s["last_seen"] or 0)))
    return {"sessions": rows[:20]}


@route("DELETE", "/api/user/sessions/{sid}", auth="user")
def kill_session(ctx):
    db = ctx["db"]
    sid = ctx["params"]["sid"]
    victim = next((s for s in db["sessions"]
                   if s.get("user_id") == ctx["user"]["id"] and s["token"].startswith(sid)), None)
    if not victim:
        raise ApiError("Session not found.", 404)
    if victim.get("token") == ctx.get("token"):
        raise ApiError("That's your current session — use Sign out instead.")
    db["sessions"].remove(victim)
    store.audit(db, ctx["user"], "session.revoke", "session:%s…" % sid)
    return {"ok": True}


# ---------------------------------------------------------- notifications --
@route("GET", "/api/user/notifications", auth="user")
def notifications(ctx):
    db = ctx["db"]
    rows = [n for n in db["notifications"] if n["user_id"] == ctx["user"]["id"]]
    rows.sort(key=lambda n: n["created_at"], reverse=True)
    return {"notifications": rows[:40]}


@route("POST", "/api/user/notifications/read-all", auth="user")
def read_all(ctx):
    db = ctx["db"]
    for n in db["notifications"]:
        if n["user_id"] == ctx["user"]["id"]:
            n["read"] = True
    return {"ok": True}
