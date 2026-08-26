"""Auth endpoints: register, login, logout, me."""
import secrets

import authx
import routing
import store
from routing import route, ApiError


def _open_account(db, user, label, kind, currency):
    acct = {
        "id": store.nid(), "user_id": user["id"], "label": label,
        "number": store.gen_account_number(), "currency": currency,
        "kind": kind,  # checking | savings
        "balance": 0.0, "frozen": False,
        "created_at": store.now_ms(),
    }
    if kind == "savings":
        acct["last_interest_at"] = store.now_ms()
    db["accounts"].append(acct)
    return acct


def open_account(db, user, label="Everyday Checking", kind="checking", currency="USD"):
    return _open_account(db, user, label, kind, currency)


def _valid_password(pw):
    return bool(pw) and len(pw) >= 8 and any(c.isdigit() for c in pw) and any(c.isalpha() for c in pw)


@route("POST", "/api/auth/register")
def register(ctx):
    db = ctx["db"]
    if not db["settings"].get("registrations_open", True):
        raise ApiError("Registration is temporarily closed. Please check back soon.", 503)
    b = ctx["body"]
    name = (b.get("name") or "").strip()
    email = (b.get("email") or "").strip().lower()
    password = b.get("password") or ""
    currency = b.get("currency") or "USD"
    if currency not in store.CURRENCIES:
        currency = "USD"
    if len(name) < 2:
        raise ApiError("Please enter your full name.")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise ApiError("Please enter a valid email address.")
    if store.find_user_by_email(db, email):
        raise ApiError("An account with this email already exists.")
    if not _valid_password(password):
        raise ApiError("Password must be 8+ characters and mix letters with numbers.")
    pin = str(b.get("pin") or "").strip()
    if not (len(pin) == 4 and pin.isdigit()):
        raise ApiError("Choose a 4-digit transaction PIN — you'll use it to authorize transfers.")

    user = {
        "id": store.nid(), "name": name, "email": email,
        "password": authx.hash_password(password), "role": "user",
        "tx_pin": store.hash_pin(pin),
        "phone": "", "address": "", "country": b.get("country") or "",
        "hue": secrets.randbelow(360),
        "kyc_status": "unverified", "kyc_doc": "", "kyc_note": "", "kyc_submitted_at": None,
        "prefs": {"email_alerts": True, "push_alerts": True},
        "suspended": False,
        "joined_at": store.now_ms(), "last_login_at": None,
    }
    db["users"].append(user)
    acct = open_account(db, user, "Everyday Checking", "checking", currency)
    token = authx.issue_token(db, user["id"], ctx.get("ua", ""), ctx.get("ip", ""))
    store.notify(db, user["id"], "Welcome to %s 🎉" % db["settings"]["site_name"],
                 "Your %s account %s is open and ready. Add money to get started."
                 % (acct["label"], acct["number"]),
                 link="#/app/accounts")
    store.audit(db, {"email": email}, "auth.register", "user:%d" % user["id"])
    return {"token": token, "user": store.public_user(user), "account": acct}


@route("POST", "/api/auth/login")
def login(ctx):
    db = ctx["db"]
    email = (ctx["body"].get("email") or "").strip().lower()
    password = ctx["body"].get("password") or ""
    user = store.find_user_by_email(db, email)
    if not user or not authx.verify_password(password, user["password"]):
        store.audit(db, {"email": email or "?"}, "auth.failed", severity="warn")
        raise ApiError("Wrong email or password.", 401)
    if user.get("suspended"):
        raise ApiError("This account is suspended. Contact support.", 403)
    token = authx.issue_token(db, user["id"], ctx.get("ua", ""), ctx.get("ip", ""))
    user["last_login_at"] = store.now_ms()
    store.audit(db, user, "auth.login", "user:%d" % user["id"])
    return {"token": token, "user": store.public_user(user)}


@route("POST", "/api/auth/logout", auth="user")
def logout(ctx):
    tok = ctx.get("token")
    db = ctx["db"]
    db["sessions"] = [s for s in db["sessions"] if s.get("token") != tok]
    return {"ok": True}


@route("GET", "/api/auth/me", auth="user")
def me(ctx):
    db = ctx["db"]
    unread = sum(1 for n in db["notifications"]
                 if n["user_id"] == ctx["user"]["id"] and not n.get("read"))
    return {
        "user": store.public_user(ctx["user"]),
        "unread": unread,
        "site_name": db["settings"]["site_name"],
        "maintenance": bool(db["settings"].get("maintenance_mode")),
        "currencies": store.CURRENCIES,
    }
