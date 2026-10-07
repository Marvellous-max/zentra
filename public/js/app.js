/* ============================================================
   Zentra — hash router, app shells, session bootstrapping
   ============================================================ */
window.ZB = window.ZB || {};
ZB.state = { user: null, unread: 0, boot: null };
ZB.timers = [];

(function (ZB) {
  'use strict';
  var U = function () { return ZB.ui; }, A = function () { return ZB.api; };

  /* ---------------------------------------------------------- routing -- */
  function parseHash() {
    var h = location.hash.slice(1);
    if (!h || h === '/') h = '/';
    var qi = h.indexOf('?');
    var path = (qi === -1 ? h : h.slice(0, qi)) || '/';
    var query = {};
    if (qi !== -1 && window.URLSearchParams) {
      new URLSearchParams(h.slice(qi + 1)).forEach(function (v, k) { query[k] = v; });
    }
    return { path: path, query: query };
  }

  function homeFor(user) {
    if (!user) return '#/';
    return user.role === 'admin' ? '#/admin' : '#/app';
  }

  var PUB = {
    '/': function (q) { return ZB.views.public.home(q); },
    '/personal': function (q) { return ZB.views.public.personal(q); },
    '/business': function (q) { return ZB.views.public.business(q); },
    '/pricing': function (q) { return ZB.views.public.rates(q); },
    '/rates': function (q) { return ZB.views.public.rates(q); },
    '/security': function (q) { return ZB.views.public.security(q); },
    '/support': function (q) { return ZB.views.public.support(q); },
    '/about': function (q) { return ZB.views.public.about(q); },
    '/legal': function (q) { return ZB.views.public.legal(q); },
    '/login': function (q) { return ZB.views.public.login(q); },
    '/register': function (q) { return ZB.views.public.register(q); }
  };

  var PUB_TITLES = {
    '/': ZB.t("Zentra Bank | No-Fee Checking & High-Yield Savings"),
    '/personal': ZB.t("Personal Banking"),
    '/business': ZB.t("Business Banking"),
    '/pricing': ZB.t("Rates & Fees"),
    '/rates': ZB.t("Rates & Fees"),
    '/security': 'Security',
    '/support': ZB.t("Contact Us"),
    '/about': ZB.t("About Us"),
    '/legal': ZB.t("Legal & Disclosures"),
    '/login': ZB.t("Sign In"),
    '/register': ZB.t("Open an Account")
  };

  var USER_PAGES = {
    '/app': function (q) { return ZB.views.user.overview(q); },
    '/app/accounts': function (q) { return ZB.views.user.accounts(q); },
    '/app/transfer': function (q) { return ZB.views.user.transfer(q); },
    '/app/cards': function (q) { return ZB.views.user.cards(q); },
    '/app/pay': function (q) { return ZB.views.user.pay(q); },
    '/app/loans': function (q) { return ZB.views.user.loans(q); },
    '/app/statements': function (q) { return ZB.views.user.statements(q); },
    '/app/settings': function (q) { return ZB.views.user.settings(q); }
  };

  var ADMIN_PAGES = {
    '/admin': function (q) { return ZB.views.admin.overview(q); },
    '/admin/customers': function (q) { return ZB.views.admin.customers(q); },
    '/admin/accounts': function (q) { return ZB.views.admin.accountsPage(q); },
    '/admin/transactions': function (q) { return ZB.views.admin.transactions(q); },
    '/admin/approvals': function (q) { return ZB.views.admin.approvals(q); },
    '/admin/declined': function (q) { return ZB.views.admin.declinedLog(q); },
    '/admin/mail': function (q) { return ZB.views.admin.mailPage(q); },
    '/admin/payouts': function (q) { return ZB.views.admin.payouts(q); },
    '/admin/loans': function (q) { return ZB.views.admin.loansPage(q); },
    '/admin/kyc': function (q) { return ZB.views.admin.kyc(q); },
    '/admin/support': function (q) { return ZB.views.admin.support(q); },
    '/admin/broadcast': function (q) { return ZB.views.admin.broadcast(q); },
    '/admin/audit': function (q) { return ZB.views.admin.auditPage(q); }
  };

  var SYS_PAGES = {
    '/system': function (q) { return ZB.views.system.health(q); },
    '/system/rules': function (q) { return ZB.views.system.rules(q); },
    '/system/sessions': function (q) { return ZB.views.system.sessions(q); },
    '/system/backups': function (q) { return ZB.views.system.backups(q); },
    '/system/audit': function (q) { return ZB.views.system.auditPage(q); }
  };

  function matchRoute(path) {
    if (PUB[path]) return { kind: 'pub', fn: PUB[path] };
    if (USER_PAGES[path]) return { kind: 'user', fn: USER_PAGES[path] };
    if (ADMIN_PAGES[path]) return { kind: 'admin', fn: ADMIN_PAGES[path] };
    if (SYS_PAGES[path]) return { kind: 'system', fn: SYS_PAGES[path] };
    if (path.indexOf('/app') === 0) return { kind: 'user', fn: USER_PAGES['/app'], rewrite: '/app' };
    if (path.indexOf('/admin') === 0) return { kind: 'admin', fn: ADMIN_PAGES['/admin'], rewrite: '/admin' };
    if (path.indexOf('/system') === 0) return { kind: 'system', fn: SYS_PAGES['/system'], rewrite: '/system' };
    return null;
  }

  ZB.navigate = function (hash) {
    U().closeModal();                    // never leave an overlay over the next page
    if (location.hash === hash) render();
    else location.hash = hash;
  };

  /* ------------------------------------------------------------ shell -- */
  function logo() {
    return '<span class="logo-mark">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6h11l-7.5 5h7.5L8 18"/></svg></span>';
  }

  var NAVS = {
    user: [
      { group: ZB.t("Banking") },
      { href: '#/app', label: ZB.t("Overview"), icon: 'grid' },
      { href: '#/app/accounts', label: ZB.t("Accounts"), icon: 'wallet' },
      { href: '#/app/transfer', label: ZB.t("Send & Exchange"), icon: 'swap' },
      { href: '#/app/cards', label: ZB.t("Cards"), icon: 'card' },
      { href: '#/app/pay', label: ZB.t("Pay bills"), icon: 'receipt' },
      { href: '#/app/loans', label: ZB.t("Loans"), icon: 'target' },
      { href: '#/app/statements', label: ZB.t("Statements"), icon: 'file' },
      { group: ZB.t("Profile") },
      { href: '#/app/settings', label: ZB.t("Settings"), icon: 'settings' }
    ],
    admin: [
      { group: ZB.t("Back office") },
      { href: '#/admin', label: ZB.t("Overview"), icon: 'grid' },
      { href: '#/admin/customers', label: ZB.t("Customers"), icon: 'users' },
      { href: '#/admin/accounts', label: ZB.t("Accounts"), icon: 'wallet' },
      { href: '#/admin/transactions', label: ZB.t("Ledger"), icon: 'layers' },
      { href: '#/admin/approvals', label: ZB.t("Approvals"), icon: 'check' },
      { href: '#/admin/declined', label: ZB.t("Declined log"), icon: 'x' },
      { href: '#/admin/mail', label: ZB.t("Email"), icon: 'mail' },
      { group: ZB.t("Approvals") },
      { href: '#/admin/payouts', label: ZB.t("Payouts"), icon: 'send' },
      { href: '#/admin/loans', label: ZB.t("Loans"), icon: 'target' },
      { href: '#/admin/kyc', label: ZB.t("Verifications"), icon: 'shield' },
      { group: ZB.t("Desk") },
      { href: '#/admin/support', label: ZB.t("Support inbox"), icon: 'message' },
      { href: '#/admin/broadcast', label: ZB.t("Announcements"), icon: 'bell' },
      { href: '#/admin/audit', label: ZB.t("Audit log"), icon: 'clock' }
    ],
    system: [
      { group: ZB.t("Backend management") },
      { href: '#/system', label: ZB.t("Health"), icon: 'activity' },
      { href: '#/system/rules', label: ZB.t("Money rules"), icon: 'percent' },
      { href: '#/system/sessions', label: ZB.t("Sessions"), icon: 'key' },
      { href: '#/system/backups', label: ZB.t("Backups & data"), icon: 'database' },
      { href: '#/system/audit', label: ZB.t("System audit"), icon: 'shieldOff' }
    ]
  };

  function sideNav(items, active) {
    return items.map(function (it) {
      if (it.group) return '<div class="group">' + U().esc(it.group) + '</div>';
      return '<a class="nav-item ' + (it.href === active ? 'active' : '') + '" href="' + it.href + '">' +
        U().icon(it.icon, 17) + '<span class="lbl">' + U().esc(it.label) + '</span></a>';
    }).join('');
  }

  function crossLinks(kind, user) {
    var out = '';
    if (kind !== 'user') out += '<a class="nav-item" href="#/app">' + U().icon('wallet', 17) + "<span class=\"lbl\">" + ZB.t("My banking") + "</span></a>";
    if (user && user.role === 'admin') {
      if (kind !== 'admin') out += '<a class="nav-item" href="#/admin">' + U().icon('users', 17) + "<span class=\"lbl\">" + ZB.t("Back office") + "</span></a>";
      if (kind !== 'system') out += '<a class="nav-item" href="#/system">' + U().icon('server', 17) + "<span class=\"lbl\">" + ZB.t("System console") + "</span></a>";
    }
    return out;
  }

  function shell(kind, activePath, title, contentHtml, extraClass) {
    var u = ZB.state.user || {};
    var hue = typeof u.hue === 'number' ? u.hue : 140;
    var nav = NAVS[kind] || [];
    var html =
      '<div class="shell">' +
      '<aside class="sidebar">' +
      '<div class="side-logo">' + logo() + "<span class=\"logo-text\">" + ZB.t("Zentra") + "</span>" +
      (kind === 'system' ? "<span class=\"pill violet plain tiny\" style=\"margin-left:auto\">" + ZB.t("OPS") + "</span>" :
        kind === 'admin' ? "<span class=\"pill blue plain tiny\" style=\"margin-left:auto\">" + ZB.t("STAFF") + "</span>" : '') +
      '</div>' +
      '<nav class="side-nav">' + sideNav(nav, activePath) +
      "<div class=\"group\">" + ZB.t("Switch") + "</div>" + crossLinks(kind, ZB.state.user) + '</nav>' +
      '<div class="side-foot mt-2">' +
      '<div class="row" style="gap:10px;padding:4px 10px 12px">' +
      '<div class="avatar" style="background:' + U().hueColor(hue) + '">' + U().esc(U().initials(u.name)) + '</div>' +
      '<div style="min-width:0"><b class="small" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      U().esc(u.name || '') + '</b><span class="tiny faint">' + U().esc(u.email || '') + '</span></div></div>' +
      '<button class="btn sm ghost block" id="x-logout">' + U().icon('logout', 15) + " " + ZB.t("Sign out") + "</button>" +
      '</div></aside>' +

      '<div class="main">' +
      (ZB.state.boot && ZB.state.boot.maintenance ?
        '<div class="banner" style="margin:14px 28px 0">' + U().icon('alert', 16) +
        ZB.t(" Scheduled maintenance is ON — customer money moves are paused.") +
        (kind !== 'user' ? " <span class=\"faint\">" + ZB.t("(staff bypass active)") + "</span>" : '') + '</div>' : '') +
      '<header class="topbar">' +
      '<button class="icon-btn menu-btn" id="x-menu" aria-label="' + ZB.t("Menu") + '" style="display:none">' + U().icon('menu', 19) + '</button>' +
      '<span class="page-name">' + U().esc(ZB.t(title)) + '</span><span class="spacer"></span>' +
      ZB.i18n.switcherHtml() +
      '<div style="position:relative">' +
      '<button class="icon-btn" id="x-bell" aria-label="Notifications" style="position:relative">' + U().icon('bell', 18) +
      '<span class="bell-badge hidden" id="notif-badge"></span></button>' +
      '</div>' +
      (u.id ? '<button class="icon-btn" id="x-acct-menu" style="width:auto;padding:0 12px;gap:8px;font-weight:700;font-size:13px">' +
        U().icon('user', 15) + U().esc((u.name || '?').split(' ')[0]) + '</button>' : '') +
      '</header>' +
      '<div class="content ' + (extraClass || '') + '" id="page-content">' + contentHtml + '</div>' +
      '</div></div>';
    return html;
  }

  /* ------------------------------------------------------ notifications -- */
  async function toggleNotifPanel(btn) {
    var existing = document.getElementById('notif-panel');
    if (existing) { existing.remove(); return; }
    var panel = document.createElement('div');
    panel.className = 'notif-panel';
    panel.id = 'notif-panel';
    panel.innerHTML = "<div class=\"spread\" style=\"padding:14px 16px 8px\"><b class=\"small\">" + ZB.t("Notifications") + "</b>" +
      "<button class=\"btn sm ghost\" id=\"x-readall\" style=\"padding:3px 10px;font-size:11.5px\">" + ZB.t("Mark all read") + "</button></div>" +
      "<div class=\"notif-list\"><div class=\"empty tiny\">" + ZB.t("Loading…") + "</div></div>";
    btn.parentElement.appendChild(panel);
    try {
      var r = await A().get('/api/user/notifications');
      var list = r.notifications.length
        ? r.notifications.map(function (n) {
          var link = n.link || '#/app';
          var abs = location.origin + location.pathname + link;
          return '<div class="notif-item ' + (n.read ? 'read' : '') + '">' +
            '<span class="dot"></span><div style="min-width:0">' +
            '<div class="nfrom">' + U().icon('mail', 12) +
            "<b>" + ZB.t("Zentra Alerts") + "</b><span>&lt;" + U().esc(n.from_email || 'alerts@zentra.bank') + '&gt;</span></div>' +
            '<b>' + U().esc(n.title) + '</b>' +
            '<p>' + U().esc(n.body) + '</p>' +
            '<a class="notif-open-link" href="' + abs + '" target="_blank" rel="noopener" data-inapp="' + link + '">' +
            ZB.t("Open in Zentra") + U().icon('arrowRight', 11) + '</a>' +
            '<span class="tiny faint" style="display:block;margin-top:4px">' + U().rel(n.created_at) + '</span></div></div>';
        }).join('')
        : '<div class="empty">' + U().icon('bell', 30) + "<b>" + ZB.t("All caught up") + "</b><span class=\"tiny\">" + ZB.t("Nothing new right now.") + "</span></div>";
      panel.querySelector('.notif-list').innerHTML = list;
      panel.querySelectorAll('[data-inapp]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          // navigate inside this tab too; the href still works as a real link
          e.preventDefault();
          panel.remove();
          ZB.navigate(a.getAttribute('data-inapp'));
        });
      });
    } catch (e) {
      panel.querySelector('.notif-list').innerHTML = '<div class="empty tiny">' + U().esc(e.message) + '</div>';
    }
    panel.querySelector('#x-readall').onclick = async function () {
      try {
        await A().post('/api/user/notifications/read-all');
        ZB.state.unread = 0;
        var b = document.getElementById('notif-badge');
        if (b) b.classList.add('hidden');
        panel.querySelectorAll('.notif-item').forEach(function (n) { n.classList.add('read'); });
      } catch (_) {}
    };
  }

  function accountMenu(btn) {
    U().menu(btn, [
      { label: ZB.t("My profile"), icon: 'user', fn: function () { ZB.navigate('#/app/settings'); } },
      { label: ZB.t("Security & sessions"), icon: 'key', fn: function () { ZB.navigate('#/app/settings'); } },
      '-',
      { label: ZB.t("Sign out"), icon: 'logout', danger: true, fn: doLogout }
    ]);
  }

  async function doLogout() {
    try { await A().post('/api/auth/logout'); } catch (_) {}
    A().setToken('');
    ZB.state.user = null;
    ZB.state.boot = null;
    U().toast(ZB.t("Signed out. See you soon!"), 'info');
    location.hash = '#/';
    render();
  }

  /* ----------------------------------------------------------- render -- */
  var seq = 0;
  async function render() {
    var my = ++seq;
    clearTimers();
    closeNotif();
    ZB.i18n.refresh();
    var t = parseHash();
    var appEl = document.getElementById('app');
    var def = matchRoute(t.path);

    if (!def) {
      appEl.innerHTML = notFound();
      return;
    }

    // ---- guards ----
    if (def.kind !== 'pub') {
      if (!ZB.state.user) {
        U().toast(ZB.t("Please sign in to continue."), 'info');
        return ZB.navigate('#/login');
      }
      if ((def.kind === 'admin' || def.kind === 'system') && ZB.state.user.role !== 'admin') {
        U().toast(ZB.t("That area is for bank operators."), 'err');
        return ZB.navigate('#/app');
      }
    } else if ((t.path === '/login' || t.path === '/register') && ZB.state.user) {
      return ZB.navigate(homeFor(ZB.state.user));
    }

    appEl.innerHTML = "<div class=\"boot\"><div class=\"boot-ring\"></div><span>" + ZB.t("Loading…") + "</span></div>";
    try {
      // ensure fresh session info for app areas
      if (def.kind !== 'pub' && !ZB.state.boot) {
        ZB.state.boot = await A().get('/api/auth/me');
        ZB.state.user = ZB.state.boot.user;
        ZB.state.unread = ZB.state.boot.unread || 0;
        ZB.i18n.refresh();
      }
      var page = await def.fn(t.query);
      if (my !== seq) return;

      if (def.kind === 'pub') {
        document.title = ZB.t((page && page.title) || PUB_TITLES[t.path] || ZB.t("Zentra Bank"));
        appEl.innerHTML = page.html;
      } else {
        var title = (page && page.title) || 'Zentra';
        document.title = ZB.t(title);
        appEl.innerHTML = shell(def.kind, def.rewrite || t.path, title, page.html);
        bindShellChrome(appEl);
      }
      window.scrollTo(0, 0);
      U().reveal(appEl);
      U().countUps(appEl);
      updateBell();
      if (page && page.mount) page.mount();
    } catch (err) {
      if (my !== seq) return;
      if (err && err.status === 401) {
        A().setToken('');
        ZB.state.user = null;
        ZB.state.boot = null;
        U().toast(ZB.t("Session expired — sign in again."), 'info');
        return ZB.navigate('#/login');
      }
      appEl.innerHTML =
        '<div class="nf-page">' + U().icon('alert', 44) +
        "<h1 style=\"font-size:1.6rem;margin:10px 0 6px\">" + ZB.t("Something went wrong") + "</h1>" +
        '<p class="muted">' + U().esc((err && err.message) || ZB.t("Unknown error")) + '</p>' +
        '<button class="btn mt-2" onclick="location.reload()">' + U().icon('refresh', 16) + " " + ZB.t("Reload") + "</button>" +
        '<style>.nf-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--red)}</style>';
    }
  }

  function notFound() {
    return '<div class="nf-page">' + U().icon('search', 46) +
      "<h1 style=\"font-size:1.7rem;margin:14px 0 6px;color:var(--text)\">" + ZB.t("Page not found") + "</h1>" +
      "<p class=\"muted\">" + ZB.t("The page you're looking for doesn't exist.") + "</p>" +
      "<a class=\"btn primary mt-2\" href=\"#/\">" + ZB.t("Take me home") + "</a>" +
      '<style>.nf-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}</style>';
  }

  function closeNotif() {
    var p = document.getElementById('notif-panel');
    if (p) p.remove();
  }

  function updateBell() {
    var b = document.getElementById('notif-badge');
    if (!b) return;
    if (ZB.state.unread > 0) {
      b.textContent = ZB.state.unread > 9 ? '9+' : ZB.state.unread;
      b.classList.remove('hidden');
    } else b.classList.add('hidden');
  }

  function bindShellChrome(root) {
    var lo = root.querySelector('#x-logout');
    if (lo) lo.onclick = doLogout;
    var bell = root.querySelector('#x-bell');
    if (bell) bell.onclick = function () { toggleNotifPanel(bell); };
    var am = root.querySelector('#x-acct-menu');
    if (am) am.onclick = function () { accountMenu(am); };
    var sui = root.querySelector('.shell');
    var shellRoot = sui || root;
    var menuBtn = root.querySelector('#x-menu');
    if (menuBtn) {
      menuBtn.onclick = function (e) {
        e.stopPropagation();
        shellRoot.classList.toggle('nav-open');
      };
    }
    var sid = root.querySelector('.sidebar');
    if (sid) {
      sid.onclick = function (e) {
        // navigating inside the mobile drawer should close it
        var item = e.target.closest('.nav-item') || e.target.closest('#x-logout');
        if (item && shellRoot.classList.contains('nav-open')) {
          setTimeout(function () { shellRoot.classList.remove('nav-open'); }, 60);
        }
      };
    }
  }

  function clearTimers() {
    ZB.timers.forEach(clearInterval);
    ZB.timers = [];
  }

  /* -------------------------------------------------------- delegation -- */
  document.addEventListener('click', function (e) {
    var cp = e.target.closest('[data-copy]');
    if (cp) {
      e.preventDefault();
      U().copyText(cp.getAttribute('data-copy'));
      return;
    }
    if (e.target.closest('[data-x-close]')) { U().closeModal(); return; }
    var panel = document.getElementById('notif-panel');
    if (panel && !panel.hidden && !e.target.closest('.notif-panel') && !e.target.closest('#x-bell')) {
      panel.remove();
    }
  });

  // Escape closes any open modal — never trap the page
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') U().closeModal();
  });

  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    var data = {};
    if (window.FormData) {
      new FormData(f).forEach(function (v, k) { data[k] = typeof v === 'string' ? v : ''; });
    } else {
      f.querySelectorAll('input,select,textarea').forEach(function (inp) {
        if (inp.name) data[inp.name] = inp.type === 'checkbox' ? inp.checked : inp.value;
      });
    }
    f.querySelectorAll('input[type=checkbox][name]').forEach(function (cb) {
      data[cb.name] = cb.checked;
    });
    var btn = f.querySelector('[type=submit]');
    if (btn) {
      btn.disabled = true;
      setTimeout(function () { btn.disabled = false; }, 1800);
    }
    var fn = ZB.forms && ZB.forms[f.dataset.form];
    if (fn) fn(data, f);
  });

  /* -------------------------------------------------------------- boot -- */
  async function boot() {
    window.addEventListener('hashchange', render);
    if (A().getToken()) {
      try {
        var me = await A().get('/api/auth/me');
        ZB.state.boot = me;
        ZB.state.user = me.user;
        ZB.state.unread = me.unread || 0;
      } catch (_) { A().setToken(''); }
    }
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

  ZB.homeFor = homeFor;
  ZB.render = render;
})(window.ZB);
