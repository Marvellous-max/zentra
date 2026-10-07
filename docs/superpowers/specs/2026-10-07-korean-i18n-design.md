# Korean Language Support (i18n) — Design

**Date:** 2026-10-07
**Status:** approved, awaiting implementation plan
**Repo:** `zentra/` (vanilla JS SPA + stdlib Python, no build step, no dependencies)

---

## 1. Goal

Let a non-English visitor — specifically a Korean speaker — use the Zentra site in
Korean, without disturbing the English experience and without adding a build step or
any dependency.

Success looks like: a browser set to Korean lands on a Korean site, can switch back to
English, has that choice remembered, reads Korean error messages, and receives Korean
transactional emails.

## 2. Decisions already made

| Decision | Choice |
|---|---|
| Scope | **Customer-facing only** — marketing pages, login/register, customer app, toasts/errors, transactional emails. Admin back office (13 pages) and system console (5 pages) stay English. |
| Language selection | **Auto-detect + manual switch.** First visit reads `navigator.language`; a switcher overrides it and is remembered. |
| Existing stored content | **New content only.** Notifications, alerts and transaction descriptions already in the database stay English — they are a historical record and will not be machine-altered. |
| Korean register | **합니다체 (formal polite)** — the register Korean banks and government services use. |
| Translation mechanism | **Approach A — the English string is the key.** |

### Why Approach A

- `t('Sign in securely')` returns Korean when known, **otherwise returns the English
  string itself**. An untranslated string renders correct English; there is no
  "missing key" failure mode, no blank, no `undefined`.
- English copy keeps living inline in the code exactly where it lives today, instead of
  being lifted into a catalog.
- The project has no build step and no dependencies by design (`README.md` states
  this). A is a ~40-line `t()` plus two plain-object catalogs.

Rejected alternatives:
- **B — stable message codes** (`{"auth.wrong_password": {"en": …, "ko": …}}`).
  Internationalization-grade and correct long term, but requires refactoring all 137
  `ApiError` sites *and* attaching codes to every UI string on the site — ~1,400,
  including the ~500 admin/system strings that Approach A deliberately never touches.
  Right answer when a third and fourth language arrive; not yet.
- **C — frontend only first.** Fastest visible win, but a Korean user gets a Korean
  interface with English error toasts and English emails, which reads as broken.

## 3. Architecture at a glance

```
        ┌── client ──────────────────────────────┐   ┌── server ──────────────────┐
        │ ZB.lang ('en' | 'ko')                   │   │ ctx["lang"] from           │
        │   ← localStorage.zb_lang                │X- │   X-Zentra-Lang header,    │
        │   ← account prefs.lang                  │ Ze│   else Accept-Language     │
        │   ← navigator.language                  │ nt│                             │
        │                                         │ ra│ T(lang, fmt, *args)         │
        │ t(key, vars)  → ZB.LOCALES[lang][key]   │ L │   → server/locales/ko.json  │
        │   miss → key (English)                  │ a │   miss → fmt (English)      │
        │                                         │ n │                             │
        │ public/js/locales/ko.js                 │ g │ emails use the RECIPIENT's  │
        └─────────────────────────────────────────┘   │ prefs.lang, not the request │
                                                      └─────────────────────────────┘
```

Two catalogs, two loaders, **disjoint contents**: the JS catalog holds UI strings, the
JSON catalog holds server-originated strings. Nothing is duplicated between them.

## 4. Locale runtime

### 4.1 Resolution order (client, at boot)

1. `localStorage.zb_lang` — an explicit switcher choice
2. else the signed-in account's `prefs.lang`
3. else `navigator.language` starting with `ko` → `'ko'`
4. else `'en'`

`ZB.lang` is the single source of truth.

### 4.2 Switching

`setLang(lang)`:
1. write `localStorage.zb_lang`
2. set `ZB.lang`
3. set `<html lang>` on `index.html`
4. for signed-in customers, persist `prefs.lang` via `PUT /api/user/profile`
5. call `ZB.render()`

Because every view is a pure function returning `{ html, title, mount }`, step 5
re-translates the entire screen in place with no reload.

### 4.3 Server locale

`public/js/zb-api.js` attaches `X-Zentra-Lang: <lang>` to every request (`request()`
already builds the header object).

`server/app.py` builds `ctx` (currently `ua` + `ip`, ~line 114) and adds `lang`:
`X-Zentra-Lang` first, `Accept-Language` second, `'en'` last.

This drives **API error messages** — a Korean UI gets Korean errors with no second
round-trip.

**Emails are different.** They are delivered outside any request, so they use the
recipient's saved `prefs.lang`, never the caller's.

### 4.4 Page titles

Each view returns `title:` (34 of them). `app.js:315` already reads `page.title` and
passes it into the topbar's `.page-name` — so localizing those literals localizes the
visible page header for free. Additionally set `document.title`, which today is never
written.

## 5. Frontend catalog

### 5.1 New files

| File | Contains |
|---|---|
| `public/js/zb-i18n.js` | `ZB.lang` resolution, `t()`, `setLang()` |
| `public/js/locales/ko.js` | one flat `{ "English source": "한국어" }` object |

Both added as `<script>` tags in `public/index.html`, loaded before the view files.

### 5.2 `t()`

