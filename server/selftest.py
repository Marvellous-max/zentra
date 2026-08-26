"""In-process end-to-end exercise of every banking flow. Run: python3 selftest.py"""
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.environ.setdefault("PORT", "0")

import store
# use a throwaway data dir so the real db is untouched
store.DATA_DIR = os.path.join(HERE, "data-selftest")
store.DB_PATH = os.path.join(store.DATA_DIR, "db.json")
shutil.rmtree(store.DATA_DIR, ignore_errors=True)

import authx
import routing
from seed import seed_if_empty
import api_auth, api_user, api_admin, api_system  # noqa: F401 (register routes)


PASS = []
FAIL = []


def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name + (" :: " + str(extra)[:200] if extra and not cond else ""))


def call(method, path, body=None, token=None, query=None):
    parts = [p for p in path.strip("/").split("/") if p]
    r, params = routing.match(method, parts)
    if not r:
        raise RuntimeError("no route: %s %s" % (method, path))
    body = dict(body or {})
    if method == "POST" and "pin" not in body:
        body["pin"] = "1234"          # default seeded transaction PIN
    ctx = {"db": store.load(), "params": params, "query": query or {}, "body": body,
           "user": None, "token": token, "ua": "selftest", "ip": "127.0.0.1"}
    if r["auth"]:
        u = authx.resolve_user(ctx["db"], token)
        if not u:
            raise routing.ApiError("Session expired — please sign in again.", 401)
        if r["auth"] == "admin":
            assert u.get("role") == "admin", "admin required"
        ctx["user"] = u
    out = r["fn"](ctx)
    return out[1] if isinstance(out, tuple) else out


