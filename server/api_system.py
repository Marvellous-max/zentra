"""System console endpoints — health, money rules, backups, sessions, maintenance.

These power the “Backend management” page. Admin role required throughout.
"""
import json
import os
import platform
import sys
import time

import authx
import routing
import store
from routing import route, ApiError

VERSION = store.new_db()["meta"]["version"]

BOOL_KEYS = ["maintenance_mode", "registrations_open", "deposits_enabled",
             "transfers_internal_enabled", "transfers_external_enabled",
             "payments_enabled", "exchange_enabled", "loans_enabled", "cards_enabled"]

NUM_KEYS = {  # key -> (min, max)
    "min_deposit": (0, 100000), "max_transfer_single": (0, 10_000_000),
    "daily_transfer_limit": (0, 100_000_000), "external_auto_limit": (0, 10_000_000),
    "kyc_required_over": (0, 10_000_000), "transfer_fee_pct": (0, 10),
    "external_fee_pct": (0, 15), "external_fee_min": (0, 500),
    "exchange_fee_pct": (0, 10), "card_issue_fee": (0, 500),
    "savings_apy": (0, 20), "loan_apr": (0, 100),
    "min_loan": (1, 1_000_000), "max_loan": (1, 100_000_000),
}
VALID_TERMS = [3, 6, 12, 24, 36, 48]


def db_size_bytes():
    try:
        return os.path.getsize(store.DB_PATH)
    except OSError:
        return 0


@route("GET", "/api/system/status", auth="admin")
def status(ctx):
    db = ctx["db"]
    t0 = time.time()
    _ = len(db["transactions"])          # touch the live dataset
    latency = round((time.time() - t0) * 1000, 2)

    savings = [a for a in db["accounts"] if a.get("kind") == "savings"]
    pending_payouts = sum(1 for t in db["transactions"]
                          if t["type"] == "transfer_out" and t["status"] == "pending")
    counts = {c: len(db[c]) for c in ("users", "accounts", "cards", "transactions",
                                      "loans", "notifications", "messages", "audit", "sessions")}
    s = db["settings"]
    active_sessions = [x for x in db["sessions"]]
    return {
        "version": VERSION,
        "uptime_s": int(time.time() - store.started_at()),
        "server_time": store.now_ms(),
        "python": sys.version.split()[0],
        "platform": "%s %s" % (platform.system(), platform.release()),
        "db_path": os.path.relpath(store.DB_PATH, store.BASE_DIR),
        "db_size_kb": round(db_size_bytes() / 1024.0, 1),
        "latency_ms": latency,
        "counts": counts,
        "active_sessions": len(active_sessions),
        "engine": {
            "savings_apy": s.get("savings_apy"),
            "savings_accounts": len(savings),
            "lazy_settlement": "daily interest credited on first touch after midnight",
            "pending_items": pending_payouts,
        },
        "flags": {k: bool(s.get(k)) for k in BOOL_KEYS},
    }


@route("GET", "/api/system/settings", auth="admin")
def get_settings(ctx):
    db = ctx["db"]
    return {"settings": db["settings"], "valid_terms": VALID_TERMS}


