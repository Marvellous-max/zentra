"""Zentra Bank — optional real outbound email (zero-dependency, stdlib only).

Activate real email by setting these environment variables. When they are
absent the module is inert (``available()`` returns False) and the whole app
silently keeps working in-app only — nothing breaks.

  SMTP_HOST       e.g. smtp.resend.com / smtp.gmail.com
  SMTP_PORT       587 (STARTTLS) or 465 (SSL)
  SMTP_USER       the account / API key username
  SMTP_PASS       the account password or API key
  SMTP_FROM       the real sender address (must be a domain you own/verified)

If SMTP_PORT == 465 the connection uses implicit TLS; otherwise STARTTLS
on the given port (587 typical). Sending is best-effort: failures are
swallowed and logged to stderr so the caller's in-app record still stands.
"""
import logging
import os
import smtplib
from email.message import EmailMessage

_log = logging.getLogger("mail")

DEFAULT_FROM = os.environ.get("SMTP_FROM", "alerts@zentra.bank")


def available():
    return bool(os.environ.get("SMTP_HOST"))


def send(to_addr, subject, body_txt, body_html=None, sender=None):
    """Send one message. Returns True if delivered or skipped (no SMTP)."""
    if not to_addr:
        return False
    if not available():
        # Not configured — this is the in-app-only mode; report as "shown".
        return None
    sender = sender or DEFAULT_FROM
    try:
        msg = EmailMessage()
        msg["From"] = "Zentra Bank <%s>" % sender
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.set_content(body_txt or "")
        if body_html:
            msg.add_alternative(body_html, subtype="html")
        port = int(os.environ.get("SMTP_PORT", "587"))
        host = os.environ["SMTP_HOST"]
        user = os.environ.get("SMTP_USER", "")
        pwd = os.environ.get("SMTP_PASS", "")
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=20) as s:
                if user:
                    s.login(user, pwd)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=20) as s:
                s.ehlo()
                s.starttls()
                s.ehlo()
                if user:
                    s.login(user, pwd)
                s.send_message(msg)
        _log.info("outbound mail to %s subject=%r", to_addr, subject)
        return True
    except Exception as e:  # never let mail problems take down a request
        _log.warning("mail to %s failed: %s", to_addr, e)
        return False