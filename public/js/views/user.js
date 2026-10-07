/* ============================================================
   Zentra — customer dashboard views
   ============================================================ */
window.ZB = window.ZB || {};
ZB.views = ZB.views || {};
ZB.forms = ZB.forms || {};

(function (ZB) {
  'use strict';
  var U = function () { return ZB.ui; };
  var ROUTING_NUMBER = '021000021';
  var cardReveal = {};   // cardId -> full number/CVV shown right after issue

  async function boot() { return ZB.api.get('/api/user/bootstrap'); }

  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? ZB.t("Good morning") : h < 18 ? ZB.t("Good afternoon") : ZB.t("Good evening");
  }

  function acctOptions(accts, selected) {
    return accts.map(function (a) {
      return '<option value="' + a.id + '" ' + (a.id === selected ? 'selected' : '') + '>' +
        U().esc(a.label + ' · ' + a.currency + ' · ' + U().money(a.balance, a.currency)) + '</option>';
    }).join('');
  }

  /* ------------------------------------------- professional TX receipts -- */
  var ALERTS_EMAIL = 'alerts@zentra.bank';

  function txResult(res) {
    // res = {state:'success'|'pending'|'declined', title, sub, amount, ref, rows:[[k,v]], mail}
    var map = {
      success:  { icon: 'check', cls: 'success',  def: ZB.t("Transaction successful") },
      pending:  { icon: 'clock', cls: 'pending',  def: ZB.t("Pending approval") },
      declined: { icon: 'x',     cls: 'declined', def: ZB.t("Transaction declined") }
    };
    var m = map[res.state] || map.success;
    var rowsHtml = (res.rows || []).map(function (r) {
      return '<div class="co-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }).join('');
    U().modal(
      '<div class="txr-head">' +
      '<div class="txr-icon ' + m.cls + '">' + U().icon(m.icon, 30) + '</div>' +
      '<h3 class="txr-title">' + U().esc(res.title || m.def) + '</h3>' +
      (res.sub ? '<div class="txr-sub">' + U().esc(res.sub) + '</div>' : '') +
      (res.amount ? '<div class="txr-amount">' + res.amount + '</div>' : '') +
      (res.ref ? '<div><span class="txr-ref-pill" data-copy="' + U().esc(res.ref) + '" style="cursor:pointer" title="' + ZB.t("Copy reference") + '">Ref&nbsp;<b>' +
        U().esc(res.ref) + '</b>&nbsp;' + U().icon('copy', 12) + '</span></div>' : '') +
      '</div>' +
      (rowsHtml ? '<div class="txr-rows">' + rowsHtml + '</div>' : '') +
      (res.state === 'pending'
        ? "<p class=\"small muted mt-2\" style=\"text-align:center\">" + ZB.t("Funds are on hold while our team reviews this transaction. You'll be notified the moment it's approved.") + "</p>"
        : '') +
      (res.state !== 'declined'
        ? '<div class="txr-mail">' + U().icon('mail', 16) +
          "<p>" + ZB.t("A confirmation was sent from") + " <b>" + ALERTS_EMAIL + '</b>' +
          (res.mail ? ' — ' + U().esc(res.mail) : '') +
          ZB.t(". Find it anytime in your") + " <b>" + ZB.t("Notifications") + "</b> " + ZB.t("tray.") + "</p></div>"
        : '') +
      '<div class="row mt-2" style="gap:10px">' +
      '<button class="btn outline block" id="txr-view">' + U().icon('file', 14) + " " + ZB.t("View statements") + "</button>" +
      "<button class=\"btn block\" data-x-close>" + ZB.t("Done") + "</button></div>");
    document.getElementById('txr-view').onclick = function () {
      U().closeModal();
      ZB.navigate('#/app/statements');
    };
  }

  function confirmTx(cfg) {
    // cfg = {title, sub, summaryRows:[[k,v]], needsPin, confirmLabel, run(pin)->Promise<result>}
    var rowsHtml = (cfg.summaryRows || []).map(function (r) {
      return '<div class="co-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }).join('');
    var pinBlock = cfg.needsPin ?
      '<div class="pin-wrap" style="margin-top:16px">' +
      "<label class=\"small\" style=\"font-weight:700;color:var(--text)\">" + ZB.t("Enter your 4-digit PIN to authorize") + "</label>" +
      '<input class="input pin-input" name="pin" required maxlength="4" inputmode="numeric" autocomplete="off" placeholder="••••">' +
      "<span class=\"pin-hint-line\">" + ZB.t("Like your card PIN at an ATM — never share it.") + "</span></div>" : '';
    U().modal(
      '<div class="modal-head"><h3>' + U().esc(cfg.title || ZB.t("Confirm transaction")) + '</h3>' +
      '<button class="icon-btn" data-x-close>' + U().icon('x', 16) + '</button></div>' +
      (cfg.sub ? '<p class="small muted mb-2">' + cfg.sub + '</p>' : '') +
      '<form data-form="u-tx-confirm">' +
      '<div class="calc-out" style="margin-bottom:14px">' + rowsHtml + '</div>' +
      pinBlock +
      '<div class="err-line hidden" id="txc-err"></div>' +
      '<button class="btn block lg" type="submit">' +
      U().icon(cfg.needsPin ? 'lock' : 'check', 15) + ' ' + U().esc(cfg.confirmLabel || 'Confirm') +
      '</button></form>');
    ZB.forms['u-tx-confirm'] = async function (data) {
      var errEl = document.getElementById('txc-err');
      function showErr(msg, isPin) {
        if (!errEl) return;
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
        if (isPin) {
          var p = document.querySelector('#modal-ov .pin-input');
          if (p) {
            p.classList.add('err');
            setTimeout(function () { p.classList.remove('err'); }, 500);
            p.select();
          }
        }
      }
      try {
        var res = await cfg.run(cfg.needsPin ? data.pin : undefined);
        U().closeModal();
        txResult(res);
        ZB.render();   // refresh balances behind the modal
      } catch (e) {
        if (e.status === 423) {           // account frozen → looks normal until PIN,
          U().closeModal();               // then the receipt itself says DECLINED
          txResult({
            state: 'declined', title: cfg.declineTitle || ZB.t("Transaction declined"),
            sub: ZB.t("We couldn't complete this request"),
            amount: cfg.amountLabel || '',
            rows: [
              ['Date', U().dateTime(Date.now())],
              ['Status', "<span class=\"pill red\">" + ZB.t("Declined") + "</span>"],
              [ZB.t("Next step"), ZB.t("Our team will contact you if action is needed")]
            ]
          });
          ZB.render();
          return;
        }
        showErr(e.message || ZB.t("Transaction failed."), /PIN/i.test(e.message || ''));
      }
    };
  }

  /* =========================================================== OVERVIEW */
  async function overview() {
    var b = await boot();
    var ov = await ZB.api.get('/api/user/overview');
    var t = ov.totals;
    var first = (b.user.name || '').split(' ')[0];

    var acctTiles = b.accounts.map(function (a) {
      var cls = a.kind === 'savings' ? 'savings' : (a.currency !== 'USD' ? 'fx' : '');
      return '<button class="acct-tile ' + cls +
        '" onclick="location.hash=\'#/app/accounts\'">' +
        '<div class="at-cur">' + U().esc(a.label) + '</div>' +
        '<div class="at-bal">' + U().money(a.balance, a.currency) + '</div>' +
        '<div class="at-num">' + U().esc(a.number) + '</div>' +
        '<div class="at-foot"><span class="tiny muted">' + a.currency +
        (a.kind === 'savings' ? ' · ' + b.apy + ZB.t("% APY") : '') + '</span>' +
        U().icon('chevronRight', 14) + '</div></button>';
    }).join('');

    var catSegs = ov.spend_by_category.map(function (c, i) {
      return { label: c.name, value: c.value, color: ZB.ui.DONUT_COLORS[i % ZB.ui.DONUT_COLORS.length] };
    });

    var quick = [
      { act: 'add', icon: 'plus', t: ZB.t("Add money"), s: ZB.t("Request a top-up") },
      { go: '#/app/transfer', icon: 'send', t: ZB.t('Send'), s: ZB.t("Free inside Zentra") },
      { go: '#/app/cards', icon: 'card', t: ZB.t("Cards"), s: ZB.t("{n} active", { n: ov.counts.cards || 0 }) },
      { go: '#/app/pay', icon: 'receipt', t: ZB.t("Pay a bill"), s: ZB.t("Utilities & more") }
    ].map(function (q) {
      var attrs = q.act === 'add' ? 'id="qa-add"' : 'data-go="' + q.go + '"';
      return '<button class="tile" ' + attrs + '>' +
        '<span class="t-icon">' + U().icon(q.icon, 19) + '</span><b>' + q.t + '</b><span>' + q.s + '</span></button>';
    }).join('');

    var html =
      '<div class="page-head"><div><h2>' + greeting() + ', ' + U().esc(first) + ' 👋</h2>' +
      "<div class=\"sub\">" + ZB.t("Here's how your money is doing today.") + "</div></div>" +
      '<div class="head-actions"><button class="btn sm ghost" id="ov-refresh">' + U().icon('refresh', 15) + " " + ZB.t("Refresh") + "</button>" +
      '<a class="btn primary sm" href="#/app/transfer">' + U().icon('send', 15) + " " + ZB.t("Send money") + "</a></div></div>" +

      (b.maintenance ? '<div class="banner">' + U().icon('alert', 16) + " " + ZB.t("Maintenance mode — transfers are temporarily paused.") + "</div>" : '') +

      '<div class="grid cols-4 mb-2">' +
      kpi('wallet', ZB.t("Total balance"), U().money(t.balance_usd, 'USD'), ZB.t(b.accounts.length === 1 ? "across {n} account" : "across {n} accounts", { n: b.accounts.length }), true) +
      kpi('trendUp', ZB.t("Income this month"), U().money(t.income_month, 'USD'), ZB.t("credits received"), false, 'up') +
      kpi('trendDown', ZB.t("Spending this month"), U().money(t.spend_month, 'USD'), ZB.t("payments & transfers")) +
      kpi('percent', ZB.t('Savings'), U().money(t.savings, 'USD'), ZB.t("earning {apy}% APY daily", { apy: b.apy })) +
      '</div>' +

      '<div class="acct-strip mb-2">' + acctTiles + '</div>' +

      '<div class="grid mb-2" style="grid-template-columns:1fr 340px">' +
      "<div class=\"card\"><div class=\"card-title\"><h3>" + ZB.t("Balance · last 30 days") + "</h3>" +
      "<span class=\"pill green plain\">" + ZB.t("All currencies combined") + "</span></div>" +
      U().areaChart(ov.history.length ? ov.history : [0, 0], { h: 210 }) + '</div>' +
      "<div class=\"card\"><div class=\"card-title\"><h3>" + ZB.t("Where money went") + "</h3></div>" +
      U().donut(catSegs, U().compact(t.spend_month), ZB.t("this month")) +
      '<div class="mt-2">' + catSegs.map(function (s, i) {
        return '<div class="spread small" style="padding:5px 0">' +
          '<span class="row" style="gap:8px"><span style="width:9px;height:9px;border-radius:3px;background:' + s.color + '"></span>' + U().esc(s.label) + '</span>' +
          '<b>' + U().compact(s.value) + '</b></div>';
      }).join('') + (catSegs.length ? '' : "<p class=\"muted small\">" + ZB.t("No spending yet this month — nice.") + "</p>") + '</div></div>' +
      '</div>' +

      '<div class="split">' +
      "<div class=\"card\"><div class=\"card-title\"><h3>" + ZB.t("Recent activity") + "</h3>" +
      "<a class=\"btn sm ghost\" href=\"#/app/statements\">" + ZB.t("View all") + "</a></div>" +
      (ov.recent.length ? ov.recent.map(function (tx) { return U().txRow(tx); }).join('') :
        '<div class="empty">' + U().icon('layers', 30) + "<b>" + ZB.t("No transactions yet") + "</b><span class=\"tiny\">" + ZB.t("Add money to get started.") + "</span></div>") +
      '</div>' +
      "<div><div class=\"card mb-2\"><div class=\"card-title\"><h3>" + ZB.t("Quick actions") + "</h3></div>" +
      '<div class="grid cols-2" style="gap:10px">' + quick + '</div></div>' +
      (ov.counts.active_loans ?
        '<div class="card hover" onclick="location.hash=\'#/app/loans\'" style="cursor:pointer">' +
        "<div class=\"spread\"><b>" + ZB.t("You have an active loan") + "</b>" + U().icon('chevronRight', 15) + '</div>' +
        "<p class=\"small muted mt-1\">" + ZB.t("Track progress or make an extra repayment any time.") + "</p></div>" : '') +
      '</div></div>';

    return {
      html: html, title: ZB.t("Overview"),
      mount: function () {
        var r = document.getElementById('ov-refresh');
        if (r) r.onclick = function () { ZB.render(); };
        var am = document.getElementById('qa-add');
        if (am) am.onclick = function () { depositModal(b.accounts); };
        document.querySelectorAll('[data-go]').forEach(function (el) {
          el.addEventListener('click', function () { ZB.navigate(el.getAttribute('data-go')); });
        });
      }
    };
  }

  function kpi(iconName, label, value, sub, big, tone) {
    return '<div class="card kpi"><div class="kpi-label">' + U().icon(iconName, 15) + label + '</div>' +
      '<div class="kpi-value ' + (tone === 'up' ? 'up' : '') + '">' + value + '</div>' +
      '<div class="kpi-sub">' + sub + '</div></div>';
  }

  /* ------------------------------------------------------ add money --- */
  function depositModal(accts, presetAcct) {
    U().modal(
      "<div class=\"modal-head\"><h3>" + ZB.t("Add money") + "</h3><button class=\"icon-btn\" data-x-close>" + U().icon('x', 16) + '</button></div>' +
      "<p class=\"small muted mb-2\">" + ZB.t("Top-up requests are reviewed by our team before the funds land in your account — usually within minutes during business hours.") + "</p>" +
      '<form data-form="u-deposit">' +
      "<div class=\"field\"><label>" + ZB.t("To account") + "</label><select class=\"input\" name=\"account_id\">" +
      acctOptions(accts, presetAcct) + '</select></div>' +
      "<div class=\"field\"><label>" + ZB.t("Funding source") + "</label><select class=\"input\" name=\"method\">" +
      "<option value=\"bank\">" + ZB.t("Linked bank transfer") + "</option>" +
      "<option value=\"card\">" + ZB.t("Debit card") + "</option><option value=\"mobile\">" + ZB.t("Mobile money") + "</option></select></div>" +
      "<div class=\"field\"><label>" + ZB.t("Amount") + "</label><div class=\"amt-wrap\"><span class=\"amt-suffix\"><select id=\"dep-cur\" class=\"input\" style=\"padding:6px 26px 6px 10px;width:auto;border-radius:9px\"></select></span>" +
      '<input class="input" type="number" step="0.01" min="1" name="amount" required placeholder="100.00"></div></div>' +
      '<button class="btn primary block lg" type="submit">' + U().icon('clock', 16) + " " + ZB.t("Request top-up") + "</button>" +
      '</form>');
    // reflect chosen account's currency symbol next to amount
    var sel = document.querySelector('form[data-form=u-deposit] [name=account_id]');
    var wrap = function () {
      var a = accts.filter(function (x) { return x.id === +sel.value; })[0];
      var sym = U().curSymbol(a ? a.currency : 'USD');
      var prefixEl = document.querySelector('#dep-cur');
      if (prefixEl) { prefixEl.innerHTML = '<option>' + sym + '</option>'; }
    };
    sel.addEventListener('change', wrap); wrap();

    ZB.forms['u-deposit'] = async function (data) {
      try {
        var r = await ZB.api.post('/api/user/deposits', data);
        U().closeModal();
        var a = accts.filter(function (x) { return x.id === +data.account_id; })[0];
        txResult({
          state: 'pending', title: ZB.t("Pending approval"),
          amount: U().money(data.amount, a ? a.currency : 'USD'),
          sub: ZB.t("To ") + (a ? a.label : ZB.t("your account")),
          ref: r.transaction.ref,
          rows: [
            ['Date', U().dateTime(Date.now())],
            [ZB.t('Method'), U().esc((data.method || 'bank').replace(/_/g, ' '))],
            ['Status', "<span class=\"pill amber\">" + ZB.t("Under review") + "</span>"]
          ],
          mail: ZB.t("we'll notify you the moment the funds land.")
        });
        ZB.render();
      } catch (e) {
        if (e.status === 423) {
          txResult({
            state: 'declined', title: ZB.t("Transaction declined"),
            sub: ZB.t("Your account is currently restricted"),
            rows: [
              ['Date', U().dateTime(Date.now())],
              [ZB.t('Reason'), ZB.t("Account under review by Zentra")],
              [ZB.t("Next step"), ZB.t("Check Notifications — our team has emailed you what to do")]
            ]
          });
          ZB.render();
          return;
        }
        U().toast(e.message, 'err');
      }
    };
  }

  /* ========================================================== ACCOUNTS */
  var selectedAccount = null;
  async function accounts() {
    var r = await ZB.api.get('/api/user/accounts');
    var accts = r.accounts;
    var pend = (await ZB.api.get('/api/user/wallet-requests?status=pending')).requests;
    if (!selectedAccount || !accts.some(function (a) { return a.id === selectedAccount; })) {
      selectedAccount = accts.length ? accts[0].id : null;
    }
    var cur = accts.filter(function (a) { return a.id === selectedAccount; })[0];

    var txs = [];
    if (selectedAccount) {
      var tr = await ZB.api.get('/api/user/transactions?account_id=' + selectedAccount + '&per=25');
      txs = tr.transactions;
    }

    var html =
      "<div class=\"page-head\"><div><h2>" + ZB.t("Your accounts") + "</h2>" +
      "<div class=\"sub\">" + ZB.t("Multi-currency wallets with local account numbers.") + "</div></div>" +
      '<div class="head-actions"><button class="btn primary sm" id="open-acct-btn">' + U().icon('plus', 15) + " " + ZB.t("Open new account") + "</button></div></div>" +

      pend.map(function (w) {
        return '<div class="banner mb-1">' + U().icon('clock', 15) + ' ' +
          ZB.t("Your {cur} wallet request is awaiting approval.", { cur: U().esc(w.currency) }) +
          '</div>';
      }).join('') +

      '<div class="acct-strip mb-2">' + accts.map(function (a) {
        var cls = a.kind === 'savings' ? 'savings' : (a.currency !== 'USD' ? 'fx' : '');
        return '<button class="acct-tile ' + cls +
          '" data-acct="' + a.id + '">' +
          '<div class="at-cur">' + U().esc(a.label) + '</div>' +
          '<div class="at-bal">' + U().money(a.balance, a.currency) + '</div>' +
          '<div class="row mt-1" style="justify-content:space-between;width:100%">' +
          '<span class="mono tiny muted">' + U().esc(a.number) + '</span>' +
          '<span class="tiny muted">' + (a.card_count === 1 ? ZB.t("1 card") : ZB.t("{n} cards", { n: a.card_count })) + '</span></div></button>';
      }).join('') + '</div>' +

      (cur ? '<div class="split">' +
        '<div class="card"><div class="card-title"><h3>' + U().esc(cur.label) + " " + ZB.t("· activity") + "</h3>" +
        '<div class="row"><button class="btn sm ghost" id="dl-stmt">' + U().icon('download', 14) + " " + ZB.t("CSV") + "</button></div></div>" +
        "<div class=\"kv mb-2\"><dt>" + ZB.t("Account number") + "</dt><dd class=\"mono\">" + U().esc(cur.number) +
        ' <button class="icon-btn" style="width:26px;height:26px" data-copy="' + U().esc(cur.number.replace(/\s/g, '')) + '">' + U().icon('copy', 12) + '</button></dd>' +
        "<dt>" + ZB.t("Routing (ABA)") + "</dt><dd class=\"mono\">" + ROUTING_NUMBER +
        ' <button class="icon-btn" style="width:26px;height:26px" data-copy="' + ROUTING_NUMBER + '">' + U().icon('copy', 12) + '</button></dd>' +
        "<dt>" + ZB.t("Currency") + "</dt><dd>" + cur.currency + (cur.kind === 'savings' ? ZB.t(" · savings") : '') + '</dd>' +
        "<dt>" + ZB.t("Status") + "</dt><dd><span class=\"pill green\">" + ZB.t("Active") + "</span></dd>" +
        "<dt>" + ZB.t("Opened") + "</dt><dd>" + U().dateShort(cur.created_at) + '</dd></div>' +
        '<div class="table-wrap"><table class="table" style="min-width:0"><tbody>' +
        (txs.length ? txs.slice(0, 12).map(function (t) {
          return '<tr><td style="width:44px"><div class="tx-icon ' + (t.amount > 0 ? 'in' : 'out') + '" style="width:34px;height:34px">' +
            U().icon(t.amount > 0 ? 'download' : 'upload', 15) + '</div></td>' +
            '<td><b class="small">' + U().esc(t.counterparty || t.type.replace(/_/g, ' ')) + '</b>' +
            '<div class="tiny faint">' + U().dateTime(t.created_at) + '</div></td>' +
            '<td class="num"><b class="' + (t.amount > 0 ? 'up' : '') + ' small">' + U().signedMoney(t.amount, t.currency) + '</b></td></tr>';
        }).join('') : "<tr><td class=\"muted small\" style=\"text-align:center;padding:30px\">" + ZB.t("No activity yet.") + "</td></tr>") +
        '</tbody></table></div></div>' +
        "<div><div class=\"card mb-2\"><div class=\"card-title\"><h3>" + ZB.t("Move money") + "</h3></div>" +
        '<button class="btn primary block mt-1" onclick="location.hash=\'#/app/transfer\'">' + U().icon('send', 15) + " " + ZB.t("Send from this account") + "</button>" +
        '<button class="btn block mt-1 ghost" onclick="location.hash=\'#/app/statements\'">' + U().icon('file', 15) + " " + ZB.t("Full statements") + "</button>" +
        '</div></div></div>'
        : '<div class="empty">' + U().icon('wallet', 34) + "<b>" + ZB.t("No accounts yet") + "</b>" + ZB.t("Open your first one above.") + "</div>");

    return {
      html: html, title: ZB.t("Accounts"),
      mount: function () {
        document.querySelectorAll('[data-acct]').forEach(function (el) {
          el.addEventListener('click', function () {
            selectedAccount = +el.dataset.acct;
            ZB.render();
          });
        });
        var ob = document.getElementById('open-acct-btn');
        if (ob) ob.onclick = function () { openAccountModal(); };
        var dl = document.getElementById('dl-stmt');
        if (dl && cur) dl.onclick = function () {
          var num = cur.number.replace(/\s/g, '');
          ZB.api.download('/api/user/statement.csv?account_id=' + cur.id,
            'zentra-' + num + '-all.csv');
          U().toast(ZB.t("Statement downloading…"), 'info');
        };
      }
    };
  }

  function openAccountModal() {
    U().modal(
      "<div class=\"modal-head\"><h3>" + ZB.t("Open a new account") + "</h3><button class=\"icon-btn\" data-x-close>" + U().icon('x', 16) + '</button></div>' +
      '<form data-form="u-open-acct">' +
      "<div class=\"field\"><label>" + ZB.t("Type") + "</label><div class=\"seg\" id=\"oa-kind\">" +
      "<button type=\"button\" data-k=\"checking\" class=\"active\">" + ZB.t("Checking") + "</button>" +
      "<button type=\"button\" data-k=\"savings\">" + ZB.t("Savings · earns APY daily") + "</button></div></div>" +
      "<div class=\"field\"><label>" + ZB.t("Currency") + "</label><select class=\"input\" name=\"currency\">" +
      U().currencyList((ZB.state.boot || {}).currencies).map(function (c) {
        return '<option value="' + c.code + '">' + c.code + ' — ' + c.name + '</option>';
      }).join('') + '</select></div>' +
      "<div class=\"field\"><label>" + ZB.t("Nickname (optional)") + "</label><input class=\"input\" name=\"label\" placeholder=\"e.g. Trip to Tokyo\"></div>" +
      '<button class="btn primary block lg" type="submit">' + U().icon('plus', 16) + " " + ZB.t("Open account") + "</button>" +
      "<p class=\"hint mt-1\">" + ZB.t("Up to 6 accounts. Free, instant, no minimums.") + "</p></form>");
    var kind = 'checking';
    document.querySelectorAll('#oa-kind button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#oa-kind button').forEach(function (x) { x.classList.remove('active'); });
        btn.classList.add('active');
        kind = btn.dataset.k;
      });
    });
    ZB.forms['u-open-acct'] = async function (data) {
      try {
        var res = await ZB.api.post('/api/user/accounts', Object.assign({}, data, { kind: kind }));
        U().closeModal();
        U().toast(res && res.pending
          ? ZB.t("Request sent — our team will review it")
          : ZB.t("Account opened 🎉"));
        ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    };
  }

  /* ========================================================== TRANSFER */
  async function transfer() {
    var b = await boot();
    var bens = await ZB.api.get('/api/user/beneficiaries');
    var accts = b.accounts;
    var benList = bens.beneficiaries;

    var html =
      "<div class=\"page-head\"><div><h2>" + ZB.t("Send & exchange") + "</h2>" +
      "<div class=\"sub\">" + ZB.t("Internal transfers are free and instant. External payouts above $2,000 get a quick compliance check.") + "</div></div></div>" +
      (!b.flags.transfers_internal_enabled ? '<div class="banner">' + U().icon('alert', 15) + " " + ZB.t("Transfers are temporarily disabled by the bank.") + "</div>" : '') +
      "<div class=\"tabs\"><button class=\"tab active\" data-tt=\"send\">" + ZB.t("Send money") + "</button>" +
      (b.flags.exchange_enabled ? "<button class=\"tab\" data-tt=\"ex\">" + ZB.t("Exchange") + "</button>" : '') +
      "<button class=\"tab\" data-tt=\"ben\">" + ZB.t("Beneficiaries") + " <span class=\"count\">" + benList.length + '</span></button></div>' +
      '<div id="tf-body"></div>';

    return {
      html: html, title: ZB.t("Send & Exchange"),
      mount: function () {
        var body = document.getElementById('tf-body');
        function show(tab) {
          document.querySelectorAll('.tab[data-tt]').forEach(function (t) {
            t.classList.toggle('active', t.dataset.tt === tab);
          });
          if (tab === 'send') body.innerHTML = sendPane(b, accts, benList);
          else if (tab === 'ex') body.innerHTML = exchangePane(b, accts);
          else body.innerHTML = benPane(benList);
          bindPane(tab);
        }
        document.querySelectorAll('.tab[data-tt]').forEach(function (t) {
          t.addEventListener('click', function () { show(t.dataset.tt); });
        });
        function bindPane(tab) {
          if (tab === 'send') bindSend(body, b, accts, benList);
          else if (tab === 'ex') bindExchange(body, b, accts);
          else bindBen(body);
        }
        show('send');
      }
    };
  }

  function modeFields(mode, b, accts, benList) {
    if (mode === 'own') {
      return "<div class=\"field\"><label>" + ZB.t("From") + "</label><select class=\"input\" name=\"from_account_id\">" +
        acctOptions(accts) + '</select></div>' +
        "<div class=\"field\"><label>" + ZB.t("To (your account)") + "</label><select class=\"input\" name=\"to_account_id\">" +
        acctOptions(accts.slice().reverse()) + '</select></div>';
    }
    if (mode === 'zentra') {
      return "<div class=\"field\"><label>" + ZB.t("From") + "</label><select class=\"input\" name=\"from_account_id\">" +
        acctOptions(accts) + '</select></div>' +
        "<div class=\"field\"><label>" + ZB.t("Recipient email") + "</label><input class=\"input\" type=\"email\" name=\"to_email\" required placeholder=\"they@example.com\"></div>" +
        '<div class="grid cols-2" style="gap:12px">' +
        "<div class=\"field\"><label>" + ZB.t("Recipient account number") + "</label>" +
        '<input class="input" name="to_account_number" required placeholder="e.g. 1047 8145 4989" inputmode="numeric"></div>' +
        "<div class=\"field\"><label>" + ZB.t("Bank name") + "</label><input class=\"input\" name=\"to_bank_name\" value=\"Zentra Bank\" required></div></div>";
    }
    return "<div class=\"field\"><label>" + ZB.t("From") + "</label><select class=\"input\" name=\"from_account_id\">" +
      acctOptions(accts) + '</select></div>' +
      "<div class=\"field\"><label>" + ZB.t("Saved beneficiary (optional)") + "</label><select class=\"input\" name=\"beneficiary_id\" id=\"ext-ben\">" +
      "<option value=\"\">" + ZB.t("— New beneficiary —") + "</option>" +
      (benList || []).map(function (bn) {
        return '<option value="' + bn.id + '">' + U().esc(bn.name + ' · ' + bn.bank) + '</option>';
      }).join('') + '</select></div>' +
      '<div id="ext-new">' +
      "<div class=\"grid cols-2\" style=\"gap:12px\"><div class=\"field\"><label>" + ZB.t("Name") + "</label>" +
      '<input class="input" name="beneficiary_name" placeholder="Full name"></div>' +
      "<div class=\"field\"><label>" + ZB.t("Bank") + "</label><input class=\"input\" name=\"beneficiary_bank\" placeholder=\"Chase, HSBC…\"></div></div>" +
      "<div class=\"field\"><label>" + ZB.t("Account number / IBAN") + "</label><input class=\"input\" name=\"beneficiary_number\" placeholder=\"GB29 NWBK…\"></div></div>";
  }

  function sendPane(b, accts, benList) {
    return '<div class="split rev"><div class="card pad-lg">' +
      '<div class="seg mb-2" id="send-mode">' +
      "<button data-m=\"zentra\" class=\"active\">" + ZB.t("To someone") + "</button>" +
      "<button data-m=\"own\">" + ZB.t("Between mine") + "</button>" +
      '<button data-m="external" ' + (b.flags.transfers_external_enabled ? '' : 'disabled') + '>' + ZB.t("External bank") + '</button></div>' +
      '<form data-form="u-transfer" id="transfer-form">' +
      '<div id="tf-fields">' + modeFields('zentra', b, accts, benList) + '</div>' +
      "<div class=\"field\"><label>" + ZB.t("Amount") + "</label><div class=\"amt-wrap\">" +
      '<input class="input" type="number" step="0.01" min="0.01" name="amount" required placeholder="0.00" style="padding-left:15px">' +
      '</div><span class="hint" id="tf-limit-hint"></span></div>' +
      "<div class=\"field\"><label>" + ZB.t("Note (optional)") + "</label><input class=\"input\" name=\"note\" maxlength=\"120\" placeholder=\"Dinner, rent, invoice #…\"></div>" +
      '<div class="err-line hidden" id="tf-errors" style="margin-bottom:12px"></div>' +
      '<button class="btn primary block lg" type="submit" id="tf-submit">' + U().icon('send', 16) + " " + ZB.t("Review & send") + "</button>" +
      '</form></div>' +
      "<div class=\"card\" id=\"tf-summary\"><h3 class=\"mb-1\">" + ZB.t("Summary") + "</h3>" +
      "<p class=\"small muted\">" + ZB.t("Fill the form — fees, limits and the recipient appear here live.") + "</p>" +
      '<div class="kv mt-2" id="sum-body"></div></div></div>';
  }

  function bindSend(root, b, accts, benList) {
    var mode = 'zentra';
    var fields = root.querySelector('#tf-fields');
    var form = root.querySelector('#transfer-form');
    var sumBody = root.querySelector('#sum-body');

    function renderMode(m) {
      mode = m;
      fields.innerHTML = modeFields(m, b, accts, benList);
      var benSel = fields.querySelector('#ext-ben');
      if (benSel) benSel.addEventListener('change', function () {
        root.querySelector('#ext-new').style.display = benSel.value ? 'none' : '';
      });
      updateSummary();
    }
    function fmtLimitHint(fromSel) {
      var a = accts.filter(function (x) { return x.id === +fromSel.value; })[0];
      if (a) root.querySelector('#tf-limit-hint').textContent =
        ZB.t("Single limit $") + Number(b.limits.max_single || 25000).toLocaleString() +
        ZB.t(" · Daily limit $") + Number(b.limits.daily || 50000).toLocaleString() + ' (USD-equiv)';
    }

    function updateSummary() {
      var fd = new FormData(form);
      var amt = parseFloat(fd.get('amount')) || 0;
      var from = accts.filter(function (x) { return x.id === +(fd.get('from_account_id')); })[0];
      var rows = [];
      if (from) rows.push([ZB.t('From'), U().esc(from.label + ' (' + from.currency + ')')]);
      if (mode === 'own') {
        var to = accts.filter(function (x) { return x.id === +(fd.get('to_account_id')); })[0];
        if (to) rows.push([ZB.t('To'), U().esc(to.label)]);
      } else if (mode === 'zentra') {
        var toNum = String(fd.get('to_account_number') || '').replace(/\s/g, '');
        rows.push([ZB.t('Recipient'), U().esc(fd.get('to_email') || '—')]);
        if (toNum) rows.push([ZB.t("Account No."), '<span class="mono">' + U().esc(toNum) + '</span>']);
        rows.push([ZB.t('Bank'), U().esc(fd.get('to_bank_name') || ZB.t("Zentra Bank"))]);
        rows.push([ZB.t('Fee'), b.flags.transfers_internal_enabled ? ZB.t('Free') : 'n/a']);
      } else {
        var benId = fd.get('beneficiary_id');
        var bn = (benList || []).filter(function (x) { return String(x.id) === String(benId); })[0];
        rows.push([ZB.t('Beneficiary'), U().esc(bn ? bn.name + ' · ' + bn.bank : (fd.get('beneficiary_name') || '—'))]);
        var fee = Math.max(amt * (b.fees.external_fee_pct || 1) / 100, b.fees.external_fee_min || 1);
        rows.push([ZB.t('Fee'), U().money(fee, from ? from.currency : 'USD')]);
        rows.push([ZB.t("Total debit"), U().money(amt + fee, from ? from.currency : 'USD')]);
        if (amt > (b.fees.external_auto_limit || 2000)) rows.push([ZB.t('Review'), ZB.t("⚠ Needs bank approval")]);
      }
      sumBody.innerHTML = rows.map(function (r) {
        return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>';
      }).join('');
    }

    root.querySelectorAll('#send-mode button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        root.querySelectorAll('#send-mode button').forEach(function (x) { x.classList.remove('active'); });
        btn.classList.add('active');
        renderMode(btn.dataset.m);
      });
    });
    form.addEventListener('input', U().debounce(updateSummary, 150));
    form.addEventListener('change', updateSummary);   // selects on every browser

    /* ---- bank-grade field validation: nothing proceeds until it's clean ---- */
    function tfValidate(data) {
      var errs = [];
      function bad(name, msg) {
        errs.push(msg);
        var el = form.querySelector('[name=' + name + ']');
        if (el) {
          el.classList.add('invalid');
          el.addEventListener('input', function h() {
            el.classList.remove('invalid'); el.removeEventListener('input', h);
          }, { once: true });
        }
      }
      var amt = parseFloat(data.amount);
      if (!data.amount) bad('amount', ZB.t("Enter an amount."));
      else if (isNaN(amt)) bad('amount', ZB.t("Amount must be a number."));
      else if (amt <= 0) bad('amount', ZB.t("Amount must be greater than zero."));
      else if (Math.round(amt * 100) / 100 !== amt) bad('amount', ZB.t("Max two decimal places."));
      if (!data.from_account_id) bad('from_account_id', ZB.t("Choose the account to send from."));
      if (mode === 'own') {
        if (!data.to_account_id) bad('to_account_id', ZB.t("Choose the account to send to."));
        else if (data.to_account_id === data.from_account_id)
          bad('to_account_id', ZB.t("Pick a different account — both sides are the same."));
      }
      if (mode === 'zentra') {
        var em = String(data.to_email || '').trim();
        if (!em) bad('to_email', ZB.t("Enter the recipient's email."));
        else if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(em))
          bad('to_email', ZB.t("That email address doesn't look valid."));
        var num = String(data.to_account_number || '').replace(/\s/g, '');
        if (!num) bad('to_account_number', ZB.t("Enter the recipient's account number."));
        else if (!/^\d{9,16}$/.test(num))
          bad('to_account_number', ZB.t("Account numbers are 9–16 digits, numbers only."));
        if (!String(data.to_bank_name || '').trim())
          bad('to_bank_name', ZB.t("Enter the recipient bank name."));
      }
      if (mode === 'external') {
        var nm = String(data.beneficiary_name || '').trim();
        if (!nm) bad('beneficiary_name', ZB.t("Enter the beneficiary's full name."));
        else if (nm.length < 3 || !/[a-zA-Z]/.test(nm))
          bad('beneficiary_name', ZB.t("Name looks incomplete."));
        if (!String(data.beneficiary_bank || '').trim())
          bad('beneficiary_bank', ZB.t("Enter the beneficiary bank."));
        var acct = String(data.beneficiary_number || '').replace(/\s/g, '');
        if (!acct) bad('beneficiary_number', ZB.t("Enter the account number or IBAN."));
        else if (!/^[A-Za-z0-9]{6,34}$/.test(acct))
          bad('beneficiary_number', ZB.t("Use 6–34 letters/digits — no symbols."));
      }
      return errs;
    }

    ZB.forms['u-transfer'] = async function (data) {
      var problems = tfValidate(data);
      if (problems.length) {
        var box = form.querySelector('#tf-errors');
        if (box) {
          box.innerHTML = "<b>" + ZB.t("Please fix the highlighted fields:") + "</b><ul>" +
            problems.map(function (m) { return '<li>' + U().esc(m) + '</li>'; }).join('') + '</ul>';
          box.classList.remove('hidden');
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          U().toast(problems[0], 'err');
        }
        return;
      }
      var amt = parseFloat(data.amount) || 0;
      var from = accts.filter(function (x) { return x.id === +data.from_account_id; })[0];
      var cur = from.currency;
      var recipient, feeText = ZB.t('Free');
      if (mode === 'own') {
        var to = accts.filter(function (x) { return x.id === +data.to_account_id; })[0];
        recipient = to ? to.label : '—';
      } else if (mode === 'zentra') {
        recipient = data.to_email || '—';
        if (data.to_account_number) {
          recipient += '<br><span class="tiny muted mono">' +
            U().esc(String(data.to_account_number).replace(/\s/g, '')) + ' · ' +
            U().esc(data.to_bank_name || ZB.t("Zentra Bank")) + '</span>';
        }
        var f1 = amt * b.fees.transfer_fee_pct / 100;
        feeText = f1 > 0 ? U().money(f1, cur) : ZB.t('Free');
      } else {
        recipient = data.beneficiary_name || ZB.t("Saved beneficiary");
        var f2 = Math.max(amt * b.fees.external_fee_pct / 100, b.fees.external_fee_min);
        feeText = U().money(f2, cur);
      }
      confirmTx({
        title: ZB.t("Authorize transfer"),
        sub: ZB.t("Review the details. Transfers are final once confirmed."),
        needsPin: true,
        declineTitle: ZB.t("Transfer declined"),
        amountLabel: U().money(amt, cur),
        confirmLabel: ZB.t("Confirm & send ") + U().money(amt, cur),
        summaryRows: [
          ['Amount', '<span style="font-size:16px">' + U().money(amt, cur) + '</span>'],
          ['To', U().esc(recipient)],
          [ZB.t('From'), U().esc(from.label + ' · ··' + String(from.number).replace(/\s/g, '').slice(-4))],
          [ZB.t('Fee'), feeText],
          [ZB.t('Note'), U().esc(data.note || '—')]
        ],
        run: async function (pin) {
          var r = await ZB.api.post('/api/user/transfers',
            Object.assign({}, data, { mode: mode, pin: pin }));
          var out = r.transactions.filter(function (t) { return t.amount < 0; })[0] || r.transactions[0];
          var base = {
            amount: U().money(amt, cur),
            sub: ZB.t("To ") + recipient,
            ref: out.ref,
            rows: [
              ['Date', U().dateTime(Date.now())],
              [ZB.t('Fee'), feeText],
              ['Status', r.pending ? "<span class=\"pill amber\">" + ZB.t("Pending review") + "</span>"
                                   : "<span class=\"pill green\">" + ZB.t("Completed") + "</span>"]
            ]
          };
          if (r.pending) return Object.assign(base, {
            state: 'pending', title: ZB.t("Pending approval"),
            mail: ZB.t("we'll email you the moment this payout is approved.")
          });
          return Object.assign(base, { state: 'success', title: ZB.t("Transfer successful") });
        }
      });
    };
    renderMode(mode);
  }

  function exchangePane(b, accts) {
    var curs = {};
    accts.forEach(function (a) { curs[a.currency] = true; });
    return '<div class="split rev"><div class="card pad-lg">' +
      '<form data-form="u-exchange" id="ex-form">' +
      '<div class="grid cols-2" style="gap:12px">' +
      "<div class=\"field\"><label>" + ZB.t("From") + "</label><select class=\"input\" name=\"from_account_id\" id=\"ex-from\">" + acctOptions(accts) + '</select></div>' +
      "<div class=\"field\"><label>" + ZB.t("To") + "</label><select class=\"input\" name=\"to_account_id\" id=\"ex-to\">" + acctOptions(accts.slice().reverse()) + '</select></div></div>' +
      "<div class=\"field\"><label>" + ZB.t("Amount") + "</label><div class=\"amt-wrap\">" +
      '<input class="input" type="number" step="0.01" min="0.01" name="amount" id="ex-amt" value="100" required style="padding-left:15px"></div></div>' +
      '<div class="calc-out" id="ex-quote" style="margin-bottom:16px">' +
      "<div class=\"co-row\"><span>" + ZB.t("Rate") + "</span><b id=\"qx-rate\">—</b></div>" +
      "<div class=\"co-row co-big\"><span>" + ZB.t("You receive") + "</span><b id=\"qx-net\" class=\"grad-text\">—</b></div>" +
      "<div class=\"co-row\"><span>" + ZB.t("Incl.") + " " + b.fees.exchange_fee_pct + ZB.t("% exchange fee") + "</span><b id=\"qx-fee\">—</b></div></div>" +
      '<button class="btn primary block lg" type="submit">' + U().icon('swap', 16) + " " + ZB.t("Exchange now") + "</button>" +
      '</form></div>' +
      "<div class=\"card\"><h3 class=\"mb-1\">" + ZB.t("Why Zentra FX feels good") + "</h3>" +
      "<div class=\"set-row\"><div><b>" + ZB.t("Live mid-market rate") + "</b><div class=\"desc\">" + ZB.t("The same rate you see quoted, refreshed continuously.") + "</div></div></div>" +
      "<div class=\"set-row\"><div><b>" + ZB.t("Flat") + " " + b.fees.exchange_fee_pct + ZB.t("% fee") + "</b><div class=\"desc\">" + ZB.t("No weekend markups, no “processing spread”. Ever.") + "</div></div></div>" +
      "<div class=\"set-row\"><div><b>" + ZB.t("Instant settlement") + "</b><div class=\"desc\">" + ZB.t("Both sides of the swap post to your ledger immediately.") + "</div></div></div></div></div>";
  }

  function bindExchange(root, b, accts) {
    var form = root.querySelector('#ex-form');
    async function refreshQuote() {
      var from = accts.filter(function (a) { return a.id === +root.querySelector('#ex-from').value; })[0];
      var to = accts.filter(function (a) { return a.id === +root.querySelector('#ex-to').value; })[0];
      var amt = parseFloat(root.querySelector('#ex-amt').value) || 0;
      if (!from || !to || from.id === to.id) {
        root.querySelector('#qx-rate').textContent = ZB.t("pick two different accounts");
        root.querySelector('#qx-net').textContent = '—';
        return;
      }
      try {
        var q = await ZB.api.get('/api/user/exchange/quote?from=' + from.currency + '&to=' + to.currency + '&amount=' + amt);
        root.querySelector('#qx-rate').textContent = '1 ' + from.currency + ' = ' + q.rate.toFixed(4) + ' ' + to.currency;
        root.querySelector('#qx-net').textContent = U().money(q.net, to.currency);
        root.querySelector('#qx-fee').textContent = U().money(q.fee, to.currency);
      } catch (e) {
        root.querySelector('#qx-rate').textContent = e.message;
      }
    }
    form.addEventListener('input', U().debounce(refreshQuote, 250));
    root.querySelector('#ex-from').addEventListener('change', refreshQuote);
    root.querySelector('#ex-to').addEventListener('change', refreshQuote);

    ZB.forms['u-exchange'] = async function (data) {
      try {
        var from = accts.filter(function (a) { return a.id === +data.from_account_id; })[0];
        var to = accts.filter(function (a) { return a.id === +data.to_account_id; })[0];
        var r = await ZB.api.post('/api/user/exchange', data);
        var outT = r.transactions.filter(function (t) { return t.amount < 0; })[0] || r.transactions[0];
        var inT = r.transactions.filter(function (t) { return t.amount > 0; })[0] || r.transactions[0];
        txResult({
          state: 'success', title: ZB.t("Exchange successful"),
          amount: U().money(data.amount, from.currency) + ' → ' + U().money(inT.amount, to.currency),
          sub: ZB.t("Rate 1 ") + from.currency + ' = ' + Number(r.rate).toFixed(4) + ' ' + to.currency,
          ref: outT.ref,
          rows: [
            ['Date', U().dateTime(Date.now())],
            [ZB.t('Fee'), outT.fee ? U().money(outT.fee, to.currency) : '—'],
            ['Status', "<span class=\"pill green\">" + ZB.t("Completed") + "</span>"]
          ],
          mail: ZB.t("both sides settled instantly.")
        });
        ZB.render();
      } catch (e) {
        if (e.status === 423) {
          txResult({
            state: 'declined', title: ZB.t("Transaction declined"),
            sub: ZB.t("Your account is currently restricted"),
            rows: [
              ['Date', U().dateTime(Date.now())],
              [ZB.t('Reason'), ZB.t("Account under review by Zentra")],
              [ZB.t("Next step"), ZB.t("Check Notifications — our team has emailed you what to do")]
            ]
          });
          ZB.render();
          return;
        }
        U().toast(e.message, 'err');
      }
    };
    refreshQuote();
  }

  function benPane(bens) {
    return '<div class="split rev"><div class="card pad-lg">' +
      "<h3 class=\"mb-2\">" + ZB.t("Add beneficiary") + "</h3>" +
      '<form data-form="u-ben-add">' +
      '<div class="grid cols-2" style="gap:12px">' +
      "<div class=\"field\"><label>" + ZB.t("Name") + "</label><input class=\"input\" name=\"name\" required placeholder=\"Full name\"></div>" +
      "<div class=\"field\"><label>" + ZB.t("Bank") + "</label><input class=\"input\" name=\"bank\" placeholder=\"Chase, HSBC…\"></div></div>" +
      "<div class=\"field\"><label>" + ZB.t("Account number / IBAN") + "</label><input class=\"input\" name=\"account_number\" required placeholder=\"…\"></div>" +
      '<button class="btn primary block" type="submit">' + U().icon('plus', 15) + " " + ZB.t("Save beneficiary") + "</button></form></div>" +
      "<div class=\"card\"><div class=\"card-title\"><h3>" + ZB.t("Saved (") + bens.length + ')</h3></div>' +
      (bens.length ? bens.map(function (bn) {
        return '<div class="set-row"><div><b>' + U().esc(bn.name) + '</b>' +
          '<div class="desc mono">' + U().esc(bn.bank + ' · ' + bn.account_number) + '</div></div>' +
          '<button class="icon-btn danger-del" data-del="' + bn.id + '" title="' + ZB.t("Remove") + '">' + U().icon('trash', 15) + '</button></div>';
      }).join('') : "<p class=\"muted small\">" + ZB.t("No saved beneficiaries yet — add one for one-tap external payouts.") + "</p>") +
      '</div></div>';
  }

  function bindBen(root) {
    ZB.forms['u-ben-add'] = async function (data) {
      try {
        await ZB.api.post('/api/user/beneficiaries', data);
        U().toast(ZB.t("Beneficiary saved"));
        ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    };
    root.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        U().confirmBox(ZB.t("Remove beneficiary?"), ZB.t("They won't be able to receive future payouts from you."), ZB.t('Remove'), true, async function () {
          try {
            await ZB.api.del('/api/user/beneficiaries/' + btn.dataset.del);
            U().toast(ZB.t('Removed'));
            ZB.render();
          } catch (e) { U().toast(e.message, 'err'); }
        });
      });
    });
  }

  /* ============================================================== CARDS */
  async function cards() {
    var b = await boot();
    var r = await ZB.api.get('/api/user/cards');
    var cs = r.cards;

    var html =
      "<div class=\"page-head\"><div><h2>" + ZB.t("Cards") + "</h2>" +
      "<div class=\"sub\">" + ZB.t("Virtual cards are free and instant. Physical metal cards cost $") +
      Number(r.issue_fee).toFixed(2) + " " + ZB.t("to issue. Click a card to flip it.") + "</div></div>" +
      '<div class="head-actions">' + (r.enabled && b.flags.cards_enabled ?
        '<button class="btn primary sm" id="new-card-btn">' + U().icon('plus', 15) + " " + ZB.t("New card") + "</button>" :
        "<span class=\"pill gray\">" + ZB.t("Card issuing paused") + "</span>") + '</div></div>' +

      '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">' +
      cs.map(function (c) { return cardBlock(c, r.max_virtual); }).join('') +
      (cs.length ? '' : '<div class="card empty" style="grid-column:1/-1">' + U().icon('card', 34) +
        "<b>" + ZB.t("No cards yet") + "</b>" + ZB.t("Create a free virtual card in seconds.") + "</div>") +
      '</div>';

    return {
      html: html, title: ZB.t("Cards"),
      mount: function () {
        document.querySelectorAll('.ucard').forEach(function (el) {
          el.addEventListener('click', function () { el.classList.toggle('flipped'); });
        });
        document.querySelectorAll('[data-freeze]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            var id = btn.dataset.freeze;
            var target = !btn.dataset.to;
            try {
              await ZB.api.post('/api/user/cards/' + id + '/freeze', { frozen: target });
              U().toast(target ? ZB.t("Card frozen 🥶") : ZB.t("Card unfrozen"));
              ZB.render();
            } catch (e) { U().toast(e.message, 'err'); }
          });
        });
        document.querySelectorAll('[data-limit]').forEach(function (btn) {
          btn.addEventListener('click', function () { limitModal(btn.dataset.limit); });
        });
        var nb = document.getElementById('new-card-btn');
        if (nb) nb.onclick = function () { newCardModal(b.accounts.filter(function (a) { return !a.frozen; }), r.issue_fee); };
      }
    };
  }

  function cardBlock(c, maxVirt) {
    var revealed = cardReveal[c.id];
    var num = revealed ? revealed.number : c.masked;
    var virtCls = c.type === 'virtual' ? ' virtual' : '';
    return '<div class="card">' +
      '<div class="ucard-scene"><div class="ucard" data-card="' + c.id + '">' +

      '<div class="ucard-face ucard-front' + virtCls + (c.frozen ? ' frozen-c' : '') + '">' +
      '<div class="rc-top"><span class="rc-brand">' + U().esc(c.label) + '<small>' +
      (c.type === 'virtual' ? ZB.t("Virtual debit") : ZB.t("Platinum debit")) + '</small></span>' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linecap="round"><path d="M8.5 8.5a7 7 0 0 1 0 7M12 6a10.5 10.5 0 0 1 0 12M15.5 3.8a14 14 0 0 1 0 16.4"/></svg></div>' +
      '<div class="rc-chip"></div>' +
      '<div class="rc-num mt-1">' + num.replace(/\s/g, '&nbsp;&nbsp;&nbsp;') + '</div>' +
      '<div class="rc-foot">' +
      "<div><div class=\"rc-label\">" + ZB.t("Holder") + "</div><b class=\"small\">" +
      U().esc((ZB.state.user.name || '').toUpperCase()) + '</b></div>' +
      "<div><div class=\"rc-label\">" + ZB.t("Expires") + "</div><b class=\"small\">" + U().esc(c.exp_month + '/' + c.exp_year) + '</b></div>' +
      '<div class="rc-brandmark">' + U().cardBrand(c.type === 'virtual' ? 'mastercard' : 'visa', 22) + '</div></div>' +
      (c.frozen ? "<span class=\"card-status-tag\">" + ZB.t("&#10052; Frozen") + "</span>" : '') +
      '</div>' +

      '<div class="ucard-face ucard-back"><div class="uc-strip"></div>' +
      '<div class="uc-sig"><i>' + (revealed ? revealed.cvv : '&bull;&bull;&bull;') + '</i></div>' +
      "<p class=\"uc-cvv-note\">" + ZB.t("CVV shown only after issuing, or flip while revealed. Never share it.") + "</p>" +
      "<p class=\"tiny\" style=\"margin-top:auto;color:var(--faint)\">" + ZB.t("zentra.bank &#183; 24/7 support &#183; if found, do not retire it") + "</p>" +
      '</div></div></div>' +

      '<div class="spread mt-2"><div class="row">' +
      '<span class="pill ' + (c.type === 'virtual' ? 'blue' : 'violet') + ' plain">' + c.type + '</span>' +
      (c.limit_monthly ? "<span class=\"pill gray plain\">" + ZB.t("limit") + " " + U().compact(c.limit_monthly) + ZB.t("/mo") + "</span>" : '') +
      (c.frozen ? "<span class=\"pill red\">" + ZB.t("frozen") + "</span>" : "<span class=\"pill green\">" + ZB.t("active") + "</span>") + '</div>' +
      '<div class="row" style="gap:6px">' +
      '<button class="icon-btn" data-limit="' + c.id + '" title="' + ZB.t("Monthly limit") + '">' + U().icon('gauge', 15) + '</button>' +
      '<button class="btn sm ' + (c.frozen ? '' : 'outline') + '" data-freeze="' + c.id + '" data-to="' + (c.frozen ? '0' : '1') + '">' +
      U().icon('snow', 13) + (c.frozen ? ' ' + ZB.t('Unfreeze') : ' ' + ZB.t('Freeze')) + '</button></div></div>' +
      '</div>';
  }

  function limitModal(cardId) {
    U().modal(
      "<div class=\"modal-head\"><h3>" + ZB.t("Monthly spending limit") + "</h3><button class=\"icon-btn\" data-x-close>" + U().icon('x', 16) + '</button></div>' +
      '<form data-form="u-card-limit">' +
      "<div class=\"field\"><label>" + ZB.t("Limit per month ($)") + "</label><input class=\"input\" type=\"number\" name=\"limit_monthly\" min=\"1\" placeholder=\"Leave empty for no limit\">" +
      "<span class=\"hint\">" + ZB.t("Transactions decline automatically past this cap.") + "</span></div>" +
      "<button class=\"btn primary block\" type=\"submit\">" + ZB.t("Save limit") + "</button></form>");
    ZB.forms['u-card-limit'] = async function (data) {
      try {
        await ZB.api.put('/api/user/cards/' + cardId + '/limit', data);
        U().closeModal();
        U().toast(ZB.t("Limit updated"));
        ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    };
  }

  function newCardModal(accts, fee) {
    U().modal(
      "<div class=\"modal-head\"><h3>" + ZB.t("Issue a new card") + "</h3><button class=\"icon-btn\" data-x-close>" + U().icon('x', 16) + '</button></div>' +
      '<form data-form="u-new-card">' +
      "<div class=\"field\"><label>" + ZB.t("Type") + "</label><div class=\"seg\" id=\"nc-type\">" +
      "<button type=\"button\" data-t=\"virtual\" class=\"active\">" + ZB.t("Virtual · free") + "</button>" +
      "<button type=\"button\" data-t=\"physical\">" + ZB.t("Metal · $") + Number(fee).toFixed(2) + '</button></div></div>' +
      "<div class=\"field\"><label>" + ZB.t("Linked account") + "</label><select class=\"input\" name=\"account_id\">" + acctOptions(accts) + '</select></div>' +
      "<div class=\"field\"><label>" + ZB.t("Nickname") + "</label><input class=\"input\" name=\"label\" placeholder=\"Online shopping\"></div>" +
      '<button class="btn primary block lg" type="submit">' + U().icon('card', 16) + " " + ZB.t("Issue card") + "</button></form>");
    var ctype = 'virtual';
    document.querySelectorAll('#nc-type button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#nc-type button').forEach(function (x) { x.classList.remove('active'); });
        btn.classList.add('active');
        ctype = btn.dataset.t;
      });
    });
    ZB.forms['u-new-card'] = async function (data) {
      try {
        var r = await ZB.api.post('/api/user/cards', Object.assign({}, data, { type: ctype }));
        cardReveal[r.card.id] = { number: r.card.number, cvv: r.card.cvv };
        U().closeModal();
        U().toast(ZB.t("Card issued — numbers visible until you leave this page"));
        ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    };
  }

  /* ================================================================ PAY */
  var chosenCategory = '';

  function billName(c) {
    var m = {
      electricity: ZB.t("Electricity"), water: ZB.t("Water & Sewage"),
      internet: ZB.t("Internet & TV"), airtime: ZB.t("Phone Airtime"),
      rent: ZB.t("Rent"), insurance: ZB.t("Insurance"),
      education: ZB.t("Education"), charity: ZB.t("Charity")
    };
    return m[c.key] || c.name;
  }

  async function pay() {
    var b = await boot();
    var cat = await ZB.api.get('/api/user/pay/catalog');
    var recents = await ZB.api.get('/api/user/transactions?type=payment&per=8');
    chosenCategory = '';

    var cats = cat.categories.map(function (c) {
      return '<button class="tile" data-cat="' + c.key + '">' +
        '<span class="t-icon">' + U().icon(c.icon, 19) + '</span><b>' + U().esc(billName(c)) + '</b></button>';
    }).join('');

    var html =
      "<div class=\"page-head\"><div><h2>" + ZB.t("Pay bills") + "</h2>" +
      "<div class=\"sub\">" + ZB.t("Utilities, rent, airtime — settled instantly with a receipt in your ledger.") + "</div></div></div>" +
      (!cat.enabled || !b.flags.payments_enabled ?
        '<div class="banner">' + U().icon('alert', 15) + " " + ZB.t("Bill payments are temporarily disabled by the bank.") + "</div>" : '') +
      '<div class="split">' +
      '<div class="card pad-lg">' +
      "<label class=\"field\"><label>" + ZB.t("Category") + "</label></label>" +
      '<div class="grid cols-4" style="gap:10px;margin-bottom:20px">' + cats + '</div>' +
      '<form data-form="u-pay">' +
      "<div class=\"field\"><label>" + ZB.t("From account") + "</label><select class=\"input\" name=\"account_id\">" +
      acctOptions(b.accounts) + '</select></div>' +
      "<div class=\"field\"><label>" + ZB.t("Biller") + "</label><input class=\"input\" name=\"biller\" required list=\"payee-list\" placeholder=\"City Power, FiberOne…\">" +
      '<datalist id="payee-list">' + cat.recent_payees.map(function (p) {
        return '<option value="' + U().esc(p.name) + '">';
      }).join('') + '</datalist></div>' +
      '<div class="grid cols-2" style="gap:12px">' +
      "<div class=\"field\"><label>" + ZB.t("Customer ref (optional)") + "</label><input class=\"input\" name=\"customer_ref\" placeholder=\"Meter/account no.\"></div>" +
      "<div class=\"field\"><label>" + ZB.t("Amount") + "</label><input class=\"input\" type=\"number\" step=\"0.01\" min=\"0.01\" name=\"amount\" required placeholder=\"0.00\"></div></div>" +
      '<button class="btn primary block lg" type="submit" ' + (cat.enabled ? '' : 'disabled') + '>' +
      U().icon('receipt', 16) + " " + ZB.t("Pay now") + "</button></form></div>" +
      "<div class=\"card\"><div class=\"card-title\"><h3>" + ZB.t("Recent payments") + "</h3></div>" +
      (recents.transactions.length ? recents.transactions.map(function (t) { return U().txRow(t); }).join('') :
        '<div class="empty">' + U().icon('receipt', 30) + "<b>" + ZB.t("No payments yet") + "</b></div>") +
      '</div></div>';

    return {
      html: html, title: ZB.t("Pay bills"),
      mount: function () {
        document.querySelectorAll('[data-cat]').forEach(function (el) {
          el.addEventListener('click', function () {
            document.querySelectorAll('[data-cat]').forEach(function (x) {
              x.classList.remove('cat-active');
            });
            el.classList.add('cat-active');
            chosenCategory = el.dataset.cat;
          });
        });
        ZB.forms['u-pay'] = async function (data) {
          var amt = parseFloat(data.amount) || 0;
          var from = b.accounts.filter(function (x) { return x.id === +data.account_id; })[0];
          if (!from || !amt || !data.biller) { U().toast(ZB.t("Fill in the biller and amount."), 'err'); return; }
          var cur = from.currency;
          confirmTx({
            title: ZB.t("Authorize payment"),
            sub: ZB.t("Bill payments are usually settled instantly."),
            needsPin: true,
            declineTitle: ZB.t("Payment declined"),
            amountLabel: U().money(amt, cur),
            confirmLabel: ZB.t('Pay') + ' ' + U().money(amt, cur),
            summaryRows: [
              [ZB.t('Amount'), '<span style="font-size:16px">' + U().money(amt, cur) + '</span>'],
              [ZB.t('Biller'), U().esc(data.biller)],
              [ZB.t('Category'), U().esc(billName({ key: chosenCategory, name: chosenCategory }) || ZB.t('other'))],
              [ZB.t('From'), U().esc(from.label + ' · ··' + String(from.number).replace(/\s/g, '').slice(-4))],
              ['Ref', U().esc(data.customer_ref || '—')]
            ],
            run: async function (pin) {
              var r = await ZB.api.post('/api/user/payments',
                Object.assign({}, data, { category: chosenCategory, pin: pin }));
              var t = r.transaction;
              return {
                state: 'success', title: ZB.t("Payment successful"),
                amount: U().money(amt, cur),
                sub: ZB.t("To ") + data.biller,
                ref: t.ref,
                rows: [
                  [ZB.t('Date'), U().dateTime(Date.now())],
                  [ZB.t('Category'), U().esc(billName({ key: chosenCategory, name: chosenCategory }) || ZB.t('other'))],
                  [ZB.t('Status'), "<span class=\"pill green\">" + ZB.t("Completed") + "</span>"]
                ],
                mail: ZB.t("keep this receipt for your records.")
              };
            }
          });
        };
      }
    };
  }

  /* ============================================================== LOANS */
  async function loans() {
    var b = await boot();
    var r = await ZB.api.get('/api/user/loans');
    var active = r.loans.filter(function (l) { return l.status === 'active'; });
    var pend = r.loans.filter(function (l) { return l.status === 'pending'; });
    var past = r.loans.filter(function (l) { return ['repaid', 'rejected'].indexOf(l.status) >= 0; });

    var heroLoan = active[0];
    var hero = heroLoan ?
      '<div class="card pad-lg mb-2"><div class="gauge-hero">' +
      '<div class="gauge-ring"><svg viewBox="0 0 120 120" style="transform:rotate(-90deg);width:100%;height:100%">' +
      '<circle r="46" cx="60" cy="60" fill="none" stroke="#e3e8ee" stroke-width="10"/>' +
      '<circle r="46" cx="60" cy="60" fill="none" stroke="#0f62a8" stroke-width="10" stroke-linecap="round" ' +
      'stroke-dasharray="' + (heroLoan.progress / 100 * 289) + ' 289"/></svg>' +
      '<div class="gauge-center"><div><b>' + heroLoan.progress + "%</b><span>" + ZB.t("repaid") + "</span></div></div></div>" +
      "<div style=\"flex:1;min-width:220px\"><div class=\"spread\"><h3>" + ZB.t("Loan #") + heroLoan.id + ' · ' + heroLoan.term_months + ZB.t(" months @ ") + heroLoan.apr + ZB.t("% APR") + "</h3>" +
      "<span class=\"pill green\">" + ZB.t("Active") + "</span></div>" +
      '<div class="grid cols-3 mt-2">' +
      "<div><span class=\"tiny faint\">" + ZB.t("MONTHLY") + "</span><br><b>" + U().money(heroLoan.monthly_payment) + '</b></div>' +
      "<div><span class=\"tiny faint\">" + ZB.t("PAID SO FAR") + "</span><br><b class=\"up\">" + U().money(heroLoan.paid_total) + '</b></div>' +
      "<div><span class=\"tiny faint\">" + ZB.t("REMAINING") + "</span><br><b>" + U().money(heroLoan.remaining) + '</b></div></div>' +
      '<div class="progress mt-2" style="max-width:420px"><i style="width:' + heroLoan.progress + '%"></i></div>' +
      '<button class="btn primary sm mt-2" data-repay="' + heroLoan.id + '" data-monthly="' + heroLoan.monthly_payment + '">' +
      U().icon('banknote', 14) + " " + ZB.t("Make a payment") + "</button></div></div></div>"
      : '';

    var html =
      "<div class=\"page-head\"><div><h2>" + ZB.t("Loans") + "</h2>" +
      "<div class=\"sub\">" + ZB.t("Transparent borrowing at") + " " + r.apr + ZB.t("% APR. No origination fees, repay anytime.") + "</div></div>" +
      (r.enabled && b.flags.loans_enabled ?
        '<button class="btn primary sm" id="req-loan">' + U().icon('plus', 15) + " " + ZB.t("Request a loan") + "</button>" : '') +
      '</div>' +
      (!r.enabled || !b.flags.loans_enabled ?
        '<div class="banner">' + U().icon('alert', 15) + " " + ZB.t("Loan applications are paused right now.") + "</div>" :
        b.user.kyc_status !== 'verified' ?
          '<div class="banner info">' + U().icon('info', 15) + " " + ZB.t("Verify your identity in Settings to unlock borrowing.") + "</div>" : '') +
      hero +
      (pend.length ? pend.map(function (l) {
        return '<div class="card mb-1" style="border-color:rgba(251,191,36,.35)"><div class="spread wrap">' +
          '<div><b>' + U().money(l.principal) + ' · ' + l.term_months + ZB.t("mo") + "</b>" +
          '<div class="small muted mt-1">' + U().esc(l.purpose || ZB.t("No purpose given")) + ZB.t(" · requested ") + U().rel(l.created_at) + '</div></div>' +
          "<div class=\"row\" style=\"gap:10px;align-items:center\"><span class=\"pill amber\">" + ZB.t("Under review") + "</span>" +
          '<button class="btn sm ghost danger" data-withdraw-loan="' + l.id + '">' + U().icon('x', 13) + " " + ZB.t("Withdraw") + "</button></div></div></div>";
      }).join('') : '') +
      (heroLoan || pend.length ? '' :
        '<div class="card empty mb-2">' + U().icon('target', 32) +
        "<b>" + ZB.t("No active loans") + "</b>" + ZB.t("Borrow from") + " " + U().money(r.min_loan) + ' to ' + U().money(r.max_loan) + '.</div>') +
      (past.length ? "<h3 class=\"mb-1 mt-2\">" + ZB.t("History") + "</h3><div class=\"table-wrap\"><table class=\"table\">" +
        "<thead><tr><th>" + ZB.t("Loan") + "</th><th>" + ZB.t("Principal") + "</th><th>" + ZB.t("Term") + "</th><th>" + ZB.t("Status") + "</th><th class=\"num\">" + ZB.t("Paid") + "</th></tr></thead><tbody>" +
        past.map(function (l) {
          return '<tr><td>#' + l.id + ' · ' + U().esc(l.purpose || '—') + '</td><td>' + U().money(l.principal) + '</td>' +
            '<td>' + l.term_months + ZB.t("mo") + "</td><td>" + U().pillFor(l.status) + '</td>' +
            '<td class="num">' + U().money(l.paid_total) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '');

    return {
      html: html, title: ZB.t("Loans"),
      mount: function () {
        var rq = document.getElementById('req-loan');
        if (rq) rq.onclick = function () { loanRequestModal(r, b.accounts); };
        document.querySelectorAll('[data-repay]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            repayModal(+btn.dataset.repay, parseFloat(btn.dataset.monthly), b.accounts);
          });
        });
        document.querySelectorAll('[data-withdraw-loan]').forEach(function (btn) {
          btn.onclick = function () {
            U().confirmBox(ZB.t("Withdraw this application?"),
              ZB.t("The request leaves the review queue — nothing was ever disbursed or owed."),
              ZB.t("Yes, withdraw it"), true, async function () {
                try {
                  await ZB.api.post('/api/user/loans/' + btn.dataset.withdrawLoan + '/cancel', {});
                  U().toast(ZB.t("Application withdrawn"));
                  ZB.render();
                } catch (e) { U().toast(e.message, 'err'); }
              });
          };
        });
      }
    };
  }

  function loanRequestModal(opts, accts) {
    var terms = opts.terms || [12];
    var term = terms[1] !== undefined ? terms[1] : terms[0];
    U().modal(
      "<div class=\"modal-head\"><h3>" + ZB.t("Request a loan") + "</h3><button class=\"icon-btn\" data-x-close>" + U().icon('x', 16) + '</button></div>' +
      '<form data-form="u-loan-req">' +
      "<div class=\"field\"><label>" + ZB.t("Amount ($) —") + " " + U().money(opts.min_loan) + ' to ' + U().money(opts.max_loan) + '</label>' +
      '<input class="input" type="number" id="lr-amt" value="' + Math.round((opts.min_loan + opts.max_loan) / 2) + '" min="' + opts.min_loan + '" max="' + opts.max_loan + '"></div>' +
      "<div class=\"field\"><label>" + ZB.t("Term") + "</label><div class=\"seg\" id=\"lr-terms\">" +
      terms.map(function (t) { return '<button type="button" data-t="' + t + '" ' + (t === term ? 'class="active"' : '') + '>' + t + " " + ZB.t("mo") + "</button>"; }).join('') +
      '</div></div>' +
      "<div class=\"field\"><label>" + ZB.t("Purpose") + "</label><input class=\"input\" name=\"purpose\" placeholder=\"Home improvement, inventory…\"></div>" +
      "<div class=\"field\"><label>" + ZB.t("Disburse to") + "</label><select class=\"input\" name=\"account_id\">" + acctOptions(accts) + '</select></div>' +
      "<div class=\"calc-out mb-2\"><div class=\"co-row co-big\"><span>" + ZB.t("Estimated monthly") + "</span><b id=\"lr-monthly\" style=\"color:var(--navy)\">—</b></div>" +
      '<div class="co-row"><span>@ ' + opts.apr + ZB.t("% APR") + "</span><b id=\"lr-total\">—</b></div></div>" +
      '<button class="btn primary block lg" type="submit">' + U().icon('target', 16) + " " + ZB.t("Submit application") + "</button></form>");

    function calc() {
      var P = parseFloat(document.getElementById('lr-amt').value) || 0;
      var rr = opts.apr / 1200;
      var mo = P * rr * Math.pow(1 + rr, term) / (Math.pow(1 + rr, term) - 1);
      document.getElementById('lr-monthly').textContent = U().money(mo);
      document.getElementById('lr-total').textContent = 'total ' + U().money(mo * term);
    }
    document.getElementById('lr-amt').addEventListener('input', calc);
    document.querySelectorAll('#lr-terms button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#lr-terms button').forEach(function (x) { x.classList.remove('active'); });
        btn.classList.add('active');
        term = parseInt(btn.dataset.t, 10);
        calc();
      });
    });
    calc();
    ZB.forms['u-loan-req'] = async function (data) {
      try {
        await ZB.api.post('/api/user/loans', Object.assign({}, data, {
          amount: document.getElementById('lr-amt').value, term_months: term
        }));
        U().closeModal();
        U().toast(ZB.t("Application submitted — we'll notify you the moment it's reviewed"));
        ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    };
  }

  function repayModal(loanId, monthly, accts) {
    U().modal(
      "<div class=\"modal-head\"><h3>" + ZB.t("Make a repayment") + "</h3><button class=\"icon-btn\" data-x-close>" + U().icon('x', 16) + '</button></div>' +
      '<form data-form="u-loan-repay">' +
      "<div class=\"field\"><label>" + ZB.t("From account") + "</label><select class=\"input\" name=\"account_id\">" + acctOptions(accts) + '</select></div>' +
      "<div class=\"field\"><label>" + ZB.t("Amount ($)") + "</label><input class=\"input\" type=\"number\" step=\"0.01\" name=\"amount\" value=\"" + monthly + '" required>' +
      "<span class=\"hint\">" + ZB.t("Pay the monthly amount, any partial amount, or clear it all at once.") + "</span></div>" +
      '<button class="btn primary block" type="submit">' + U().icon('check', 15) + " " + ZB.t("Pay now") + "</button></form>");
    ZB.forms['u-loan-repay'] = async function (data) {
      try {
        await ZB.api.post('/api/user/loans/' + loanId + '/pay', data);
        U().closeModal();
        U().toast(ZB.t("Repayment posted ✓"));
        ZB.render();
      } catch (e) { U().toast(e.message, 'err'); }
    };
  }

  /* ========================================================= STATEMENTS */
  var stmtMonth = '', stmtAcct = null;
  async function statements() {
    var b = await boot();
    var accts = b.accounts;
    if (!stmtAcct || !accts.some(function (a) { return a.id === stmtAcct; })) {
      stmtAcct = accts.length ? accts[0].id : null;
    }
    var now = new Date();
    var months = [];
    for (var i = 0; i < 12; i++) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2));
    }
    if (!stmtMonth) stmtMonth = months[0];
    var cur = accts.filter(function (a) { return a.id === stmtAcct; })[0];

    var txs = [], inn = 0, out = 0;
    if (cur) {
      var tr = await ZB.api.get('/api/user/transactions?account_id=' + cur.id + '&per=100');
      txs = tr.transactions.filter(function (t) {
        var d = new Date(t.created_at);
        return (d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2)) === stmtMonth;
      });
      txs.forEach(function (t) { if (t.amount > 0) inn += t.amount; else out += -t.amount; });
    }

    var html =
      "<div class=\"page-head\"><div><h2>" + ZB.t("Statements") + "</h2>" +
      "<div class=\"sub\">" + ZB.t("Every transaction, filterable and exportable.") + "</div></div>" +
      '<div class="head-actions">' +
      '<select class="input" id="st-acct" style="width:auto">' + acctOptions(accts, stmtAcct) + '</select>' +
      '<button class="btn sm ghost" id="st-print">' + U().icon('file', 14) + " " + ZB.t("Print") + "</button>" +
      '<button class="btn primary sm" id="st-dl">' + U().icon('download', 14) + " " + ZB.t("Download CSV") + "</button></div></div>" +
      '<div class="chip-row mb-2">' + months.map(function (m) {
        return '<button class="chip-btn ' + (m === stmtMonth ? 'active' : '') + '" data-mo="' + m + '">' + U().monthName(m) + '</button>';
      }).join('') + '</div>' +
      '<style>@media print{.sidebar,.topbar,.page-head .head-actions,.chip-row{display:none!important}.content{padding:0}}</style>' +
      '<div class="card">' +
      '<div class="spread mb-2 wrap"><div class="row wrap" style="gap:18px">' +
      "<div><span class=\"tiny faint\">" + ZB.t("ACCOUNT") + "</span><br><b>" + (cur ? U().esc(cur.label) + ' · ' + cur.currency : '—') + '</b></div>' +
      "<div><span class=\"tiny faint\">" + ZB.t("PERIOD") + "</span><br><b>" + U().monthName(stmtMonth) + '</b></div>' +
      "<div><span class=\"tiny faint\">" + ZB.t("MONEY IN") + "</span><br><b class=\"up\">" + U().money(inn, cur ? cur.currency : 'USD') + '</b></div>' +
      "<div><span class=\"tiny faint\">" + ZB.t("MONEY OUT") + "</span><br><b class=\"down\">" + U().money(out, cur ? cur.currency : 'USD') + '</b></div></div>' +
      '<span class="pill gray">' + txs.length + " " + ZB.t("transactions") + "</span></div>" +
      "<div class=\"table-wrap\"><table class=\"table\"><thead><tr><th>" + ZB.t("Date") + "</th><th>" + ZB.t("Description") + "</th><th>" + ZB.t("Ref") + "</th><th>" + ZB.t("Status") + "</th><th class=\"num\">" + ZB.t("Amount") + "</th><th class=\"num\">" + ZB.t("Balance") + "</th></tr></thead><tbody>" +
      (txs.length ? txs.map(function (t) {
        var cancelable = t.status === 'pending' && (t.type === 'deposit' || t.type === 'transfer_out');
        return '<tr><td class="small muted" style="white-space:nowrap">' + U().dateShort(t.created_at) + '</td>' +
          '<td><b class="small">' + U().esc(t.counterparty || t.type) + '</b>' +
          (t.note ? '<div class="tiny faint">' + U().esc(t.note) + '</div>' : '') +
          (cancelable ? '<button class="btn sm ghost danger" data-cancel-tx="' + t.id + '" style="margin-top:6px">' +
            U().icon('x', 13) + " " + ZB.t("Cancel request") + "</button>" : '') + '</td>' +
          '<td class="mono tiny">' + U().esc(t.ref) + '</td><td>' + U().pillFor(t.status) + '</td>' +
          '<td class="num"><b class="' + (t.amount > 0 ? 'up' : '') + ' small">' + U().signedMoney(t.amount, t.currency) + '</b></td>' +
          '<td class="num small muted">' + (t.balance_after != null ? U().money(t.balance_after, t.currency) : '—') + '</td></tr>';
      }).join('') : "<tr><td colspan=\"6\" style=\"text-align:center;padding:36px\" class=\"muted\">" + ZB.t("No transactions in") + " " + U().monthName(stmtMonth) + '.</td></tr>') +
      '</tbody></table></div></div>';

    return {
      html: html, title: ZB.t("Statements"),
      mount: function () {
        document.querySelectorAll('[data-mo]').forEach(function (el) {
          el.addEventListener('click', function () { stmtMonth = el.dataset.mo; ZB.render(); });
        });
        document.querySelectorAll('[data-cancel-tx]').forEach(function (btn) {
          btn.onclick = function () {
            U().confirmBox(ZB.t("Cancel this request?"),
              ZB.t("Only requests still awaiting approval can be withdrawn. Any held funds return to your balance instantly."),
              ZB.t("Yes, cancel it"), true, async function () {
                try {
                  await ZB.api.post('/api/user/requests/' + btn.dataset.cancelTx + '/cancel', {});
                  U().toast(ZB.t("Request cancelled"));
                  ZB.render();
                } catch (e) { U().toast(e.message, 'err'); }
              });
          };
        });
        var sa = document.getElementById('st-acct');
        if (sa) sa.addEventListener('change', function () { stmtAcct = +sa.value; ZB.render(); });
        var dl = document.getElementById('st-dl');
        if (dl && cur) dl.onclick = function () {
          ZB.api.download('/api/user/statement.csv?account_id=' + cur.id + '&month=' + stmtMonth,
            'zentra-' + cur.number.replace(/\s/g, '') + '-' + stmtMonth + '.csv');
          U().toast(ZB.t("CSV downloading…"), 'info');
        };
        var pr = document.getElementById('st-print');
        if (pr) pr.onclick = function () { window.print(); };
      }
    };
  }

  /* =========================================================== SETTINGS */
  async function settings() {
    var b = await boot();
    var u = b.user;
    var sess = await ZB.api.get('/api/user/sessions');

    var kycCard;
    if (u.kyc_status === 'verified') {
      kycCard = '<div class="card"><div class="spread"><h3 class="row">' + U().icon('shield', 18) + " " + ZB.t("Identity") + "</h3>" +
        "<span class=\"pill green\">" + ZB.t("Verified") + "</span></div>" +
        "<p class=\"small muted mt-1\">" + ZB.t("You're fully unlocked — higher limits, loans and instant external payouts.") + "</p></div>";
    } else if (u.kyc_status === 'pending') {
      kycCard = '<div class="card"><div class="spread"><h3 class="row">' + U().icon('clock', 18) + " " + ZB.t("Identity") + "</h3>" +
        "<span class=\"pill amber\">" + ZB.t("Under review") + "</span></div>" +
        "<p class=\"small muted mt-1\">" + ZB.t("Submitted") + " " + U().rel(u.kyc_submitted_at || Date.now()) + ZB.t(". We usually finish within hours — you'll get a notification.") + "</p></div>";
    } else {
      kycCard = '<div class="card"><div class="spread"><h3 class="row">' + U().icon('shieldOff', 18) + " " + ZB.t("Identity") + "</h3>" +
        '<span class="pill ' + (u.kyc_status === 'rejected' ? 'red' : 'gray') + '">' +
        (u.kyc_status === 'rejected' ? ZB.t("Rejected — resubmit") : ZB.t("Not verified")) + '</span></div>' +
        (u.kyc_status === 'rejected' && u.kyc_note ? "<p class=\"small down mt-1\">" + ZB.t("Reason:") + " " + U().esc(u.kyc_note) + '</p>' : '') +
        "<p class=\"small muted mt-1 mb-2\">" + ZB.t("Unlocks transfers over $10,000, loans and faster payouts.") + "</p>" +
        '<form data-form="u-kyc">' +
        "<div class=\"field\"><label>" + ZB.t("Document type") + "</label><select class=\"input\" name=\"doc_type\">" +
        "<option value=\"passport\">" + ZB.t("Passport") + "</option><option value=\"drivers_license\">" + ZB.t("Driver's license") + "</option>" +
        "<option value=\"national_id\">" + ZB.t("National ID") + "</option></select></div>" +
        "<div class=\"field\"><label>" + ZB.t("Document image") + "</label><input class=\"input\" name=\"doc_name\" placeholder=\"my_passport.jpg\" required>" +
        "<span class=\"hint\">" + ZB.t("Demo mode: typing a file name stands in for the upload.") + "</span></div>" +
        '<button class="btn primary block" type="submit">' + U().icon('upload', 15) + " " + ZB.t("Submit for review") + "</button></form></div>";
    }

    var html =
      "<div class=\"page-head\"><div><h2>" + ZB.t("Settings") + "</h2>" +
      "<div class=\"sub\">" + ZB.t("Profile, security, verification and sessions.") + "</div></div></div>" +
      '<div class="grid cols-2">' +

      "<div class=\"card\"><div class=\"card-title\"><h3>" + ZB.t("Profile") + "</h3>" +
      '<span class="avatar" style="background:' + U().hueColor(u.hue || 140) + ';width:42px;height:42px">' + U().esc(U().initials(u.name)) + '</span></div>' +
      '<form data-form="u-profile">' +
      "<div class=\"field\"><label>" + ZB.t("Full name") + "</label><input class=\"input\" name=\"name\" value=\"" + U().esc(u.name) + '" required></div>' +
      "<div class=\"field\"><label>" + ZB.t("Email") + "</label><input class=\"input\" value=\"" + U().esc(u.email) + '" disabled>' +
      "<span class=\"hint\">" + ZB.t("Contact support to change your email.") + "</span></div>" +
      '<div class="grid cols-2" style="gap:12px">' +
      "<div class=\"field\"><label>" + ZB.t("Phone") + "</label><input class=\"input\" name=\"phone\" value=\"" + U().esc(u.phone || '') + '"></div>' +
      "<div class=\"field\"><label>" + ZB.t("Country") + "</label><input class=\"input\" name=\"country\" value=\"" + U().esc(u.country || '') + '"></div></div>' +
      "<div class=\"field\"><label>" + ZB.t("Address") + "</label><input class=\"input\" name=\"address\" value=\"" + U().esc(u.address || '') + '"></div>' +
      "<button class=\"btn primary block\" type=\"submit\">" + ZB.t("Save profile") + "</button></form></div>" +

      "<div class=\"card\"><div class=\"card-title\"><h3>" + ZB.t("Password") + "</h3></div>" +
      '<form data-form="u-pass">' +
      "<div class=\"field\"><label>" + ZB.t("Current password") + "</label><input class=\"input\" type=\"password\" name=\"current\" required autocomplete=\"current-password\"></div>" +
      "<div class=\"field\"><label>" + ZB.t("New password") + "</label><input class=\"input\" type=\"password\" name=\"new\" required minlength=\"8\" autocomplete=\"new-password\">" +
      "<span class=\"hint\">" + ZB.t("8+ characters mixing letters and numbers.") + "</span></div>" +
      '<button class="btn block" type="submit">' + U().icon('key', 15) + " " + ZB.t("Change password") + "</button></form>" +
      '<hr style="border-color:var(--line);margin:18px 0">' +
      "<h3 class=\"mb-1\">" + ZB.t("Transaction PIN") + "</h3>" +
      "<p class=\"tiny muted\" style=\"margin-bottom:12px\">" + ZB.t("Required to authorize transfers and bill payments — like your card PIN at an ATM.") + "</p>" +
      '<form data-form="u-pin">' +
      '<div class="grid cols-2" style="gap:12px">' +
      "<div class=\"field\"><label>" + ZB.t("Current PIN") + "</label><input class=\"input pin-input\" style=\"width:100%;letter-spacing:8px;text-align:center;font-size:18px;padding:9px 4px 9px 12px\" type=\"password\" name=\"current\" required maxlength=\"4\" inputmode=\"numeric\" autocomplete=\"off\" placeholder=\"••••\"></div>" +
      "<div class=\"field\"><label>" + ZB.t("New PIN") + "</label><input class=\"input pin-input\" style=\"width:100%;letter-spacing:8px;text-align:center;font-size:18px;padding:9px 4px 9px 12px\" type=\"password\" name=\"new\" required maxlength=\"4\" inputmode=\"numeric\" autocomplete=\"off\" placeholder=\"••••\"></div></div>" +
      '<button class="btn block" type="submit">' + U().icon('lock', 15) + " " + ZB.t("Change transaction PIN") + "</button></form>" +
      '<hr style="border-color:var(--line);margin:18px 0">' +
      "<h3 class=\"mb-1\">" + ZB.t("Notifications") + "</h3>" +
      '<form data-form="u-prefs">' +
      "<label class=\"set-row\" style=\"cursor:pointer\"><div><b>" + ZB.t("Email alerts") + "</b><div class=\"desc\">" + ZB.t("Receipts, approvals and security notices.") + "</div></div>" +
      '<span class="switch"><input type="checkbox" name="email_alerts" ' + ((u.prefs || {}).email_alerts !== false ? 'checked' : '') + '><span class="track"></span></span></label>' +
      "<label class=\"set-row\" style=\"cursor:pointer\"><div><b>" + ZB.t("Push alerts") + "</b><div class=\"desc\">" + ZB.t("Real-time nudges for every transaction.") + "</div></div>" +
      '<span class="switch"><input type="checkbox" name="push_alerts" ' + ((u.prefs || {}).push_alerts !== false ? 'checked' : '') + '><span class="track"></span></span></label>' +
      "<button class=\"btn sm ghost mt-2\" type=\"submit\">" + ZB.t("Save preferences") + "</button></form></div>" +

      kycCard +

      "<div class=\"card\"><div class=\"card-title\"><h3>" + ZB.t("Active sessions") + "</h3><span class=\"pill gray\">" + sess.sessions.length + '</span></div>' +
      sess.sessions.map(function (s) {
        var dev = (s.device || ZB.t("Unknown device")).replace(/Mozilla\/5\.0 \(([^)]+)\).*$/, '$1').slice(0, 40);
        return '<div class="set-row"><div><b>' + U().esc(dev) +
        (s.current ? " <span class=\"pill green plain\">" + ZB.t("this device") + "</span>" : '') + '</b>' +
          '<div class="desc mono">' + U().esc(s.ip || '') + ZB.t(" · last seen ") + U().rel(s.last_seen || s.created_at) + '</div></div>' +
          (s.current ? '' : '<button class="icon-btn" data-kill="' + s.id + '" title="' + ZB.t("Revoke") + '">' + U().icon('x', 14) + '</button>') +
          '</div>';
      }).join('') + '</div>' +
      '</div>';

    return {
      html: html, title: ZB.t("Settings"),
      mount: function () {
        document.querySelectorAll('[data-kill]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            U().confirmBox(ZB.t("Revoke session?"), ZB.t("That device will be signed out immediately."), 'Revoke', true, async function () {
              try {
                await ZB.api.del('/api/user/sessions/' + btn.dataset.kill);
                U().toast(ZB.t("Session revoked"));
                ZB.render();
              } catch (e) { U().toast(e.message, 'err'); }
            });
          });
        });
      }
    };
  }

  /* ------------------------------------------------------- form hooks -- */
  ZB.forms['u-profile'] = async function (data) {
    try {
      await ZB.api.put('/api/user/profile', data);
      ZB.state.boot = null;
      U().toast(ZB.t("Profile saved"));
      ZB.render();
    } catch (e) { U().toast(e.message, 'err'); }
  };
  ZB.forms['u-pass'] = async function (data) {
    try {
      await ZB.api.put('/api/user/password', data);
      U().toast(ZB.t("Password changed 🔒"));
      document.querySelector('form[data-form=u-pass]').reset();
    } catch (e) { U().toast(e.message, 'err'); }
  };
  ZB.forms['u-pin'] = async function (data) {
    try {
      await ZB.api.put('/api/user/pin', { current: data.current, new: data.new });
      U().toast(ZB.t("Transaction PIN updated 🔐"));
      document.querySelector('form[data-form=u-pin]').reset();
      ZB.render();
    } catch (e) { U().toast(e.message, 'err'); }
  };
  ZB.forms['u-prefs'] = async function (data) {
    try {
      await ZB.api.put('/api/user/profile', { prefs: data });
      U().toast(ZB.t("Preferences saved"));
    } catch (e) { U().toast(e.message, 'err'); }
  };
  ZB.forms['u-kyc'] = async function (data) {
    try {
      await ZB.api.post('/api/user/kyc', data);
      ZB.state.boot = null;
      U().toast(ZB.t("Documents submitted — we'll review shortly"));
      ZB.render();
    } catch (e) { U().toast(e.message, 'err'); }
  };

  ZB.views.user = {
    overview: overview, accounts: accounts, transfer: transfer, cards: cards,
    pay: pay, loans: loans, statements: statements, settings: settings,
    depositModal: depositModal
  };
})(window.ZB);
