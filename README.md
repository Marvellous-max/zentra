# ◆ Zentra — Banking, beautifully simple

An ultra-modern, **fully functional digital banking platform** — public marketing site,
customer dashboard, admin back-office, and a backend-management console. Every button,
form and approval queue works against a real ledger engine.

**Zero dependencies.** Pure Python 3 standard library backend + hand-crafted vanilla
JS/CSS frontend. No npm, no build step, no database server.

---

## 🚀 Run it

```bash
python3 bank/server/app.py
```

Open **http://127.0.0.1:8788** — that's it.
(First run auto-seeds `bank/data/db.json` with a rich demo dataset. Delete that file to reset.)

| Account | Email | Password | Tx PIN |
|---|---|---|---|
| 👤 Customer demo | `demo@zentra.bank` | `Demo@1234` | `1234` |
| 🛡 Admin | `admin@zentra.bank` | `Admin@1234` | — |
| 👤 Background customers | `sofia@example.com`, … | `User@1234` | `1234` |

> Custom port/host: `PORT=9000 HOST=0.0.0.0 python3 bank/server/app.py`
> The login page has one-click "fill demo credentials" buttons.
> **Transaction PIN:** every transfer and bill payment must be authorized with the customer's
> 4-digit PIN (set at signup, changeable in Settings → Security). Wrong PIN = declined.

---

## 🗺 Every page, fully functional

### Public site
| Page | What works |
|---|---|
| **Landing** `#/` | Light corporate hero with realistic debit-card mockup (gentle pointer tilt), product trio, live FX ticker marquee, navy rate band wired to real settings, feature grid, how-it-works steps, testimonials, FAQ accordion |
| **Personal / Business** | Product pages: account comparison table, per-product bullet lists, business cash-flow features |
| **Rates & Fees** `#/rates` | The whole price list — deposit rates, lending terms, transfer/FX and card fee tables pulled live from configured settings, plus interactive **savings projector** & **loan estimator** calculators. Full legal disclosures footer |
| **Security** | Defense-in-depth explainer band + customer safety habits |
| **Support** | Working contact form → lands in the staff support inbox; FAQ; contact channels; copy-to-clipboard contacts |
| **About / Legal** | Company story with live stats; full disclosure-style legal center (deposit agreement, Truth-in-Savings, privacy, error resolution) |
| **Login / Register** | PBKDF2-hashed auth, password-strength meter, currency choice at signup, auto-opened checking account |

### 👤 Customer dashboard (`#/app`)
| Page | What works |
|---|---|
| **Overview** | KPIs (total balance / income / spend / savings), 30-day balance area chart (all currencies USD-equivalent), spend-by-category donut, account tiles, quick actions incl. one-tap **Add money** modal |
| **Accounts** | Open new checking/savings accounts (up to 6, any of 3 currencies), per-account activity, copy account number, CSV statement download |
| **Send & Exchange** | Three modes — to another Zentra customer by email + account number + bank name (validated against records), between own accounts, or external bank payout (fee + auto-approval threshold); live summary panel; **Exchange tab** with debounced live FX quote incl. fee math; beneficiary manager |
| **Add money (admin-approved)** | Top-up requests land as *pending* — nothing credits until an administrator approves them in the back office; the customer gets branded notifications at request, approval, or decline |
| **Approvals center** `#/admin/approvals` | Every pending money movement (top-ups, payouts, other) in one queue with Approve / **Decline & send branded email** — the decline composer writes a customer-facing email from `alerts@zentra.bank` explaining why and what to do next |
| **Declined log** `#/admin/declined` | Audit trail of declined transactions and blocked attempts from frozen accounts, with one-click branded mail composer and resolve workflow |
| **Freeze transactions** (customer drawer) | Freezes a customer's money movement while leaving login intact — every transfer/payment/top-up/exchange returns a professional *Transaction declined* receipt, each attempt is logged for the admin, and restore takes one click. (Separate "Block login" toggle still kills sessions.) |
| **Cards** | Flip-card visuals (front/back CVV) with real Visa / Mastercard network marks, freeze/unfreeze instantly, monthly spending limits, issue free virtual cards (cap enforced) or metal cards ($5 fee) — numbers revealed right after issuing |
| **Pay bills** | 8 categories with icons, biller autocomplete from history, customer reference field, PIN-authorized with instant receipts in the ledger |
| **Loans** | Request with live monthly-payment preview (real amortization formula), pending/active states, progress gauge, partial repayments, early payoff |
| **Statements** | Month chips ×12, per-account filtered ledger with running balances, money-in/out totals, CSV export, print view |
| **Settings** | Profile edit, password change, **KYC submission** (simulated upload → review), notification preferences, active session list with remote revoke |

