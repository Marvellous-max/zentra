"""Tiny route table: decorators register handlers; match() resolves them."""
import re


class ApiError(Exception):
    def __init__(self, message, code=400):
        super(ApiError, self).__init__(message)
        self.message = message
        self.code = code


class RawResponse(object):
    """Escape hatch for binary/CSV/file downloads."""
    def __init__(self, body, ctype="application/octet-stream", disposition=None, status=200):
        self.body = body if isinstance(body, bytes) else str(body).encode("utf-8")
        self.ctype = ctype
        self.disposition = disposition
        self.status = status


ROUTES = []


def route(method, pattern, auth=None):
    """@route("GET", "/api/user/accounts/{id}", auth="user")  auth: None|"user"|"admin"""
    rx = re.compile("^" + re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", pattern) + "$")

    def deco(fn):
        ROUTES.append({"method": method, "rx": rx, "fn": fn, "auth": auth})
        return fn
    return deco


def match(method, parts):
    path = "/" + "/".join(parts)
    for r in ROUTES:
        if r["method"] != method:
            continue
        m = r["rx"].match(path)
        if m:
            return r, m.groupdict()
    return None, {}
