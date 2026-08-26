/* ============================================================
   Zentra UI kit — icons, formatting, toasts, modals, SVG charts
   ============================================================ */
window.ZB = window.ZB || {};

(function (ZB) {
  'use strict';

  /* --------------------------------------------------------- escaping -- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ----------------------------------------------------------- icons --- */
  /* ------------------------------------------------ card network logos -- */
  function cardBrand(kind, h) {
    h = h || 18;
    if (kind === 'mastercard') {
      return '<svg height="' + h + '" viewBox="0 0 44 28" style="display:inline-block;vertical-align:middle">' +
        '<circle cx="15" cy="14" r="11" fill="#EB001B"/>' +
        '<circle cx="29" cy="14" r="11" fill="#F79E1B"/>' +
        '<path d="M22 5.6a11 11 0 0 1 0 16.8 11 11 0 0 1 0-16.8z" fill="#FF5F00"/>' +
        '</svg>';
    }
    // visa wordmark (skewed italic)
    return '<svg height="' + Math.round(h * 0.62) + '" viewBox="0 0 60 19" style="display:inline-block;vertical-align:middle">' +
      '<text x="0" y="15.5" font-family="Arial, Helvetica, sans-serif" font-size="18.5" ' +
      'font-style="italic" font-weight="900" letter-spacing="-1" fill="#FFFFFF">VISA</text></svg>';
  }

  var ICONS = {
    home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    wallet: '<path d="M3 7a2 2 0 012-2h13a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M16 12h5v4h-5a2 2 0 010-4z"/>',
    swap: '<path d="M7 10h11l-3.5-3.5"/><path d="M17 15H6l3.5 3.5"/>',
    card: '<rect x="2.5" y="5.5" width="19" height="13.5" rx="2.5"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/>',
    receipt: '<path d="M6 3h12v18l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4z"/><path d="M9.5 8h5M9.5 12h5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9.5 13h5M9.5 17h5"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1 2.6a6.8 6.8 0 012.3 1l2.7-.6 1.7 3-2 1.9a7 7 0 010 2.6l2 1.9-1.7 3-2.7-.6a6.8 6.8 0 01-2.3 1l-1 2.6h-3.4"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 4.6a3.5 3.5 0 010 7M17.5 14.9c2 .7 3.5 2.3 3.5 5.1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.4 4.1-5 7.5-5s6.3 1.6 7.5 5"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    send: '<path d="M21 3L10.5 13.5"/><path d="M21 3l-6.8 18-3.7-7.5L3 9.8z"/>',
    download: '<path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5"/><path d="M4 19h16"/>',
    upload: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5"/><path d="M4 19h16"/>',
    shield: '<path d="M12 2.5l8 3.5v5.2c0 5-3.4 9.2-8 10.8-4.6-1.6-8-5.8-8-10.8V6z"/><path d="M8.8 12l2.3 2.3 4-4.6"/>',
    bell: '<path d="M6 9.5a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19.5a2.2 2.2 0 004 0"/>',
    logout: '<path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3"/><path d="M15 8l4 4-4 4M19 12H9.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronLeft: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    chevronRight: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    arrowRight: '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0112 5c6.5 0 10 7 10 7a17.6 17.6 0 01-3.2 4M6.1 6.1A16.9 16.9 0 002 12s3.5 7 10 7a10 10 0 004.3-1"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
    snow: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/><path d="M12 6l-2.5-2M12 6l2.5-2M12 18l-2.5 2M12 18l2.5 2"/>',
    zap: '<path d="M13 2L4.5 13.5H11L9.5 22 19 10h-6.5z"/>',
    droplet: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 01-13 0C5.5 10 12 3 12 3z"/>',
    wifi: '<path d="M2.5 9.5a14 14 0 0119 0M5.5 13a9.5 9.5 0 0113 0M8.7 16.4a5 5 0 016.6 0"/><circle cx="12" cy="19.6" r="1.3" fill="currentColor"/>',
    smartphone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    shieldOff: '<path d="M12 2.5l8 3.5v5.2c0 5-3.4 9.2-8 10.8-4.6-1.6-8-5.8-8-10.8V6z"/><path d="M9 9l6 6M15 9l-6 6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>',
    key: '<circle cx="8" cy="15.5" r="4.5"/><path d="M11.5 12L20 3.5M16 7.5l3 3M13.5 10l2 2"/>',
    refresh: '<path d="M20 12a8 8 0 10-2.3 5.6"/><path d="M20 12V6.5M20 12h-5.5" transform="rotate(45 12 12)"/>',
    trash: '<path d="M4 7h16M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
    edit: '<path d="M14.5 5.5l4 4L8 20H4v-4z"/><path d="M12.5 7.5l4 4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
    trendUp: '<path d="M3 17l6-6 4 4 8-8.5"/><path d="M15.5 6.5H21V12"/>',
    trendDown: '<path d="M3 7l6 6 4-4 8 8.5"/><path d="M15.5 17.5H21V12"/>',
    pie: '<path d="M12 3a9 9 0 109 9h-9z"/><path d="M14.5 2.8A9 9 0 0121.2 9.5H14.5z"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5"/><path d="M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12"/>',
    server: '<rect x="3.5" y="3.5" width="17" height="7" rx="2"/><rect x="3.5" y="13.5" width="17" height="7" rx="2"/><circle cx="8" cy="7" r=".9" fill="currentColor"/><circle cx="8" cy="17" r=".9" fill="currentColor"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    save: '<path d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M8 3v5h7V3M7 21v-7h10v7"/>',
    rotate: '<path d="M3 12a9 9 0 102.6-6.4"/><path d="M3 4v5h5"/>',
    cloudDown: '<path d="M7 18a4.5 4.5 0 01-.9-8.9 6 6 0 0111.7 1.4A3.8 3.8 0 0117.5 18z"/><path d="M12 12v7m0 0l-3-3m3 3l3-3"/>',
    cloudUp: '<path d="M7 18a4.5 4.5 0 01-.9-8.9 6 6 0 0111.7 1.4A3.8 3.8 0 0117.5 18z"/><path d="M12 19v-7m0 0l-3 3m3-3l3 3"/>',
    briefcase: '<rect x="3" y="7.5" width="18" height="13" rx="2"/><path d="M9 7.5V5.6A1.6 1.6 0 0110.6 4h2.8A1.6 1.6 0 0115 5.6v1.9"/><path d="M3 13h18"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="17" r="2.6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7.5l9 6 9-6"/>',
    message: '<path d="M21 12a8.5 8.5 0 01-8.5 8.5c-1.5 0-3-.4-4.2-1L3 21l1.6-4.6A8.5 8.5 0 1121 12z"/>',
    star: '<path d="M12 2.8l2.8 5.9 6.2.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.2-.8z"/>',
    heart: '<path d="M12 20.5S3.5 15 3.5 8.9A4.6 4.6 0 0112 6.4a4.6 4.6 0 018.5 2.5c0 6.1-8.5 11.6-8.5 11.6z"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5z"/><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.5h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    filter: '<path d="M3.5 5h17l-6.5 8v6l-4-2v-4z"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h5"/>',
    banknote: '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 12h.01M18 12h.01"/>',
    gauge: '<path d="M5 19a8.5 8.5 0 1114 0"/><path d="M12 13l3.5-4.5"/><circle cx="12" cy="14" r="1.6" fill="currentColor"/>',
    building: '<path d="M4 21V5.5A2.5 2.5 0 016.5 3h7A2.5 2.5 0 0116 5.5V21"/><path d="M16 9h2.5A2.5 2.5 0 0121 11.5V21"/><path d="M2.5 21h19"/><path d="M8 7.5h4M8 11h4M8 14.5h4"/>'
  };

  function icon(name, size, cls) {
    size = size || 18;
    return '<svg class="' + (cls || '') + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || ICONS.info) + '</svg>';
  }

  /* -------------------------------------------------------- formatting - */
  var fmtCache = {};
  function money(v, cur, opts) {
    cur = cur || 'USD';
    try {
      var k = cur + (opts && opts.noDec ? '-nd' : '');
      fmtCache[k] = fmtCache[k] || new Intl.NumberFormat('en-US', {
        style: 'currency', currency: cur,
        minimumFractionDigits: opts && opts.noDec ? 0 : 2,
        maximumFractionDigits: opts && opts.noDec ? 0 : 2
      });
      return fmtCache[k].format(v || 0);
    } catch (e) { return '$' + (Number(v) || 0).toFixed(2); }
  }
  function signedMoney(amount, cur) {
    var v = Number(amount) || 0;
    return (v > 0 ? '+' : '') + money(v, cur);
  }
  function compact(v, cur) {
    var n = Math.abs(Number(v) || 0);
    var sign = v < 0 ? '-' : '';
    var sym = { USD: '$', EUR: '€', GBP: '£' }[cur] || '$';
    if (n >= 1e9) return sign + sym + (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return sign + sym + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return sign + sym + (n / 1e3).toFixed(1) + 'k';
    return sign + sym + n.toFixed(0);
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function rel(ts) {
    var s = Math.max(1, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return dateShort(ts);
  }
  function dateShort(ts) {
    var d = new Date(ts);
    return MONTHS[d.getMonth()] + ' ' + d.getDate();
  }
  function dateTime(ts) {
    var d = new Date(ts);
    var h = d.getHours(), m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() +
      ' · ' + h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }
  function monthName(ym) { // "2024-06"
    var p = ym.split('-');
    return MONTHS[(+p[1]) - 1] + ' ' + p[0];
  }

  function hueColor(h) {
    return 'hsl(' + (h % 360) + ',72%,62%)';
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  /* ------------------------------------------------------------ toast -- */
  function toast(msg, type, ms) {
    type = type || 'ok';
    var stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = icon(type === 'err' ? 'alert' : type === 'info' ? 'info' : 'check', 17) +
      '<span>' + esc(msg) + '</span>';
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); }, 260);
    }, ms || 3400);
  }

  /* ------------------------------------------------------------ modal -- */
  function modal(html, opts) {
    opts = opts || {};
    closeModal();
    var ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.id = 'modal-ov';
    ov.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '">' + html + '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    document.body.appendChild(ov);
    var f = ov.querySelector('input,select,textarea');
    if (f) setTimeout(function () { f.focus(); }, 60);
    return ov;
  }
  function closeModal() {
    var ov = document.getElementById('modal-ov');
    if (ov) ov.remove();
  }
  function confirmBox(title, text, actionLabel, danger, onYes) {
    modal(
      '<div class="modal-head"><h3>' + esc(title) + '</h3></div>' +
      '<p class="muted" style="font-size:14px">' + esc(text) + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn ghost" data-x-close>Cancel</button>' +
      '<button class="btn ' + (danger ? 'danger' : 'primary') + '" id="cf-yes">' + esc(actionLabel) + '</button>' +
      '</div>');
    var ov = document.getElementById('modal-ov');
    ov.querySelector('[data-x-close]').onclick = closeModal;
    ov.querySelector('#cf-yes').onclick = function () { closeModal(); onYes(); };
  }

  function menu(anchorEl, items) {
    closeMenus();
    var m = document.createElement('div');
    m.className = 'menu';
    m.innerHTML = items.map(function (it, i) {
      if (it === '-') return '<hr>';
      return '<button data-mi="' + i + '" class="' + (it.danger ? 'danger' : '') + '">' +
        (it.icon ? icon(it.icon, 15) : '') + esc(it.label) + '</button>';
    }).join('');
    document.body.appendChild(m);
    var r = anchorEl.getBoundingClientRect();
    var mw = Math.min(230, window.innerWidth - 16);
    var left = Math.min(r.left, window.innerWidth - mw - 10);
    var bottomSpace = window.innerHeight - r.bottom;
    if (bottomSpace < 240) m.style.top = Math.max(10, r.top - 10 - 40 * items.length) + 'px';
    else m.style.top = (r.bottom + 8) + 'px';
    m.style.left = left + 'px';
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mi]');
      if (!b) return;
      closeMenus();
      var it = items[+b.dataset.mi];
      if (it && it.fn) it.fn();
    });
    setTimeout(function () {
      document.addEventListener('click', function h(e) {
        if (!m.contains(e.target)) { closeMenus(); document.removeEventListener('click', h); }
      });
    }, 0);
  }
  function closeMenus() {
    document.querySelectorAll('.menu').forEach(function (m) { m.remove(); });
  }

  /* ----------------------------------------------------------- charts -- */
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var p0 = pts[i - 1], p1 = pts[i];
      var mx = (p0[0] + p1[0]) / 2;
      d += ' C' + mx + ',' + p0[1] + ' ' + mx + ',' + p1[1] + ' ' + p1[0] + ',' + p1[1];
    }
    return d;
  }

  function areaChart(series, opts) {
    opts = opts || {};
    var w = opts.w || 600, h = opts.h || 180, pad = 6;
    var min = Math.min.apply(null, series), max = Math.max.apply(null, series);
    if (max === min) { max += 1; min -= 1; }
    var range = max - min;
    var stepX = (w - pad * 2) / Math.max(1, series.length - 1);
    var pts = series.map(function (v, i) {
      return [pad + i * stepX, h - pad - ((v - min) / range) * (h - pad * 2)];
    });
    var id = 'ag' + Math.random().toString(36).slice(2, 8);
    var line = smoothPath(pts);
    var fill = line + ' L' + pts[pts.length - 1][0] + ',' + (h - pad) +
      ' L' + pts[0][0] + ',' + (h - pad) + ' Z';
    var stroke = opts.stroke || '#0f62a8';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" ' +
      'style="width:100%;height:' + h + 'px">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + stroke + '" stop-opacity=".22"/>' +
      '<stop offset="100%" stop-color="' + stroke + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + fill + '" fill="url(#' + id + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + stroke + '" stroke-width="2.5" stroke-linecap="round"/>' +
      '</svg>';
  }

  function barsDual(labels, a, b, opt) {
    opt = opt || {};
    var c1 = opt.c1 || '#0f62a8', c2 = opt.c2 || '#7fb3dd';
    var w = opt.w || 620, h = opt.h || 190, pad = 24;
    var all = a.concat(b);
    var max = Math.max.apply(null, all.concat([1]));
    var n = labels.length;
    var slot = (w - pad * 2) / n;
    var bw = Math.min(14, slot / 2.8);
    var out = '';
    for (var i = 0; i < n; i++) {
      var cx = pad + slot * i + slot / 2;
      var ha = (a[i] / max) * (h - pad * 2);
      var hb = (b[i] / max) * (h - pad * 2);
      out += '<rect x="' + (cx - bw - 2) + '" y="' + (h - pad - ha) + '" width="' + bw + '" height="' + Math.max(ha, 2) +
        '" rx="3" fill="' + c1 + '"><title>In: ' + compact(a[i]) + '</title></rect>';
      out += '<rect x="' + (cx + 2) + '" y="' + (h - pad - hb) + '" width="' + bw + '" height="' + Math.max(hb, 2) +
        '" rx="3" fill="' + c2 + '"><title>Out: ' + compact(b[i]) + '</title></rect>';
      if (n <= 16 || i % 2 === 0) {
        out += '<text x="' + cx + '" y="' + (h - 7) + '" text-anchor="middle" font-size="9.5" fill="#52606d">' +
          labels[i] + '</text>';
      }
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto">' + out + '</svg>';
  }

  var DONUT_COLORS = ['#004977', '#117aca', '#5b9bd5', '#1e7e34', '#c05621', '#6b7c93'];
  function donut(segs, centerTop, centerSub) {
    var total = segs.reduce(function (s, x) { return s + x.value; }, 0);
    if (!total) return '<div class="empty tiny">No data yet</div>';
    var R = 52, C = 2 * Math.PI * R, off = 0, arcs = '';
    segs.forEach(function (sg, i) {
      var frac = sg.value / total;
      var len = frac * C;
      arcs += '<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="' + (sg.color || DONUT_COLORS[i % DONUT_COLORS.length]) +
        '" stroke-width="17" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) +
        '" stroke-linecap="butt"><title>' + esc(sg.label) + ': ' + compact(sg.value) + '</title></circle>';
      off += len;
    });
    return '<svg viewBox="0 0 140 140" style="width:150px;height:150px;margin:0 auto;display:block">' + arcs +
      '<text x="70" y="66" text-anchor="middle" font-size="15" font-weight="700" fill="#16283b">' + esc(centerTop) + '</text>' +
      '<text x="70" y="84" text-anchor="middle" font-size="9.5" fill="#52606d">' + esc(centerSub || '') + '</text></svg>';
  }

  function ringGauge(pct, color) {
    var R = 46, C = 2 * Math.PI * R;
    var len = Math.max(0, Math.min(100, pct)) / 100 * C;
    return '<svg viewBox="0 0 120 120" style="width:100%;height:100%">' +
      '<circle r="' + R + '" cx="60" cy="60" fill="none" stroke="#e3e8ee" stroke-width="10"/>' +
      '<circle r="' + R + '" cx="60" cy="60" fill="none" stroke="' + (color || '#0f62a8') +
      '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + len + ' ' + (C - len) + '"/>' +
      '</svg>';
  }

  function sparkline(series, color) {
    if (!series.length) return '';
    var w = 120, h = 34;
    var min = Math.min.apply(null, series), max = Math.max.apply(null, series);
    if (max === min) max += 1;
    var pts = series.map(function (v, i) {
      return [i / (series.length - 1) * w, h - ((v - min) / (max - min)) * (h - 6) - 3];
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:' + w + 'px;height:' + h + 'px">' +
      '<path d="' + smoothPath(pts) + '" fill="none" stroke="' + (color || '#0f62a8') +
      '" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  /* ------------------------------------------------------- animations -- */
  function reveal(root) {
    var els = (root || document).querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: .08 });
    els.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i * 45, 300) + 'ms';
      io.observe(el);
    });
  }

  function countUps(root) {
    (root || document).querySelectorAll('[data-count]').forEach(function (el) {
      var target = parseFloat(el.dataset.count);
      var prefix = el.dataset.prefix || '', suffix = el.dataset.suffix || '';
      var dec = parseInt(el.dataset.dec || '0', 10);
      if (!isFinite(target)) return;
      var t0 = null, dur = 1100;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + (target * eased).toLocaleString('en-US', {
          minimumFractionDigits: dec, maximumFractionDigits: dec
        }) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* ------------------------------------------------------------- misc -- */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copied to clipboard'); })
        .catch(function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied to clipboard'); }
    catch (e) { toast('Copy failed', 'err'); }
    ta.remove();
  }
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }
  function agoBadge(ts) { return '<span class="tiny faint">' + rel(ts) + '</span>'; }

  var TX_META = {
    deposit: { label: 'Deposit', dir: 'in', icon: 'download' },
    transfer_in: { label: 'Transfer in', dir: 'in', icon: 'send' },
    interest: { label: 'Interest', dir: 'in', icon: 'percent' },
    exchange_in: { label: 'Exchange', dir: 'in', icon: 'swap' },
    loan_disbursement: { label: 'Loan', dir: 'in', icon: 'banknote' },
    reversal: { label: 'Reversal', dir: 'neutral', icon: 'rotate' },
    adjustment: { label: 'Adjustment', dir: 'neutral', icon: 'edit' },
    transfer_out: { label: 'Transfer', dir: 'out', icon: 'send' },
    payment: { label: 'Payment', dir: 'out', icon: 'receipt' },
    fee: { label: 'Fee', dir: 'out', icon: 'receipt' },
    loan_payment: { label: 'Loan payment', dir: 'out', icon: 'banknote' },
    exchange_out: { label: 'Exchange', dir: 'out', icon: 'swap' }
  };

  function txRow(t, opts) {
    opts = opts || {};
    var meta = TX_META[t.type] || { label: t.type, dir: 'neutral', icon: 'info' };
    var isIn = t.amount > 0;
    var cls = meta.dir === 'in' || isIn ? 'in' : meta.dir === 'out' ? 'out' : 'neutral';
    var sub = [];
    if (opts.showAccount !== false && t.account_label) sub.push(t.account_label);
    if (t.note) sub.push(t.note);
    var statusPill = '';
    if (t.status === 'pending') statusPill = '<span class="pill amber plain">Pending</span>';
    else if (t.status === 'rejected') statusPill = '<span class="pill red plain">Rejected</span>';
    else if (t.status === 'reversed') statusPill = '<span class="pill gray plain">Reversed</span>';
    return '<div class="tx-row" ' + (opts.attr || '') + '>' +
      '<div class="tx-icon ' + cls + '">' + icon(meta.icon, 17) + '</div>' +
      '<div class="tx-main"><b>' + esc(t.counterparty || meta.label) + '</b>' +
      '<span>' + esc(sub.join(' · ').slice(0, 80)) + ' · ' + rel(t.created_at) + '</span></div>' +
      '<div class="tx-amt">' + statusPill +
      '<b class="' + (isIn ? 'up' : '') + '">' + signedMoney(t.amount, t.currency) + '</b>' +
      (opts.showRef ? '<span class="mono tiny">' + esc(t.ref) + '</span>' :
        '<span>' + esc(dateShort(t.created_at)) + '</span>') + '</div></div>';
  }

  function pillFor(status) {
    var map = {
      completed: 'green', active: 'green', verified: 'green', resolved: 'green', repaid: 'green',
      pending: 'amber', ordered: 'amber', open: 'amber',
      rejected: 'red', frozen: 'red', suspended: 'red',
      reversed: 'gray', unverified: 'gray'
    };
    var cls = map[status] || 'gray';
    return '<span class="pill ' + cls + '">' + esc(String(status).replace(/_/g, ' ')) + '</span>';
  }

  ZB.ui = {
    esc: esc, icon: icon, money: money, signedMoney: signedMoney, compact: compact,
    rel: rel, dateShort: dateShort, dateTime: dateTime, monthName: monthName,
    hueColor: hueColor, initials: initials,
    toast: toast, modal: modal, closeModal: closeModal, confirmBox: confirmBox,
    menu: menu, closeMenus: closeMenus,
    areaChart: areaChart, barsDual: barsDual, donut: donut, ringGauge: ringGauge, sparkline: sparkline,
    reveal: reveal, countUps: countUps, copyText: copyText, debounce: debounce,
    txRow: txRow, pillFor: pillFor, DONUT_COLORS: DONUT_COLORS,
    cardBrand: cardBrand
  };
})(window.ZB);
