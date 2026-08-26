"""Zentra — JSON store, banking ledger engine, lazy interest settlement, audit trail."""
import hashlib
import hmac
import json
import os
import secrets
import threading
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "db.json")

DAY_MS = 86_400_000
_lock = threading.RLock()
_db = None
_started_at = time.time()

CURRENCIES = {"USD": {"symbol": "$", "name": "US Dollar"},
              "EUR": {"symbol": "\u20ac", "name": "Euro"},
              "GBP": {"symbol": "\u00a3", "name": "British Pound"}}


def r2(x):
    """Round money to 2 decimals (float-safe)."""
    return round(float(x) + 1e-9, 2)


def now_ms():
    return int(time.time() * 1000)


def started_at():
    return _started_at


def new_db():
    return {
        "meta": {"next_id": 1, "version": "1.0.0"},
        "users": [], "sessions": [], "accounts": [], "cards": [],
        "transactions": [], "beneficiaries": [], "loans": [],
        "notifications": [], "messages": [], "broadcasts": [],
        "audit": [], "settings": {},
    }


def load():
    global _db
    with _lock:
        if _db is not None:
            return _db
        if os.path.exists(DB_PATH):
            try:
                with open(DB_PATH, "r", encoding="utf-8") as f:
                    _db = json.load(f)
                base = new_db()
                for k, v in base.items():
                    _db.setdefault(k, v)
                for k, v in DEFAULT_SETTINGS.items():
                    _db["settings"].setdefault(k, v)
                _migrate(_db)
                return _db
            except Exception:
                pass
        _db = new_db()
        _db["settings"].update(DEFAULT_SETTINGS)
        return _db


PIN_ITERATIONS = 120_000
DEFAULT_PIN = "1234"   # seeded/legacy accounts; changeable in Settings


def hash_pin(pin):
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt.encode("utf-8"),
                            PIN_ITERATIONS, dklen=32)
    return "pin$%d$%s$%s" % (PIN_ITERATIONS, salt, h.hex())


def verify_pin(user, pin):
    stored = user.get("tx_pin") or ""
    try:
        _, iters, salt, hx = stored.split("$", 3)
        h = hashlib.pbkdf2_hmac("sha256", str(pin).encode("utf-8"), salt.encode("utf-8"),
                                int(iters), dklen=32)
        return hmac.compare_digest(h.hex(), hx)
    except Exception:
        return False


def _migrate(db):
    """Self-heal older databases: give every user a transaction PIN hash."""
    changed = False
    db.setdefault("declined_logs", [])
    for u in db["users"]:
        if not u.get("tx_pin"):
            u["tx_pin"] = hash_pin(DEFAULT_PIN)
            changed = True
        if "restricted" not in u:
            u["restricted"] = False
            changed = True
    if changed:
        save()


def save():
    with _lock:
        if _db is None:
            return
        os.makedirs(DATA_DIR, exist_ok=True)
        tmp = DB_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(_db, f, indent=1)
        os.replace(tmp, DB_PATH)


def replace_all(newdb):
    """Atomically swap the live database (restore / reset)."""
    global _db
    with _lock:
        base = new_db()
        for k in base:
            newdb.setdefault(k, base[k])
        for k, v in DEFAULT_SETTINGS.items():
            newdb["settings"].setdefault(k, v)
        _db = newdb
        save()


def nid():
    db = load()
    with _lock:
        i = db["meta"]["next_id"]
        db["meta"]["next_id"] = i + 1
        return i


DEFAULT_SETTINGS = {
    # brand
    "site_name": "Zentra",
    "support_email": "help@zentra.bank",
    # flags
    "maintenance_mode": False,
    "registrations_open": True,
    "deposits_enabled": True,
    "transfers_internal_enabled": True,
    "transfers_external_enabled": True,
    "payments_enabled": True,
    "exchange_enabled": True,
    "loans_enabled": True,
    "cards_enabled": True,
    # money rules
    "min_deposit": 5.0,
    "max_transfer_single": 25000.0,
    "daily_transfer_limit": 50000.0,
    "external_auto_limit": 2000.0,     # external payouts above this wait for approval
    "kyc_required_over": 10000.0,      # outgoing transfers need verified KYC above this
    "transfer_fee_pct": 0.0,           # internal Zentra transfers
    "external_fee_pct": 1.0,           # payouts to other banks
    "external_fee_min": 1.0,
    "exchange_fee_pct": 0.35,
    "max_virtual_cards": 3,
    "card_issue_fee": 5.0,
    "savings_apy": 4.25,
    "loan_apr": 9.9,
    "min_loan": 500.0,
    "max_loan": 50000.0,
    "loan_terms_months": [6, 12, 24, 36],
    # fx (units of currency per 1 USD)
    "fx": {"USD": 1.0, "EUR": 0.92, "GBP": 0.79},
}


