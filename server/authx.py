"""Password hashing (PBKDF2-HMAC-SHA256) and bearer session tokens."""
import hashlib
import hmac
import secrets

import store

ITERATIONS = 120_000


def hash_password(pw):
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt.encode("utf-8"), ITERATIONS, dklen=64)
    return "pbkdf2$%d$%s$%s" % (ITERATIONS, salt, h.hex())


def verify_password(pw, stored):
    try:
        algo, iters, salt, hx = stored.split("$", 3)
        if algo != "pbkdf2":
            return False
        h = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt.encode("utf-8"),
                                int(iters), dklen=64)
        return hmac.compare_digest(h.hex(), hx)
    except Exception:
        return False


def issue_token(db, user_id, ua="", ip=""):
    token = secrets.token_hex(32)
    db["sessions"].append({
        "token": token, "user_id": user_id,
        "device": (ua or "Unknown device")[:120], "ip": (ip or "")[:64],
        "created_at": store.now_ms(), "last_seen": store.now_ms(),
    })
    if len(db["sessions"]) > 800:  # keep the table tidy
        db["sessions"] = db["sessions"][-600:]
    return token


def resolve_user(db, token):
    """Return the user for this token, or None. Suspended users are locked out."""
    if not token:
        return None
    now = store.now_ms()
    for s in db["sessions"]:
        if s.get("token") == token:
            u = store.find_user(db, s.get("user_id"))
            s["last_seen"] = now
            if not u or u.get("suspended"):
                return None
            u["last_login_at"] = u.get("last_login_at") or s.get("created_at")
            return u
    return None


def revoke_user_sessions(db, user_id, except_token=None):
    keep = []
    n = 0
    for s in db["sessions"]:
        if s.get("user_id") == user_id and s.get("token") != except_token:
            n += 1
            continue
        keep.append(s)
    db["sessions"] = keep
    return n
