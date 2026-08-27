/* ============================================================
   Zentra — backend management console (system) views
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

  /* ============================================================= HEALTH */
  async function health() {
    var s = await ZB.api.get('/api/system/status');
    var delRes = null;
    try { delRes = await ZB.api.get('/api/admin/deliveries'); } catch (_) {}
    var upH = Math.floor(s.uptime_s / 3600), upM = Math.floor((s.uptime_s % 3600) / 60);
    var mail = (delRes && delRes.deliveries) || [];
    var mailCard =
      '<div class="card"><div class="card-title"><h3>Recent outbound mail</h3>' +
      (delRes ? '<span class="tiny faint">' + delRes.counts.sent + ' sent · ' +
        delRes.counts.failed + ' failed' + (delRes.counts.skipped ? ' · ' + delRes.counts.skipped + ' skipped' : '') + '</span>' : '') + '</div>' +
      (mail.length ? '<div class="kv">' + mail.slice(0, 8).map(function (m) {
        var st = m.ok === true ? ['green', 'sent', 'check'] : (m.ok === false ? ['red', 'failed', 'x'] : ['gray', 'skipped', 'bell']);
        return '<div class="row" style="gap:8px;justify-content:space-between"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          U().icon(st[2], 13) + ' ' +
          U().esc(m.subject || '(no subject)') +
          '<span class="tiny faint" style="display:block">' + U().esc(m.to) + '</span></span>' +
          '<span class="pill ' + st[0] + '">' + st[1] + '</span></div>';
      }).join('') + '</div>' : '<p class="tiny muted" style="padding:8px 12px">No outbound mail recorded yet.</p>') +
      '</div>';
    var c = s.counts;
    var html =
      pageHead('System health', 'Live vitals of the banking core.',
        '<button class="btn sm ghost" id="sh-refresh">' + U().icon('refresh', 14) + ' Refresh</button>') +

      (s.flags.maintenance_mode ?
        '<div class="banner">' + U().icon('alert', 16) +
        ' <b>Maintenance mode is ON</b> — customers can browse but not move money.' +
        ' <a href="#/system/rules" style="color:#fcd34d;text-decoration:underline">Turn it off in Money rules</a></div>' : '') +

      '<div class="health-grid mb-2">' +
      hItem('Server', 'v' + s.version + ' · Python ' + s.python, true) +
      hItem('Uptime', upH + 'h ' + upM + 'm', true) +
      hItem('Datastore', s.db_path + ' · ' + s.db_size_kb + ' KB', true) +
      hItem('Engine latency', s.latency_ms + ' ms scan', true) +
      hItem('Active sessions', String(s.active_sessions), s.active_sessions < 200) +
      hItem('Outbound mail', s.mail && s.mail.enabled ? 'ACTIVE · from ' + s.mail.from : 'off (in-app only)', s.mail && s.mail.enabled) +
      hItem('Platform', s.platform, true) +
      '</div>' +

      '<div class="grid cols-3 mb-2">' +
      bigCount('users', 'Customers & staff', c.users) +
      bigCount('wallet', 'Open accounts', c.accounts) +
      bigCount('card', 'Cards issued', c.cards) +
      '</div>' +
      '<div class="grid cols-3 mb-2">' +
      bigCount('layers', 'Ledger entries', c.transactions) +
      bigCount('target', 'Loans', c.loans) +
      bigCount('shieldOff', 'Audit events', c.audit) +
      '</div>' +

      '<div class="split">' +
      '<div class="card"><div class="card-title"><h3>Settlement engine</h3><span class="status-led"></span></div>' +
      '<div class="kv">' +
      '<dt>Savings interest</dt><dd>' + s.engine.savings_apy + '% APY · lazy daily accrual</dd>' +
      '<dt>Savings accounts</dt><dd>' + s.engine.savings_accounts + '</dd>' +
      '<dt>Strategy</dt><dd class="small muted">Interest is credited on the first API touch after each midnight — correct even after days offline.</dd>' +
      '<dt>Pending payouts</dt><dd>' + s.engine.pending_items + ' awaiting approval</dd>' +
      '</div></div>' +
      '<div class="card"><div class="card-title"><h3>Service switches</h3><a class="btn sm ghost" href="#/system/rules">Edit</a></div>' +
      Object.keys(s.flags).map(function (k) {
        var on = s.flags[k];
        return '<div class="flag-row"><span class="small">' +
          k.replace(/_/g, ' ').replace(/\b\w/g, function (ch) { return ch.toUpperCase(); }) + '</span>' +
          '<span class="pill ' + (on ? 'green' : 'red') + '">' + (on ? 'on' : 'off') + '</span></div>';
      }).join('') + '</div></div>' +
      mailCard + '</div>';

    return {
      html: html, title: 'System health',
      mount: function () {
        var r = document.getElementById('sh-refresh');
        if (r) r.onclick = function () { ZB.render(); };
        ZB.timers.push(setInterval(function () {
          if (location.hash.indexOf('/system') === 0) ZB.render();
        }, 30000));
      }
    };
  }

  function hItem(label, value, ok) {
    return '<div class="health-item"><div class="h-label"><span class="status-led' + (ok === false ? ' warn' : '') + '"></span>' +
      label + '</div><div class="h-val" style="font-size:' + (String(value).length > 22 ? '13px;line-height:1.5' : '19px') + '">' +
      U().esc(value) + '</div></div>';
  }
  function bigCount(iconName, label, n) {
    return '<div class="card kpi"><div class="kpi-label">' + U().icon(iconName, 15) + label + '</div>' +
      '<div class="kpi-value" data-count="' + n + '">0</div></div>';
  }

  /* ============================================================== RULES */
  async function rules() {
    var r = await ZB.api.get('/api/system/settings');
    var st = r.settings;

    var flagRows = [
      ['maintenance_mode', 'Maintenance mode', 'Pauses all customer money moves. Staff keep full access.'],
      ['registrations_open', 'Registration open', 'New sign-ups allowed.'],
      ['deposits_enabled', 'Deposits', 'Instant top-ups into accounts.'],
      ['transfers_internal_enabled', 'Internal transfers', 'Zentra-to-Zentra and between own accounts.'],
      ['transfers_external_enabled', 'External transfers', 'Payouts to other banks.'],
      ['payments_enabled', 'Bill payments', 'Utility and biller payments.'],
      ['exchange_enabled', 'Currency exchange', 'Swapping between currency wallets.'],
      ['loans_enabled', 'Loan applications', 'New loan requests (existing loans unaffected).'],
      ['cards_enabled', 'Card issuing', 'Virtual & physical card creation.']
    ].map(function (f) {
      return '<label class="flag-row" style="cursor:pointer"><div><b class="small">' + f[1] + '</b>' +
        '<div class="desc tiny muted">' + f[2] + '</div></div>' +
        '<span class="switch"><input type="checkbox" name="' + f[0] + '" data-flag ' +
        (st[f[0]] ? 'checked' : '') + '><span class="track"></span></span></label>';
    }).join('');

    function numField(key, label, hint, step) {
      return '<div class="field"><label>' + label + '</label>' +
        '<input class="input" type="number" step="' + (step || '0.01') + '" name="' + key + '" value="' + st[key] + '">' +
        (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
    }

    var fxRows = Object.keys(st.fx).map(function (cur) {
      return '<div class="field"><label>' + cur + ' per $1</label>' +
        '<input class="input" name="fx_' + cur + '" value="' + st.fx[cur] + '"' +
        (cur === 'USD' ? ' disabled' : '') + '>' +
        (cur === 'USD' ? '<span class="hint">Base currency — pinned to 1</span>' : '') + '</div>';
    }).join('');

    var termChips = [3, 6, 12, 24, 36, 48].map(function (t) {
      var on = (st.loan_terms_months || []).indexOf(t) >= 0;
      return '<button type="button" data-term="' + t + '" class="chip-btn ' + (on ? 'active' : '') + '">' + t + ' mo</button>';
    }).join('');

    var html =
      pageHead('Money rules', 'Every control below applies platform-wide, instantly.',
        '<button class="btn primary sm" id="rules-save">' + U().icon('save', 15) + ' Save changes</button>') +

      '<form id="rules-form">' +

      (st.maintenance_mode ?
        '<div class="banner">' + U().icon('alert', 15) + ' Maintenance is ON right now. Customers see a banner and cannot move money.</div>' : '') +

      '<div class="grid cols-2 mb-2">' +
      '<div class="card"><div class="card-title"><h3>Brand</h3></div>' +
      numFieldStr('site_name', 'Site name', 'Shown across emails, dashboards and landing copy.') +
      numFieldStr('support_email', 'Support email', 'Displayed on public pages.') + '</div>' +

      '<div class="card"><div class="card-title"><h3>Safety switch</h3></div>' +
      '<label class="flag-row" style="cursor:pointer"><div><b class="small down">Emergency stop</b>' +
      '<div class="desc tiny muted">Freeze ALL customer money movement instantly (maintenance mode).</div></div>' +
      '<span class="switch"><input type="checkbox" name="maintenance_mode" data-flag ' +
      (st.maintenance_mode ? 'checked' : '') + '><span class="track"></span></span></label>' +
      '<p class="hint">Use during incidents. The dashboard shows an amber banner while it\'s on.</p></div>' +
      '</div>' +

      '<div class="card mb-2"><div class="card-title"><h3>Feature switches</h3></div>' + flagRows + '</div>' +

      '<div class="grid cols-2 mb-2">' +
      '<div class="card"><div class="card-title"><h3>Limits & thresholds</h3></div>' +
      numField('max_transfer_single', 'Single transfer cap ($)', '0 disables the cap.', '1') +
      numField('daily_transfer_limit', 'Daily transfer limit ($)', 'Per account, USD-equivalent. 0 = unlimited.', '1') +
      numField('external_auto_limit', 'Auto-approve external payouts under ($)', 'Above this they queue for approval.') +
      numField('kyc_required_over', 'KYC required over ($)', 'Outgoing transfers above this need verified identity.') +
      numField('min_deposit', 'Minimum deposit ($)', '', '1') + '</div>' +

      '<div class="card"><div class="card-title"><h3>Fees & rates</h3></div>' +
      numField('transfer_fee_pct', 'Zentra transfer fee (%)', 'Keep 0 — free is the promise.') +
      numField('external_fee_pct', 'External payout fee (%)') +
      numField('external_fee_min', 'External fee minimum ($)', '1') +
      numField('exchange_fee_pct', 'Exchange fee (%)') +
      numField('card_issue_fee', 'Physical card issue fee ($)', '1') + '</div>' +
      '</div>' +

      '<div class="grid cols-2">' +
      '<div class="card"><div class="card-title"><h3>Credit engine</h3></div>' +
      numField('savings_apy', 'Savings APY (%)', 'Accrued daily, credited every day.') +
      numField('loan_apr', 'Loan APR (%)', 'Used for new quotes and the pricing calculators.') +
      '<div class="field"><label>Offered terms</label><div class="chip-row" id="term-chips">' + termChips + '</div>' +
      '<input type="hidden" name="loan_terms_months" id="terms-hidden" value="' + (st.loan_terms_months || []).join(',') + '">' +
      '<span class="hint">Tap to toggle terms offered to borrowers.</span></div>' +
      '<div class="grid cols-2" style="gap:12px">' +
      numField('min_loan', 'Min loan ($)', '', '1') +
      numField('max_loan', 'Max loan ($)', '', '1') + '</div></div>' +

      '<div class="card"><div class="card-title"><h3>FX rates</h3>' +
      '<span class="tiny muted">units per 1 USD</span></div>' +
      '<div class="grid cols-3" style="gap:12px">' + fxRows + '</div>' +
      '<p class="hint mt-1">Rates power exchange quotes, USD-equivalents and the landing ticker. Changes are audit-logged.</p></div>' +
      '</div></form>';

    return {
      html: html, title: 'Money rules',
      mount: function () {
        document.querySelectorAll('#term-chips [data-term]').forEach(function (chip) {
          chip.addEventListener('click', function () {
            chip.classList.toggle('active');
            syncTerms();
          });
        });
        function collect() {
          var f = document.getElementById('rules-form');
          var body = { fx: {} };
          f.querySelectorAll('input[name]').forEach(function (inp) {
            var k = inp.name;
            if (!k) return;
            if (inp.disabled) return;
            if (k.indexOf('fx_') === 0) { body.fx[k.slice(3)] = parseFloat(inp.value); return; }
            if (inp.dataset.flag !== undefined && inp.type === 'checkbox') { body[k] = inp.checked; return; }
            if (inp.type === 'number') { body[k] = inp.value === '' ? undefined : parseFloat(inp.value); return; }
            body[k] = inp.value;
          });
          Object.keys(body).forEach(function (k) { if (body[k] === undefined) delete body[k]; });
          return body;
        }
        function syncTerms() {
          var t = [];
          document.querySelectorAll('#term-chips .active').forEach(function (chip) {
            t.push(+chip.dataset.term);
          });
          document.getElementById('terms-hidden').value = t.join(',');
        }
        async function save() {
          try {
            var body = collect();
            body.loan_terms_months = document.getElementById('terms-hidden').value;
            var res = await ZB.api.put('/api/system/settings', body);
            if (res.changed.length) {
              U().toast(res.changed.length + ' rule' + (res.changed.length === 1 ? '' : 's') + ' updated & audited');
            } else U().toast('No changes to save', 'info');
            ZB.state.boot = null;
            ZB.render();
          } catch (e) { U().toast(e.message, 'err'); }
        }
        document.getElementById('rules-save').addEventListener('click', save);
        document.getElementById('rules-form').addEventListener('submit', function (e) {
          e.preventDefault(); save();
        });
      }
    };

    function numFieldStr(key, label, hint) {
      return '<div class="field"><label>' + label + '</label>' +
        '<input class="input" type="text" name="' + key + '" value="' + U().esc(st[key]) + '">' +
        (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
    }
  }

  /* =========================================================== SESSIONS */
  async function sessions() {
    var s = await ZB.api.get('/api/system/status');
    var html =
      pageHead('Sessions', 'Who is signed in across the whole bank.') +
      '<div class="split">' +
      '<div><div class="health-grid mb-2">' +
      '<div class="health-item"><div class="h-label"><span class="status-led"></span>Active sessions</div>' +
      '<div class="h-val" data-count="' + s.active_sessions + '">0</div></div></div>' +
      '<div class="card"><div class="card-title"><h3>Nuke options</h3></div>' +
      '<p class="small muted mb-2">Signs out every customer and staff member except you. Use for suspected credential leaks or after rotating secrets.</p>' +
      '<button class="btn danger block" id="revoke-all">' + U().icon('logout', 16) +
      ' Revoke every other session (' + Math.max(0, s.active_sessions - 1) + ')</button></div></div>' +
      '<div class="card"><div class="card-title"><h3>How sessions work here</h3></div>' +
      '<div class="set-row"><div><b>Bearer tokens</b><div class="desc">32-byte random hex, stored server-side with device + IP metadata.</div></div></div>' +
      '<div class="set-row"><div><b>Instant revocation</b><div class="desc">Killed sessions fail on the very next request — nothing lingers.</div></div></div>' +
      '<div class="set-row"><div><b>Self-service</b><div class="desc">Customers can revoke their own devices from Settings → Active sessions.</div></div></div>' +
      '<div class="set-row"><div><b>Freeze cascade</b><div class="desc">Suspending a customer automatically kills all their sessions.</div></div></div>' +
      '</div></div>';

    return {
      html: html, title: 'Sessions',
      mount: function () {
        document.getElementById('revoke-all').addEventListener('click', function () {
          U().confirmBox('Revoke all sessions?',
            'Everyone except you gets signed out immediately, including other admins.',
            'Revoke everything', true, async function () {
              try {
                var r = await ZB.api.post('/api/system/revoke-sessions');
                U().toast(r.killed + ' sessions revoked');
                ZB.render();
              } catch (e) { U().toast(e.message, 'err'); }
            });
        });
      }
    };
  }

  /* ============================================================ BACKUPS */
  async function backups() {
    var s = await ZB.api.get('/api/system/status');
    var html =
      pageHead('Backups & data', 'The whole bank lives in one JSON document — take it anywhere.') +
      '<div class="grid cols-2">' +

      '<div class="card"><div class="card-title"><h3>' + U().icon('cloudDown', 17) + ' Export snapshot</h3></div>' +
      '<p class="small muted mb-2">Downloads a complete, human-readable JSON backup of every user, account, transaction and setting (' + s.db_size_kb + ' KB).</p>' +
      '<button class="btn primary block" id="bk-export">' + U().icon('download', 15) + ' Download JSON backup</button>' +
      '<hr style="border-color:var(--line);margin:18px 0">' +
      '<div class="card-title" style="margin-bottom:10px"><h3 style="font-size:.95rem">' + U().icon('refresh', 16) + ' Compact file</h3></div>' +
      '<p class="small muted mb-2">Rewrites the datastore atomically and reports reclaimed space.</p>' +
      '<button class="btn ghost block" id="bk-vacuum">' + U().icon('zap', 15) + ' Compact now</button>' +
      '<div class="code-box mt-1 hidden" id="vac-out"></div></div>' +

      '<div class="danger-zone card" style="background:rgba(251,113,133,.05)">' +
      '<div class="card-title"><h3 class="down">' + U().icon('alert', 17) + ' Danger zone</h3></div>' +
      '<div class="field"><label>Restore from backup file</label>' +
      '<input type="file" id="imp-file" class="input" accept=".json,application/json" style="padding:9px">' +
      '<span class="hint">Replaces the ENTIRE database. Current data is overwritten permanently.</span></div>' +
      '<button class="btn block" id="bk-import" disabled>' + U().icon('upload', 15) + ' Restore database</button>' +
      '<hr style="border-color:rgba(251,113,133,.25);margin:18px 0">' +
      '<p class="small muted mb-2"><b class="down">Reset & reseed:</b> wipes everything and rebuilds the rich demo dataset (customers, history, queues). You stay signed in as admin afterwards.</p>' +
      '<button class="btn danger block" id="bk-reset">' + U().icon('rotate', 15) + ' Reset to demo data</button></div>' +

      '</div>';

    return {
      html: html, title: 'Backups & data',
      mount: function () {
        document.getElementById('bk-export').addEventListener('click', function () {
          ZB.api.download('/api/system/export', 'zentra-backup.json');
          U().toast('Snapshot downloading…', 'info');
        });
        document.getElementById('bk-vacuum').addEventListener('click', async function () {
          try {
            var r = await ZB.api.post('/api/system/vacuum');
            var out = document.getElementById('vac-out');
            out.classList.remove('hidden');
            out.textContent = 'compacted: ' + r.before_kb + ' KB → ' + r.after_kb + ' KB';
            U().toast('Datastore compacted');
          } catch (e) { U().toast(e.message, 'err'); }
        });
        var fileInput = document.getElementById('imp-file');
        var impBtn = document.getElementById('bk-import');
        var fileText = '';
        fileInput.addEventListener('change', function () {
          var f = fileInput.files && fileInput.files[0];
          impBtn.disabled = !f;
          if (!f) return;
          if (window.FileReader) {
            var reader = new FileReader();
            reader.onload = function () { fileText = String(reader.result || ''); };
            reader.readAsText(f);
          }
          U().toast(f.name + ' staged — click Restore to commit', 'info');
        });
        impBtn.addEventListener('click', function () {
          U().confirmBox('Overwrite the entire database?',
            'Every current user, account and transaction will be replaced by the uploaded backup. This cannot be undone.',
            'Yes, restore it', true, async function () {
              try {
                var r = await ZB.api.post('/api/system/import', { payload: fileText });
                U().toast('Restored: ' + r.users + ' users, ' + r.accounts + ' accounts');
                ZB.state.boot = null;
                location.hash = '#/system';
                ZB.render();
              } catch (e) { U().toast(e.message, 'err'); }
            });
        });
        document.getElementById('bk-reset').addEventListener('click', function () {
          U().confirmBox('Reset to fresh demo data?',
            'Everything is wiped and the demo dataset rebuilt. Your session survives as admin.',
            'Wipe & reseed', true, async function () {
              try {
                var r = await ZB.api.post('/api/system/reset');
                ZB.api.setToken(r.token);
                ZB.state.boot = null;
                U().toast('Bank reset to demo state ✨');
                location.hash = '#/admin';
                ZB.render();
              } catch (e) { U().toast(e.message, 'err'); }
            });
        });
      }
    };
  }

  /* ======================================================= SYSTEM AUDIT */
  async function auditPage(query) {
    // reuse the admin audit renderer under the console nav
    return ZB.views.admin.auditPage(query);
  }

  ZB.views.system = {
    health: health, rules: rules, sessions: sessions,
    backups: backups, auditPage: auditPage
  };
})(window.ZB);