# --------------------------------------------------------------- lookups ---
def find_user(db, uid):
    for u in db["users"]:
        if u["id"] == uid:
            return u
    return None


def find_user_by_email(db, email):
    e = (email or "").strip().lower()
    for u in db["users"]:
        if u["email"].lower() == e:
            return u
    return None


def find_account(db, acct_id):
    for a in db["accounts"]:
        if a["id"] == acct_id:
            return a
    return None


def find_card(db, card_id):
    for c in db["cards"]:
        if c["id"] == card_id:
            return c
    return None


def find_loan(db, loan_id):
    for l in db["loans"]:
        if l["id"] == loan_id:
            return l
    return None


def user_accounts(db, uid):
    return [a for a in db["accounts"] if a["user_id"] == uid]


def public_user(u):
    d = dict(u)
    d.pop("password", None)
    d.pop("tx_pin", None)
    return d


# ------------------------------------------------------------ formatting ---
def fmt_money(x, cur="USD"):
    sym = CURRENCIES.get(cur, {}).get("symbol", "$")
    return "%s%s" % (sym, format(r2(abs(x)), ",.2f"))


def ref_code(prefix="ZN"):
    return "%s-%s" % (prefix, secrets.token_hex(3).upper())


def gen_account_number():
    """Realistic 12-digit account number, e.g. 4021 8837 4902."""
    return "%04d %04d %04d" % (secrets.randbelow(10000), secrets.randbelow(10000),
                               secrets.randbelow(10000))


ROUTING_NUMBER = "021000021"
ALERTS_EMAIL = "alerts@zentra.bank"


def gen_card_number():
    return "4539 %04d %04d %04d" % (secrets.randbelow(10000), secrets.randbelow(10000),
                                    secrets.randbelow(10000))


def fmt_date(ms):
    return time.strftime("%b %d, %Y", time.localtime(ms / 1000))


def fmt_dt(ms):
    return time.strftime("%b %d, %Y · %H:%M", time.localtime(ms / 1000))


# ---------------------------------------------------------------- notify ---
def notify(db, user_id, title, body, created_at=None, link=""):
    """Record a branded alert. `link` is an in-app route the customer can open."""
    db["notifications"].append({
        "id": nid(), "user_id": user_id, "title": title, "body": body,
        "read": False, "created_at": created_at or now_ms(),
        "from_email": ALERTS_EMAIL, "link": (link or "#/app")[:80],
    })
    if len(db["notifications"]) > 4000:
        db["notifications"] = db["notifications"][-3000:]


def log_declined(db, user_id, kind, reason, message="", tx_ref=""):
    """Append to the back-office declined log.

    kind: 'attempt'  — a restricted customer tried to move money
          'transaction' — an administrator declined a pending item
          'account'  — the account itself was frozen/restricted
    """
    db.setdefault("declined_logs", [])
    entry = {"id": nid(), "ref": ref_code("DL"), "user_id": user_id, "kind": kind,
             "reason": (reason or "")[:200], "message": (message or "")[:1000],
             "tx_ref": tx_ref or "", "resolved": False, "mailed": False,
             "mail_subject": "", "created_at": now_ms()}
    db["declined_logs"].append(entry)
    return entry


def notify_admins(db, title, body):
    for u in db["users"]:
        if u.get("role") == "admin":
            notify(db, u["id"], title, body)


# ----------------------------------------------------------------- audit ---
def audit(db, actor, action, target="", severity="info", **meta):
    db["audit"].append({
        "id": nid(), "ts": now_ms(),
        "actor_id": actor.get("id") if actor else None,
        "actor": actor.get("email", "system") if actor else "system",
        "action": action, "target": str(target), "severity": severity,
        "meta": meta or {},
    })
    if len(db["audit"]) > 6000:
        db["audit"] = db["audit"][-5000:]


# ----------------------------------------------------------- fx / limits ---
def fx_to_usd(db, amount, currency):
    rate = db["settings"]["fx"].get(currency, 1.0) or 1.0
    return r2(float(amount) / rate)


def usd_to(db, amount_usd, currency):
    rate = db["settings"]["fx"].get(currency, 1.0) or 1.0
    return r2(float(amount_usd) * rate)


def spent_today_usd(db, account):
    """Sum of today's outgoing transfer/payment/exchange volume on an account (USD-eq)."""
    start = now_ms() - (now_ms() % DAY_MS)
    total = 0.0
    for t in db["transactions"]:
        if t.get("account_id") != account["id"] or t.get("created_at", 0) < start:
            continue
        if t["type"] in ("transfer_out", "payment", "exchange_out", "fee") and t["amount"] < 0:
            total += fx_to_usd(db, -t["amount"], account["currency"])
    return r2(total)


