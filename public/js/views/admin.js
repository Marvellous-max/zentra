/* ============================================================
   Zentra — admin back-office views
   ============================================================ */
window.ZB = window.ZB || {};
ZB.views = ZB.views || {};
ZB.forms = ZB.forms || {};

(function (ZB) {
  'use strict';
  var U = function () { return ZB.ui; };

  function pageHead(title, sub, actionsHtml) {
    return '<div class="page-head"><div><h2>' + title + '</h2>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' +
      '<div class="head-actions">' + (actionsHtml || '') + '</div></div>';
  }

  /* keep the caret in a search box across debounced re-renders */
  function refocusInput(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var v = el.value;
    try { el.focus(); el.setSelectionRange(v.length, v.length); } catch (_) {}
  }

  function pager(meta, baseQuery) {
    if (!meta || meta.pages <= 1) return '';
    var btns = '';
    for (var p = 1; p <= meta.pages && p <= 9; p++) {
      btns += '<button class="' + (p === meta.page ? 'on' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    return '<div class="pager"><button ' + (meta.page <= 1 ? 'disabled' : '') + ' data-page="' + (meta.page - 1) + '">‹</button>' +
      btns +
      (meta.pages > 9 ? '<span class="tiny faint">… ' + meta.pages + '</span>' : '') +
      '<button ' + (meta.page >= meta.pages ? 'disabled' : '') + ' data-page="' + (meta.page + 1) + '">›</button></div>' +
      '<input type="hidden" id="pager-base" value="' + U().esc(baseQuery || '') + '">';
  }

  /* =========================================================== OVERVIEW */
  async function overview() {
    var r = await ZB.api.get('/api/admin/overview');
    var k = r.kpis;
    var q = r.queues;

    var labels = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date(Date.now() - i * 86400000);
      labels.push(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getDate());
    }

    var html =
      pageHead('Back office', 'Everything happening across the bank, right now.',
        '<a class="btn primary sm" href="#/system">' + U().icon('server', 15) + ' System console</a>') +

      '<div class="grid cols-4 mb-2">' +
      kpiCard('users', 'Customers', String(k.customers), '+' + k.new_week + ' this week') +
      kpiCard('database', 'Deposits held', '$' + Math.round(k.deposits_usd).toLocaleString(), k.verified_pct + '% KYC verified') +
      kpiCard('target', 'Loan book', '$' + Math.round(k.loan_book_usd).toLocaleString(), q.loans + ' pending approval') +
      kpiCard('swap', 'Today volume', '$' + Math.round(k.volume_today_in).toLocaleString() + ' in · $' + Math.round(k.volume_today_out).toLocaleString() + ' out', '') +
      '</div>' +

      '<div class="grid mb-2" style="grid-template-columns:2fr 1fr">' +
      '<div class="card"><div class="card-title"><h3>Cash flow · 14 days</h3>' +
      '<span class="row tiny muted" style="gap:12px"><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:#0f62a8;display:inline-block"></i>in</span>' +
      '<span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:#7fb3dd;display:inline-block"></i>out</span></span></div>' +
      U().barsDual(labels, r.charts.vol_in, r.charts.vol_out, { h: 210 }) + '</div>' +
      '<div><div class="card mb-2"><div class="card-title"><h3>Approval queues</h3></div>' +
      queueRow('#/admin/approvals?type=topups', 'download', 'Top-ups waiting', q.topups, 'amber') +
      queueRow('#/admin/approvals?type=payouts', 'send', 'Payouts waiting', q.payouts, 'amber') +
      queueRow('#/admin/declined?resolved=0', 'x', 'Declined / blocked', q.declined_open || 0, 'red') +
      queueRow('#/admin/loans', 'target', 'Loan decisions', q.loans) +
      queueRow('#/admin/kyc', 'shield', 'Identity checks', q.kyc) +
      queueRow('#/admin/support', 'message', 'Support inbox', q.messages) +
      '</div>' +
      '<div class="card"><div class="card-title"><h3>Newest customers</h3><a class="btn sm ghost" href="#/admin/customers">All</a></div>' +
      r.latest_users.map(function (u) {
        return '<div class="tx-row"><div class="avatar" style="background:' + U().hueColor(u.hue) + ';width:36px;height:36px;font-size:12px">' +
          U().esc(U().initials(u.name)) + '</div>' +
          '<div class="tx-main"><b>' + U().esc(u.name) + '</b><span>' + U().rel(u.joined_at) + ' · ' +
          U().compact(u.balance_usd) + '</span></div>' + U().pillFor(u.kyc_status) + '</div>';
      }).join('') + '</div></div></div>' +

      '<div class="card"><div class="card-title"><h3>Latest staff actions</h3><a class="btn sm ghost" href="#/admin/audit">Full audit log</a></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Severity</th></tr></thead><tbody>' +
      (r.recent_audit.length ? r.recent_audit.map(function (a) {
        return '<tr><td class="small muted" style="white-space:nowrap">' + U().rel(a.ts) + '</td>' +
          '<td class="small mono">' + U().esc(a.actor) + '</td><td class="small"><b>' + U().esc(a.action) + '</b></td>' +
          '<td class="small muted">' + U().esc(String(a.target)) + '</td><td>' + sevPill(a.severity) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted" style="text-align:center;padding:26px">No activity yet.</td></tr>') +
      '</tbody></table></div></div>';

    return { html: html, title: 'Back office' };
  }

  function kpiCard(iconName, label, value, sub) {
    return '<div class="card kpi"><div class="kpi-label">' + U().icon(iconName, 15) + label + '</div>' +
      '<div class="kpi-value" style="font-size:' + (value.length > 14 ? '1.35rem' : '1.7rem') + '">' + value + '</div>' +
      (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') + '</div>';
  }
  function queueRow(href, icon, label, count, tone) {
    return '<a class="set-row" href="' + href + '" style="cursor:pointer;text-decoration:none;color:inherit">' +
      '<div class="row" style="gap:10px"><span class="t-icon" style="width:34px;height:34px;border-radius:8px;background:var(--bg-tint);color:var(--navy);display:grid;place-items:center">' +
      U().icon(icon, 15) + '</span><b class="small">' + label + '</b></div>' +
      (count ? '<span class="pill ' + (tone || 'amber') + '">' + count + ' pending</span>' : '<span class="pill green">clear</span>') +
      '</a>';
  }
  function sevPill(sev) {
    var map = { info: 'gray', warn: 'amber', critical: 'red' };
    return '<span class="pill ' + (map[sev] || 'gray') + ' plain">' + U().esc(sev) + '</span>';
  }

  /* ========================================================== CUSTOMERS */
  var custState = { q: '', status: '', page: 1 };
  async function customers(query) {
    if (query && query.q !== undefined) { custState.q = query.q || ''; custState.status = query.status || ''; custState.page = +(query.page || 1); }
    var qs = '?q=' + encodeURIComponent(custState.q) +
      '&status=' + encodeURIComponent(custState.status) + '&page=' + custState.page;
    var r = await ZB.api.get('/api/admin/users' + qs);

    var filters = [['', 'All'], ['active', 'Active'], ['frozen', 'Frozen'],
      ['pending_kyc', 'KYC pending'], ['unverified', 'Unverified'], ['verified', 'Verified']]
      .map(function (f) {
        return '<option value="' + f[0] + '" ' + (custState.status === f[0] ? 'selected' : '') + '>' + f[1] + '</option>';
      }).join('');

    var html =
      pageHead('Customers', r.meta.total + ' customer account' + (r.meta.total === 1 ? '' : 's'),
        '<div class="row" style="background:var(--surface);border:1px solid var(--line-2);border-radius:999px;padding:8px 14px;gap:8px">' +
        U().icon('search', 15) +
        '<input id="cu-q" placeholder="Search name or email…" value="' + U().esc(custState.q) + '" style="border:none;background:none;outline:none;width:190px;color:var(--text);font-size:13.5px"></div>' +
        '<select class="input" id="cu-status" style="width:auto">' + filters + '</select>') +

      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Customer</th><th>KYC</th><th>Status</th><th>Accounts</th><th class="num">Balance (USD-eq)</th><th>Joined</th><th></th></tr></thead><tbody>' +
      (r.users.length ? r.users.map(function (u) {
        return '<tr style="cursor:pointer" data-open="' + u.id + '">' +
          '<td><div class="row" style="gap:11px"><div class="avatar" style="background:' + U().hueColor(u.hue) + ';width:34px;height:34px;font-size:12px">' +
          U().esc(U().initials(u.name)) + '</div><div><b class="small">' + U().esc(u.name) +
          (u.role === 'admin' ? ' <span class="pill violet plain">staff</span>' : '') + '</b>' +
          '<div class="tiny faint">' + U().esc(u.email) + '</div></div></div></td>' +
          '<td>' + U().pillFor(u.kyc_status) + '</td>' +
          '<td>' + (u.suspended ? '<span class="pill red">login blocked</span>'
            : u.restricted ? '<span class="pill amber">transactions frozen</span>'
            : '<span class="pill green">active</span>') + '</td>' +
          '<td class="num">' + u.accounts + '</td>' +
          '<td class="num"><b>' + U().money(u.balance_usd, 'USD', { noDec: u.balance_usd > 10000 }) + '</b></td>' +
          '<td class="small muted">' + U().dateShort(u.joined_at) + '</td>' +
          '<td><button class="icon-btn" data-open="' + u.id + '">' + U().icon('chevronRight', 15) + '</button></td></tr>';
      }).join('') : '<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">No customers match.</td></tr>') +
      '</tbody></table></div>' + pager(r.meta);

    return {
      html: html, title: 'Customers',
      mount: function () {
        var qi = document.getElementById('cu-q');
        qi.addEventListener('input', U().debounce(function () {
          custState.q = qi.value; custState.page = 1;
          location.hash = '#/admin/customers?q=' + encodeURIComponent(custState.q) +
            '&status=' + encodeURIComponent(custState.status);
        }, 400));
        document.getElementById('cu-status').addEventListener('change', function (e) {
          custState.status = e.target.value; custState.page = 1;
          location.hash = '#/admin/customers?q=' + encodeURIComponent(custState.q) +
            '&status=' + encodeURIComponent(e.target.value);
        });
        document.querySelectorAll('[data-open]').forEach(function (el) {
          el.addEventListener('click', function () { openCustomer(+el.dataset.open); });
        });
        if (custState.q) refocusInput('cu-q');
        bindPager();
      }
    };
  }

  function bindPager() {
    document.querySelectorAll('.pager [data-page]').forEach(function (b) {
      b.addEventListener('click', function () {
        var base = document.getElementById('pager-base');
        location.hash = '#/' + (base && base.value ? base.value : '') + '&page=' + b.dataset.page;
      });
    });
  }

  async function openCustomer(id) {
    var d = await ZB.api.get('/api/admin/users/' + id);
    var u = d.user;
    var ov = document.createElement('div');
    ov.className = 'drawer-overlay'; ov.id = 'cust-drawer';
    ov.innerHTML =
      '<div class="drawer">' +
      '<div class="spread mb-2"><div class="row" style="gap:12px">' +
      '<div class="avatar lg" style="background:' + U().hueColor(u.hue) + '">' + U().esc(U().initials(u.name)) + '</div>' +
      '<div><h3>' + U().esc(u.name) + '</h3><span class="small muted">' + U().esc(u.email) + '</span></div></div>' +
      '<button class="icon-btn" id="dw-close">' + U().icon('x', 16) + '</button></div>' +

      '<div class="row wrap mb-2" style="gap:8px">' + U().pillFor(u.kyc_status) +
      (u.suspended ? '<span class="pill red">login blocked</span>' : '<span class="pill green">active</span>') +
      (u.restricted ? '<span class="pill red plain">transactions frozen</span>' : '') +
      (u.role === 'admin' ? '<span class="pill violet plain">staff</span>' : '') + '</div>' +

      '<div class="kv mb-2">' +
      '<dt>Joined</dt><dd>' + U().dateTime(u.joined_at) + '</dd>' +
      '<dt>Last login</dt><dd>' + (u.last_login_at ? U().rel(u.last_login_at) : 'never') + '</dd>' +
      '<dt>Phone</dt><dd>' + U().esc(u.phone || '—') + '</dd>' +
      '<dt>Country</dt><dd>' + U().esc(u.country || '—') + '</dd>' +
      '<dt>Sessions</dt><dd>' + d.sessions + '</dd>' +
      (d.profile.kyc_submitted_at ? '<dt>KYC doc</dt><dd class="mono small">' + U().esc(d.profile.kyc_doc || '—') + '</dd>' : '') +
      '</div>' +

      '<div class="row wrap mt-2 mb-2" style="gap:8px">' +
      (u.suspended
        ? '<button class="btn sm" id="dw-unfreeze">' + U().icon('check', 14) + ' Allow login</button>'
        : '<button class="btn sm danger" id="dw-freeze">' + U().icon('snow', 14) + ' Block login</button>') +
      (u.restricted
        ? '<button class="btn sm" id="dw-unrestrict">' + U().icon('check', 14) + ' Restore transactions</button>'
        : '<button class="btn sm solid-danger" id="dw-restrict">' + U().icon('lock', 14) + ' Freeze transactions</button>') +
      '<button class="btn sm" id="dw-adjust">' + U().icon('edit', 14) + ' Adjust balance</button>' +
      '<button class="btn sm ghost" id="dw-role">' + U().icon('key', 14) + (u.role === 'admin' ? ' Revoke staff' : ' Make staff') + '</button>' +
      (d.profile.kyc_submitted_at && u.kyc_status === 'pending'
        ? '<button class="btn sm primary" id="dw-kyc">' + U().icon('shield', 14) + ' Review ID</button>'
        : '') +
      '<button class="btn sm ghost danger" id="dw-delete">' + U().icon('trash', 14) + '</button></div>' +

      '<h4 class="mt-2 mb-1 small faint" style="letter-spacing:.08em">ACCOUNTS (' + d.accounts.length + ')</h4>' +
      d.accounts.map(function (a) {
        return '<div class="set-row"><div><b>' + U().esc(a.label) + '</b>' +
          '<div class="desc mono">' + U().esc(a.number) + ' · ' + a.currency + '</div></div>' +
          '<div style="text-align:right"><b>' + U().money(a.balance, a.currency) + '</b>' +
          (a.frozen ? '<br><span class="pill red">frozen</span>' : '') + '</div></div>';
      }).join('') +

      '<h4 class="mt-2 mb-1 small faint" style="letter-spacing:.08em">CARDS</h4>' +
      (d.cards.length ? d.cards.map(function (c) {
        return '<div class="set-row"><div><b>' + U().esc(c.label) + '</b><div class="desc mono">' + U().esc(c.masked) + '</div></div>' +
          (c.frozen ? '<span class="pill red">frozen</span>' : U().pillFor(c.status)) + '</div>';
      }).join('') : '<p class="small muted">None issued.</p>') +

      '<h4 class="mt-2 mb-1 small faint" style="letter-spacing:.08em">LOANS</h4>' +
      (d.loans.length ? d.loans.map(function (l) {
        return '<div class="set-row"><div><b>#' + l.id + ' · ' + U().money(l.principal) + ' / ' + l.term_months + 'mo @ ' + l.apr + '%</b>' +
          '<div class="desc">' + U().esc(l.purpose || '—') + ' · paid ' + U().money(l.paid_total || 0) + '</div></div>' +
          U().pillFor(l.status) + '</div>';
      }).join('') : '<p class="small muted">No loans.</p>') +

      '<h4 class="mt-2 mb-1 small faint" style="letter-spacing:.08em">RECENT ACTIVITY</h4>' +
      (d.transactions.length ? d.transactions.slice(0, 8).map(function (t) { return U().txRow(t, { showAccount: false }); }).join('')
        : '<p class="small muted">No transactions.</p>');

    document.body.appendChild(ov);
    // Crash-proof binder: conditional buttons (freeze/unfreeze, restrict/unrestrict)
    // only exist in some states — a null lookup must never kill later bindings.
    function bind(sel, fn) {
      var el = ov.querySelector(sel);
      if (el) el.onclick = fn;
    }
    bind('#dw-close', closeDrawer);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeDrawer(); });

    bind('#dw-freeze', function () {
      U().confirmBox('Freeze this customer?', 'They lose login access and all sessions die immediately.', 'Freeze account', true, async function () {
        await ZB.api.post('/api/admin/users/' + id + '/freeze', { frozen: true });
        U().toast('Account frozen'); closeDrawer(); ZB.render();
      });
    });
    bind('#dw-unfreeze', async function () {
      try {
        await ZB.api.post('/api/admin/users/' + id + '/freeze', { frozen: false });
        U().toast('Account restored'); closeDrawer(); ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    });
    bind('#dw-restrict', function () {
      U().modal(
        '<div class="modal-head"><h3>Freeze transactions</h3>' +
        '<button class="icon-btn" data-x-close>' + U().icon('x', 16) + '</button></div>' +
        '<p class="small muted mb-2">' + U().esc(u.name) + ' can still sign in and browse, but every transfer, payment, top-up and exchange will be <b>declined</b> until you restore them. They\'ll be notified.</p>' +
        '<form data-form="adm-restrict">' +
        '<div class="field"><label>Reason (shared with the customer)</label>' +
        '<input class="input" name="reason" required placeholder="Under compliance review — verification needed"></div>' +
        '<button class="btn solid-danger block" type="submit">' + U().icon('lock', 15) + ' Freeze transactions</button></form>');
      ZB.forms['adm-restrict'] = async function (data) {
        try {
          await ZB.api.post('/api/admin/users/' + id + '/restrict',
            { restricted: true, reason: data.reason });
          U().closeModal();
          U().toast('Transactions frozen for ' + u.name.split(' ')[0]);
          closeDrawer(); ZB.render();
        } catch (e) { U().toast(e.message, 'err'); }
      };
    });
    bind('#dw-unrestrict', async function () {
      try {
        await ZB.api.post('/api/admin/users/' + id + '/restrict', { restricted: false });
        U().toast('Transactions restored for customer');
        closeDrawer(); ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    });
    bind('#dw-adjust', function () {
      adjustModal(id, d.accounts, function () { closeDrawer(); ZB.render(); });
    });
    bind('#dw-role', async function () {
      var newRole = u.role === 'admin' ? 'user' : 'admin';
      U().confirmBox((newRole === 'admin' ? 'Grant staff access?' : 'Revoke staff access?'),
        newRole === 'admin' ? u.name + ' will get full back-office and system-console powers.'
          : u.name + ' will lose back-office access.',
        newRole === 'admin' ? 'Make staff' : 'Revoke', false, async function () {
          try {
            await ZB.api.post('/api/admin/users/' + id + '/role', { role: newRole });
            U().toast('Role updated'); closeDrawer(); ZB.render();
          } catch (e) { U().toast(e.message, 'err'); }
        });
    });
    bind('#dw-kyc', function () { kycModal(id, u.name, function () { closeDrawer(); ZB.render(); }); });
    bind('#dw-delete', function () {
      U().confirmBox('Delete ' + u.name + ' permanently?',
        'This wipes their accounts, cards, loans and transaction history. There is no undo.',
        'Delete forever', true, async function () {
          try {
            await ZB.api.del('/api/admin/users/' + id);
            U().toast('Customer deleted'); closeDrawer(); ZB.render();
          } catch (e) { U().toast(e.message, 'err'); }
        });
    });
  }

  function closeDrawer() {
    var el = document.getElementById('cust-drawer');
    if (el) el.remove();
  }

  function adjustModal(userId, accounts, done) {
    U().modal(
      '<div class="modal-head"><h3>Adjust balance</h3><button class="icon-btn" data-x-close>' + U().icon('x', 16) + '</button></div>' +
      '<form data-form="adm-adjust">' +
      '<div class="field"><label>Account</label><select class="input" name="account_id">' +
      accounts.map(function (a) {
        return '<option value="' + a.id + '">' + U().esc(a.label + ' · ' + a.currency + ' · ' + a.number) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label>Amount — use negative to debit</label><input class="input" type="number" step="0.01" name="amount" required placeholder="-250.00 or 500.00"></div>' +
      '<div class="field"><label>Reason (required, audited)</label><input class="input" name="reason" required placeholder="Goodwill credit, correction…"></div>' +
      '<button class="btn primary block" type="submit">' + U().icon('check', 15) + ' Post adjustment</button></form>');
    ZB.forms['adm-adjust'] = async function (data) {
      try {
        await ZB.api.post('/api/admin/users/' + userId + '/adjust', data);
        U().closeModal();
        U().toast('Adjustment posted & notified');
        if (done) done();
      } catch (e) { U().toast(e.message, 'err'); }
    };
  }

  /* =========================================================== ACCOUNTS */
  async function accountsPage() {
    var r = await ZB.api.get('/api/admin/accounts');
    var html =
      pageHead('Bank accounts', 'Total held: <b style="color:var(--mint)">$' + Math.round(r.total_usd).toLocaleString() + '</b> USD-equivalent across all wallets.') +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Owner</th><th>Label</th><th>Number</th><th>Currency</th><th>Type</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>' +
      r.accounts.map(function (a) {
        return '<tr><td><b class="small">' + U().esc(a.owner_name) + '</b>' +
          '<div class="tiny faint">' + U().esc(a.owner_email) + '</div></td>' +
          '<td class="small">' + U().esc(a.label) + '</td>' +
          '<td class="mono small">' + U().esc(a.number) + '</td><td>' + a.currency + '</td>' +
          '<td class="small muted">' + (a.kind === 'savings' ? 'Savings' : 'Checking') + '</td>' +
          '<td class="num"><b>' + U().money(a.balance, a.currency) + '</b>' +
          '<div class="tiny faint">≈ ' + U().compact(a.usd_eq) + '</div></td>' +
          '<td><div class="row" style="gap:8px;justify-content:flex-end">' +
          (a.frozen ? '<span class="pill red">frozen</span>' : '<span class="pill green plain">active</span>') +
          '<button class="btn sm ' + (a.frozen ? 'danger' : 'ghost') + '" data-frz="' + a.id + '" data-to="' + (a.frozen ? '0' : '1') + '">' +
          U().icon('snow', 13) + (a.frozen ? ' Frozen' : ' Freeze') + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div>';

    return {
      html: html, title: 'Accounts',
      mount: function () {
        document.querySelectorAll('[data-frz]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            try {
              await ZB.api.post('/api/admin/accounts/' + btn.dataset.frz + '/freeze', { frozen: btn.dataset.to === '1' });
              U().toast(btn.dataset.to === '1' ? 'Account frozen' : 'Account unfrozen');
              ZB.render();
            } catch (e) { U().toast(e.message, 'err'); }
          });
        });
      }
    };
  }

  /* ======================================================= TRANSACTIONS */
  var txState = { q: '', type: '', status: '', page: 1 };
  async function transactions(query) {
    if (query) {
      if (query.page) txState.page = +query.page || 1;
      if (query.status !== undefined && query.status !== null) txState.status = query.status || '';
      if (query.type !== undefined && query.type !== null) txState.type = query.type || '';
    }
    var qs = '?q=' + encodeURIComponent(txState.q) + '&type=' + txState.type + '&status=' + txState.status + '&page=' + txState.page;
    var r = await ZB.api.get('/api/admin/transactions' + qs);

    var typeOpts = ['', 'deposit', 'transfer_in', 'transfer_out', 'payment', 'interest',
      'exchange_out', 'loan_disbursement', 'loan_payment', 'adjustment', 'reversal']
      .map(function (t) {
        return '<option value="' + t + '" ' + (txState.type === t ? 'selected' : '') + '>' +
          (t || 'All types') + '</option>';
      }).join('');
    var statusOpts = ['', 'completed', 'pending', 'rejected', 'reversed'].map(function (s) {
      return '<option value="' + s + '" ' + (txState.status === s ? 'selected' : '') + '>' +
        (s || 'All statuses') + '</option>';
    }).join('');

    var html =
      pageHead('Ledger', 'Every money movement across the bank. ' + r.meta.total + ' entries.',
        '<div class="row" style="background:var(--surface);border:1px solid var(--line-2);border-radius:999px;padding:8px 14px;gap:8px">' +
        U().icon('search', 15) +
        '<input id="tx-q" placeholder="Ref, person, note…" value="' + U().esc(txState.q) + '" style="border:none;background:none;outline:none;width:180px;color:var(--text);font-size:13.5px"></div>' +
        '<select class="input" id="tx-type" style="width:auto">' + typeOpts + '</select>' +
        '<select class="input" id="tx-status" style="width:auto">' + statusOpts + '</select>') +

      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>When</th><th>Person</th><th>Description</th><th>Account</th><th>Status</th><th class="num">Amount</th><th></th></tr></thead><tbody>' +
      (r.transactions.length ? r.transactions.map(function (t) {
        return '<tr><td class="small muted" style="white-space:nowrap">' + U().rel(t.created_at) + '</td>' +
          '<td class="small"><b>' + U().esc(t.user_name) + '</b></td>' +
          '<td class="small">' + U().esc(t.counterparty || t.type.replace(/_/g, ' ')) +
          (t.note ? '<div class="tiny faint">' + U().esc(t.note.slice(0, 60)) + '</div>' : '') +
          '<div class="tiny mono faint">' + t.ref + '</div></td>' +
          '<td class="small muted">' + U().esc(t.account_label) + ' · ' + t.currency + '</td>' +
          '<td>' + U().pillFor(t.status) + '</td>' +
          '<td class="num"><b class="' + (t.amount > 0 ? 'up' : '') + '">' + U().signedMoney(t.amount, t.currency) + '</b></td>' +
          '<td>' + (t.status === 'pending'
            ? '<div class="row" style="gap:6px;justify-content:flex-end">' +
              '<button class="btn sm" data-appr="' + t.id + '">' + U().icon('check', 13) + ' Approve</button>' +
              '<button class="btn sm danger" data-decl="' + t.id + '">Decline</button></div>'
            : t.status !== 'reversed' ? '<button class="btn sm ghost" data-rev="' + t.id + '">' + U().icon('rotate', 13) + ' Reverse</button>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">Nothing matches those filters.</td></tr>') +
      '</tbody></table></div>' +
      '<input type="hidden" id="pager-base" value="admin/transactions?q=&type=' + txState.type + '&status=' + txState.status + '">' +
      pager(r.meta);

    return {
      html: html, title: 'Ledger',
      mount: function () {
        var qi = document.getElementById('tx-q');
        qi.addEventListener('input', U().debounce(function () {
          txState.q = qi.value; txState.page = 1; ZB.render();
        }, 400));
        document.getElementById('tx-type').addEventListener('change', function (e) { txState.type = e.target.value; txState.page = 1; ZB.render(); });
        document.getElementById('tx-status').addEventListener('change', function (e) { txState.status = e.target.value; txState.page = 1; ZB.render(); });
        document.querySelectorAll('[data-appr]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            U().confirmBox('Approve this transaction?',
              'The held funds complete their journey and the customer is notified immediately.',
              'Approve', false, async function () {
                try {
                  await ZB.api.post('/api/admin/transactions/' + btn.dataset.appr + '/review',
                    { decision: 'approve' });
                  U().toast('Transaction approved & completed ✅');
                  ZB.render();
                } catch (e) { U().toast(e.message, 'err'); }
              });
          });
        });
        document.querySelectorAll('[data-decl]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            U().modal(
              '<div class="modal-head"><h3>Decline transaction</h3>' +
              '<button class="icon-btn" data-x-close>' + U().icon('x', 16) + '</button></div>' +
              '<p class="small muted mb-2">The hold is released back to the customer\'s balance and they\'re notified with your reason.</p>' +
              '<form data-form="adm-tx-decline">' +
              '<div class="field"><label>Reason shown to the customer</label>' +
              '<input class="input" name="reason" required placeholder="Compliance review failed — contact support"></div>' +
              '<button class="btn solid-danger block" type="submit">' + U().icon('x', 15) + ' Decline & refund hold</button></form>');
            ZB.forms['adm-tx-decline'] = async function (data) {
              try {
                await ZB.api.post('/api/admin/transactions/' + btn.dataset.decl + '/review',
                  Object.assign({ decision: 'reject' }, data));
                U().closeModal();
                U().toast('Declined — hold refunded to customer');
                ZB.render();
              } catch (e) { U().toast(e.message, 'err'); }
            };
          });
        });
        document.querySelectorAll('[data-rev]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            U().modal(
              '<div class="modal-head"><h3>Reverse transaction</h3><button class="icon-btn" data-x-close>' + U().icon('x', 16) + '</button></div>' +
              '<p class="small muted mb-2">A mirrored entry restores the balance automatically. The customer is notified and the action is audit-logged as critical.</p>' +
              '<form data-form="adm-reverse">' +
              '<div class="field"><label>Reason (required)</label><input class="input" name="reason" required placeholder="Duplicate charge, fraud hold…"></div>' +
              '<button class="btn danger block" type="submit">' + U().icon('rotate', 15) + ' Post reversal</button></form>');
            ZB.forms['adm-reverse'] = async function (data) {
              try {
                await ZB.api.post('/api/admin/transactions/' + btn.dataset.rev + '/reverse', data);
                U().closeModal();
                U().toast('Reversal posted');
                ZB.render();
              } catch (e) { U().toast(e.message, 'err'); }
            };
          });
        });
        document.querySelectorAll('.pager [data-page]').forEach(function (b) {
          b.addEventListener('click', function () { txState.page = +b.dataset.page; ZB.render(); });
        });
        if (txState.q) refocusInput('tx-q');
      }
    };
  }

  /* ============================================================ PAYOUTS */
  async function payouts() {
    var r = await ZB.api.get('/api/admin/payouts');
    var pending = r.payouts.filter(function (p) { return p.status === 'pending'; });
    var past = r.payouts.filter(function (p) { return p.status !== 'pending'; });

    var html =
      pageHead('Payout approvals', 'External transfers above $2,000 wait here for a compliance decision.') +
      (pending.length ?
        '<div class="banner">' + U().icon('clock', 15) + ' ' + pending.length + ' payout' + (pending.length === 1 ? '' : 's') + ' need a decision. Funds are already on hold from the customer\'s balance.</div>' +
        pending.map(function (p) {
          return '<div class="card mb-1" style="border-color:rgba(251,191,36,.35)"><div class="spread wrap">' +
            '<div><b>' + U().money(-p.amount - (p.fee || 0), p.currency) + ' → ' + U().esc(p.counterparty) + '</b>' +
            '<div class="small muted mt-1">' + U().esc(p.ext_bank || '') + ' ••' + U().esc(p.ext_number || '') +
            ' · requested by <b>' + U().esc(p.user_name) + '</b> from ' + U().esc(p.account_label) + '</div>' +
            '<div class="tiny faint mt-1">' + U().dateTime(p.created_at) + ' · ref <span class="mono">' + p.ref + '</span></div></div>' +
            '<div class="row" style="gap:8px">' +
            '<button class="btn primary sm" data-ok="' + p.id + '">' + U().icon('check', 14) + ' Approve</button>' +
            '<button class="btn danger sm" data-no="' + p.id + '">' + U().icon('x', 14) + ' Reject</button></div></div></div>';
        }).join('')
        : '<div class="empty card">' + U().icon('check', 32) + '<b>Queue is clear</b>No payouts waiting for review.</div>') +
      (past.length ? '<h3 class="mt-3 mb-1">Recently decided</h3><div class="table-wrap"><table class="table">' +
        '<thead><tr><th>When decided</th><th>Beneficiary</th><th>Customer</th><th>Status</th><th class="num">Amount</th></tr></thead><tbody>' +
        past.map(function (p) {
          return '<tr><td class="small muted">' + U().rel(p.created_at) + '</td><td class="small">' + U().esc(p.counterparty) + '</td>' +
            '<td class="small muted">' + U().esc(p.user_name) + '</td><td>' + U().pillFor(p.status) + '</td>' +
            '<td class="num"><b class="down">' + U().money(-p.amount - (p.fee || 0), p.currency) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' : '');

    return {
      html: html, title: 'Payout approvals',
      mount: function () {
        document.querySelectorAll('[data-ok]').forEach(function (btn) {
          btn.addEventListener('click', function () { review(btn.dataset.ok, 'approve'); });
        });
        document.querySelectorAll('[data-no]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            U().modal(
              '<div class="modal-head"><h3>Reject payout</h3><button class="icon-btn" data-x-close>' + U().icon('x', 16) + '</button></div>' +
              '<form data-form="adm-payout-no">' +
              '<div class="field"><label>Reason shown to the customer</label><input class="input" name="reason" required placeholder="Compliance hold — contact support"></div>' +
              '<button class="btn danger block" type="submit">' + U().icon('x', 15) + ' Reject & refund</button></form>');
            ZB.forms['adm-payout-no'] = async function (data) {
              try {
                await ZB.api.post('/api/admin/payouts/' + btn.dataset.no + '/review',
                  Object.assign({ decision: 'reject' }, data));
                U().closeModal();
                U().toast('Rejected — funds returned to customer');
                ZB.render();
              } catch (e) { U().toast(e.message, 'err'); }
            };
          });
        });
      }
    };

    async function review(id, decision) {
      try {
        await ZB.api.post('/api/admin/payouts/' + id + '/review', { decision: decision });
        U().toast(decision === 'approve' ? 'Approved — bank is sending it 🚀' : 'Done');
        ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    }
  }

  /* =============================================================== LOANS */
  var loanTab = 'pending';
  async function loansPage(query) {
    if (query && query.tab) loanTab = query.tab;
    var r = await ZB.api.get('/api/admin/loans?status=' + loanTab);
    var tabs = [['pending', 'Pending'], ['active', 'Active'], ['rejected', 'Declined'], ['repaid', 'Repaid'], ['', 'All']]
      .map(function (t) {
        return '<button class="tab ' + (loanTab === t[0] ? 'active' : '') + '" data-lt="' + t[0] + '">' + t[1] + '</button>';
      }).join('');

    var html =
      pageHead('Loans desk', 'Approve with one click — funds disburse instantly at ' + r.apr + '% APR.') +
      '<div class="tabs">' + tabs + '</div>' +
      (r.loans.length ? r.loans.map(function (l) {
        return '<div class="card mb-1 hover"><div class="spread wrap">' +
          '<div><b>' + U().esc(l.user_name) + '</b> wants <b>' + U().money(l.principal, l.currency) + '</b> over ' +
          l.term_months + 'mo' +
          '<div class="small muted mt-1">' + U().money(l.monthly_payment, l.currency) + '/mo · ' +
          U().esc(l.purpose || 'no purpose given') + ' · into ' + U().esc(l.account_label) + '</div>' +
          '<div class="tiny faint mt-1">' + U().rel(l.created_at) + ' · ' + U().esc(l.user_email) + '</div></div>' +
          '<div class="row wrap" style="gap:8px">' + U().pillFor(l.status) +
          (l.status === 'pending'
            ? '<button class="btn primary sm" data-loan="' + l.id + '" data-dec="approve">' + U().icon('check', 14) + ' Approve & disburse</button>' +
              '<button class="btn danger sm" data-loan="' + l.id + '" data-dec="reject">' + U().icon('x', 14) + ' Decline</button>'
            : '') +
          '</div></div></div>';
      }).join('') : '<div class="empty card">' + U().icon('target', 32) + '<b>Nothing in “' + (loanTab || 'all') + '”</b></div>');

    return {
      html: html, title: 'Loans desk',
      mount: function () {
        document.querySelectorAll('[data-lt]').forEach(function (t) {
          t.addEventListener('click', function () { loanTab = t.dataset.lt; ZB.render(); });
        });
        document.querySelectorAll('[data-loan]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.dataset.loan, dec = btn.dataset.dec;
            if (dec === 'approve') {
              U().confirmBox('Approve this loan?',
                'The principal is deposited into the customer\'s account immediately and repayments begin next month.',
                'Approve & disburse', false, async function () {
                  try {
                    await ZB.api.post('/api/admin/loans/' + id + '/review', { decision: 'approve' });
                    U().toast('Loan disbursed 💸');
                    ZB.render();
                  } catch (e) { U().toast(e.message, 'err'); }
                });
            } else {
              U().modal(
                '<div class="modal-head"><h3>Decline application</h3><button class="icon-btn" data-x-close>' + U().icon('x', 16) + '</button></div>' +
                '<form data-form="adm-loan-no">' +
                '<div class="field"><label>Reason shown to the customer</label><input class="input" name="note" required placeholder="Debt-to-income ratio too high"></div>' +
                '<button class="btn danger block" type="submit">Decline application</button></form>');
              ZB.forms['adm-loan-no'] = async function (data) {
                try {
                  await ZB.api.post('/api/admin/loans/' + id + '/review',
                    Object.assign({ decision: 'reject' }, data));
                  U().closeModal();
                  U().toast('Application declined');
                  ZB.render();
                } catch (e) { U().toast(e.message, 'err'); }
              };
            }
          });
        });
      }
    };
  }

  /* ================================================================= KYC */
  async function kyc() {
    var r = await ZB.api.get('/api/admin/users?status=pending_kyc&page=1');
    var users = r.users;

    var html =
      pageHead('Identity reviews', 'Documents submitted by customers. Approve to unlock loans and higher limits.') +
      (users.length ? users.map(function (u) {
        return '<div class="card mb-1"><div class="spread wrap">' +
          '<div class="row" style="gap:13px"><div class="avatar" style="background:' + U().hueColor(u.hue) + '">' +
          U().esc(U().initials(u.name)) + '</div>' +
          '<div><b>' + U().esc(u.name) + '</b> <span class="small muted">· ' + U().esc(u.email) + '</span>' +
          '<div class="tiny faint mt-1">joined ' + U().rel(u.joined_at) + ' · ' + U().esc(u.country || 'unknown country') + '</div></div></div>' +
          '<div class="row" style="gap:8px">' +
          '<button class="btn primary sm" data-kyc-ok="' + u.id + '">' + U().icon('shield', 14) + ' Verify</button>' +
          '<button class="btn danger sm" data-kyc-no="' + u.id + '">' + U().icon('x', 14) + ' Reject</button></div></div></div>';
      }).join('') : '<div class="empty card">' + U().icon('shield', 32) +
        '<b>All caught up</b>No identity checks waiting.</div>');

    return {
      html: html, title: 'Verifications',
      mount: function () {
        document.querySelectorAll('[data-kyc-ok]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            try {
              await ZB.api.post('/api/admin/users/' + btn.dataset.kycOk + '/kyc', { decision: 'approve' });
              U().toast('Identity verified ✅');
              ZB.render();
            } catch (e) { U().toast(e.message, 'err'); }
          });
        });
        document.querySelectorAll('[data-kyc-no]').forEach(function (btn) {
          btn.addEventListener('click', function () { kycModal(+btn.dataset.kycNo, '', null); });
        });
      }
    };
  }

  function kycModal(userId, name, done) {
    U().modal(
      '<div class="modal-head"><h3>Reject verification' + (name ? ' — ' + U().esc(name) : '') + '</h3>' +
      '<button class="icon-btn" data-x-close>' + U().icon('x', 16) + '</button></div>' +
      '<form data-form="adm-kyc-no">' +
      '<div class="field"><label>Reason shown to the customer</label><input class="input" name="note" required placeholder="Document blurry — please resubmit"></div>' +
      '<button class="btn danger block" type="submit">Reject submission</button></form>');
    ZB.forms['adm-kyc-no'] = async function (data) {
      try {
        await ZB.api.post('/api/admin/users/' + userId + '/kyc', Object.assign({ decision: 'reject' }, data));
        U().closeModal();
        U().toast('Verification rejected');
        if (done) done(); else ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    };
  }

  /* ============================================================ SUPPORT */
  async function support() {
    var r = await ZB.api.get('/api/admin/messages');
    var msgs = r.messages;
    var open = msgs.filter(function (m) { return m.status === 'open'; });

    var html =
      pageHead('Support inbox', 'Messages from the public site and logged-in customers.') +
      (msgs.length ? msgs.map(function (m) {
        return '<div class="msg-card mb-1 ' + (m.status === 'resolved' ? 'resolved' : '') + '">' +
          '<div class="spread wrap"><div><b>' + U().esc(m.subject) + '</b>' +
          '<span class="pill ' + (m.status === 'open' ? 'amber' : 'green') + '" style="margin-left:8px">' + m.status + '</span>' +
          '<div class="small muted mt-1">' + U().esc(m.name) + ' &lt;' + U().esc(m.email) + '&gt; · ' + U().rel(m.created_at) + '</div></div></div>' +
          '<p class="small mt-1" style="line-height:1.6">' + U().esc(m.body) + '</p>' +
          (m.reply ? '<div class="code-box mt-1" style="max-height:none"><b style="color:var(--mint)">You:</b> ' + U().esc(m.reply) + '</div>' : '') +
          (m.status === 'open' ?
            '<div class="row mt-2 wrap" style="gap:8px"><input class="input" id="reply-' + m.id + '" placeholder="Type a reply…" style="flex:1;min-width:220px">' +
            '<button class="btn sm primary" data-reply="' + m.id + '">' + U().icon('send', 13) + ' Reply</button>' +
            '<button class="btn sm ghost" data-resolve="' + m.id + '">' + U().icon('check', 13) + ' Resolve</button></div>' : '') +
          '</div>';
      }).join('') : '<div class="empty card">' + U().icon('message', 32) + '<b>Inbox zero</b>No messages yet.</div>');

    return {
      html: html, title: 'Support inbox',
      mount: function () {
        document.querySelectorAll('[data-reply]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            var inp = document.getElementById('reply-' + btn.dataset.reply);
            if (!inp.value.trim()) { U().toast('Write something first', 'err'); return; }
            try {
              await ZB.api.post('/api/admin/messages/' + btn.dataset.reply,
                { reply: inp.value, resolve: true });
              U().toast('Reply sent & resolved');
              ZB.render();
            } catch (e) { U().toast(e.message, 'err'); }
          });
        });
        document.querySelectorAll('[data-resolve]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            try {
              await ZB.api.post('/api/admin/messages/' + btn.dataset.resolve, { resolve: true });
              U().toast('Marked resolved');
              ZB.render();
            } catch (e) { U().toast(e.message, 'err'); }
          });
        });
      }
    };
  }

  /* ========================================================= BROADCASTS */
  async function broadcast() {
    var r = await ZB.api.get('/api/admin/broadcasts');
    var html =
      pageHead('Announcements', 'Land directly in every customer\'s notification tray.') +
      '<div class="split rev"><div class="card pad-lg">' +
      '<form data-form="adm-broadcast">' +
      '<div class="field"><label>Title</label><input class="input" name="title" required maxlength="80" placeholder="Scheduled maintenance Sunday"></div>' +
      '<div class="field"><label>Message</label><textarea class="input" name="body" required maxlength="380" placeholder="Keep it short and human."></textarea></div>' +
      '<div class="field"><label>Audience</label><div class="seg" id="bc-aud">' +
      '<button type="button" data-a="all" class="active">Everyone</button>' +
      '<button type="button" data-a="verified">Verified only</button></div></div>' +
      '<button class="btn primary block lg" type="submit">' + U().icon('bell', 16) + ' Send announcement</button></form></div>' +
      '<div class="card"><div class="card-title"><h3>Sent history</h3></div>' +
      (r.broadcasts.length ? r.broadcasts.map(function (bc) {
        return '<div class="set-row"><div><b>' + U().esc(bc.title) + '</b>' +
          '<div class="desc">' + U().esc(bc.body.slice(0, 90)) + (bc.body.length > 90 ? '…' : '') + '</div>' +
          '<div class="tiny faint mt-1">' + U().rel(bc.created_at) + ' · ' + bc.recipients + ' recipients · by ' + U().esc(bc.sent_by) + '</div></div>' +
          '<span class="pill blue plain">' + bc.audience + '</span></div>';
      }).join('') : '<p class="small muted">Nothing sent yet.</p>') + '</div></div>';

    var audience = 'all';
    return {
      html: html, title: 'Announcements',
      mount: function () {
        document.querySelectorAll('#bc-aud button').forEach(function (btn) {
          btn.addEventListener('click', function () {
            document.querySelectorAll('#bc-aud button').forEach(function (x) { x.classList.remove('active'); });
            btn.classList.add('active');
            audience = btn.dataset.a;
          });
        });
        ZB.forms['adm-broadcast'] = async function (data) {
          try {
            var res = await ZB.api.post('/api/admin/broadcasts',
              Object.assign({}, data, { audience: audience }));
            U().toast('Sent to ' + res.broadcast.recipients + ' customers 📣');
            ZB.render();
          } catch (e) { U().toast(e.message, 'err'); }
        };
      }
    };
  }

  /* ============================================================== AUDIT */
  var audState = { q: '', severity: '', page: 1 };
  async function auditPage(query) {
    if (query && query.page) audState.page = +query.page || 1;
    var qs = '?q=' + encodeURIComponent(audState.q) + '&severity=' + audState.severity + '&page=' + audState.page;
    var r = await ZB.api.get('/api/admin/audit' + qs);
    var sevOpts = ['', 'info', 'warn', 'critical'].map(function (s) {
      return '<option value="' + s + '" ' + (audState.severity === s ? 'selected' : '') + '>' +
        (s || 'All severities') + '</option>';
    }).join('');

    var html =
      pageHead('Audit trail', 'Append-only record of everything that happens — including yours.',
        '<div class="row" style="background:var(--surface);border:1px solid var(--line-2);border-radius:999px;padding:8px 14px;gap:8px">' +
        U().icon('search', 15) +
        '<input id="au-q" placeholder="Action, actor, target…" value="' + U().esc(audState.q) + '" style="border:none;background:none;outline:none;width:200px;color:var(--text);font-size:13.5px"></div>' +
        '<select class="input" id="au-sev" style="width:auto">' + sevOpts + '</select>') +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th><th>Severity</th></tr></thead><tbody>' +
      (r.audit.length ? r.audit.map(function (a) {
        return '<tr><td class="small muted" style="white-space:nowrap">' + U().dateTime(a.ts) + '</td>' +
          '<td class="small mono">' + U().esc(a.actor) + '</td>' +
          '<td class="small"><b>' + U().esc(a.action) + '</b></td>' +
          '<td class="small muted mono">' + U().esc(String(a.target)) + '</td>' +
          '<td class="tiny muted">' + U().esc(JSON.stringify(a.meta || {})).slice(1, 120).replace(/"$/, '') + '</td>' +
          '<td>' + sevPill(a.severity) + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px">No matching events.</td></tr>') +
      '</tbody></table></div>' +
      '<input type="hidden" id="pager-base" value="admin/audit?q=&severity=' + audState.severity + '">' +
      pager(r.meta);

    return {
      html: html, title: 'Audit log',
      mount: function () {
        var qi = document.getElementById('au-q');
        qi.addEventListener('input', U().debounce(function () {
          audState.q = qi.value; audState.page = 1; ZB.render();
        }, 350));
        document.getElementById('au-sev').addEventListener('change', function (e) {
          audState.severity = e.target.value; audState.page = 1; ZB.render();
        });
        document.querySelectorAll('.pager [data-page]').forEach(function (b) {
          b.addEventListener('click', function () { audState.page = +b.dataset.page; ZB.render(); });
        });
        if (audState.q) refocusInput('au-q');
      }
    };
  }

  /* ------------------------------------- approvals center (all queues) -- */
  function declineMailModal(txId, ref, customer) {
    U().modal(
      '<div class="modal-head"><h3>Decline ' + U().esc(ref || 'transaction') + '</h3>' +
      '<button class="icon-btn" data-x-close>' + U().icon('x', 16) + '</button></div>' +
      '<p class="small muted mb-2">The hold is released back to the customer\'s balance. You can also send them a branded email from <b>alerts@zentra.bank</b> explaining why and how to fix it.</p>' +
      '<form data-form="adm-decline-mail">' +
      '<div class="field"><label>Reason for declining</label>' +
      '<input class="input" name="reason" required placeholder="Compliance review failed"></div>' +
      '<div class="field"><label>Email subject</label>' +
      '<input class="input" name="subject" value="Important: action required on your account"></div>' +
      '<div class="field"><label>Message to ' + U().esc(customer || 'the customer') + '</label>' +
      '<textarea class="input" name="message" rows="5">Hello,\n\nYour transaction (ref ' + U().esc(ref || '') + ') was declined after a routine review.\n\nTo restore full access to your account, please:\n1. Reply to this email with proof of the funding source.\n2. Complete identity verification in Settings → Verification.\n\nOnce reviewed, your account will work normally again.\n\n— Zentra Alerts · alerts@zentra.bank</textarea></div>' +
      '<button class="btn solid-danger block" type="submit">' + U().icon('mail', 15) + ' Decline & send email</button></form>');
    ZB.forms['adm-decline-mail'] = async function (data) {
      try {
        await ZB.api.post('/api/admin/transactions/' + txId + '/review',
          { decision: 'reject', reason: data.reason, message: data.message, subject: data.subject });
        U().closeModal();
        U().toast('Declined — branded email sent to customer');
        ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    };
  }

  function approveTx(id) {
    U().confirmBox('Approve this transaction?',
      'Held funds complete their journey and the customer is notified immediately.',
      'Approve', false, async function () {
        try {
          await ZB.api.post('/api/admin/transactions/' + id + '/review', { decision: 'approve' });
          U().toast('Transaction approved & completed ✅');
          ZB.render();
        } catch (e) { U().toast(e.message, 'err'); }
      });
  }

  async function approvals(q) {
    var r = await ZB.api.get('/api/admin/transactions?status=pending&per=100');
    var rows = r.transactions;
    var topups = rows.filter(function (t) { return t.type === 'deposit'; });
    var payoutsL = rows.filter(function (t) { return t.type === 'transfer_out'; });
    var other = rows.filter(function (t) { return t.type !== 'deposit' && t.type !== 'transfer_out'; });
    var focus = q && q.type ? q.type : '';

    function group(title, icon, list, render) {
      if (!list.length) return '';
      return '<h3 class="mb-1 mt-2">' + U().icon(icon, 16) + ' ' + title + ' <span class="pill amber">' + list.length + '</span></h3>' +
        list.map(render).join('');
    }
    function txCard(t) {
      var inbound = t.amount > 0;
      return '<div class="card mb-1" style="border-color:rgba(251,191,36,.35)"><div class="spread wrap">' +
        '<div><b>' + U().money(t.amount, t.currency) + (inbound ? ' → ' : ' ← ') + U().esc(t.user_name) + '</b>' +
        '<div class="small muted mt-1">' + U().esc((t.counterparty || t.type.replace(/_/g, ' '))) +
        ' · into ' + U().esc(t.account_label || '') + '</div>' +
        '<div class="tiny faint mt-1">' + U().dateTime(t.created_at) + ' · ref <span class="mono">' + U().esc(t.ref) + '</span></div></div>' +
        '<div class="row" style="gap:8px">' +
        '<button class="btn primary sm" data-appr="' + t.id + '">' + U().icon('check', 14) + ' Approve</button>' +
        '<button class="btn danger sm" data-decl="' + t.id + '" data-ref="' + U().esc(t.ref) + '" data-cust="' + U().esc(t.user_name) + '">' + U().icon('x', 14) + ' Decline</button></div></div>';
    }

    var html =
      pageHead('Approvals', 'Every pending money movement in one place — approve it, or decline it with a branded email explaining what the customer must do.') +
      '<div class="row mb-2" style="gap:8px">' +
      ['<a class="pill ' + (!focus ? 'navy plain' : 'gray') + '" href="#/admin/approvals">All (' + rows.length + ')</a>',
       '<a class="pill ' + (focus === 'topups' ? 'navy plain' : 'gray') + '" href="#/admin/approvals?type=topups">Top-ups (' + topups.length + ')</a>',
       '<a class="pill ' + (focus === 'payouts' ? 'navy plain' : 'gray') + '" href="#/admin/approvals?type=payouts">Payouts (' + payoutsL.length + ')</a>',
       '<a class="pill ' + (focus === 'other' ? 'navy plain' : 'gray') + '" href="#/admin/approvals?type=other">Other (' + other.length + ')</a>'
      ].join(' ') + '</div>' +
      (!rows.length ? '<div class="empty card">' + U().icon('check', 32) + '<b>All clear</b>No transactions waiting for review.</div>' :
        (focus !== 'payouts' && focus !== 'other' ? group('Top-ups awaiting approval', 'download', topups, txCard) : '') +
        (focus !== 'topups' && focus !== 'other' ? group('Payouts awaiting approval', 'send', payoutsL, txCard) : '') +
        (focus !== 'topups' && focus !== 'payouts' ? group('Other pending items', 'clock', other, txCard) : ''));

    return {
      html: html, title: 'Approvals',
      mount: function () {
        document.querySelectorAll('[data-appr]').forEach(function (btn) {
          btn.addEventListener('click', function () { approveTx(btn.dataset.appr); });
        });
        document.querySelectorAll('[data-decl]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            declineMailModal(btn.dataset.decl, btn.dataset.ref, btn.dataset.cust);
          });
        });
      }
    };
  }

  /* --------------------------------------------------- declined log ----- */
  async function declinedLog(q) {
    var resolvedF = q && q.resolved !== undefined ? q.resolved : '';
    var r = await ZB.api.get('/api/admin/declined-logs' + (resolvedF !== '' ? '?resolved=' + resolvedF : ''));
    var kindPill = { attempt: ['red', 'Blocked attempt'], transaction: ['amber', 'Declined txn'],
                     account: ['violet', 'Account freeze'] };
    var html =
      pageHead('Declined log', 'Every declined or blocked movement — with a one-click branded email telling the customer what to do next.') +
      '<div class="row mb-2" style="gap:10px">' +
      '<span class="kpi-chip">' + U().icon('alert', 14) + ' ' + r.open + ' open</span>' +
      '<span class="row" style="gap:8px;margin-left:auto">' +
      ['<a class="pill ' + (resolvedF === '' ? 'navy plain' : 'gray') + '" href="#/admin/declined">All</a>',
       '<a class="pill ' + (resolvedF === '0' ? 'navy plain' : 'gray') + '" href="#/admin/declined?resolved=0">Open</a>',
       '<a class="pill ' + (resolvedF === '1' ? 'navy plain' : 'gray') + '" href="#/admin/declined?resolved=1">Resolved</a>'
      ].join(' ') + '</span></div>' +
      (r.logs.length ?
        '<div class="table-wrap card"><table class="table">' +
        '<thead><tr><th>When</th><th>Customer</th><th>Type</th><th>Reason</th><th>Status</th><th style="width:190px"></th></tr></thead><tbody>' +
        r.logs.map(function (l) {
          var kp = kindPill[l.kind] || ['gray', l.kind];
          return '<tr><td class="small muted">' + U().rel(l.created_at) +
            '<div class="tiny faint mono">' + U().esc(l.ref) + '</div></td>' +
            '<td class="small"><b>' + U().esc(l.user_name) + '</b><div class="tiny faint">' + U().esc(l.user_email) + '</div></td>' +
            '<td><span class="pill ' + kp[0] + ' plain">' + kp[1] + '</span></td>' +
            '<td class="small">' + U().esc(l.reason) +
            (l.tx_ref ? '<div class="tiny faint mono">txn ' + U().esc(l.tx_ref) + '</div>' : '') + '</td>' +
            '<td>' + (l.resolved ? '<span class="pill green">resolved</span>' : '<span class="pill amber">open</span>') +
            (l.mailed ? '<div class="tiny faint mt-1">' + U().icon('mail', 11) + ' emailed</div>' : '') + '</td>' +
            '<td><div class="row" style="gap:6px;justify-content:flex-end">' +
            (l.mail_locked
              ? '<span class="tiny muted" style="display:inline-flex;align-items:center;gap:4px">' + U().icon('lock', 12) +
                ' email unlocks on attempt ' + l.attempts + '/3</span>'
              : '<button class="btn sm ghost" data-mail="' + l.id + '" data-ref="' + U().esc(l.ref) + '" data-name="' + U().esc(l.user_name) + '" data-reason="' + U().esc(l.reason) + '">' + U().icon('mail', 13) + ' Mail</button>') +
            (l.resolved ? '' : '<button class="btn sm" data-resolve="' + l.id + '">' + U().icon('check', 13) + ' Resolve</button>') +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty card">' + U().icon('check', 32) + '<b>Nothing declined</b>No blocked movements on record.</div>');

    return {
      html: html, title: 'Declined log',
      mount: function () {
        document.querySelectorAll('[data-resolve]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            try {
              await ZB.api.post('/api/admin/declined-logs/' + btn.dataset.resolve + '/resolve');
              U().toast('Marked resolved ✓'); ZB.render();
            } catch (e) { U().toast(e.message, 'err'); }
          });
        });
        document.querySelectorAll('[data-mail]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            U().modal(
              '<div class="modal-head"><h3>Email ' + U().esc(btn.dataset.name) + '</h3>' +
              '<button class="icon-btn" data-x-close>' + U().icon('x', 16) + '</button></div>' +
              '<p class="tiny muted mb-2">Delivered in-app and by email from <b>alerts@zentra.bank</b> regarding ' + U().esc(btn.dataset.ref) + '.</p>' +
              '<form data-form="adm-log-mail">' +
              '<div class="field"><label>Subject</label>' +
              '<input class="input" name="subject" value="Important: action required on your account"></div>' +
              '<div class="field"><label>What happened & what they must do</label>' +
              '<textarea class="input" name="body" rows="6">Hello,\n\nRegarding ' + U().esc(btn.dataset.ref) + ': ' + U().esc(btn.dataset.reason) + '.\n\nTo get your account working again, please:\n1. Complete identity verification under Settings → Verification.\n2. Reply to this email with any documents we requested.\n\nOur team reviews replies within one business day.\n\n— Zentra Alerts · alerts@zentra.bank</textarea></div>' +
              '<button class="btn block" type="submit">' + U().icon('mail', 15) + ' Send branded email</button></form>');
            ZB.forms['adm-log-mail'] = async function (data) {
              try {
                await ZB.api.post('/api/admin/declined-logs/' + btn.dataset.mail + '/mail', data);
                U().closeModal();
                U().toast('Email sent from alerts@zentra.bank 📧'); ZB.render();
              } catch (e) { U().toast(e.message, 'err'); }
            };
          });
        });
      }
    };
  }

  async function mailPage() {
    var status = null;
    try { status = await ZB.api.get('/api/system/status'); } catch (_) {}
    var mailState = (status && status.mail) || { enabled: false, from: 'alerts@zentra.bank' };
    var cust = await ZB.api.get('/api/admin/users?per=200');
    var del = null;
    try { del = await ZB.api.get('/api/admin/deliveries'); } catch (_) {}

    var setupHelp = mailState.enabled
      ? '<p class="tiny faint">Outbound email is <b>active via ' + U().esc(mailState.provider) + '</b> · sent from <b>' + U().esc(mailState.from) + '</b>. New customers, transaction alerts and admin emails go straight to real inboxes.</p>'
      : '<p class="tiny faint">Email is currently <b>in-app only</b> (nothing real is sent). To turn on real delivery add API env vars on your host:<br>' +
        '<b>Recommended — Brevo</b> (free 300/day, no domain needed): <code>BREVO_API_KEY</code> + <code>BREVO_FROM</code> (your verified sender email).<br>' +
        '<b>Alternative — Resend</b> (free 100/day): <code>RESEND_API_KEY</code> + <code>RESEND_FROM</code> (needs a verified domain).<br>' +
        'Optionally <code>MAIL_FROM_NAME</code> (default "Zentra Bank"). Then redeploy.</p>';

    var statusPill = mailState.enabled
      ? '<span class="pill green">ACTIVE · ' + U().esc(mailState.provider) + '</span>'
      : '<span class="pill red">OFF · in-app only</span>';

    var opts = cust.users.map(function (u) {
      return '<option value="' + u.id + '">' + U().esc(u.name) + ' — ' + U().esc(u.email) + '</option>';
    }).join('');

    var delRows = (del && del.deliveries) || [];
    var html =
      pageHead('Email', 'Compose branded mail to any customer · delivery log') +
      '<div class="split rev"><div class="card pad-lg">' +
      '<form data-form="adm-mail">' +
      '<div class="field"><label>Send to</label><select class="input" name="user_id" required>' +
      '<option value="">Choose a customer…</option>' + opts + '</select></div>' +
      '<div class="field"><label>Subject</label><input class="input" name="subject" required maxlength="120" placeholder="Important: action required on your account"></div>' +
      '<div class="field"><label>Message</label><textarea class="input" name="body" rows="7" required maxlength="1000" placeholder="Hello,&#10;&#10;Write the message…"></textarea></div>' +
      '<button class="btn primary block lg" type="submit">' + U().icon('send', 15) + ' Send email</button>' +
      '</form></div>' +
      '<div class="split-col" style="display:flex;flex-direction:column;gap:14px">' +
      '<div class="card"><div class="card-title"><h3>Mail status</h3>' + statusPill + '</div>' + setupHelp + '</div>' +
      '<div class="card"><div class="card-title"><h3>Recent deliveries</h3>' + (del ? '<span class="tiny faint">' + del.counts.sent + ' sent · ' + del.counts.failed + ' failed</span>' : '') + '</div>' +
      (delRows.length ? delRows.slice(0, 10).map(function (m) {
        var st = m.ok === true ? ['green', 'sent'] : (m.ok === false ? ['red', 'failed'] : ['gray', 'skipped']);
        return '<div class="set-row"><div><b class="small">' + U().esc(m.subject) + '</b>' +
          '<div class="tiny faint">' + U().esc(m.to) + ' · ' + U().rel(m.created_at) + '</div></div>' +
          '<span class="pill ' + st[0] + '">' + st[1] + '</span></div>';
      }).join('') : '<p class="small muted">No outbound mail yet.</p>') + '</div>' +
      '</div></div>';

    return {
      html: html, title: 'Email',
      mount: function () {
        ZB.forms['adm-mail'] = async function (data) {
          try {
            await ZB.api.post('/api/admin/send-mail', data);
            U().toast('Email sent 📧'); ZB.render();
          } catch (e) { U().toast(e.message, 'err'); }
        };
      }
    };
  }

  ZB.views.admin = {
    overview: overview, customers: customers, accountsPage: accountsPage,
    transactions: transactions, payouts: payouts, loansPage: loansPage,
    kyc: kyc, support: support, broadcast: broadcast, auditPage: auditPage,
    approvals: approvals, declinedLog: declinedLog, mailPage: mailPage
  };
})(window.ZB);