### 🛡 Admin back-office (`#/admin`)
| Page | What works |
|---|---|
| **Overview** | Platform KPIs, 14-day cash-flow chart (in/out bars), approval-queue counters, newest customers, latest staff actions |
| **Customers** | Search/status-filter/paginate; detail drawer: freeze/unfreeze (kills sessions), credit/debit **balance adjustments with mandatory audited reason**, grant/revoke staff, KYC approve/reject, cascade delete |
| **Accounts** | Every wallet in the bank sorted by USD-equivalent, one-click freeze/unfreeze |
| **Ledger** | Global transaction log with search + type/status filters, pagination, guarded **reversals** (mirrored entry + notification) |
| **Payout approvals** | External transfers above the auto-limit wait here on hold; approve (release) or reject (auto-refund with reason) |
| **Loans desk** | Tabbed pipeline; approve = instant disbursement into the customer's chosen account; decline with reason |
| **Verifications** | KYC document review queue, verify or reject-with-note |
| **Support inbox** | Reply (notifies customer) + resolve workflow for contact-form messages |
| **Announcements** | Broadcast to everyone or verified-only; delivery history |
| **Audit log** | Filterable append-only trail with severity levels |

### ⚙️ Backend management console (`#/system`)
| Page | What works |
|---|---|
| **Health** | Live vitals: version, uptime, Python/platform, DB path+size, engine latency scan, collection counts, settlement-engine status, service-switch overview (auto-refreshes every 30s) |
| **Money rules** | The control room: **maintenance mode emergency stop**, registration toggle, per-feature switches (deposits/transfers/payouts/payments/exchange/loans/cards), transfer caps & daily limits, KYC threshold, all fees, savings APY, loan APR + offered terms, **FX rate editor** — every change diffed and audit-logged |
| **Sessions** | Live session count + revoke-everything-except-me |
| **Backups & data** | Full JSON snapshot download, atomic compact/vacuum, restore-from-backup file, reset-and-reseed demo data |
| **System audit** | The same immutable trail, under the ops nav |

---

## 🔌 API surface

```
POST   /api/auth/register|login|logout          GET  /api/auth/me
GET    /api/public/bootstrap                    POST /api/public/support

GET    /api/user/bootstrap|overview|accounts|transactions|cards|loans
GET    /api/user/beneficiaries|pay/catalog|sessions|notifications|deposit-options
GET    /api/user/exchange/quote                 GET  /api/user/statement.csv
POST   /api/user/accounts|deposits|transfers|exchange|payments|loans|kyc
POST   /api/user/cards · cards/:id/freeze       PUT  cards/:id/limit
PUT    /api/user/profile|password               POST loans/:id/pay · notifications/read-all
DELETE /api/user/beneficiaries/:id · sessions/:sid

GET    /api/admin/overview|users|accounts|transactions|payouts|loans|messages|broadcasts|audit
POST   /api/admin/users/:id/adjust|freeze|role|kyc   PUT users/:id   DELETE users/:id
POST   /api/admin/accounts/:id/freeze · transactions/:id/reverse · payouts/:id/review
POST   /api/admin/loans/:id/review · broadcasts · messages/:id

GET    /api/system/status|settings|export       PUT  /api/system/settings
POST   /api/system/import|reset|vacuum|revoke-sessions
```

Auth = `Authorization: Bearer <token>` · roles enforced server-side · every money mutation
posts a signed double-entry-style ledger record with running balance.

## ⚙️ How the engine works

- **Lazy daily interest** — savings accounts accrue `% APY / 365` per whole day elapsed,
  credited on the first API touch after midnight. Correct after weeks offline, no cron needed.
- **Pending holds done right** — external payouts above the auto-approval limit debit
  immediately as a *hold*; rejecting refunds atomically, approving just completes the entry.
- **Money safety** — PBKDF2-HMAC-SHA256 (120k iterations), timing-safe compares, ownership +
  role checks on every route, frozen-account guards, daily/single/KYC gates, atomic JSON
  writes (temp-file + rename), HTML escaped at every render point.
- **Frontend** — hash-router SPA (~5k lines vanilla JS/CSS) styled like a modern US bank
  site: white + navy corporate design system (Capital One / Chase inspired), utility bar,
  mega-footer with FDIC disclosures, realistic card visuals with flip animation, hand-built
  SVG charts (area / grouped bars / donut / ring gauges), modals, drawers, toasts, sliders,
  count-ups, reveal-on-scroll, responsive down to mobile.
- **Professional transaction lifecycle** — outgoing transfers and bill payments open a
  review-and-authorize step with the customer's 4-digit PIN, then land on a branded receipt
  modal: green **Transaction successful**, amber **Pending approval** (compliance holds),
  or red **Transaction declined**, each with reference number, fee, date and a note that a
  confirmation came from `alerts@zentra.bank`. Every alert in the notification tray is an
  email-style message from Zentra Alerts with a working deep link into the exact page.
- **Real account numbers** — each wallet gets a random 12-digit account number
  (e.g. `1047 8145 4989`) plus the bank routing number `021000021`, copyable from the
  Accounts page.

## 🧪 Verified

- `python3 server/selftest.py` → **76 end-to-end assertions green** (register→deposit→
  transfer→payout hold→approve/reject-refund→exchange→cards→bills→loans→KYC→admin
  adjust/reverse/broadcast→settings diff→export/import→reset→session revocation).
- Every client API call cross-checked against the route table (66 routes) — zero mismatches.
- All JS compile-checked; live HTTP pass over every read endpoint + money flows, 0 errors.