# --------------------------------------------------------- ledger engine ---
def post(db, account, amount, tx_type, status="completed", counterparty="", note="",
         category="", method="", pair=None, fee=0.0, extra=None, created_at=None):
    """Post one signed ledger entry against `account` and move its balance.

    amount > 0 credits, amount < 0 debits. Pending entries hold the funds by
    debiting immediately (status flips later without touching balances again).
    Returns the transaction dict.
    """
    amount = r2(amount)
    entry = {
        "id": nid(), "ref": ref_code(), "account_id": account["id"],
        "user_id": account["user_id"], "currency": account["currency"],
        "type": tx_type, "amount": amount, "status": status,
        "counterparty": counterparty[:80], "note": (note or "")[:200],
        "category": category, "method": method, "pair": pair,
        "fee": r2(fee),
        "balance_after": None, "created_at": created_at or now_ms(),
    }
    if status == "completed":
        account["balance"] = r2(account["balance"] + amount)
        entry["balance_after"] = account["balance"]
    elif status == "pending":
        if amount < 0:
            # outgoing hold: take the money now; approval just completes the entry
            account["balance"] = r2(account["balance"] + amount)
            entry["balance_after"] = account["balance"]
        else:
            # incoming credit (e.g. deposit): wait for approval — no balance change yet
            entry["balance_after"] = None
    if extra:
        entry.update(extra)
    db["transactions"].append(entry)
    return entry


def complete_pending(db, tx_id, approve=True, reason=""):
    """Resolve a pending entry.

    Outgoing holds (amount < 0): money already left — reject refunds it.
    Incoming credits (amount > 0, e.g. deposits): nothing moved yet —
    approve credits the balance now, reject simply discards the request.
    """
    target = None
    for t in db["transactions"]:
        if t["id"] == tx_id:
            target = t
            break
    if not target or target["status"] != "pending":
        return None
    acct = find_account(db, target["account_id"])
    if approve:
        if acct and target["amount"] > 0:
            acct["balance"] = r2(acct["balance"] + target["amount"])
        target["status"] = "completed"
        if acct:
            target["balance_after"] = acct["balance"]
    else:
        if acct and target["amount"] < 0:   # refund the outgoing hold
            acct["balance"] = r2(acct["balance"] - target["amount"])
        target["status"] = "rejected"
        if reason:
            target["note"] = (target["note"] + " · " + reason)[:200]
    return target


def reverse_tx(db, tx_id, reason=""):
    """Reverse a completed entry with an opposite mirrored one. Returns (orig, rev)."""
    orig = None
    for t in db["transactions"]:
        if t["id"] == tx_id:
            orig = t
            break
    if not orig or orig["status"] not in ("completed", "pending"):
        return None, None
    acct = find_account(db, orig["account_id"])
    if orig["status"] == "pending":
        complete_pending(db, tx_id, approve=False, reason=reason or "Reversed by admin")
        return orig, None
    rev = {
        "id": nid(), "ref": ref_code("RV"), "account_id": orig["account_id"],
        "user_id": orig["user_id"], "currency": orig["currency"],
        "type": "reversal", "amount": r2(-orig["amount"]), "status": "completed",
        "counterparty": orig["counterparty"], "note": ("Reversal of %s · %s" % (orig["ref"], reason))[:200],
        "category": "", "method": "", "pair": orig["pair"], "fee": 0,
        "created_at": now_ms(),
    }
    if acct:
        acct["balance"] = r2(acct["balance"] + rev["amount"])
        rev["balance_after"] = acct["balance"]
    orig["status"] = "reversed"
    db["transactions"].append(rev)
    return orig, rev


def pair_id():
    return secrets.token_hex(6)


# --------------------------------------------------- savings interest pass --
def settle_interest(db):
    """Lazily credit daily savings interest (whole days elapsed since last accrual)."""
    now = now_ms()
    apy = float(db["settings"].get("savings_apy", 0)) / 100.0
    changed = False
    if apy <= 0:
        return False
    daily = apy / 365.0
    for a in db["accounts"]:
        if a.get("kind") != "savings" or a.get("frozen"):
            continue
        last = a.get("last_interest_at") or a.get("created_at", now)
        whole_days = int((now - last) // DAY_MS)
        if whole_days < 1 or a["balance"] <= 0:
            continue
        interest = r2(a["balance"] * daily * min(whole_days, 30))
        if interest >= 0.01:
            post(db, a, interest, "interest", counterparty="Zentra Bank",
                 note="Savings interest · %dd @ %.2f%% APY" % (whole_days, apy * 100))
            a["last_interest_at"] = last + whole_days * DAY_MS
            changed = True
        else:
            a["last_interest_at"] = last + whole_days * DAY_MS
    return changed
