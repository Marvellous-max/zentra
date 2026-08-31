"""Zentra — outbound email via HTTPS APIs (zero-dependency, stdlib only).

Provider auto-detect (env vars, first configured wins):
  1. Brevo  — BREVO_API_KEY + BREVO_FROM
  2. Resend — RESEND_API_KEY + RESEND_FROM
  3. SMTP   — SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM
Optional: MAIL_FROM_NAME (display name), MAIL_FROM (overrides sender address),
PUBLIC_URL (base URL for buttons, default https://zentraonline.dpdns.org).

send() renders every message in Zentra's branded letterhead with structured
detail rows, a reference line and a sign-in button. Tri-state returns:
True (delivered) / False (attempted, failed) / None (no provider configured).
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
PUBLIC_URL = (os.environ.get("PUBLIC_URL") or "https://zentraonline.dpdns.org").rstrip("/")
BROWSER_UA = "Mozilla/5.0 (compatible; ZentraBankMailer/1.0; +https://zentraonline.dpdns.org)"
DEFAULT_FROM_NAME = os.environ.get("MAIL_FROM_NAME", "Zentra")

# kind → (accent colour, chip label)
KINDS = {
    "success": ("#0f8a5f", "TRANSACTION RECEIPT"),
    "info": ("#1c5d99", "ACCOUNT UPDATE"),
    "warning": ("#b45309", "SECURITY NOTICE"),
    "critical": ("#b3261e", "ACTION REQUIRED"),
}


def _env(name):
    v = os.environ.get(name)
    return v.strip() if isinstance(v, str) else v


def provider():
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
    return (_env("MAIL_FROM") or _env("BREVO_FROM") or _env("RESEND_FROM")
            or _env("SMTP_FROM") or "alerts@zentra.bank")


def from_name():
    return DEFAULT_FROM_NAME


def _esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# ------------------------------------------------------------ design -------
FONT = ("font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,"
        "Helvetica,Arial,sans-serif")


def _greet_html(greet):
    if not greet:
        return ""
    return ('<p style="margin:14px 0 10px;color:#5a6f82;font-size:14px">Dear %s,</p>'
            % _esc(greet))


def _inner(inner):
    if inner and inner.strip():
        return ('<div style="margin:0 0 6px;color:#33475b;font-size:14.5px;'
                'line-height:1.7">%s</div>' % inner)
    return ""


def email_frame(kind="info", title="", greet="", inner="", rows=None,
                cta=None, ref=None, preheader=None):
    """Render the full Zentra letterhead.

    kind:   success | info | warning | critical  (accent colour + chip label)
    title:  headline, e.g. "Money sent"
    inner:  body paragraph(s), may be simple html
    rows:   list of (label, value) — value may contain simple html (e.g. <b>)
    cta:    "#/app/statements" or ("#/app/cards", "Manage cards")
    ref:    transaction reference string
    """
    accent, chip = KINDS.get(kind, KINDS["info"])
    rows = rows or []
    preheader = preheader or title

    rows_html = ""
    if rows:
        cells = ""
        for i, (k, v) in enumerate(rows):
            border = "border-top:1px solid #edf2f7;" if i else ""
            shown = v if str(v).startswith("<") else _esc(v)
            cells += (
                '<tr>'
                '<td style="%s padding:9px 0;color:#6b7f92;font-size:12.5px;'
                'letter-spacing:.02em">%s</td>'
                '<td style="%s padding:9px 0;text-align:right;color:#12283a;'
                'font-size:13.5px;font-weight:600">%s</td>'
                '</tr>' % (border, _esc(k), border, shown))
        rows_html = (
            '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" '
            'style="margin:18px 0 4px;border-top:2px solid #dbe4ec;'
            'border-bottom:1px solid #edf2f7">%s</table>' % cells)

    ref_html = ""
    if ref:
        ref_html = ('<p style="margin:10px 0 0;color:#8ea2b5;font-size:11.5px">'
                    'Reference&nbsp;&nbsp;<span style="font-family:Consolas,Menlo,monospace;'
                    'color:#5a6f82">%s</span></p>' % _esc(ref))

    cta_html = ""
    if cta:
        target, label = cta if isinstance(cta, tuple) else (cta, "Sign in to Zentra")
        href = target if target.startswith("http") else PUBLIC_URL + "/" + target.lstrip("#/")
        cta_html = (
            '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px">'
            '<tr><td style="background:#0b2a4a;border-radius:9px">'
            '<a href="%s" style="display:inline-block;padding:12px 26px;color:#ffffff;'
            'font-size:14px;font-weight:600;text-decoration:none">%s</a></td></tr></table>'
            % (_esc(href), _esc(label)))

    return f'''<div style="margin:0;padding:0;background:#eef2f7;{FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{_esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7"><tr><td align="center" style="padding:30px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dfe7ef">
<tr><td style="background:#0b2a4a;padding:20px 32px">
<table role="presentation" width="100%"><tr><td>
<table role="presentation" cellpadding="0"><tr>
<td style="padding-right:12px"><div style="width:38px;height:38px;background:#155a92;border-radius:10px;color:#ffffff;font-size:20px;font-weight:bold;text-align:center;line-height:38px">Z</div></td>
<td><span style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:-.01em">Zentra</span><br>
<span style="color:#8fb3d4;font-size:10px;letter-spacing:.18em">SECURE ACCOUNT NOTIFICATIONS</span></td>
</tr></table></td></tr></table></td></tr>
<tr><td style="height:4px;background:{accent};font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 6px">{_greet_html(greet)}
<div style="color:{accent};font-size:11px;font-weight:700;letter-spacing:.14em">{chip}</div>
<h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#12283a;font-weight:700">{_esc(title)}</h1>
{_inner(inner)}
{rows_html}{ref_html}{cta_html}
</td></tr>
<tr><td style="padding:6px 32px 26px">
<div style="border-top:1px solid #edf2f7;padding-top:14px;color:#8ea2b5;font-size:11.5px;line-height:1.7">
This is an automated message from Zentra. Never share your password or PIN &mdash; we will never email you asking for them.<br>
Questions? Reply to this email or use the support desk in your Zentra app.
</div></td></tr>
</table>
<p style="margin:14px 0 0;color:#9db0c2;font-size:10.5px">{_esc(PUBLIC_URL)}</p>
</td></tr></table></div>'''


def _text_to_html(body_txt):
    paras = [p for p in str(body_txt or "").split("\n\n") if p.strip()]
    return "".join(
        '<p style="margin:0 0 12px">%s</p>' % _esc(p).replace("\n", "<br>")
        for p in paras)


def _rows_to_text(rows):
    if not rows:
        return ""
    return "\n" + "\n".join(
        "· %s: %s" % (k, str(v).replace("<b>", "").replace("</b>", ""))
        for k, v in rows)


# ------------------------------------------------------------------ send ----
def _post(url, payload, headers):
    headers = dict(headers or {})
    headers.setdefault("User-Agent", BROWSER_UA)   # Cloudflare bans "Python-urllib" UA
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", "replace")[:200]
        except Exception:
            pass
        raise RuntimeError("HTTP %s %s" % (e.code, body)) from None


def _send_brevo(to_addr, subject, text_part, html_part, sender):
    payload = {
        "sender": {"name": from_name(), "email": sender},
        "to": [{"email": to_addr}],
        "subject": subject,
        "textContent": text_part,
        "htmlContent": html_part,
    }
    return _post(BREVO_URL, payload, {
        "api-key": _env("BREVO_API_KEY"),
        "content-type": "application/json",
        "accept": "application/json",
    })


def _send_resend(to_addr, subject, text_part, html_part, sender):
    payload = {
        "from": "%s <%s>" % (from_name(), sender),
        "to": [to_addr],
        "subject": subject,
        "text": text_part,
        "html": html_part,
    }
    return _post(RESEND_URL, payload, {
        "Authorization": "Bearer " + _env("RESEND_API_KEY"),
        "content-type": "application/json",
    })


def _send_smtp(to_addr, subject, text_part, html_part, sender):
    msg = EmailMessage()
    msg["From"] = "%s <%s>" % (from_name(), sender)
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.set_content(text_part or "")
    msg.add_alternative(html_part, subtype="html")
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


def send(to_addr, subject, body_txt, body_html=None, sender=None, kind="info",
         rows=None, cta=None, greet=None, ref=None):
    """Send one branded message. Tri-state: True / False / None (unconfigured)."""
    mode = provider()
    if not to_addr or mode is None:
        return None if mode is None else False
    sender = sender or from_address()
    rows = rows or []
    text_part = (body_txt or subject) + _rows_to_text(rows)
    html_part = email_frame(kind=kind, title=subject, greet=greet,
                            inner=body_html if body_html else _text_to_html(body_txt),
                            rows=rows, cta=cta, ref=ref,
                            preheader=(body_txt or subject)[:90])
    try:
        if mode == "brevo":
            ok = _send_brevo(to_addr, subject, text_part, html_part, sender)
        elif mode == "resend":
            ok = _send_resend(to_addr, subject, text_part, html_part, sender)
        else:
            ok = _send_smtp(to_addr, subject, text_part, html_part, sender)
        _log.info("outbound mail via %s to %s subject=%r ok=%s", mode, to_addr, subject, ok)
        return ok
    except Exception as e:
        _log.warning("mail via %s to %s failed: %s", mode, to_addr, e)
        return False