@route("PUT", "/api/system/settings", auth="admin")
def put_settings(ctx):
    db = ctx["db"]
    b = ctx["body"]
    changes = []
    s = db["settings"]

    for k in BOOL_KEYS:
        if k in b:
            v = bool(b[k])
            if s.get(k) != v:
                changes.append((k, s.get(k), v))
                s[k] = v

    for k, (lo, hi) in NUM_KEYS.items():
        if k in b and b[k] not in ("", None):
            try:
                v = store.r2(float(b[k]))
            except (TypeError, ValueError):
                raise ApiError("%s must be a number." % k)
            if v < lo or v > hi:
                raise ApiError("%s must be between %s and %s." % (k, lo, hi))
            if s.get(k) != v:
                changes.append((k, s.get(k), v))
                s[k] = v

    if "site_name" in b:
        name = (b["site_name"] or "").strip()[:30]
        if len(name) >= 2 and name != s.get("site_name"):
            changes.append(("site_name", s.get("site_name"), name))
            s["site_name"] = name
    if "support_email" in b:
        em = (b["support_email"] or "").strip()[:80]
        if "@" in em and em != s.get("support_email"):
            changes.append(("support_email", s.get("support_email"), em))
            s["support_email"] = em

    if "loan_terms_months" in b:
        raw = b["loan_terms_months"]
        if isinstance(raw, str):
            raw = [x for x in raw.replace("[", "").replace("]", "").split(",") if x.strip()]
        try:
            terms = sorted({int(x) for x in raw})
        except (TypeError, ValueError):
            raise ApiError("Loan terms must be integers.")
        terms = [t for t in terms if t in VALID_TERMS]
        if not terms:
            raise ApiError("Pick at least one valid term (%s)." % VALID_TERMS)
        if terms != s.get("loan_terms_months"):
            changes.append(("loan_terms_months", s.get("loan_terms_months"), terms))
            s["loan_terms_months"] = terms

    if "fx" in b and isinstance(b["fx"], dict):
        fx = dict(s.get("fx") or {})
        for cur, val in b["fx"].items():
            cur = str(cur).upper()
            if cur not in store.CURRENCIES:
                continue
            try:
                v = float(val)
            except (TypeError, ValueError):
                raise ApiError("FX rate for %s must be a number." % cur)
            if v <= 0 or v > 10000:
                raise ApiError("FX rate for %s out of range." % cur)
            if cur == "USD" and abs(v - 1.0) > 1e-9:
                raise ApiError("USD is the base currency — its rate stays 1.")
            if fx.get(cur) != v:
                changes.append(("fx.%s" % cur, fx.get(cur), v))
                fx[cur] = v
        s["fx"] = fx

    if not changes:
        return {"ok": True, "changed": [], "settings": s}

    for k, old, new in changes:
        store.audit(db, ctx["user"], "system.setting_change", k,
                    severity="warn", old=old, new=new)
    return {"ok": True, "changed": [{"key": k, "old": o, "new": n} for k, o, n in changes],
            "settings": s}


@route("POST", "/api/system/revoke-sessions", auth="admin")
def revoke_sessions(ctx):
    db = ctx["db"]
    keep_token = ctx.get("token")
    before = len(db["sessions"])
    db["sessions"] = [s for s in db["sessions"] if s.get("token") == keep_token]
    killed = before - len(db["sessions"])
    store.audit(db, ctx["user"], "system.revoke_sessions", "*", severity="warn", killed=killed)
    return {"ok": True, "killed": killed}


@route("GET", "/api/system/export", auth="admin")
def export_db(ctx):
    payload = json.dumps(store.load(), indent=1, default=str)
    fname = "zentra-backup-%s.json" % time.strftime("%Y%m%d-%H%M%S")
    store.audit(ctx["db"], ctx["user"], "system.export", fname)
    return routing.RawResponse(payload, "application/json; charset=utf-8",
                               disposition='attachment; filename="%s"' % fname)


@route("POST", "/api/system/import", auth="admin")
def import_db(ctx):
    raw = ctx["body"].get("payload")
    if isinstance(raw, dict):
        data = raw
    else:
        try:
            data = json.loads(raw or "")
        except (TypeError, ValueError):
            raise ApiError("That doesn't look like a valid Zentra backup file.")
    if not isinstance(data, dict) or "users" not in data or "accounts" not in data \
            or "transactions" not in data or "settings" not in data:
        raise ApiError("Backup is missing core collections (users/accounts/transactions/settings).")
    store.replace_all(data)
    # re-log on the fresh db so the action itself is auditable
    fresh = store.load()
    admin = None
    for u in fresh["users"]:
        if u.get("role") == "admin":
            admin = u
            break
    store.audit(fresh, {"email": ctx["user"]["email"]}, "system.import", "*",
                severity="critical")
    return {"ok": True, "users": len(fresh["users"]), "accounts": len(fresh["accounts"]),
            "admin_email": admin["email"] if admin else None}


@route("POST", "/api/system/reset", auth="admin")
def reset_demo(ctx):
    import seed
    seed.fresh()
    fresh = store.load()
    admin = next(u for u in fresh["users"] if u.get("role") == "admin")
    token = authx.issue_token(fresh, admin["id"], ctx.get("ua", ""), ctx.get("ip", ""))
    store.audit(fresh, {"email": ctx["user"]["email"]}, "system.reset", "*",
                severity="critical", mode="demo")
    store.save()
    return {"ok": True, "token": token,
            "credentials": {"admin": "admin@zentra.bank / Admin@1234",
                            "demo": "demo@zentra.bank / Demo@1234"}}


@route("POST", "/api/system/vacuum", auth="admin")
def vacuum(ctx):
    before = db_size_bytes()
    store.save()
    after = db_size_bytes()
    store.audit(ctx["db"], ctx["user"], "system.vacuum", "*",
                before_kb=round(before / 1024.0, 1), after_kb=round(after / 1024.0, 1))
    return {"ok": True, "before_kb": round(before / 1024.0, 1),
            "after_kb": round(after / 1024.0, 1)}
