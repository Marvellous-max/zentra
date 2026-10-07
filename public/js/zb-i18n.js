/* ============================================================
   Zentra i18n — locale resolution, translation, language switch
   ============================================================ */
window.ZB = window.ZB || {};

(function (ZB) {
  'use strict';

  ZB.LOCALES = ZB.LOCALES || {};

  var STORE_KEY = 'zb_lang';
  var LANGS = { en: 'English', ko: '한국어' };

  function normalize(l) {
    l = String(l == null ? '' : l).toLowerCase();
    if (l === 'ko' || l.indexOf('ko-') === 0 || l.indexOf('ko_') === 0) return 'ko';
    if (l === 'en' || l.indexOf('en-') === 0 || l.indexOf('en_') === 0) return 'en';
    return null;
  }

  /* localStorage → saved account preference → browser language → English */
  function resolve() {
    var stored = null;
    try { stored = normalize(localStorage.getItem(STORE_KEY)); } catch (e) {}
    if (stored) return stored;
    var u = ZB.state && ZB.state.user;
    var pref = u && u.prefs && normalize(u.prefs.lang);
    if (pref) return pref;
    var nav = navigator.language || navigator.userLanguage || 'en';
    return normalize(nav) || 'en';
  }

  function refresh() {
    ZB.lang = resolve();
    applyDocumentLang();
    return ZB.lang;
  }

  function applyDocumentLang() {
    if (document.documentElement) {
      document.documentElement.setAttribute('lang', ZB.lang === 'ko' ? 'ko' : 'en');
    }
  }

  /* The English string is both the key and the default: a missing
     translation returns the key itself, never a blank or `undefined`. */
  function t(key, vars) {
    if (key == null) return '';
    var table = ZB.LOCALES[ZB.lang] || {};
    var s = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key;
    if (vars) {
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) {
          s = s.split('{' + k + '}').join(String(vars[k]));
        }
      }
    }
    return s;
  }

  function persistPrefs(lang) {
    var u = ZB.state && ZB.state.user;
    if (!u || !ZB.api || !ZB.api.put) return;
    var prefs = {};
    var cur = u.prefs || {};
    for (var k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) prefs[k] = cur[k];
    prefs.lang = lang;
    ZB.api.put('/api/user/profile', { prefs: prefs })
      .then(function (r) { if (r && r.user) ZB.state.user = r.user; })
      .catch(function () {});
  }

  function setLang(lang) {
    lang = normalize(lang) || 'en';
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
    ZB.lang = lang;
    applyDocumentLang();
    persistPrefs(lang);
    if (ZB.render) ZB.render();
  }

  function otherLang() { return ZB.lang === 'ko' ? 'en' : 'ko'; }

  function switcherHtml() {
    var other = otherLang();
    return '<button type="button" class="lang-switch" data-lang="' + other + '" ' +
      'aria-label="Language: ' + LANGS[ZB.lang] + '" title="' + LANGS[ZB.lang] + '">' +
      LANGS[other] + '</button>';
  }

  ZB.lang = 'en';
  ZB.i18n = {
    t: t, setLang: setLang, refresh: refresh, resolve: resolve,
    switcherHtml: switcherHtml, otherLang: otherLang, LANGS: LANGS
  };
  ZB.t = t;

  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== document) {
      if (el.getAttribute && el.getAttribute('data-lang') !== null) {
        e.preventDefault();
        setLang(el.getAttribute('data-lang'));
        return;
      }
      el = el.parentNode;
    }
  });

  refresh();
})(window.ZB);