```js
function t(key, vars) {
  var s = (ZB.LOCALES[ZB.lang] || {})[key] || key;   // miss → English, always valid
  // replace {name} placeholders from `vars`
  return s;
}
```

`en` has no catalog — the English string is the key and the default value.

### 5.3 Extraction scope

| File | ~Strings |
|---|---|
| `public/js/views/public.js` (marketing + login + register) | 395 |
| `public/js/views/user.js` (customer app) | 470 |
| `public/js/app.js` (shell, nav, notification panel) | 85 |
| `public/js/zb-ui.js` (toasts, tx labels, pills) | 130 |
| **Total** | **~1,080** |

**Not extracted:** `public/js/views/admin.js` and `public/js/views/system.js` stay
English by decision.

### 5.4 Dynamic text

Static sentences become keys directly. Fragments currently built by concatenation keep
their existing ternaries, and each branch becomes its own key — e.g. `' account'` and
`' accounts'` remain two separate English keys rather than introducing a plural engine.
Korean requires no plural rules, so nothing is lost.

### 5.5 Language switcher

Two placements:
- **Public header** — next to Sign in
- **Customer app topbar** — in `app.js`'s `shell()`

Both call `setLang()`.

## 6. Server-side text

### 6.1 The single helper

```python
def T(lang, fmt, *args):
    s = CATALOGS.get(lang, {}).get(fmt, fmt)   # miss → English
    return s % args if args else s
```

Works uniformly for a bare template and for an interpolated one.

### 6.2 Where each channel is localized

| Channel | Mechanism | Call sites touched |
|---|---|---|
| 120 plain `ApiError` messages | localized at the `app.py` catch handler | **0** |
| 17 interpolated `ApiError` | wrap: `ApiError(T(ctx["lang"], "…%s…", x))` | 17 |
| `notify()` titles/bodies (37 calls) | wrap: `T(lang, …)` at the call site | ~37 |
| Email row labels (26 groups, 33 labels) | literal labels, localized inside `notify()` | 0 |
| `mail.py` chrome (4 chips, "Dear %s,", disclaimer, CTA) | `mail.send()` gains a `lang` argument | ~6 |

`lang` resolution:
- **errors** → `ctx["lang"]` (what the UI is showing)
- **notifications/emails** → the recipient's `prefs.lang`, resolved from `db` +
  `user_id`, both of which every `notify()` call site already has

Double-localization is harmless: an already-Korean string will not match any English
key, so `T()` returns it unchanged.

### 6.3 Dates

`store.fmt_date()` and `store.fmt_dt()` bake English month abbreviations via
`strftime("%b %d, %Y")`. They gain a `lang` argument so emails and CSV statements can
render Korean month names.

### 6.4 Data model

- `users[].prefs` gains `"lang": "en" | "ko"` (default `"en"`).
- **The prefs whitelist at `server/api_user.py:1045-1048` must be extended** — it
  rebuilds the dict from an explicit list, so an unknown key is silently dropped.
- `server/seed.py` seeds `prefs.lang` as `"en"`.
- For visitors with no account, `localStorage.zb_lang` is sufficient.

### 6.5 Catalog

`server/locales/ko.json` — same `{ "English": "한국어" }` shape as the JS catalog.

## 7. Testing

`server/selftest.py` (currently 112 checks) gains:

1. **Error localization** — a request with `X-Zentra-Lang: ko` returns a Korean error
   message; the same request without the header returns English. Proves both
   translation and fallback.
2. **Email localization** — trigger a notification for a customer with
   `prefs.lang == "ko"` and assert the deliveries log holds a Korean title.
3. **Fallback** — `T("ko", "a string with no translation")` returns the input.
4. **Coverage guard** — regex-scan the four JS files for `t('…')` and the Python call
   sites for `T(…, '…')`; fail if any key lacks a `ko` entry. This is what stops a
   later copy edit from silently leaving Korean stale.

Frontend behaviour (switcher, `<html lang>`, re-render) is verified in a browser, as
was done for the KRW work — there is no JS test runner in this project.

## 8. Explicitly out of scope

- Admin back office and system console localization
- Translating text already stored in the database
- A third language or an ICU/pluralization framework
- Per-locale SEO pages / server-rendered `<title>` variants (there is no SSR; only
  `<html lang>` and `document.title` are updated at runtime)
- RTL — Korean needs none

## 9. Success criteria

1. A browser whose language is Korean shows Korean on the public site and the customer
   app, with no user action.
2. Switching to English and reloading stays English; switching back to Korean and
   reloading stays Korean.
3. For a signed-in customer, the choice survives a new device (persisted `prefs.lang`).
4. Error toasts match the current UI language.
5. Transactional emails to a `ko` customer are in Korean.
6. `<html lang>` and `document.title` match the visible language.
7. Admin and system console remain entirely English.
8. `selftest.py` passes with the new checks, including the coverage guard.

## 10. Risks

- **Volume.** ~1,080 UI strings plus ~60 server call sites is mechanical but large;
  this should be executed in reviewable slices rather than one change.
- **English drift.** The coverage guard is what keeps Korean current; it must be part
  of the same change that introduces the catalogs, not a later addition.
- **Copy quality.** 합니다체 Korean must be written, not machine-translated; a bank
  reading as translated is worse than a bank reading as English.
