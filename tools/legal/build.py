#!/usr/bin/env python3
"""Build the printable Zentra legal document set (private — not served).

Reads legal/documents.json (the single source of truth) and writes, for every
document:

    legal/print/<id>.html   standalone, self-contained page
    legal/pdf/<id>.pdf      print-ready PDF (requires Chrome)

These live outside public/, so the web server never serves them; open the
files locally and send them to a customer yourself.

Usage
    python3 tools/legal/build.py              # HTML + PDF
    python3 tools/legal/build.py --html       # HTML only
    python3 tools/legal/build.py --doc aml-kyc
    python3 tools/legal/build.py --pdf --out /tmp/legal

Zero third-party dependencies: stdlib json/html + Chrome headless for PDF.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "legal", "documents.json")
OUT_HTML = os.path.join(ROOT, "legal", "print")
OUT_PDF = os.path.join(ROOT, "legal", "pdf")

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]


def find_chrome():
    env = os.environ.get("CHROME_BIN")
    if env and os.path.isfile(env):
        return env
    for path in CHROME_CANDIDATES:
        if os.path.isfile(path):
            return path
    return None


# --------------------------------------------------------------- rendering --
def esc(s):
    return (str(s if s is not None else "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


def fill(text, bank):
    """Escape text and substitute {{token}} placeholders from the bank header."""
    out, i, buf = [], 0, ""
    src = str(text)
    while i < len(src):
        if src.startswith("{{", i):
            j = src.find("}}", i)
            key = src[i + 2:j] if j != -1 else None
            if key and key in bank:
                out.append(esc(buf))
                buf = ""
                out.append(esc(bank[key]))
                i = j + 2
                continue
        buf += src[i]
        i += 1
    out.append(esc(buf))
    return "".join(out)


def render_table(t, bank):
    if not t:
        return ""
    head = "".join("<th>%s</th>" % fill(h, bank) for h in t.get("head") or [])
    rows = "".join(
        "<tr>%s</tr>" % "".join("<td>%s</td>" % fill(c, bank) for c in r)
        for r in t.get("rows") or [])
    return ('<div class="tw"><table><thead><tr>%s</tr></thead>'
            "<tbody>%s</tbody></table></div>" % (head, rows))


def render_list(items, ordered, bank):
    if not items:
        return ""
    tag = "ol" if ordered else "ul"
    body = "".join("<li>%s</li>" % fill(i, bank) for i in items)
    return "<%s class='dl'>%s</%s>" % (tag, body, tag)


def render_note(note, bank):
    if not note:
        return ""
    return '<aside class="note"><span class="ni">i</span><p>%s</p></aside>' % fill(note, bank)


def render_form(f, bank):
    if not f:
        return ""
    photo = (
        '<div class="idf-photo"><div class="photo-box">'
        '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" '
        'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">'
        '<circle cx="12" cy="8.6" r="3.9"></circle>'
        '<path d="M4.4 20.2c1.1-3.7 4-5.7 7.6-5.7s6.5 2 7.6 5.7"></path></svg>'
        "<span class='pb-label'>%s</span></div>"
        "<span class='pb-hint'>%s</span></div>" % (esc(f["photo_label"]), esc(f["photo_hint"])))
    docs = (
        "<div class='idf-docs'><span class='idf-label'>%s</span><ul class='tick-list'>%s</ul></div>"
        % (esc(f["document_label"]),
           "".join("<li><span class='tick'></span>%s</li>" % esc(o)
                   for o in f.get("document_options") or [])))
    fields = "<div class='idf-fields'>%s</div>" % "".join(
        "<label class='idf-field'><span>%s</span><i></i></label>" % esc(row[0])
        for row in f.get("fields") or [])
    signs = (
        "<div class='idf-signs'>"
        "<div class='sign-box tall'><i></i><span>%s</span><em>%s</em></div>"
        "<div class='sign-box tall'><i></i><span>%s</span></div>"
        "<div class='sign-box'><i></i><span>%s</span></div>"
        "</div>" % (esc(f["signature_label"]), esc(f["signature_hint"]),
                    esc(f["officer_label"]), esc(f["date_label"])))
    return (
        '<section class="idform" id="customer-identification-form">'
        '<div class="idf-head"><h3>%s</h3><span class="idf-ref">%s</span></div>'
        '<p class="idf-lead">%s</p>'
        '<div class="idf-top">%s%s</div>%s'
        '<div class="idf-declaration"><span class="idf-label">Declaration</span><p>%s</p></div>'
        '%s<p class="idf-return">%s</p></section>'
        % (esc(f["title"]), esc(f["ref"]), esc(f["lead"]), photo, docs, fields,
           esc(f["declaration"]), signs, fill(f["return_to"], bank)))


def render_section(sec, bank, idx):
    out = []
    if sec.get("h"):
        out.append('<h2 id="s%d">%s</h2>' % (idx, esc(sec["h"])))
    for key in sec:
        if key == "h":
            continue
        v = sec[key]
        if not v:
            continue
        if key in ("p", "p2", "p3", "lead"):
            items = v if isinstance(v, list) else [v]
            out.extend("<p>%s</p>" % fill(t, bank) for t in items)
        elif key == "ul":
            out.append(render_list(v, False, bank))
        elif key == "ol":
            out.append(render_list(v, True, bank))
        elif key == "table":
            out.append(render_table(v, bank))
        elif key == "note":
            out.append(render_note(v, bank))
        elif key == "form":
            out.append(render_form(v, bank))
    return '<section class="doc-sec">%s</section>' % "".join(out)


# ------------------------------------------------------------------- styles --
CSS = """
:root{--navy:#004977;--navy9:#00263e;--ink:#16283b;--muted:#52606d;--faint:#7b8894;
--line:#dde3ea;--line2:#c3ccd6;--tint:#eef4f9;--alt:#f4f6f8;--sky:#7fb3dd}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#fff;color:var(--ink);
font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
font-size:10.7pt;line-height:1.62}
.page{max-width:172mm;margin:0 auto;padding:16mm 4mm 22mm}
/* masthead */
.mast{border-bottom:2.4pt solid var(--navy);padding-bottom:7pt;
display:flex;justify-content:space-between;align-items:flex-end;gap:16pt}
.brand{display:flex;align-items:center;gap:7pt;font-family:-apple-system,BlinkMacSystemFont,
"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-weight:800;font-size:12.5pt;
letter-spacing:.055em;text-transform:uppercase;color:var(--navy9)}
.brand svg{display:block}
.brand em{font-style:normal;color:var(--sky);font-size:9pt}
.mast-r{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
font-size:7.6pt;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);
text-align:right;line-height:1.5}
/* title block */
.title{margin-top:16pt}
.eyebrow{display:flex;align-items:center;gap:7pt;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
font-size:7.6pt;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--navy)}
.eyebrow span.n{font-variant-numeric:tabular-nums;color:var(--faint);
border:.7pt solid var(--line2);border-radius:99pt;padding:.5pt 6pt}
h1{font-size:23pt;line-height:1.14;letter-spacing:-.02em;margin:9pt 0 7pt;color:var(--navy9);
break-after:avoid;page-break-after:avoid}
.sum{font-size:11.4pt;font-style:italic;color:var(--muted);line-height:1.6;
max-width:135mm;margin:0 0 11pt}
.meta{display:flex;flex-wrap:wrap;gap:0 14pt;font-family:-apple-system,BlinkMacSystemFont,
"Segoe UI",Roboto,Arial,sans-serif;font-size:8.2pt;color:var(--faint);
border-top:.7pt solid var(--line);border-bottom:.7pt solid var(--line);
padding:7pt 0;margin-bottom:16pt}
.meta b{font-weight:600;color:var(--muted)}
/* body */
.doc-sec{margin:0}
h2{font-size:13.2pt;color:var(--navy9);margin:17pt 0 6pt;letter-spacing:-.008em;
break-after:avoid;page-break-after:avoid;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
p{margin:0 0 8pt;color:#2c3e50;text-align:justify;hyphens:auto}
ul.dl,ol.dl{margin:0 0 9pt;padding-left:15pt;color:#2c3e50}
ul.dl li,ol.dl li{margin-bottom:4.5pt;text-align:justify}
ul.dl li::marker,ol.dl li::marker{color:var(--navy)}
.tw{margin:9pt 0 12pt;border:.7pt solid var(--line2);border-radius:3pt;overflow:hidden;
break-inside:auto}
table{width:100%;border-collapse:collapse;font-size:9.4pt}
thead{display:table-header-group}
th{background:var(--alt);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,
sans-serif;font-size:7.6pt;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
color:var(--muted);text-align:left;padding:6pt 8pt;border-bottom:.9pt solid var(--line2)}
td{padding:6pt 8pt;border-bottom:.7pt solid var(--line);vertical-align:top;color:#2c3e50}
tbody tr:last-child td{border-bottom:0}
tbody tr:nth-child(even) td{background:#fafbfc}
tr{break-inside:avoid;page-break-inside:avoid}
.note{display:flex;gap:8pt;align-items:flex-start;margin:10pt 0 12pt;padding:8pt 10pt;
background:var(--tint);border:.7pt solid #d8e6f2;border-left:2.6pt solid var(--navy);
border-radius:3pt;break-inside:avoid;page-break-inside:avoid}
.note .ni{flex:none;width:13pt;height:13pt;border-radius:50%;background:var(--navy);color:#fff;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
font-size:8.4pt;font-weight:800;line-height:13pt;text-align:center;font-style:normal}
.note p{margin:0;color:var(--navy9);font-size:9.6pt;font-weight:600;text-align:left}
/* identification form */
.idform{border:1.6pt solid var(--navy);border-radius:5pt;overflow:hidden;margin:14pt 0 10pt;
break-inside:avoid;page-break-inside:avoid}
.idf-head{display:flex;justify-content:space-between;align-items:baseline;gap:12pt;
background:var(--navy);color:#fff;padding:7pt 11pt}
.idf-head h3{margin:0;font-size:11pt;color:#fff;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:-.01em}
.idf-ref{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:7.6pt;
color:rgba(255,255,255,.75);white-space:nowrap}
.idf-lead{margin:0;padding:9pt 11pt 0;font-size:9.3pt;color:var(--muted);line-height:1.6}
.idf-label{display:block;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,
sans-serif;font-size:7.2pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
color:var(--navy);margin-bottom:6pt}
.idf-top{display:grid;grid-template-columns:44mm 1fr;gap:12pt;padding:10pt 11pt 0}
.photo-box{border:1.4pt dashed var(--line2);border-radius:3pt;aspect-ratio:35/45;
display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6pt;
padding:8pt;text-align:center;color:var(--line2);position:relative;overflow:hidden}
.photo-box::after{content:"";position:absolute;inset:4pt;border:.6pt solid #eef1f5;border-radius:2pt}
.photo-box svg{color:var(--line2)}
.pb-label{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
font-size:6.8pt;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
color:var(--muted);position:relative;z-index:1}
.pb-hint{display:block;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,
sans-serif;font-size:7.6pt;color:var(--faint);line-height:1.5;margin-top:6pt}
.tick-list{list-style:none;margin:0;padding:0}
.tick-list li{display:flex;gap:6pt;align-items:flex-start;margin-bottom:5pt;
font-size:8.7pt;color:var(--muted);line-height:1.45}
.tick{flex:none;width:9pt;height:9pt;margin-top:1.6pt;border:1pt solid var(--line2);
border-radius:1.5pt;background:#fff}
.idf-fields{display:grid;grid-template-columns:1fr 1fr;gap:8pt 14pt;padding:11pt 11pt 0}
.idf-field{display:flex;flex-direction:column;gap:2pt}
.idf-field span{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
font-size:7.4pt;font-weight:600;color:var(--muted);line-height:1.35}
.idf-field i{display:block;height:16pt;border-bottom:1.1pt solid var(--line2)}
.idf-declaration{padding:11pt 11pt 0}
.idf-declaration p{margin:0;background:var(--alt);border:.7pt solid var(--line);
border-radius:3pt;padding:8pt 9pt;font-size:8.4pt;line-height:1.62;color:var(--muted)}
.idf-signs{display:grid;grid-template-columns:1.35fr 1fr .8fr;gap:12pt;padding:11pt}
.sign-box{position:relative;display:flex;flex-direction:column;justify-content:flex-end;
gap:2pt;height:56pt;border:1.1pt solid var(--line2);border-radius:3pt;padding:5pt 7pt}
.sign-box.tall{height:66pt}
.sign-box i{position:absolute;left:7pt;right:7pt;top:46%;border-top:.8pt dashed var(--line2)}
.sign-box span{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
font-size:6.8pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
color:var(--muted);line-height:1.35}
.sign-box em{font-style:normal;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,
Arial,sans-serif;font-size:6.8pt;color:var(--faint);line-height:1.35}
.idf-return{margin:0;padding:0 11pt 10pt;font-family:-apple-system,BlinkMacSystemFont,
"Segoe UI",Roboto,Arial,sans-serif;font-size:7.8pt;color:var(--faint)}
/* closing */
.closing{margin-top:20pt;padding-top:10pt;border-top:.7pt solid var(--line);
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
font-size:8pt;color:var(--faint);line-height:1.65}
.closing .end{display:block;text-align:center;letter-spacing:.28em;text-transform:uppercase;
font-size:6.8pt;color:var(--line2);margin-top:8pt}
.scr{display:none}
@media screen{body{background:#eef1f5}.page{background:#fff;margin:24px auto;
box-shadow:0 3px 18px rgba(16,42,67,.16);border-radius:4px;padding-bottom:40px}
.scr{display:flex;justify-content:space-between;align-items:center;gap:12px;max-width:172mm;
margin:20px auto 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,
sans-serif;font-size:13px;color:#52606d}
.scr a{color:#0f62a8;font-weight:600;text-decoration:none}.scr a:hover{text-decoration:underline}
.scr button{font-family:inherit;font-size:13px;font-weight:600;color:#fff;background:#004977;
border:0;border-radius:6px;padding:8px 15px;cursor:pointer}}
@media print{@page{margin:15mm 14mm 16mm}.scr{display:none}
body{background:#fff}.page{max-width:none;margin:0;padding:0;box-shadow:none;border-radius:0}}
"""

JS = "function p(){window.print()}document.addEventListener('DOMContentLoaded',function(){"
JS += "var b=document.getElementById('print');if(b)b.onclick=p;});"


def shell_html(data, doc, index):
    bank = data.get("bank") or {}
    secs = doc.get("sections") or []
    body = "".join(render_section(s, bank, i) for i, s in enumerate(secs))
    nav = (
        "<div class='scr'><span><button id='print'>Print / save as PDF</button></span>"
        "<span>Document %s of %s</span></div>" % (index + 1, len(data["documents"])))
    return """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} &middot; {bank} Legal &amp; Disclosures</title>
<style>{css}</style></head><body>{nav}
<main class="page">
  <header class="mast">
    <div class="brand">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6.5 6h11l-7.5 5h7.5L8 18"/></svg>
      {bank}<em>&#9679;</em>
    </div>
    <div class="mast-r">Legal &amp; Disclosures<br>Document {num} of {total}</div>
  </header>

  <div class="title">
    <div class="eyebrow"><span class="n">{num}</span>{category}</div>
    <h1>{title}</h1>
    <p class="sum">{summary}</p>
    <div class="meta">
      <span><b>Effective</b> {effective}</span>
      <span><b>Last updated</b> {updated}</span>
      <span><b>Version</b> {version}</span>
      <span><b>Reference</b> {ref}</span>
    </div>
  </div>

  {body}

  <div class="closing">
    {bank} &middot; {address} &middot; {email} &middot; {phone}<br>
    This document forms part of your agreement with {bank}. Printed copies are
    available free of charge on request.
    <span class="end">End of document</span>
  </div>
</main>
<script>{js}</script>
</body></html>
""".format(css=CSS, js=JS, nav=nav,
           title=esc(doc["title"]), bank=esc(bank.get("name", "Zentra Bank")),
           num=esc(doc["number"]), total=len(data["documents"]),
           category=esc(doc.get("category", "")), summary=esc(doc.get("summary", "")),
           effective=esc(data.get("effective", "")), updated=esc(data.get("updated", "")),
           version=esc(data.get("version", "")),
           ref="%s-%s" % (data.get("version", "1.0"), doc["number"]),
           body=body, address=esc(bank.get("address", "")), email=esc(bank.get("email", "")),
           phone=esc(bank.get("phone", "")))


def chrome_print(chrome, html_path, pdf_path, wait=75):
    """Print one HTML file to PDF.

    Chrome on macOS writes the PDF promptly but can linger for a long time
    afterwards in its updater/shutdown path, so we wait for the output file
    to finish growing rather than for the process to exit.
    """
    if os.path.isfile(pdf_path):
        os.remove(pdf_path)

    profile = tempfile.mkdtemp(prefix="zentra-legal-")
    err = tempfile.NamedTemporaryFile(prefix="zentra-chrome-", suffix=".log",
                                      delete=False)
    err.close()
    cmd = [chrome,
           "--headless=new",
           "--disable-gpu",
           "--disable-dev-shm-usage",
           "--no-sandbox",
           "--no-first-run",
           "--no-default-browser-check",
           "--no-pdf-header-footer",
           "--disable-extensions",
           "--disable-background-networking",
           "--user-data-dir=" + profile,
           "--print-to-pdf=" + pdf_path,
           "file://" + html_path]
    proc = None
    try:
        with open(err.name, "wb") as fh:
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=fh)
        deadline = time.time() + wait
        last, stable = -1, 0
        while time.time() < deadline:
            time.sleep(0.25)
            if os.path.isfile(pdf_path):
                size = os.path.getsize(pdf_path)
                if size >= 1000:
                    stable = stable + 1 if size == last else 0
                    last = size
                    if stable >= 3:          # ~0.75 s with no growth
                        break
            if proc.poll() is not None:
                break
        if not os.path.isfile(pdf_path) or os.path.getsize(pdf_path) < 1000:
            tail = open(err.name, encoding="utf-8", errors="replace").read()[-900:]
            raise RuntimeError("chrome produced no PDF (rc=%s)\n%s" % (proc.poll(), tail))
        return os.path.getsize(pdf_path)
    finally:
        if proc is not None and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                proc.kill()
        shutil.rmtree(profile, ignore_errors=True)
        try:
            os.unlink(err.name)
        except OSError:
            pass


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--html", action="store_true", help="write HTML only (skip PDF)")
    mode.add_argument("--pdf", action="store_true", help="write PDF only (needs existing HTML)")
    ap.add_argument("--doc", help="build a single document id")
    ap.add_argument("--out", help="override the HTML output directory")
    args = ap.parse_args()

    with open(SRC, encoding="utf-8") as fh:
        data = json.load(fh)

    docs = data["documents"]
    if args.doc:
        docs = [d for d in docs if d["id"] == args.doc]
        if not docs:
            ap.error("unknown document id: %s" % args.doc)

    out_html = args.out or OUT_HTML
    out_pdf = OUT_PDF
    os.makedirs(out_html, exist_ok=True)

    written = []
    for i, doc in enumerate(docs):
        full = next(n for n, d in enumerate(data["documents"]) if d["id"] == doc["id"])
        path = os.path.join(out_html, doc["id"] + ".html")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(shell_html(data, doc, full))
        written.append((doc, path))
    print("html  %2d  ->  %s" % (len(written), os.path.relpath(out_html, ROOT)))

    if args.html:
        return 0

    chrome = find_chrome()
    if not chrome:
        print("PDF skipped: Chrome not found (set CHROME_BIN to override).", file=sys.stderr)
        return 2

    os.makedirs(out_pdf, exist_ok=True)
    ok, failed = 0, []
    for doc, path in written:
        pdf = os.path.join(out_pdf, doc["id"] + ".pdf")
        try:
            size = chrome_print(chrome, path, pdf)
            ok += 1
            print("pdf   ok   %-28s %6.1f KB" % (doc["id"], size / 1024.0))
        except Exception as exc:                      # noqa: BLE001
            failed.append(doc["id"])
            print("pdf   FAIL %-28s %s" % (doc["id"], exc), file=sys.stderr)
    print("pdf   %2d ok, %d failed  ->  %s" % (ok, len(failed), os.path.relpath(out_pdf, ROOT)))
    if failed:
        print("failed: %s" % ", ".join(failed), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