def main():
    seeded = seed_if_empty()
    check("seed ran", seeded)
    db = store.load()
    check("users seeded", len(db["users"]) >= 10, len(db["users"]))
    check("accounts seeded", len(db["accounts"]) >= 12)
    check("transactions seeded", len(db["transactions"]) > 120)

    # balances consistent with ledger (completed entries sum == balance ± pending holds)
    for a in db["accounts"]:
        s = round(sum(t["amount"] for t in db["transactions"]
                      if t["account_id"] == a["id"]), 2)
        if abs(s - a["balance"]) > 0.02:
            check("ledger balance acct %d" % a["id"], False, "%s vs %s" % (s, a["balance"]))
    PASS.append("ledger matches balances")

    # ---- register ----
    r = call("POST", "/api/auth/register",
             {"name": "Test Person", "email": "test@example.com", "password": "Passw0rd8"})
    tok_new = r["token"]
    check("register returns account", r["account"]["currency"] == "USD")

    # duplicate email rejected
    try:
        call("POST", "/api/auth/register", {"name": "X Y", "email": "test@example.com",
                                            "password": "Passw0rd8"})
        check("dup email rejected", False)
    except routing.ApiError as e:
        check("dup email rejected", e.code in (400, 409))

    # ---- login demo ----
    r = call("POST", "/api/auth/login", {"email": "demo@zentra.bank", "password": "Demo@1234"})
    tok = r["token"]
    check("demo login", r["user"]["name"] == "Jordan Miles")
    wrong = False
    try:
        call("POST", "/api/auth/login", {"email": "demo@zentra.bank", "password": "nope"})
    except routing.ApiError as e:
        wrong = e.code == 401
    check("bad login 401", wrong)

    # ---- me / bootstrap / overview ----
    me = call("GET", "/api/auth/me", token=tok)
    check("me has unread", me["unread"] >= 1)
    bs = call("GET", "/api/user/bootstrap", token=tok)
    check("bootstrap accounts", len(bs["accounts"]) == 3)
    ov = call("GET", "/api/user/overview", token=tok)
    check("overview totals", ov["totals"]["balance_usd"] > 1000, ov["totals"])
    check("overview history 30", len(ov["history"]) == 30)
    chk_id = next(a["id"] for a in bs["accounts"] if a["label"] == "Everyday Checking")
    sav_id = next(a["id"] for a in bs["accounts"] if a.get("kind") == "savings")
    eur_id = next(a["id"] for a in bs["accounts"] if a["currency"] == "EUR")
    bal0 = next(a["balance"] for a in bs["accounts"] if a["id"] == chk_id)

    # ---- deposit: pends until an administrator approves it ----
    r = call("POST", "/api/user/deposits", {"account_id": chk_id, "amount": "1,000.00",
                                            "method": "card"}, token=tok)
    check("deposit request pends", r.get("pending") is True and
          next(a["balance"] for a in call("GET", "/api/user/accounts", token=tok)["accounts"]
               if a["id"] == chk_id) == bal0)
    dep_tx = r["transaction"]["id"]
    atok = call("POST", "/api/auth/login", {"email": "admin@zentra.bank",
                                            "password": "Admin@1234"})["token"]
    rr = call("POST", "/api/admin/transactions/%d/review" % dep_tx,
              {"decision": "approve"}, token=atok)
    check("deposit approved by admin",
          rr["ok"] is True and
          next(a["balance"] for a in call("GET", "/api/user/accounts", token=tok)["accounts"]
               if a["id"] == chk_id) == round(bal0 + 1000, 2))
    # a declined top-up never touches the balance
    r2 = call("POST", "/api/user/deposits", {"account_id": chk_id, "amount": 500}, token=tok)
    call("POST", "/api/admin/transactions/%d/review" % r2["transaction"]["id"],
         {"decision": "reject", "reason": "Source unverified"}, token=atok)
    check("deposit decline leaves balance",
          next(a["balance"] for a in call("GET", "/api/user/accounts", token=tok)["accounts"]
               if a["id"] == chk_id) == round(bal0 + 1000, 2))
    try:
        call("POST", "/api/user/deposits", {"account_id": chk_id, "amount": 1}, token=tok)
        check("min deposit enforced", False)
    except routing.ApiError as e:
        check("min deposit enforced", True)

    # ---- restricted accounts: login OK, every money move declined (423) ----
    _db0 = store.load()
    uid_me = store.find_user_by_email(_db0, "demo@zentra.bank")["id"]
    notif_before = len(call("GET", "/api/user/notifications", token=tok)["notifications"])
    call("POST", "/api/admin/users/%d/restrict" % uid_me,
         {"restricted": True, "reason": "Verification needed"}, token=atok)
    call("GET", "/api/auth/me", token=tok)          # login/session still fine
    check("silent freeze: customer NOT notified at freeze time",
          len(call("GET", "/api/user/notifications", token=tok)["notifications"]) == notif_before)
    blocked = 0
    for path, body in [
            ("/api/user/transfers", {"mode": "own", "from_account_id": chk_id,
                                     "to_account_id": sav_id, "amount": 5}),
            ("/api/user/payments", {"account_id": chk_id, "biller": "City Power",
                                    "amount": 10, "category": "utilities"}),
            ("/api/user/deposits", {"account_id": chk_id, "amount": 50}),
            ("/api/user/exchange", {"from_account_id": chk_id, "to_account_id": eur_id,
                                    "amount": 5})]:
        try:
            call("POST", path, body, token=tok)
        except routing.ApiError as e:
            if e.code == 423:
                blocked += 1
    check("restricted: all four money moves declined (423)", blocked == 4)
    dlogs = call("GET", "/api/admin/declined-logs", token=atok)["logs"]
    check("restricted: attempts logged for admin",
          sum(1 for l in dlogs if l["kind"] == "attempt" and l["user_email"] == "demo@zentra.bank") >= 4)
    # escalation lands in the ADMIN's own tray exactly once (on the 3rd attempt)
    adm_notifs = [n for n in call("GET", "/api/user/notifications", token=atok)["notifications"]]
    esc = sum(1 for n in adm_notifs if n["title"].startswith("3rd declined attempt"))
    check("3rd-attempt escalation reaches admin once", esc == 1, esc)
    # and the customer still got NOTHING during the restriction
    check("customer tray silent through declines",
          len(call("GET", "/api/user/notifications", token=tok)["notifications"]) == notif_before)
    call("POST", "/api/admin/users/%d/restrict" % uid_me, {"restricted": False}, token=atok)
    r = call("POST", "/api/user/transfers", {"mode": "own", "from_account_id": chk_id,
                                             "to_account_id": sav_id, "amount": 5,
                                             "note": "post-restrict"}, token=tok)
    check("unrestrict restores transactions", r["ok"])

    # ---- gated branded email: locked on tries 1-2, unlocks on the 3rd ----
    call("POST", "/api/admin/users/%d/restrict" % uid_me,
         {"restricted": True, "reason": "re-check"}, token=atok)

    def _one_try():
        try:
            call("POST", "/api/user/transfers", {"mode": "own",
                 "from_account_id": chk_id, "to_account_id": sav_id,
                 "amount": 3}, token=tok)
            return False
        except routing.ApiError as e:
            return e.code == 423

    ok1 = _one_try()
    dl1 = [l for l in call("GET", "/api/admin/declined-logs", token=atok)["logs"]
           if l["kind"] == "attempt" and l["user_email"] == "demo@zentra.bank"][0]
    locked = False
    try:
        call("POST", "/api/admin/declined-logs/%s/mail" % dl1["id"],
             {"subject": "too early", "body": "must be rejected"}, token=atok)
    except routing.ApiError as e:
        locked = e.code == 409
    check("email LOCKED on try 1 of frozen state", ok1 and locked)
    _one_try(); _one_try()
    dl3 = [l for l in call("GET", "/api/admin/declined-logs", token=atok)["logs"]
           if l["kind"] == "attempt" and l["user_email"] == "demo@zentra.bank"][0]
    sent = call("POST", "/api/admin/declined-logs/%s/mail" % dl3["id"],
                {"subject": "How to unfreeze your account",
                 "body": "Complete verification under Settings to unfreeze."},
                token=atok)["ok"]
    check("email UNLOCKS on try 3 and delivers", sent)
    call("POST", "/api/admin/users/%d/restrict" % uid_me,
         {"restricted": False}, token=atok)

    # ---- transfer own ----
    before_sav = call("GET", "/api/user/accounts", token=tok)["accounts"]
    sav_bal = next(a["balance"] for a in before_sav if a["id"] == sav_id)
    r = call("POST", "/api/user/transfers", {"mode": "own", "from_account_id": chk_id,
                                             "to_account_id": sav_id, "amount": 250,
                                             "note": "vacation fund"}, token=tok)
    check("own transfer ok", r["ok"])
    after = call("GET", "/api/user/accounts", token=tok)["accounts"]
    check("own transfer moved money",
          next(a["balance"] for a in after if a["id"] == sav_id) == round(sav_bal + 250, 2))

    # insufficient funds guard
    broke = False
    try:
        call("POST", "/api/user/transfers", {"mode": "own", "from_account_id": eur_id,
                                             "to_account_id": chk_id, "amount": 999999},
             token=tok)
    except routing.ApiError as e:
        broke = "Insufficient" in e.message or "Exchange" in e.message or "Pick two" in e.message
    check("insufficient/currency guard", broke)

    # ---- transfer to another customer (requires recipient acct number) ----
    sofia = store.find_user_by_email(store.load(), "sofia@example.com")
    sofia_chk = next(a for a in store.user_accounts(store.load(), sofia["id"])
                     if a["currency"] == "USD" and a["kind"] == "checking")
    r = call("POST", "/api/user/transfers", {"mode": "zentra", "from_account_id": chk_id,
                                             "to_email": "sofia@example.com", "amount": 75,
                                             "to_account_number": sofia_chk["number"],
                                             "to_bank_name": "Zentra Bank",
                                             "note": "lunch"}, token=tok)
    check("zentra transfer ok", r["ok"])

    # wrong recipient account number is rejected
    badnum = False
    try:
        call("POST", "/api/user/transfers", {"mode": "zentra", "from_account_id": chk_id,
             "to_email": "sofia@example.com", "amount": 5,
             "to_account_number": "0000 0000 0000"}, token=tok)
    except routing.ApiError as e:
        badnum = "doesn't match our records" in e.message
    except AssertionError:
        badnum = True
    check("wrong recipient account number declined", badnum)

    # unknown recipient
    err404 = False
    try:
        call("POST", "/api/user/transfers", {"mode": "zentra", "from_account_id": chk_id,
                                             "to_email": "ghost@nowhere.io", "amount": 10},
             token=tok)
    except routing.ApiError as e:
        err404 = "No Zentra customer" in e.message
    check("unknown recipient message", err404)

    # ---- external payout below auto-limit completes instantly ----
    r = call("POST", "/api/user/beneficiaries",
             {"name": "External Test", "bank": "Some Bank", "account_number": "12345678"},
             token=tok)
    ben_id = r["beneficiary"]["id"]
    r = call("POST", "/api/user/transfers", {"mode": "external", "from_account_id": chk_id,
                                             "beneficiary_id": ben_id, "amount": 500,
                                             "note": "rent share"}, token=tok)
    check("small payout auto-completes", r["pending"] is False)

    # big payout goes pending
    r = call("POST", "/api/user/transfers", {"mode": "external", "from_account_id": chk_id,
                                             "beneficiary_name": "Big Co", "beneficiary_bank": "Mega Bank",
                                             "beneficiary_number": "99887766", "amount": 5000},
             token=tok)
    check("big payout pends for approval", r["pending"] is True)
    pend_ref = r["transactions"][0]["ref"]

    # KYC gate over threshold? (kyc_required_over=10000; verified user fine)

    # ---- exchange ----
    q = call("GET", "/api/user/exchange/quote", token=tok,
             query={"from": "USD", "to": "EUR", "amount": "100"})
    check("quote math", abs(q["gross"] - 92.0) < 0.01 and q["net"] < q["gross"])
    r = call("POST", "/api/user/exchange", {"from_account_id": chk_id, "to_account_id": eur_id,
                                            "amount": 50}, token=tok)
    check("exchange ok", r["ok"] and len(r["transactions"]) == 2)

    # ---- cards ----
    cards = call("GET", "/api/user/cards", token=tok)
    n_before = len(cards["cards"])
    r = call("POST", "/api/user/cards", {"account_id": chk_id, "label": "Online Shopping",
                                         "type": "virtual"}, token=tok)
    check("virtual card issued", r["card"]["number"].startswith("4539"))
    full_num = r["card"]["number"]
    cid = r["card"]["id"]
    r = call("POST", "/api/user/cards/%d/freeze" % cid, {"frozen": True}, token=tok)
    check("card freeze", r["card"]["frozen"])
    # virtual card cap (3 active) -> we now have 3 virtual? demo had 1 virtual + this = 2... create one more then expect error
    call("POST", "/api/user/cards", {"account_id": chk_id, "type": "virtual"}, token=tok)
    capped = False
    try:
        call("POST", "/api/user/cards", {"account_id": chk_id, "type": "virtual"}, token=tok)
    except routing.ApiError as e:
        capped = "virtual cards" in e.message
    check("virtual card cap enforced", capped)
    # physical card charges fee
    r = call("POST", "/api/user/cards", {"account_id": chk_id, "type": "physical",
                                         "label": "Metal X"}, token=tok)
    check("physical card ordered status", r["card"]["status"] == "ordered")

    # ---- payments ----
    cat = call("GET", "/api/user/pay/catalog", token=tok)
    check("bill catalog", len(cat["categories"]) >= 5)
    r = call("POST", "/api/user/payments", {"account_id": chk_id, "biller": "City Power",
                                            "category": "electricity", "customer_ref": "A-1122",
                                            "amount": 88.4}, token=tok)
    check("bill paid", r["transaction"]["type"] == "payment")

    # ---- loans ----
    loans = call("GET", "/api/user/loans", token=tok)
    active = [l for l in loans["loans"] if l["status"] == "active"]
    check("demo has active loan", len(active) == 1)
    r = call("POST", "/api/user/loans/%d/pay" % active[0]["id"],
             {"account_id": chk_id, "amount": active[0]["monthly_payment"]}, token=tok)
    check("loan repayment posts", r["loan"]["paid_total"] > active[0]["paid_total"])
    # new loan request (verified user allowed)
    r = call("POST", "/api/user/loans", {"account_id": chk_id, "amount": 3000,
                                         "term_months": 12, "purpose": "test"}, token=tok)
    check("loan request pends", r["loan"]["status"] == "pending")
    loan_id = r["loan"]["id"]

    # unverified user blocked from loans
    tok_liam = call("POST", "/api/auth/login", {"email": "liam@example.com",
                                                "password": "User@1234"})["token"]
    liam_bs = call("GET", "/api/user/bootstrap", token=tok_liam)
    liam_chk = liam_bs["accounts"][0]["id"]
    blocked = False
    try:
        call("POST", "/api/user/loans", {"account_id": liam_chk, "amount": 2000,
                                         "term_months": 12}, token=tok_liam)
    except routing.ApiError as e:
        blocked = "verification" in e.message.lower() or "identity" in e.message.lower()
    check("loans require kyc", blocked)

    # ---- statement csv ----
    import api_user as au
    ctx = {"db": store.load(), "params": {}, "query": {"account_id": str(chk_id)},
           "body": {}, "user": None, "token": tok, "ua": "", "ip": ""}
    ctx["user"] = authx.resolve_user(store.load(), tok)
    resp = au.statement_csv(ctx)
    check("statement csv", resp.body.decode().count("\n") > 20)

    # ---- sessions & notifications & profile ----
    ss = call("GET", "/api/user/sessions", token=tok)
    check("sessions listed", any(s["current"] for s in ss["sessions"]))
    call("POST", "/api/user/notifications/read-all", token=tok)
    me = call("GET", "/api/auth/me", token=tok)
    check("read-all works", me["unread"] == 0)
    r = call("PUT", "/api/user/profile", {"name": "Jordan A. Miles", "phone": "+1 415 555 0000"},
             token=tok)
    check("profile update", r["user"]["name"] == "Jordan A. Miles")
    badpw = False
    try:
        call("PUT", "/api/user/password", {"current": "wrong", "new": "Newpass123"}, token=tok)
    except routing.ApiError:
        badpw = True
    check("wrong current password rejected", badpw)
    r = call("PUT", "/api/user/password", {"current": "Demo@1234", "new": "Newpass123"}, token=tok)
    check("password change", r["ok"])
    call("POST", "/api/auth/login", {"email": "demo@zentra.bank", "password": "Newpass123"})
    call("PUT", "/api/user/password", {"current": "Newpass123", "new": "Demo@1234"}, token=tok)

    # ================= admin ==================
    tok_adm = call("POST", "/api/auth/login", {"email": "admin@zentra.bank",
                                               "password": "Admin@1234"})["token"]
    adm = call("GET", "/api/admin/overview", token=tok_adm)
    check("admin overview kpis", adm["kpis"]["customers"] >= 8)
    check("admin queues populated", adm["queues"]["payouts"] >= 2 and adm["queues"]["loans"] >= 2)

    users = call("GET", "/api/admin/users", token=tok_adm, query={"q": "jordan"})
    check("admin user search", users["meta"]["total"] == 1)
    uid_demo = users["users"][0]["id"]

    detail = call("GET", "/api/admin/users/%d" % uid_demo, token=tok_adm)
    check("admin user detail", len(detail["accounts"]) == 3 and detail["sessions"] >= 1)

    # adjust balance with reason
    acc0 = detail["accounts"][0]
    r = call("POST", "/api/admin/users/%d/adjust" % uid_demo,
             {"account_id": acc0["id"], "amount": 25, "reason": "goodwill credit"}, token=tok_adm)
    check("adjustment posts", r["transaction"]["type"] == "adjustment")
    no_reason = False
    try:
        call("POST", "/api/admin/users/%d/adjust" % uid_demo,
             {"account_id": acc0["id"], "amount": 5, "reason": ""}, token=tok_adm)
    except routing.ApiError:
        no_reason = True
    check("adjustment requires reason", no_reason)

    # payouts queue approve/reject
    pq = call("GET", "/api/admin/payouts", token=tok_adm)
    check("payout queue has items", len(pq["payouts"]) >= 2)
    mine_pend = [p for p in pq["payouts"] if p["ref"] == pend_ref][0]
    r = call("POST", "/api/admin/payouts/%d/review" % mine_pend["id"],
             {"decision": "approve"}, token=tok_adm)
    check("payout approve", r["ok"])
    elena_item = next((p for p in pq["payouts"] if p["user_email"] == "elena@example.com"), None)
    if elena_item and elena_item["status"] == "pending":
        MAIL_TXT = ("Hello Elena, your payout was declined after a compliance review. "
                    "Please upload a bank statement under Settings to restore transfers.")
        r = call("POST", "/api/admin/payouts/%d/review" % elena_item["id"],
                 {"decision": "reject", "reason": "compliance hold",
                  "message": MAIL_TXT}, token=tok_adm)
        check("payout reject refunds", r["ok"])
        el = call("GET", "/api/admin/users", token=tok_adm, query={"q": "elena"})
        det = call("GET", "/api/admin/users/%d" % el["users"][0]["id"], token=atok)
        bal_now = det["accounts"][0]["balance"]
        check("refund restored balance", bal_now > 30000, bal_now)
        elena_tok = call("POST", "/api/auth/login",
                         {"email": "elena@example.com", "password": "User@1234"})["token"]
        notifs = [n for n in call("GET", "/api/user/notifications", token=elena_tok)["notifications"]]
        mailed = any("bank statement" in (n.get("body") or "") for n in notifs)
        check("branded decline mail delivered to customer", mailed)
        dl = call("GET", "/api/admin/declined-logs", token=atok)["logs"]
        entry = next((l for l in dl if l["tx_ref"] == elena_item["ref"]), None)
        check("declined log records mail", bool(entry) and entry["mailed"] is True)
        rr = call("POST", "/api/admin/declined-logs/%d/resolve" % entry["id"], {}, token=atok)
        check("declined log resolve", rr["ok"])

    # loan review
    lq = call("GET", "/api/admin/loans", token=tok_adm, query={"status": "pending"})
    check("pending loans listed", len(lq["loans"]) >= 2)
    target = next(l for l in lq["loans"] if l["user_email"] == "demo@zentra.bank")
    r = call("POST", "/api/admin/loans/%d/review" % target["id"],
             {"decision": "approve"}, token=tok_adm)
    check("loan approved+disbursed", r["ok"])
    amara_loan = next(l for l in lq["loans"] if l["user_email"] == "amara@example.com")
    r = call("POST", "/api/admin/loans/%d/review" % amara_loan["id"],
             {"decision": "reject", "note": "debt ratio"}, token=tok_adm)
    check("loan reject", r["ok"])

    # kyc review
    kq_users = call("GET", "/api/admin/users", token=tok_adm, query={"status": "pending_kyc"})
    check("kyc queue", kq_users["meta"]["total"] >= 2)
    noah_uid = next(u["id"] for u in kq_users["users"] if u["email"] == "noah@example.com")
    r = call("POST", "/api/admin/users/%d/kyc" % noah_uid, {"decision": "approve"}, token=tok_adm)
    check("kyc approve", r["kyc_status"] == "verified")
    tara_uid = next(u["id"] for u in kq_users["users"] if u["email"] == "tara@example.com")
    r = call("POST", "/api/admin/users/%d/kyc" % tara_uid,
             {"decision": "reject", "note": "blurry"}, token=tok_adm)
    check("kyc reject", r["kyc_status"] == "rejected")

    # reverse a transaction
    txs = call("GET", "/api/admin/transactions", token=tok_adm, query={"q": "City Power"})
    victim = txs["transactions"][0]
    r = call("POST", "/api/admin/transactions/%d/reverse" % victim["id"],
             {"reason": "duplicate charge"}, token=tok_adm)
    check("tx reversal", r["ok"])
    rev_guard = False
    try:
        call("POST", "/api/admin/transactions/%d/reverse" % victim["id"],
             {"reason": "again"}, token=tok_adm)
    except routing.ApiError:
        rev_guard = True
    check("double reversal blocked", rev_guard)

    # freeze/unfreeze user kills sessions
    # marcus is seeded suspended -> login must fail
    sus = False
    try:
        call("POST", "/api/auth/login", {"email": "marcus@example.com", "password": "User@1234"})
    except routing.ApiError as e:
        sus = e.code == 403
    check("suspended login blocked", sus)

    # freeze sofia then verify lockout, then unfreeze
    tok_sofia = call("POST", "/api/auth/login", {"email": "sofia@example.com",
                                                 "password": "User@1234"})["token"]
    sofia_uid = call("GET", "/api/auth/me", token=tok_sofia)["user"]["id"]
    call("POST", "/api/admin/users/%d/freeze" % sofia_uid, {"frozen": True}, token=tok_adm)
    locked = False
    try:
        call("GET", "/api/user/bootstrap", token=tok_sofia)
    except routing.ApiError as e:
        locked = e.code == 401
    check("frozen session invalidated", locked)
    call("POST", "/api/admin/users/%d/freeze" % sofia_uid, {"frozen": False}, token=tok_adm)

    # role guards
    last_admin_ok = False
    try:
        call("POST", "/api/admin/users/%d/role" % 999, {"role": "user"}, token=tok_adm)
    except routing.ApiError:
        last_admin_ok = True
    check("role change on missing user 404s", last_admin_ok)

    # broadcast
    r = call("POST", "/api/admin/broadcasts", {"title": "Scheduled maintenance Sunday",
                                               "body": "Brief window at 02:00 UTC."}, token=tok_adm)
    check("broadcast sent", r["broadcast"]["recipients"] >= 8)

    # messages
    msgs = call("GET", "/api/admin/messages", token=tok_adm)
    check("messages listed", len(msgs["messages"]) >= 3)
    open_msg = next(m for m in msgs["messages"] if m["status"] == "open")
    r = call("POST", "/api/admin/messages/%d" % open_msg["id"],
             {"reply": "Ships in 3-5 business days!", "resolve": True}, token=tok_adm)
    check("message reply+resolve", r["message"]["status"] == "resolved")

    # audit
    audit = call("GET", "/api/admin/audit", token=tok_adm, query={"severity": "critical"})
    check("critical audit entries", audit["meta"]["total"] >= 3)

    # ================= system console ==================
    st = call("GET", "/api/system/status", token=tok_adm)
    check("system status", st["uptime_s"] >= 0 and st["counts"]["accounts"] >= 12)

    gs = call("GET", "/api/system/settings", token=tok_adm)
    check("settings readable", gs["settings"]["site_name"] == "Zentra")
    r = call("PUT", "/api/system/settings",
             {"transfer_fee_pct": 0.25, "savings_apy": 4.5,
              "fx": {"EUR": 0.93}, "maintenance_mode": False}, token=tok_adm)
    keys_changed = [c["key"] for c in r["changed"]]
    check("settings update diffed", set(keys_changed) == {"transfer_fee_pct", "savings_apy", "fx.EUR"},
          keys_changed)
    bad_fx = False
    try:
        call("PUT", "/api/system/settings", {"fx": {"USD": 2}}, token=tok_adm)
    except routing.ApiError as e:
        bad_fx = "base currency" in e.message
    check("USD fx pinned", bad_fx)
    # restore
    call("PUT", "/api/system/settings", {"transfer_fee_pct": 0, "savings_apy": 4.25,
                                         "fx": {"EUR": 0.92}}, token=tok_adm)

    # export/import round-trip
    exp = call("GET", "/api/system/export", token=tok_adm)
    snapshot = json.loads(exp.body.decode())
    check("export valid json db", "users" in snapshot and "audit" in snapshot)
    r = call("POST", "/api/system/vacuum", token=tok_adm)
    check("vacuum reports sizes", r["after_kb"] > 0)

    # reset rebuilds demo db and returns fresh admin token
    r = call("POST", "/api/system/reset", token=tok_adm)
    fresh_tok = r["token"]
    me2 = call("GET", "/api/auth/me", token=fresh_tok)
    check("reset re-issues admin session", me2["user"]["role"] == "admin")
    st2 = call("GET", "/api/system/status", token=fresh_tok)
    check("reset rebuilt dataset", st2["counts"]["transactions"] > 100)

    # revoke-sessions spares current
    extra_tok = call("POST", "/api/auth/login", {"email": "yuki@example.com",
                                                 "password": "User@1234"})["token"]
    r = call("POST", "/api/system/revoke-sessions", token=fresh_tok)
    check("revoke others keeps current", r["killed"] >= 1)
    gone = False
    try:
        call("GET", "/api/auth/me", token=extra_tok)
    except routing.ApiError as e:
        gone = e.code == 401
    check("revoked session dead", gone)

    # non-admin cannot reach system endpoints
    tok_yuki = call("POST", "/api/auth/login", {"email": "yuki@example.com",
                                                "password": "User@1234"})["token"]
    denied = False
    try:
        call("GET", "/api/system/status", token=tok_yuki)
    except AssertionError:
        denied = True
    except routing.ApiError as e:
        denied = e.code == 403
    check("system endpoint admin-only", denied)

    # ---- transaction PIN + branded alerts + admin tx review (fresh db) ----
    tok_d = call("POST", "/api/auth/login", {"email": "demo@zentra.bank",
                                             "password": "Demo@1234"})["token"]
    bs = call("GET", "/api/user/bootstrap", token=tok_d)
    acct_id = bs["accounts"][0]["id"]

    bad = False
    try:
        call("POST", "/api/user/transfers", {"mode": "own", "from_account_id": acct_id,
             "to_account_id": bs["accounts"][1]["id"], "amount": 5, "pin": "0000"}, token=tok_d)
    except routing.ApiError as e:
        bad = e.code == 403
    except AssertionError:
        bad = True
    check("wrong pin declines transfer", bad)

    nopin = False
    try:
        call("POST", "/api/user/payments", {"account_id": acct_id, "biller": "Test",
             "amount": 3, "category": "other", "pin": ""}, token=tok_d)
    except routing.ApiError as e:
        nopin = e.code in (400, 403)
    except AssertionError:
        nopin = True
    check("missing pin blocks payment", nopin)

    r = call("PUT", "/api/user/pin", {"current": "1234", "new": "9987"}, token=tok_d)
    check("pin change works", r.get("ok") is True)
    rejected = False
    try:
        call("PUT", "/api/user/pin", {"current": "1234", "new": "1111"}, token=tok_d)
    except routing.ApiError as e:
        rejected = e.code == 403
    except AssertionError:
        rejected = True
    check("old pin no longer valid after change", rejected)
    r = call("PUT", "/api/user/pin", {"current": "9987", "new": "1234"}, token=tok_d)
    check("pin changed back", r.get("ok") is True)

    # pending external payout -> admin approves via generic review endpoint
    r = call("POST", "/api/user/transfers", {"mode": "external", "from_account_id": acct_id,
             "beneficiary_name": "Selftest Beneficiary", "beneficiary_bank": "First National",
             "beneficiary_number": "9988776655", "amount": 5000}, token=tok_d)
    pend_tx = r["transactions"][0]
    check("large payout pends above auto-limit", pend_tx["status"] == "pending")
    tok_a2 = call("POST", "/api/auth/login", {"email": "admin@zentra.bank",
                                              "password": "Admin@1234"})["token"]
    r = call("POST", "/api/admin/transactions/%d/review" % pend_tx["id"],
             {"decision": "approve"}, token=tok_a2)
    check("admin approves pending transaction", r.get("ok") is True)
    rows = call("GET", "/api/admin/transactions", token=tok_a2,
                query={"q": pend_tx["ref"]})["transactions"]
    check("approved tx now completed", rows and rows[0]["status"] == "completed")

    # decline path refunds the hold
    r = call("POST", "/api/user/transfers", {"mode": "external", "from_account_id": acct_id,
             "beneficiary_name": "Decline Me", "beneficiary_bank": "Some Bank",
             "beneficiary_number": "1122334455", "amount": 3000}, token=tok_d)
    dtx = r["transactions"][0]
    bal_before = call("GET", "/api/user/accounts", token=tok_d)["accounts"][0]["balance"]
    r = call("POST", "/api/admin/transactions/%d/review" % dtx["id"],
             {"decision": "reject", "reason": "Compliance review failed"}, token=tok_a2)
    check("admin declines pending transaction", r.get("ok") is True)
    bal_after = call("GET", "/api/user/accounts", token=tok_d)["accounts"][0]["balance"]
    held = abs(dtx["amount"])                      # full debit incl. fee
    check("declined hold refunded to balance",
          abs(bal_after - bal_before - held) < 0.01)

    # notifications are branded with alert email + working link
    notes = call("GET", "/api/user/notifications", token=tok_d)["notifications"]
    branded = [n for n in notes if n.get("from_email") == store.ALERTS_EMAIL]
    linked = [n for n in notes if n.get("link", "").startswith("#/")]
    check("alerts carry branded from-address", len(branded) >= 2, len(branded))
    check("alerts carry deep links", len(linked) >= 2, len(linked))

    print("")
    print("PASSED: %d" % len(PASS))
    if FAIL:
        print("FAILED: %d" % len(FAIL))
        for f in FAIL:
            print("  ✗ %s" % f)
        sys.exit(1)
    print("ALL GREEN ✅")


if __name__ == "__main__":
    main()
