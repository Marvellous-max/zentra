"""Zentra Bank — outbound email via HTTPS APIs (zero-dependency, stdlib only).

Render's free tier blocks outbound SMTP ports, so real email is sent through
providers' HTTPS APIs instead. The provider is auto-detected from environment
variables, in this order:

  1. Brevo  — BREVO_API_KEY  + BREVO_FROM    (free 300/day; sender verified by
              a confirmation email — no domain purchase needed)
  2. Resend — RESEND_API_KEY + RESEND_FROM   (free 100/day; a verified domain is
              required for a custom "from" address)
  3. SMTP   — SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM
              (kept for VPS/self-hosted deployments where SMTP is allowed)

Optional: MAIL_FROM_NAME (display name, default "Zentra Bank") and MAIL_FROM
(overrides the provider-specific sender address — handy once you own a domain).

When nothing is configured the module is inert: available() is False and
send() returns None, so the whole app keeps working in-app only.
"""
import json
import logging
import os
import smtplib
import urllib.request
from email.message import EmailMessage

_log = logging.getLogger("mail")

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
RESEND_URL = "https://api.resend.com/emails"

DEFAULT_FROM_NAME = os.environ.get("MAIL_FROM_NAME", "Zentra Bank")


def _env(name):
    """Env value with whitespace/newlines stripped (Render paste-safe)."""
    v = os.environ.get(name)
    return v.strip() if isinstance(v, str) else v


# --------------------------------------------------------------- provider ---
def provider():
    """'brevo' | 'resend' | 'smtp' | None — first configured wins."""
    if _env("BREVO_API_KEY"):
        return "brevo"
    if _env("RESEND_API_KEY"):
        return "resend"
    if _env("SMTP_HOST"):
        return "smtp"
    return None


def available():
    return provider() is not None


def from_address():
    """The real sender mailbox (must be verified in the provider's console)."""
    return (_env("MAIL_FROM") or _env("BREVO_FROM") or _env("RESEND_FROM")
            or _env("SMTP_FROM") or "alerts@zentra.bank")


def from_name():
    return DEFAULT_FROM_NAME


# ------------------------------------------------------------ branding ------
def _esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _branded_html(inner_html):
    """Wrap message content in the Zentra-branded email frame."""
    return (
        '<div style="margin:0;padding:24px;background:#eef4f9;'
        'font-family:Arial,Helvetica,sans-serif">'
        '<div style="max-width:560px;margin:0 auto;background:#ffffff;'
        'border-radius:12px;overflow:hidden;border:1px solid #dbe6ee">'
        '<div style="background:#003b5c;padding:18px 24px">'
        '<span style="color:#ffffff;font-size:20px;font-weight:bold;'
        'letter-spacing:-.01em">Zentra</span>'
        '<span style="display:block;color:#9fc3dd;font-size:12px;margin-top:2px">'
        'Banking designed around you</span></div>'
        '<div style="padding:24px;color:#1c3242;font-size:14px;line-height:1.65">'
        + inner_html +
        '</div>'
        '<div style="padding:14px 24px;background:#f7fafc;border-top:1px solid #dbe6ee;'
        'color:#7b93a6;font-size:11.5px;line-height:1.6">'
        'Zentra Bank, N.A. &#183; Member FDIC &#183; Equal Housing Lender<br>'
        'Manage alerts in your Zentra inbox. We will never ask for your password '
        'or transaction PIN by email.</div>'
        '</div></div>'
    )


def _text_to_html(body_txt):
    paras = [p for p in str(body_txt or "").split("\n\n") if p.strip()]
    return "".join("<p>%s</p>" % _esc(p).replace("\n", "<br>") for p in paras) or "<p></p>"


# ------------------------------------------------------------------ send ----
def _post(url, payload, headers):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=12) as resp:
        return 200 <= resp.status < 300


def _send_brevo(to_addr, subject, body_txt, body_html, sender):
    payload = {
        "sender": {"name": from_name(), "email": sender},
        "to": [{"email": to_addr}],
        "subject": subject,
        "textContent": body_txt or "",
        "htmlContent": _branded_html(body_html or _text_to_html(body_txt)),
    }
    return _post(BREVO_URL, payload, {
        "api-key": _env("BREVO_API_KEY"),
        "content-type": "application/json",
        "accept": "application/json",
    })


def _send_resend(to_addr, subject, body_txt, body_html, sender):
    payload = {
        "from": "%s <%s>" % (from_name(), sender),
        "to": [to_addr],
        "subject": subject,
        "text": body_txt or "",
        "html": _branded_html(body_html or _text_to_html(body_txt)),
    }
    return _post(RESEND_URL, payload, {
        "Authorization": "Bearer " + _env("RESEND_API_KEY"),
        "content-type": "application/json",
    })


def _send_smtp(to_addr, subject, body_txt, body_html, sender):
    msg = EmailMessage()
    msg["From"] = "%s <%s>" % (from_name(), sender)
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.set_content(body_txt or "")
    if body_html:
        msg.add_alternative(_branded_html(body_html), subtype="html")
    port = int(os.environ.get("SMTP_PORT", "587"))
    host = _env("SMTP_HOST")
    user, pwd = _env("SMTP_USER") or "", _env("SMTP_PASS") or ""
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=20) as s:
            if user:
                s.login(user, pwd)
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=20) as s:
            s.ehlo(); s.starttls(); s.ehlo()
            if user:
                s.login(user, pwd)
            s.send_message(msg)
    return True


def send(to_addr, subject, body_txt, body_html=None, sender=None):
    """Send one branded message.

    Returns True (delivered), False (attempted but failed),
    or None (no provider configured — in-app-only mode).
    """
    mode = provider()
    if not to_addr or mode is None:
        return None if mode is None else False
    sender = sender or from_address()
    try:
        if mode == "brevo":
            ok = _send_brevo(to_addr, subject, body_txt, body_html, sender)
        elif mode == "resend":
            ok = _send_resend(to_addr, subject, body_txt, body_html, sender)
        else:
            ok = _send_smtp(to_addr, subject, body_txt, body_html, sender)
        _log.info("outbound mail via %s to %s subject=%r ok=%s", mode, to_addr, subject, ok)
        return ok
    except Exception as e:  # never let mail problems take down a request
        _log.warning("mail via %s to %s failed: %s", mode, to_addr, e)
        return False
