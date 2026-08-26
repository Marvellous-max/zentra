"""Public (unauthenticated) endpoints: landing-page data + support inbox."""
import store
from routing import route, ApiError


@route("GET", "/api/public/bootstrap")
def bootstrap(ctx):
    db = ctx["db"]
    s = db["settings"]
    customers = [u for u in db["users"] if u.get("role") != "admin"]
    deposits = round(sum(store.fx_to_usd(db, a["balance"], a["currency"]) for a in db["accounts"]), 2)
    countries = {u.get("country") for u in customers if u.get("country")}
    return {
        "site_name": s["site_name"],
        "stats": {
            "customers": len(customers) + 48000,
            "deposits_usd": deposits,
            "transactions": len(db["transactions"]),
            "countries": max(len(countries), 12),
            "apy": s.get("savings_apy"),
            "uptime_pct": 99.99,
        },
        "fx": s.get("fx", {}),
        "fees": {
            "transfer_fee_pct": s.get("transfer_fee_pct"),
            "external_fee_pct": s.get("external_fee_pct"),
            "external_fee_min": s.get("external_fee_min"),
            "exchange_fee_pct": s.get("exchange_fee_pct"),
            "loan_apr": s.get("loan_apr"),
            "savings_apy": s.get("savings_apy"),
            "card_issue_fee": s.get("card_issue_fee"),
        },
        "loan_terms": sorted(s.get("loan_terms_months", [3, 6, 12, 24, 36, 48])),
        "currencies": ["USD", "EUR", "GBP"],
        "registrations_open": bool(s.get("registrations_open", True)),
        "support_email": s.get("support_email"),
    }


@route("POST", "/api/public/support")
def support_message(ctx):
    db = ctx["db"]
    b = ctx["body"]
    name = (b.get("name") or "").strip()
    email = (b.get("email") or "").strip().lower()
    subject = (b.get("subject") or "").strip()[:90]
    body = (b.get("body") or "").strip()[:1500]
    if len(name) < 2:
        raise ApiError("Please tell us your name.")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise ApiError("Please enter a valid email so we can reply.")
    if len(subject) < 3:
        raise ApiError("Please add a short subject.")
    if len(body) < 10:
        raise ApiError("Please describe your question in a bit more detail.")
    user = store.find_user_by_email(db, email)
    msg = {
        "id": store.nid(), "user_id": user["id"] if user else None,
        "name": name[:60], "email": email, "subject": subject, "body": body,
        "status": "open", "reply": "", "created_at": store.now_ms(),
    }
    db["messages"].append(msg)
    store.notify_admins(db, "New support message",
                        "%s · “%s”" % (name, subject))
    return {"ok": True}
