"""First-run seed: staff, demo customer, lively 6-month banking history,
pending queues (payouts / loans / KYC) and support messages."""
import secrets
import time

import authx
import store


def _mkuser(db, name, email, pw, role="user", kyc="unverified", joined=None,
            suspended=False, phone="", country="United States"):
    u = {
        "id": store.nid(), "name": name, "email": email,
        "password": authx.hash_password(pw), "role": role,
        "tx_pin": store.hash_pin("1234"),
        "phone": phone, "address": "", "country": country,
        "hue": secrets.randbelow(360),
        "kyc_status": kyc, "kyc_doc": "", "kyc_note": "",
        "kyc_submitted_at": None, "kyc_reviewed_at": None,
        "prefs": {"email_alerts": True, "push_alerts": True},
        "suspended": suspended,
        "joined_at": joined or store.now_ms(), "last_login_at": None,
    }
    db["users"].append(u)
    return u


def _mkaccount(db, user, label, kind, currency, created_at):
    a = {
        "id": store.nid(), "user_id": user["id"], "label": label,
        "number": store.gen_account_number(), "currency": currency,
        "kind": kind, "balance": 0.0, "frozen": False,
        "created_at": created_at,
    }
    if kind == "savings":
        a["last_interest_at"] = created_at
    db["accounts"].append(a)
    return a


def _mkcard(db, user, acct, label, ctype, created_at):
    num = store.gen_card_number()
    now_t = time.gmtime()
    c = {
        "id": store.nid(), "user_id": user["id"], "account_id": acct["id"],
        "label": label, "brand": "VISA", "number": num,
        "masked": "\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 " + num[-4:],
        "last4": num[-4:],
        "exp_month": "%02d" % ((now_t.tm_mon % 12) + 1),
        "exp_year": str(now_t.tm_year + 4)[-4:],
        "cvv": "%03d" % secrets.randbelow(1000),
        "frozen": False, "type": ctype,
        "status": "ordered" if ctype == "physical" else "active",
        "limit_monthly": 3000 if ctype == "virtual" else None,
        "created_at": created_at,
    }
    db["cards"].append(c)
    return c


def fresh():
    """Wipe and rebuild the demo database. Returns the new db."""
    import store as s
    s._db = s.new_db()
    db = s._db
    db["settings"].update(dict(store.DEFAULT_SETTINGS))
    build(db)
    s.save()
    return db


def seed_if_empty():
    db = store.load()
    if db["users"]:
        return False
    build(db)
    store.save()
    return True


