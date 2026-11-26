/* Doukkany /start/: our own anonymous counter (owner, 2026-11-26: "Every visitor, anonymous",
 * "Only /start/ funnel"). Sends the funnel events to the Doukkany server (Supabase function
 * site-events) for the Admin "Website" page. Used by start/app.js and tests/counter.test.js.
 *
 * What it sends: a random visit id that lives only in this page's memory (a reload = a new
 * visit; nothing is saved on the device, no cookie), the event name and fixed choices (screen,
 * shop type, answer, offer, button, page language, phone/PC, ad campaign words from the link).
 * Never: a name, a phone number, an email, the "other" shop text. Only on the real site.
 * It never slows the page: errors are ignored and nothing is retried.
 */
(function (root) {
  'use strict';

  var URL_PROD = 'https://clseghjxpmlutwrrvmrf.supabase.co/functions/v1/site-events';

  // The only details sent (the server refuses any other one).
  var KEYS = ['funnel_step', 'step_number', 'intention', 'activity', 'pain', 'selected', 'pain_count',
    'device_count', 'license_type', 'platform', 'method', 'link_type', 'download_trigger', 'app_version',
    'tutorial_id', 'tutorial_category', 'tutorial_position', 'page_language', 'from_language',
    'to_language', 'device'];
  var AD = { utm_source: 'ad_source', utm_medium: 'ad_medium', utm_campaign: 'ad_campaign', utm_content: 'ad_content' };

  // Same rule as the server: short, no markup, nothing like an email or a phone number.
  function campaignText(v) {
    return typeof v === 'string' && v.length >= 1 && v.length <= 100 &&
      !/[\u0000-\u001f\u007f<>"\\@]/.test(v) && !/\d{8,}/.test(v.replace(/[\s.\-()\/+]/g, ''));
  }

  // utm_* words of the page address, cleaned. `search` = location.search.
  function campaignFrom(search) {
    var out = {};
    var q;
    try { q = new URLSearchParams(search || ''); } catch (e) { return out; }
    Object.keys(AD).forEach(function (k) {
      var v = q.get(k);
      v = v == null ? '' : String(v).trim();
      if (campaignText(v)) out[AD[k]] = v;
    });
    return out;
  }

  function uuid(cryptoObj) {
    var c = cryptoObj || (typeof crypto !== 'undefined' ? crypto : null);
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    var b = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* opts: { on: boolean, url, internal: boolean, base: function () -> details for every event
   *         (language, device, campaign), post: function (url, body, leaving) }
   * Returns { count(name, params), flush(leaving), visitId, pending() }. */
  function createCounter(opts) {
    var visitId = uuid();
    var queue = [];
    var timer = null;

    function clean(params) {
      var out = {};
      var base = opts.base ? opts.base() : {};
      Object.keys(base).forEach(function (k) { if (base[k] != null) out[k] = base[k]; });
      params = params || {};
      KEYS.forEach(function (k) {
        var v = params[k];
        if (v === undefined || v === null) return;
        if (typeof v === 'string' && (v.length > 100 || v.indexOf('@') !== -1)) return;
        if (typeof v === 'number' && !isFinite(v)) return;
        out[k] = v;
      });
      return out;
    }

    function flush(leaving) {
      if (timer) { clearTimeout(timer); timer = null; }
      while (queue.length) {
        var body = JSON.stringify({ visit_id: visitId, internal: !!opts.internal, events: queue.splice(0, 30) });
        try { opts.post(opts.url || URL_PROD, body, !!leaving); } catch (e) {}
      }
    }

    function count(name, params) {
      if (!opts.on) return;
      queue.push({ event_id: uuid(), event: name, details: clean(params) });
      if (queue.length >= 20) flush(false);
      else if (!timer) timer = setTimeout(function () { timer = null; flush(false); }, 3000);
    }

    return { count: count, flush: flush, visitId: visitId, pending: function () { return queue.length; } };
  }

  // The browser way to send: text/plain (no preflight), no cookies, a beacon when leaving.
  function browserPost(url, body, leaving) {
    if (leaving && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
    }
    if (typeof fetch === 'function') {
      fetch(url, { method: 'POST', body: body, keepalive: true, credentials: 'omit',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(function () {});
    }
  }

  var COUNTER = { createCounter: createCounter, campaignFrom: campaignFrom, campaignText: campaignText,
    browserPost: browserPost, KEYS: KEYS, URL: URL_PROD, uuid: uuid };
  if (typeof module === 'object' && module.exports) module.exports = COUNTER;
  else root.DK_COUNTER = COUNTER;
})(this);
