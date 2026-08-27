"""Zentra Bank — zero-dependency HTTP server (REST API + static frontend)."""
import json
import mimetypes
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
PORT = int(os.environ.get("PORT", "8788"))
HOST = os.environ.get("HOST", "0.0.0.0")   # bind all interfaces so Render/VPS reach it

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import store        # noqa: E402
import authx        # noqa: E402
import routing      # noqa: E402
import api_auth     # noqa: E402  (registers routes)
import api_public   # noqa: E402
import api_user     # noqa: E402
import api_admin    # noqa: E402
import api_system   # noqa: E402
from seed import seed_if_empty  # noqa: E402


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "Zentra/1.0"

    def log_message(self, fmt, *args):  # quieter logs
        sys.stderr.write("· %s %s\n" % (self.command, self.path))

    # ------------------------------------------------------------- output --
    def _send(self, code, payload, ctype="application/json; charset=utf-8"):
        body = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control",
                         "no-store" if ctype.startswith(("application/json", "text/html"))
                         else "max-age=300")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _send_raw(self, rr):
        self.send_response(rr.status)
        self.send_header("Content-Type", rr.ctype)
        self.send_header("Content-Length", str(len(rr.body)))
        if rr.disposition:
            self.send_header("Content-Disposition", rr.disposition)
        self.end_headers()
        try:
            self.wfile.write(rr.body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    # -------------------------------------------------------------- input --
    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > 5_000_000:  # room for backup restores
            raise routing.ApiError("Request body too large.", 413)
        raw = self.rfile.read(length)
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            raise routing.ApiError("Invalid JSON body.")

    def _token(self):
        h = self.headers.get("Authorization") or ""
        return h[7:].strip() if h.lower().startswith("bearer ") else None

    # --------------------------------------------------------------- verbs --
    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")

    def do_PUT(self):
        self._handle("PUT")

    def do_DELETE(self):
        self._handle("DELETE")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Allow", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ------------------------------------------------------------ dispatch --
    def _handle(self, method):
        parsed = urlparse(self.path)
        parts = [p for p in parsed.path.strip("/").split("/") if p]

        if not parts or parts[0] != "api":
            return self._static(method, parsed.path)

        db = store.load()
        try:
            r, params = routing.match(method, parts)
            if not r:
                raise routing.ApiError("Not found.", 404)
            ctx = {
                "db": db, "params": params,
                "query": {k: v[0] for k, v in parse_qs(parsed.query).items()},
                "body": {}, "user": None, "token": self._token(),
                "ua": self.headers.get("User-Agent") or "",
                "ip": self.client_address[0] if self.client_address else "",
            }
            if r["auth"]:
                user = authx.resolve_user(db, ctx["token"])
                if not user:
                    raise routing.ApiError("Session expired — please sign in again.", 401)
                if r["auth"] == "admin" and user.get("role") != "admin":
                    raise routing.ApiError("Admin access required.", 403)
                ctx["user"] = user

            if method in ("POST", "PUT", "DELETE"):
                ctx["body"] = self._read_body()

            # lazy engine: credit savings interest on every touch
            store.settle_interest(db)

            # maintenance gate: customers can browse but not move money
            if ctx["db"]["settings"].get("maintenance_mode"):
                blocked_auth = r["auth"] in ("user",) and method != "GET"
                is_admin_bypass = ctx["user"] and ctx["user"].get("role") == "admin"
                if blocked_auth and not is_admin_bypass:
                    raise routing.ApiError(
                        "Zentra is in scheduled maintenance — money moves are paused. "
                        "Please try again soon.", 503)

            result = r["fn"](ctx)
            if isinstance(result, routing.RawResponse):
                store.save()
                return self._send_raw(result)
            status, payload = result if isinstance(result, tuple) else (200, result)
            store.save()
            self._send(status, payload)
        except routing.ApiError as e:
            self._send(e.code, {"error": e.message})
        except Exception:
            traceback.print_exc()
            self._send(500, {"error": "Internal server error."})

    # -------------------------------------------------------------- static --
    def _static(self, method, path):
        if method != "GET":
            return self._send(405, {"error": "Method not allowed."})
        rel = path.lstrip("/") or "index.html"
        full = os.path.normpath(os.path.join(PUBLIC_DIR, rel))
        if not full.startswith(PUBLIC_DIR):
            return self._send(403, {"error": "Forbidden."})
        if not os.path.isfile(full):
            if "." not in os.path.basename(rel):
                full = os.path.join(PUBLIC_DIR, "index.html")  # SPA fallback
            else:
                return self._send(404, {"error": "File not found."})
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            data = f.read()
            if full.endswith("index.html") and os.environ.get("SMARTSUPP_KEY"):
                key = os.environ["SMARTSUPP_KEY"].strip()
                snippet = (
                    '<!-- Smartsupp Live Chat script -->'
                    '<script type="text/javascript">'
                    'var _smartsupp = _smartsupp || {};'
                    '_smartsupp.key = %r;'
                    "window.smartsupp||(function(d) {"
                    "  var s,c,o=smartsupp=function(){ o._.push(arguments)};o._=[];"
                    "  s=d.getElementsByTagName('script')[0];c=d.createElement('script');"
                    "  c.type='text/javascript';c.charset='utf-8';c.async=true;"
                    "  c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);"
                    "})(document);"
                    '</script>'
                    '<noscript>Powered by <a href="https://www.smartsupp.com" target="_blank">Smartsupp</a></noscript>'
                ) % key
                data = data.replace(b"</body>", snippet.encode("utf-8") + b"</body>")
            self._send(200, data, ctype)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 128


def main():
    os.makedirs(store.DATA_DIR, exist_ok=True)
    seeded = seed_if_empty()
    print("")
    print("  ◆ Zentra Bank is running")
    print("  ➜ Local:   http://%s:%d" % (HOST, PORT))
    print("  ➜ Admin:   admin@zentra.bank / Admin@1234")
    print("  ➜ Demo:    demo@zentra.bank / Demo@1234")
    print("  %s database at %s" % ("Seeded fresh" if seeded else "Using existing",
                                    os.path.relpath(store.DB_PATH, BASE_DIR)))
    print("")
    srv = Server((HOST, PORT), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[bye] Server stopped.")


if __name__ == "__main__":
    main()