def build(db):
    now = store.now_ms()
    day = store.DAY_MS
    rnd = secrets.SystemRandom()

    # ------------------------------------------------------------ staff ---
    admin = _mkuser(db, "Ava Sterling", "admin@zentra.bank", "Admin@1234",
                    role="admin", kyc="verified", joined=now - 300 * day,
                    country="United Kingdom")

    # ------------------------------------------------------- demo customer --
    demo = _mkuser(db, "Jordan Miles", "demo@zentra.bank", "Demo@1234",
                   kyc="verified", joined=now - 210 * day, phone="+1 415 555 0138",
                   country="United States")
    demo["kyc_doc"] = "passport:miles_passport.jpg"
    demo["kyc_submitted_at"] = now - 205 * day
    demo["kyc_reviewed_at"] = now - 204 * day
    demo["address"] = "980 Marina Blvd, San Francisco, CA"

    chk = _mkaccount(db, demo, "Everyday Checking", "checking", "USD", now - 210 * day)
    sav = _mkaccount(db, demo, "Growth Savings", "savings", "USD", now - 200 * day)
    eur = _mkaccount(db, demo, "Euro Wallet", "checking", "EUR", now - 120 * day)

    card1 = _mkcard(db, demo, chk, "Everyday Metal", "physical", now - 190 * day)
    card1["status"] = "active"
    card2 = _mkcard(db, demo, chk, "Travel Virtual", "virtual", now - 60 * day)

    db["beneficiaries"].append({"id": store.nid(), "user_id": demo["id"],
                                "name": "Sofia Reyes", "bank": "Chase Bank",
                                "account_number": "888312094", "created_at": now - 150 * day})
    db["beneficiaries"].append({"id": store.nid(), "user_id": demo["id"],
                                "name": "Maria Miles", "bank": "HSBC UK",
                                "account_number": "GB29 NWBK 6016 1331 9268",
                                "created_at": now - 90 * day})

    # ------------------------------------------- background customers ------
    sofia = _mkuser(db, "Sofia Reyes", "sofia@example.com", "User@1234", kyc="verified",
                    joined=now - 45 * day, country="Spain")
    sofia_chk = _mkaccount(db, sofia, "Everyday Checking", "checking", "USD", now - 45 * day)
    liam = _mkuser(db, "Liam Chen", "liam@example.com", "User@1234", kyc="unverified",
                   joined=now - 12 * day, country="Singapore")
    liam_chk = _mkaccount(db, liam, "Everyday Checking", "checking", "USD", now - 12 * day)
    amara = _mkuser(db, "Amara Okafor", "amara@example.com", "User@1234", kyc="verified",
                    joined=now - 63 * day, country="Nigeria")
    amara_chk = _mkaccount(db, amara, "Everyday Checking", "checking", "USD", now - 63 * day)
    amara_sav = _mkaccount(db, amara, "High-Yield Savings", "savings", "USD", now - 40 * day)
    noah = _mkuser(db, "Noah Becker", "noah@example.com", "User@1234", kyc="pending",
                   joined=now - 3 * day, country="Germany")
    noah_chk = _mkaccount(db, noah, "Everyday Checking", "checking", "USD", now - 3 * day)
    noah["kyc_doc"] = "national_id:becker_id.jpg"
    noah["kyc_submitted_at"] = now - 1 * day
    elena = _mkuser(db, "Elena Petrova", "elena@example.com", "User@1234", kyc="verified",
                    joined=now - 55 * day, country="Bulgaria")
    elena_chk = _mkaccount(db, elena, "Everyday Checking", "checking", "USD", now - 55 * day)
    marcus = _mkuser(db, "Marcus Hale", "marcus@example.com", "User@1234", kyc="unverified",
                     joined=now - 7 * day, suspended=True, country="United States")
    marcus_chk = _mkaccount(db, marcus, "Everyday Checking", "checking", "USD", now - 7 * day)
    yuki = _mkuser(db, "Yuki Tanaka", "yuki@example.com", "User@1234", kyc="verified",
                   joined=now - 74 * day, country="Japan")
    yuki_chk = _mkaccount(db, yuki, "Everyday Checking", "checking", "USD", now - 74 * day)
    yuki_sav = _mkaccount(db, yuki, "Growth Savings", "savings", "USD", now - 70 * day)
    _mkcard(db, yuki, yuki_chk, "Platinum", "physical", now - 50 * day)

    tara = _mkuser(db, "Tara Osei", "tara@example.com", "User@1234", kyc="pending",
                   joined=now - 20 * day, country="Ghana")
    tara_chk = _mkaccount(db, tara, "Everyday Checking", "checking", "USD", now - 20 * day)
    tara["kyc_doc"] = "drivers_license:osei_dl.pdf"
    tara["kyc_submitted_at"] = now - 18 * day

    def post(acct, amount, ttype, ts, **kw):
        return store.post(db, acct, amount, ttype, created_at=ts, **kw)

    # ============================== demo history (180 days) ================
    post(chk, 500.0, "deposit", ts=now - 209 * day, counterparty="Opening deposit",
         note="Welcome bonus + initial transfer", method="bank")

    grocers = ["FreshMart", "GreenGrocer", "Corner Market"]
    coffee = ["Blue Bottle", "Daily Grind", "Café Aroma"]
    d = 208
    month_i = 0
    while d >= 0:
        ts_day = now - d * day
        dom = time.localtime(ts_day / 1000).tm_mday
        if dom == 1:  # salary
            post(chk, 4850.0, "transfer_in", ts=ts_day + 9 * 3600_000,
                 counterparty="Northwind Technologies", note="Monthly salary",
                 category="Salary", method="internal")
            month_i += 1
        if dom == 3:  # rent
            post(chk, -1650.0, "payment", ts=ts_day + 10 * 3600_000,
                 counterparty="Hillside Apartments", note="Monthly rent",
                 category="rent", method="bill")
        if dom == 12:  # internet bill
            post(chk, -59.99, "payment", ts=ts_day + 8 * 3600_000,
                 counterparty="FiberOne Broadband", category="internet", method="bill")
        if dom in (7, 21):  # savings top-up
            post(chk, -600.0, "transfer_out", ts=ts_day + 11 * 3600_000,
                 counterparty=sav["label"], pair="seed-sav-%d-%d" % (month_i, dom))
            post(sav, 600.0, "transfer_in", ts=ts_day + 11 * 3600_000 + 1,
                 counterparty=chk["label"], pair="seed-sav-%d-%d" % (month_i, dom))
        if dom in (10, 24) and d < 120:  # groceries
            amt = round(rnd.uniform(42, 130), 2)
            post(chk, -amt, "payment", ts=ts_day + 18 * 3600_000,
                 counterparty=rnd.choice(grocers), category="groceries", method="card")
        if dom in (5, 15, 25):  # coffee
            amt = round(rnd.uniform(4, 14), 2)
            post(chk, -amt, "payment", ts=ts_day + 8 * 3600_000,
                 counterparty=rnd.choice(coffee), category="dining", method="card")
        if dom == 17 and d < 100:  # dining out
            amt = round(rnd.uniform(30, 95), 2)
            post(chk, -amt, "payment", ts=ts_day + 20 * 3600_000,
                 counterparty="The Copper Table", category="dining", method="card")
        if dom == 26 and d < 110:  # transport
            post(chk, -round(rnd.uniform(20, 60), 2), "payment", ts=ts_day + 9 * 3600_000,
                 counterparty="Metro Transit", category="transport", method="card")
        d -= 1

    # interest history on savings (~ weekly cosmetic credits over 28 weeks)
    for wk in range(27, -1, -1):
        ts = now - wk * 7 * day
        base = 12000 + (27 - wk) * 550
        post(sav, round(base * 0.0425 / 52, 2), "interest", ts=ts + 6 * 3600_000,
             counterparty="Zentra Bank", note="Savings interest · weekly @ 4.25% APY")

    # a transfer from Sofia to demo and back (pair)
    p = store.pair_id()
    post(sofia_chk, -250.0, "transfer_out", ts=now - 33 * day, counterparty="Jordan",
         note="Concert tickets", method="internal", pair=p)
    post(chk, 250.0, "transfer_in", ts=now - 33 * day, counterparty="Sofia",
         note="Concert tickets", method="internal", pair=p)

    # exchanges into the Euro wallet
    for i, dd in enumerate((90, 45)):
        pp = store.pair_id()
        post(chk, -800.0, "exchange_out", ts=now - dd * day, counterparty="EUR wallet",
             note="Exchanged @ 0.9200", pair=pp)
        post(eur, 736.00, "exchange_in", ts=now - dd * day + 1, counterparty="USD wallet",
             note="Exchanged @ 0.9200 (fee 0.35%)", fee=2.58, pair=pp)
    post(eur, -420.0, "payment", ts=now - 38 * day, counterparty="Air France",
         category="travel", method="card")
    post(eur, -89.99, "payment", ts=now - 15 * day, counterparty="Booking.com",
         category="travel", method="card")

    # demo loan — active, 3 payments made
    loan_apr = db["settings"]["loan_apr"]
    monthly = round(8000 * (loan_apr / 1200) * (1 + loan_apr / 1200) ** 24 /
                    (((1 + loan_apr / 1200) ** 24) - 1), 2)
    l1 = {"id": store.nid(), "user_id": demo["id"], "account_id": chk["id"],
          "principal": 8000.0, "apr": loan_apr, "term_months": 24,
          "monthly_payment": monthly, "purpose": "Home renovation",
          "status": "active", "paid_total": round(monthly * 3, 2),
          "created_at": now - 96 * day, "disbursed_at": now - 95 * day,
          "reviewed_at": now - 95 * day, "review_note": "",
          "next_due_at": now - 5 * day}
    db["loans"].append(l1)
    post(chk, 8000.0, "loan_disbursement", ts=now - 95 * day,
         counterparty="Zentra Loans", note="Loan #%d disbursed · 24m @ %.1f%%" % (l1["id"], loan_apr))
    for k in range(3):
        post(chk, -monthly, "loan_payment", ts=now - (65 - 30 * k) * day,
             counterparty="Zentra Loans", note="Repayment · loan #%d" % l1["id"])
    # an older fully-repaid loan
    m2 = 2000 * (loan_apr / 1200) * (1 + loan_apr / 1200) ** 6 / (((1 + loan_apr / 1200) ** 6) - 1)
    l2 = {"id": store.nid(), "user_id": demo["id"], "account_id": chk["id"],
          "principal": 2000.0, "apr": loan_apr, "term_months": 6,
          "monthly_payment": round(m2, 2), "purpose": "Laptop purchase",
          "status": "repaid", "paid_total": round(m2 * 6, 2),
          "created_at": now - 190 * day, "disbursed_at": now - 189 * day,
          "closed_at": now - 39 * day}
    db["loans"].append(l2)
    post(chk, 2000.0, "loan_disbursement", ts=now - 189 * day, counterparty="Zentra Loans",
         note="Loan #%d disbursed · 6m @ %.1f%%" % (l2["id"], loan_apr))
    for k in range(6):
        post(chk, -round(m2, 2), "loan_payment", ts=now - (159 - 30 * k) * day,
             counterparty="Zentra Loans", note="Repayment · loan #%d" % l2["id"])

    # ============================ other customers' activity ===============
    post(sofia_chk, 3200.0, "deposit", ts=now - 44 * day, counterparty="Bank transfer",
         method="bank", note="Initial funding")
    post(sofia_chk, -145.50, "payment", ts=now - 20 * day, counterparty="Mercadona",
         category="groceries", method="card")
    post(sofia_chk, -62.0, "payment", ts=now - 9 * day, counterparty="Vodafone",
         category="airtime", method="bill")
    post(sofia_chk, 900.0, "transfer_in", ts=now - 5 * day, counterparty="Freelance client",
         category="Salary", method="internal")

    post(liam_chk, 2310.0, "deposit", ts=now - 12 * day, counterparty="Card top-up",
         method="card")
    post(liam_chk, -340.0, "payment", ts=now - 6 * day, counterparty="Lazada",
         category="shopping", method="card")

    post(amara_chk, 15000.0, "deposit", ts=now - 62 * day, counterparty="Bank transfer",
         method="bank", note="Business proceeds")
    post(amara_sav, 25000.0, "transfer_in", ts=now - 40 * day,
         counterparty="Internal", note="Moved from checking")
    post(amara_chk, -25000.0, "transfer_out", ts=now - 40 * day,
         counterparty="High-Yield Savings", note="Moved to savings")
    post(amara_sav, 240.0, "interest", ts=now - 10 * day, counterparty="Zentra Bank",
         note="Savings interest · monthly @ 4.25% APY")

    post(noah_chk, 640.35, "deposit", ts=now - 3 * day, counterparty="Opening deposit",
         method="bank")

    post(elena_chk, 34105.0, "deposit", ts=now - 54 * day, counterparty="Bank transfer",
         method="bank", note="Property sale proceeds")
    # pending external payout (approval queue)
    post(elena_chk, -(3500.0 + 35.0), "transfer_out", status="pending", ts=now - 22 * 3600_000,
         counterparty="Kostadin Iliev", note="Invoice payment · Zurich Private Bank",
         method="external", fee=35.0, extra={"ext_bank": "Zurich Private Bank",
                                             "ext_number": "4471"})
    # completed payout
    post(elena_chk, -1200.0, "transfer_out", ts=now - 12 * day, counterparty="Ivana Petrova",
         note="Family support · DSK Bank", method="external", fee=12.0,
         extra={"ext_bank": "DSK Bank", "ext_number": "8830"})

    post(marcus_chk, 1180.90, "deposit", ts=now - 7 * day, counterparty="Card top-up",
         method="card")

    post(yuki_chk, 52000.0, "deposit", ts=now - 73 * day, counterparty="Bank transfer",
         method="bank", note="Relocation funds")
    post(yuki_chk, -2800.0, "payment", ts=now - 50 * day, counterparty="Tokyo Realty",
         category="rent", method="bill")
    post(yuki_sav, 4000.0, "transfer_in", ts=now - 49 * day, counterparty="Checking",
         note="Emergency fund")
    post(yuki_chk, -4000.0, "transfer_out", ts=now - 49 * day, counterparty="Growth Savings",
         note="To Growth Savings")
    # Yuki active loan
    my_monthly = round(10000 * (loan_apr / 1200) * (1 + loan_apr / 1200) ** 36 /
                       (((1 + loan_apr / 1200) ** 36) - 1), 2)
    db["loans"].append({
        "id": store.nid(), "user_id": yuki["id"], "account_id": yuki_chk["id"],
        "principal": 10000.0, "apr": loan_apr, "term_months": 36,
        "monthly_payment": my_monthly, "purpose": "Studio equipment",
        "status": "active", "paid_total": round(my_monthly * 2, 2),
        "created_at": now - 55 * day, "disbursed_at": now - 54 * day,
        "next_due_at": now + 12 * day})
    post(yuki_chk, 10000.0, "loan_disbursement", ts=now - 54 * day,
         counterparty="Zentra Loans", note="Loan disbursed · 36m @ %.1f%%" % loan_apr)

    post(tara_chk, 750.0, "deposit", ts=now - 19 * day, counterparty="Mobile money",
         method="mobile")

    # Amara's pending loan request
    db["loans"].append({
        "id": store.nid(), "user_id": amara["id"], "account_id": amara_chk["id"],
        "principal": 25000.0, "apr": loan_apr, "term_months": 36,
        "monthly_payment": round(25000 * (loan_apr / 1200) * (1 + loan_apr / 1200) ** 36 /
                                 (((1 + loan_apr / 1200) ** 36) - 1), 2),
        "purpose": "Boutique expansion", "status": "pending", "paid_total": 0.0,
        "created_at": now - 26 * 3600_000})

    # ---------------------------------------------------------- messages ---
    db["messages"].append({
        "id": store.nid(), "user_id": noah["id"], "name": "Noah Becker",
        "email": "noah@example.com", "subject": "Card delivery time?",
        "body": "Hi! I just ordered the physical card — how long does shipping to Berlin take?",
        "status": "open", "reply": "", "created_at": now - 26 * 3600_000})
    db["messages"].append({
        "id": store.nid(), "user_id": None, "name": "Priya Nair",
        "email": "priya.nair@example.org", "subject": "Business account",
        "body": "Do you offer joint business accounts for a two-founder GmbH? Thanks!",
        "status": "open", "reply": "", "created_at": now - 50 * 3600_000})
    db["messages"].append({
        "id": store.nid(), "user_id": sofia["id"], "name": "Sofia Reyes",
        "email": "sofia@example.com", "subject": "Exchange rate alert",
        "body": "Could I get notified when USD→EUR goes above 0.94?",
        "status": "resolved", "reply": "Rate alerts are rolling out this quarter — added you to the pilot list!",
        "replied_at": now - 72 * 3600_000, "resolved_at": now - 70 * 3600_000,
        "created_at": now - 80 * 3600_000})

    # ------------------------------------------------------- broadcast -----
    db["broadcasts"].append({
        "id": store.nid(),
        "title": "Zentra cards are live on Apple Pay & Google Pay 🎉",
        "body": "Add your Zentra card to your phone's wallet today and pay contactless everywhere.",
        "audience": "all", "recipients": 9, "sent_by": admin["email"],
        "created_at": now - 6 * day})

    # ---------------------------------------------------- notifications ----
    notes = [
        (demo["id"], "Welcome to Zentra ✨", "Your Everyday Checking account is ready.", True, now - 210 * day),
        (demo["id"], "Identity verified ✅", "Your passport check passed — enjoy every feature.", True, now - 204 * day),
        (demo["id"], "Loan approved 🎉", "$8,000.00 has been deposited into Everyday Checking.", False, now - 95 * day),
        (demo["id"], "New card issued", "Your virtual card •%s is ready to use." % card2["last4"], False, now - 60 * day),
        (demo["id"], "Payment successful", "$1,650.00 paid to Hillside Apartments.", False, now - 3 * day),
        (demo["id"], "Savings interest credited", "Your Growth Savings earned interest overnight.", False, now - 1 * day),
    ]
    for uid, title, body, read, ts in notes:
        db["notifications"].append({"id": store.nid(), "user_id": uid, "title": title,
                                    "body": body, "read": read, "created_at": ts})
    db["notifications"].append({"id": store.nid(), "user_id": admin["id"],
                               "title": "Payout approval needed",
                               "body": "Elena Petrova requested an external payout of $3,500.00.",
                               "read": False, "created_at": now - 22 * 3600_000})
    db["notifications"].append({"id": store.nid(), "user_id": admin["id"],
                               "title": "KYC review needed",
                               "body": "Noah Becker submitted a national ID for verification.",
                               "read": False, "created_at": now - 1 * day})
    db["notifications"].append({"id": store.nid(), "user_id": admin["id"],
                               "title": "New loan request",
                               "body": "Amara Okafor requested $25,000.00 over 36m.",
                               "read": False, "created_at": now - 26 * 3600_000})

    # ------------------------------------------------------------- audit ---
    db["audit"].append({"id": store.nid(), "ts": now, "actor_id": None, "actor": "system",
                        "action": "system.seed", "target": "*", "severity": "info", "meta": {}})
    db["audit"].append({"id": store.nid(), "ts": now - 22 * 3600_000, "actor_id": elena["id"],
                        "actor": elena["email"], "action": "payout.request",
                        "target": "txn:*", "severity": "warn",
                        "meta": {"amount": 3500.0, "to": "Kostadin Iliev"}})
    db["audit"].append({"id": store.nid(), "ts": now - 1 * day, "actor_id": noah["id"],
                        "actor": noah["email"], "action": "kyc.submit", "target": "user:%d" % noah["id"],
                        "severity": "info", "meta": {"doc": "national_id"}})
