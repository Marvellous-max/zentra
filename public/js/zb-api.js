/* ============================================================
   Zentra API client
   ============================================================ */
window.ZB = window.ZB || {};

(function (ZB) {
  'use strict';
  var KEY = 'zb_token';

  function getToken() { return localStorage.getItem(KEY) || ''; }
  function setToken(t) { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); }

  async function request(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var tok = getToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    var res;
    try {
      res = await fetch(path, {
        method: opts.method || 'GET', headers: headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
      });
    } catch (e) {
      throw new Error('Network error — is the Zentra server running?');
    }
    var data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      var err = new Error(data.error || ('Request failed (' + res.status + ')'));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  ZB.api = {
    get: function (p) { return request(p); },
    post: function (p, body) { return request(p, { method: 'POST', body: body || {} }); },
    put: function (p, body) { return request(p, { method: 'PUT', body: body || {} }); },
    del: function (p) { return request(p, { method: 'DELETE' }); },
    getToken: getToken, setToken: setToken,

    /** Download an authenticated file endpoint as a local blob. */
    download: async function (path, filename) {
      var headers = {};
      var tok = getToken();
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
      var res = await fetch(path, { headers: headers });
      if (!res.ok) throw new Error('Download failed (' + res.status + ')');
      var blob = await res.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename || 'download';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }
  };
})(window.ZB);
