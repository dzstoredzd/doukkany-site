/* Doukkany /start/ funnel: screens and actions.
 * Data and rules: funnel.js (shop types, problems, lessons, steps, FAQ order, checkout check),
 * ../js/offer.js (prices), ../js/lessons.js (the 25 videos), texts.js (words).
 * The answers stay in this browser (localStorage). The buyer's details stay in this tab
 * (sessionStorage) and leave it only in a "pay at delivery" order or a WhatsApp message the
 * visitor sends. Analytics never carry a name, a phone or an address, and never block a click. */
(function () {
  'use strict';
  var OFFER = window.DK_OFFER, LESSONS = window.DK_LESSONS, F = window.DK_FUNNEL, TEXT = window.DK_START_TEXT;
  var COUNTER = window.DK_COUNTER || null;
  var tracking = window.dkTracking || null;

  var WA_NUMBER = '213775452101'; // same as the app (kSupportPhone) and /download/
  var WA_SHOWN = '0775 45 21 01';
  // Who makes Doukkany (owner, 2026-11-27: shown on the page so shops know who they buy from).
  var DEV_NAME = 'Younes Mimene', DEV_EMAIL = 'younes.mimene@gmail.com';
  var PLAY_URL = 'https://play.google.com/store/apps/details?id=com.yousoft.doukkany';
  var RELEASE_PAGE = 'https://github.com/dzstoredzd/doukkany-releases/releases/latest';
  var FEED_URL = 'https://raw.githubusercontent.com/dzstoredzd/doukkany-releases/main/doukkany/stable/latest.json';
  var API_URL = 'https://api.github.com/repos/dzstoredzd/doukkany-releases/releases/latest';
  var STORE_KEY = 'dk-start-v1';
  var VERSION_KEY = 'dk-start-fv';

  var view = document.getElementById('view');
  var params = new URLSearchParams(location.search);
  var lang = 'ar';
  var t = TEXT.ar;
  var current = null;
  var depth = 0;          // our own history entries above the first one
  var journey = null;     // trial | buy | download | prices: what the visitor came to do

  function $(id) { return document.getElementById(id); }

  var DEVICE = (function () {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/windows/i.test(ua)) return 'windows';
    return 'other';
  })();
  var IS_PHONE = DEVICE === 'android' || DEVICE === 'ios';

  // The site that sent the visitor (host only, e.g. "m.facebook.com"; nothing when it is us).
  var REFERRER = (function () {
    try {
      var h = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : '';
      return h && h !== location.hostname && /^[a-z0-9.-]{1,100}$/.test(h) ? h : '';
    } catch (e) { return ''; }
  })();

  // ---------------------------------------------------------------------------------
  // Saved answers (owner brief §24): language, journey, shop type, problems, devices, last
  // screen. Never a name, a phone or an address (those live in the tab only, see `buyer`).
  // ---------------------------------------------------------------------------------
  var state = (function () {
    try { return F.cleanState(JSON.parse(localStorage.getItem(STORE_KEY) || 'null'), Date.now()); } catch (e) { return F.cleanState(null); }
  })();
  var hadProgress = !!(state.intent || state.activity || state.mode);
  // An ad or greeting link can pick the shop type, the intent, the devices, the version.
  var fromLink = F.linkAnswers(location.search);
  if (fromLink.activity) state.activity = fromLink.activity;
  if (fromLink.intent) state.intent = fromLink.intent;
  if (fromLink.mode) state.mode = fromLink.mode;
  // Funnel version: forced by ?fv=, else the one this device already got, else the default
  // (or the A/B split when one runs: funnel.js EXPERIMENT).
  (function () {
    var saved = null;
    try { saved = localStorage.getItem(VERSION_KEY); } catch (e) {}
    state.fv = F.pickVersion(saved, fromLink.fv);
    if (F.EXPERIMENT.split > 0 || fromLink.fv) { try { localStorage.setItem(VERSION_KEY, state.fv); } catch (e) {} }
  })();
  if (state.intent) journey = state.intent;
  function save() {
    state.at = Date.now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function reset() { var fv = state.fv; state = F.cleanState(null); state.fv = fv; save(); }

  // ---------------------------------------------------------------------------------
  // Analytics (owner brief §21). One place: track(). Our own anonymous counter (counter.js,
  // every visitor, no cookie) and Google Tag Manager (js/tracking.js; no consent bar since
  // 2026-11-28). A failed send never stops the page.
  // ---------------------------------------------------------------------------------
  var COUNTER_LIVE = location.hostname === 'yousoft.site';
  var ownCounter = (function () {
    if (!COUNTER) return null;
    var debug = !COUNTER_LIVE && params.get('dk_debug') === '1';
    var internal = false;
    try { internal = localStorage.getItem('dk_internal') === '1'; } catch (e) {}
    var ad = COUNTER.campaignFrom(location.search);
    var c = COUNTER.createCounter({
      on: COUNTER_LIVE || debug, internal: internal,
      base: function () {
        var b = { page_language: lang, device: DEVICE, funnel_version: state.fv };
        if (journey) b.journey = journey;
        if (REFERRER) b.referrer = REFERRER;
        Object.keys(ad).forEach(function (k) { b[k] = ad[k]; });
        return b;
      },
      post: COUNTER_LIVE ? COUNTER.browserPost : function (url, body) {
        (window.__dkCounterSent = window.__dkCounterSent || []).push(JSON.parse(body));
      }
    });
    function leave() { c.flush(true); }
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') leave(); });
    return c;
  })();

  // Our counter keeps the funnel's own names (the site-events server accepts only those).
  // Google Tag Manager (GA4 + Meta Pixel) gets the names of the event list in
  // DOUKKANY-MARKETING/migration/01-website-tracking.md, once each: gtmEvents() maps them.
  // Names with no entry here stay in our counter only.
  function ext(p, more) { var q = {}; Object.keys(p).forEach(function (k) { q[k] = p[k]; }); Object.keys(more).forEach(function (k) { q[k] = more[k]; }); return q; }
  var funnelStarted = false;
  function started(list) {
    if (funnelStarted) return list;
    funnelStarted = true;
    return [['sales_funnel_started', {}]].concat(list);
  }
  function gtmEvents(name, p) {
    switch (name) {
      case 'funnel_viewed': return [['sales_funnel_viewed', p]];
      case 'trial_journey_selected': return started([['intention_selected', ext(p, { intention: 'trial' })]]);
      case 'purchase_journey_selected': return started([['intention_selected', ext(p, { intention: 'buy' })]]);
      case 'direct_download_selected': return started([['intention_selected', ext(p, { intention: 'download' })]]);
      case 'offer_viewed': return started([['license_selected', p]]);
      case 'step_viewed': return [['funnel_step_viewed', p]];
      case 'challenges_selected': return [['pain_selected', p]];
      case 'video_played': return [['tutorial_clicked', p]];
      case 'download_clicked':
        return [[p.platform === 'android' ? 'google_play_clicked' : 'windows_download_clicked', ext(p, { download_trigger: 'button' })]];
      case 'whatsapp_clicked':
        return p.purpose === 'order' ?
          [['purchase_requested', ext(ext(p, priceParams(p.license_type)), { method: 'whatsapp' })], ['funnel_completed', { method: 'whatsapp_order', pay: p.pay, license_type: p.license_type }]] :
          [['whatsapp_support_clicked', ext(p, { method: p.purpose, link_type: 'whatsapp' })]];
      case 'activity_selected': case 'device_selected': case 'pricing_viewed':
      case 'download_link_shared': case 'download_link_copied': case 'download_email_app_opened':
      case 'language_changed':
        return [[name, p]];
      default: return [];
    }
  }
  // GTM only (names our counter does not have).
  function sendGtm(name, p, opts) {
    try {
      if (!tracking) return;
      var q = ext(p || {}, { funnel_version: state.fv });
      if (journey) q.journey = journey;
      tracking.track(name, q, opts);
    } catch (e) {}
  }
  function track(name, p) {
    p = p || {};
    try { if (ownCounter) ownCounter.count(name, p); } catch (e) {}
    gtmEvents(name, p).forEach(function (ev) { sendGtm(ev[0], ev[1]); });
  }
  // Some events only once per page load (opening the same FAQ twice is one open).
  var once = {};
  function trackOnce(key, name, p) { if (once[key]) return; once[key] = true; track(name, p); }
  function gtmOnce(key, name, p, opts) { if (once[key]) return; once[key] = true; sendGtm(name, p, opts); }
  // The price of the offer on screen, from js/offer.js (Meta ViewContent / InitiateCheckout / Lead value).
  function priceParams(type) {
    var plan = OFFER.plans[type];
    return plan ? { value: plan.price, currency: OFFER.currency, license_type: type } : {};
  }

  // ---------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fill(s, vars) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; }); }
  function ic(id, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function cic(id, color, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" style="color:' + color + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function money(n) { return '<bdi class="ltr">' + OFFER.format(n) + '</bdi>'; }
  // A price inside plain text (summaries, WhatsApp messages): kept left-to-right, else Arabic
  // text shows "14 000" as "000 14".
  function num(n) { return '⁦' + OFFER.format(n) + '⁩'; }
  var C = { win: '#0078D4', android: '#16A34A', both: '#7C3AED', blue: '#2563EB', green: '#16A34A',
    orange: '#EA580C', teal: '#0D9488', slate: '#475569', pink: '#DB2777', amber: '#D97706' };

  function devices() { return F.devices(state); }
  function rec() { var d = devices(); return d ? OFFER.recommend(d.pcs, d.phones) : { ok: false, reason: 'none' }; }
  function activityName() {
    var name = t.act[state.activity] || '';
    if (state.activity === 'other' && state.other) name += ': ' + state.other;
    return name;
  }
  function devName(mode) { return t.devName[mode || state.mode] || ''; }
  function offerName(r) { return r && r.ok ? t.plan[r.type][0] : ''; }
  // Every value in the price texts comes from js/offer.js.
  var PRICE_VARS = function () {
    return { phone: num(OFFER.plans.phone.price), pc: num(OFFER.plans.pc.price), shop: num(OFFER.plans.shop.price),
      delivery: num(OFFER.deliveryFee), days: OFFER.trialDays };
  };

  function waLink(text) { return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text); }
  function waButton(purpose, text, label, cls) {
    return '<a class="' + (cls || 'btn wa') + '" data-wa="' + purpose + '" href="' + esc(waLink(text)) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(label) + '</a>';
  }
  function campaignQuery(via) { try { return tracking ? tracking.campaignQuery(via) : ''; } catch (e) { return ''; } }
  function withCampaign(url, via) { var q = campaignQuery(via); return q ? url + (url.indexOf('?') === -1 ? '?' : '&') + q : url; }
  // Play gives `referrer` to the app on its first open (Play Install Referrer): campaign words,
  // and with ads consent only, dk_ads=1 + Meta's click id (js/tracking.js playReferrer).
  function playUrl() {
    var q = '';
    try { q = tracking && tracking.playReferrer ? tracking.playReferrer() : campaignQuery(); } catch (e) {}
    return q ? PLAY_URL + '&referrer=' + encodeURIComponent(q) : PLAY_URL;
  }
  // The same PC link as /download/'s "send the link to your PC": on a PC it starts the download.
  function winLink(via) { return withCampaign(new URL('../download/', location.href).href + '?get=windows&lang=' + lang, via); }

  // ---------------------------------------------------------------------------------
  // Navigation: one history entry per step, so the phone's Back button works.
  // ---------------------------------------------------------------------------------
  function stepFromHash() { return (location.hash || '').replace(/^#/, '') || 'welcome'; }

  function go(step, replace) {
    step = F.allowedStep(state, step);
    // A step left forwards is a step completed (the drop-off chart counts both).
    var from = F.progressIndex(current, state), to = F.progressIndex(step, state);
    if (current && from >= 0 && to > from) track('step_completed', { funnel_step: current, step_number: from + 1 });
    if (replace || step === current) history.replaceState({ dk: depth }, '', '#' + step);
    else { depth += 1; history.pushState({ dk: depth }, '', '#' + step); }
    render(step, true);
  }
  function back() {
    track('step_back', { funnel_step: current });
    if (history.state && history.state.dk > 0) { history.back(); return; }
    var prev = current === 'prices' || current === 'download' ? 'welcome' : F.previousStep(state, current);
    history.replaceState({ dk: 0 }, '', '#' + prev);
    render(prev, true);
  }
  window.addEventListener('popstate', function (e) {
    depth = e.state && e.state.dk ? e.state.dk : 0;
    var step = F.allowedStep(state, stepFromHash());
    if (step !== stepFromHash()) history.replaceState({ dk: depth }, '', '#' + step);
    render(step, true);
  });

  // ---------------------------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------------------------
  // `focus` = the visitor moved to this screen (not a redraw: language, a toggle, closing a video).
  var firstRender = true;
  function render(step, focus) {
    current = step;
    if (step !== 'welcome' && step !== state.last) { state.last = step; save(); }
    document.documentElement.classList.toggle('at-welcome', step === 'welcome');
    var html = SCREENS[step]();
    view.innerHTML = '<section class="step" data-step="' + step + '"><div class="scroll">' + html + '</div></section>';
    shapeScreen(step);
    renderProgress(step);
    afterRender(step, focus || firstRender);
    firstRender = false;
    if (focus) {
      var h = view.querySelector('h1');
      if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
      window.scrollTo(0, 0);
    }
  }

  // The page itself never scrolls: the question stays at the top, the answers are the only part
  // that scrolls, the buttons stay at the bottom.
  function shapeScreen(step) {
    var sec = view.firstChild, scroll = sec.firstChild;
    var head = document.createElement('div');
    head.className = 'head';
    if (scroll.firstElementChild && scroll.firstElementChild.matches('h1')) {
      head.appendChild(scroll.firstElementChild);
      if (scroll.firstElementChild && scroll.firstElementChild.matches('.lead, .q-sub')) head.appendChild(scroll.firstElementChild);
    }
    sec.insertBefore(head, scroll);
    var dock = scroll.querySelector(':scope > .dock');
    if (dock) sec.appendChild(dock);
    scroll.addEventListener('scroll', function () { sec.classList.toggle('scrolled', scroll.scrollTop > 2); }, { passive: true });
  }

  function renderProgress(step) {
    var i = F.progressIndex(step, state);
    var show = step !== 'welcome';
    $('prog').hidden = !show;
    if (!show) return;
    var total = F.progressFor(state).length;
    var n = i < 0 ? 0 : i + 1;
    var seg = '';
    if (i >= 0) for (var k = 1; k <= total; k++) seg += '<i' + (k <= n ? ' class="on"' : '') + '></i>';
    $('bar').innerHTML = seg;
    $('prog-txt').textContent = i < 0 ? '' : fill(t.stepOf, { n: n, t: total });
    $('back-txt').textContent = t.back;
  }

  function choice(act, icon, title, desc, opts) {
    opts = opts || {};
    return '<button type="button" class="choice' + (opts.cls ? ' ' + opts.cls : '') + '" data-act="' + act + '"' +
      (opts.id ? ' id="' + opts.id + '"' : '') +
      (opts.color ? ' style="--c:' + opts.color + '"' : '') +
      (opts.pressed != null ? ' aria-pressed="' + opts.pressed + '"' : '') + '>' +
      '<span class="ci">' + ic(icon, opts.fillIcon ? 'f' : '') + '</span>' +
      '<span class="ct"><b>' + esc(title) + '</b>' + (opts.price ? '<span class="cp">' + opts.price + '</span>' : '') +
      (desc ? '<span class="cd">' + esc(desc) + '</span>' : '') + (opts.tag ? '<span class="tag">' + esc(opts.tag) + '</span>' : '') + '</span>' +
      (opts.noGo ? '' : '<span class="go">' + ic('i-next', 'flip') + '</span>') + '</button>';
  }

  // "Skip the questions and download": the last screen with the device the visitor is on.
  function skipLink() {
    if (F.isBuy(state)) return '';
    return '<div class="dock"><div class="row"><button type="button" class="link" data-act="skip-all">' + ic('i-dl') + esc(t.skipAll) + '</button></div></div>';
  }

  var SCREENS = {
    welcome: function () {
      var resume = '';
      if (hadProgress && (state.activity || state.mode)) {
        resume = '<div class="note resume"><p>' + esc(t.resumeTxt) + '</p>' +
          '<button type="button" class="btn soft small" data-act="resume">' + esc(t.resumeBtn) + '</button>' +
          '<button type="button" class="link" data-act="restart">' + esc(t.restartBtn) + '</button></div>';
      }
      // A link from an ad for one shop type: say what Doukkany does for that shop, at once.
      var pitch = fromLink.activity ? '<p class="pitch">' + cic(F.activity(state.activity).icon, F.activity(state.activity).color) + '<span>' + esc(t.pitch[state.activity]) + '</span></p>' : '';
      return '<h1>' + esc(t.wTitle) + '</h1><p class="lead">' + esc(t.wSub) + '</p>' +
        resume + pitch +
        // Real app screens: the PC app (Arabic) and the phone app.
        '<figure class="mock" aria-label="' + esc(t.mockAlt) + '">' +
          '<span class="lap"><span class="lap-scr"><img src="../download/assets/pc-sell-760.webp" width="760" height="475" alt="" decoding="async" fetchpriority="high"></span></span>' +
          '<span class="mphn"><img src="../download/assets/01-sell-360.webp" width="360" height="780" alt="" decoding="async"></span>' +
        '</figure>' +
        '<ul class="facts benefits">' +
          '<li>' + cic('i-cloudoff', C.blue) + esc(t.factOffline) + '</li>' +
          '<li>' + cic('i-check', C.green) + esc(t.factOnce) + '</li>' +
          '<li>' + cic('i-devices', C.both) + esc(t.factDevices) + '</li>' +
          '<li>' + cic('i-gift', C.pink) + esc(fill(t.factTrial, PRICE_VARS())) + '</li></ul>' +
        '<div class="quick">' +
          '<button type="button" class="link" data-act="go:prices">' + ic('i-tag') + esc(t.seePrices) + '</button>' +
          '<button type="button" class="link" data-act="demo">' + ic('i-play') + esc(t.seeDemo) + '</button>' +
          '<button type="button" class="link" data-act="go:download">' + ic('i-dl') + esc(t.directDl) + '</button></div>' +
        '<div class="dock"><button type="button" class="btn block" data-act="intent:trial">' + ic('i-play-c') + esc(t.trialT) + '</button>' +
        '<button type="button" class="btn soft block" data-act="intent:buy">' + ic('i-bag') + esc(t.buyT) + '</button></div>';
    },

    activity: function () {
      var tiles = F.ACTIVITIES.map(function (a) {
        return '<button type="button" class="tile" style="--c:' + a.color + '" data-act="activity:' + a.id + '" aria-pressed="' + (state.activity === a.id) + '">' +
          '<span class="ci">' + ic(a.icon) + '</span><span class="tl">' + esc(t.act[a.id]) + '</span>' + ic('i-next', 'flip go') + '</button>';
      }).join('');
      var next = F.isBuy(state) ? 'devices' : 'pain';
      var dock;
      if (state.activity === 'other') {
        dock = '<div class="field"><label for="other">' + esc(t.otherLabel) + '</label>' +
          '<input id="other" type="text" maxlength="60" autocomplete="off" placeholder="' + esc(t.otherPh) + '" value="' + esc(state.other) + '">' +
          '</div><div class="dock"><button type="button" class="btn block" data-act="go:' + next + '">' + esc(t.next) + '</button></div>';
      } else if (F.isBuy(state)) {
        // Buying: the shop type is only to help; it can be skipped (owner brief §11).
        dock = '<div class="dock"><div class="row"><button type="button" class="link" data-act="go:devices">' + esc(t.skipQ) + '</button></div></div>';
      } else dock = skipLink();
      return '<h1>' + esc(t.aTitle) + '</h1><p class="q-sub">' + esc(t.aSub) + '</p><div class="tiles list">' + tiles + '</div>' + dock;
    },

    // "What bothers you most?": several answers or none. A chosen answer shows, at once, what
    // Doukkany does about it, in one plain sentence.
    pain: function () {
      var shown = F.painsFor(state.activity);
      var chosen = 0;
      var tiles = shown.map(function (p) {
        var on = state.pains.indexOf(p.id) !== -1;
        if (on) chosen += 1;
        return '<button type="button" class="tile pain" style="--c:' + p.color + '" data-act="pain:' + p.id + '" aria-pressed="' + on + '">' +
          '<span class="ci">' + ic(on ? 'i-check' : p.icon) + '</span><span>' + esc(t.pain[p.id]) + '</span>' +
          (on ? '<span class="fix">' + esc(t.painFix[p.id]) + '</span>' : '') +
          '</button>';
      }).join('');
      return '<h1>' + esc(t.painTitle) + '</h1><p class="q-sub">' + esc(t.painSub) + '</p>' +
        '<div class="tiles">' + tiles + '</div>' +
        '<div class="dock"><button type="button" class="btn block" data-act="pain-done">' + esc(chosen ? t.next : t.painSkip) + '</button>' +
        '<div class="row"><button type="button" class="link" data-act="skip-all">' + ic('i-dl') + esc(t.skipAll) + '</button></div></div>';
    },

    devices: function () {
      var hereTag = function (m) {
        if (m === 'pc' && DEVICE === 'windows') return t.here;
        if (m === 'phone' && DEVICE === 'android') return t.hereAndroid;
        return null;
      };
      // Prices on the cards only when buying (a trial pays nothing now).
      var price = function (type) { return F.isBuy(state) ? money(OFFER.plans[type].price) + ' ' + esc(t.da) : ''; };
      return '<h1>' + esc(t.dTitle) + '</h1><p class="q-sub">' + esc(t.dSub) + '</p>' +
        '<div class="choices">' +
        choice('mode:phone', 'i-phone', t.modePhoneT, t.modePhoneD, { pressed: state.mode === 'phone', tag: hereTag('phone'), color: C.android, price: price('phone') }) +
        choice('mode:pc', 'i-win', t.modePcT, t.modePcD, { pressed: state.mode === 'pc', tag: hereTag('pc'), fillIcon: true, color: C.win, price: price('pc') }) +
        choice('mode:both', 'i-pcphone', t.modeBothT, t.modeBothD, { pressed: state.mode === 'both', color: C.both, price: price('pc') }) +
        '</div>' +
        // How a phone works with the PC, plainly (owner brief §8): no cloud, no remote access.
        '<details class="tip block"><summary>' + ic('i-wifi') + esc(t.netTitle) + '</summary><ul class="dots">' +
        t.netPoints.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></details>' +
        (DEVICE === 'ios' ? '<p class="warn block">' + esc(t.iosNote) + '</p>' : '');
    },

    // ---- v2 trial end: download first, then the advice and the offer (owner brief §9, §17) ----
    ready: function () {
      var d = devices(), r = rec();
      var ff = F.featuresFor(state);
      var top = ff.list.slice(0, 3);
      var answers = '<div class="answers">' + (state.activity ? '<span>' + esc(activityName()) + '</span>' : '') +
        '<span>' + esc(devName()) + '</span><button type="button" class="link" data-act="go:devices">' + esc(t.edit) + '</button></div>';
      var advice = '<div class="card advice"><h2>' + cic('i-spark', C.amber) + esc(t.adviceTitle) + '</h2>' +
        (state.activity ? '<p>' + esc(t.pitch[state.activity]) + '</p>' : '') +
        '<ul class="incl">' + top.map(function (f) {
          var because = ff.why[f] ? '<span class="why-tag">' + esc(fill(t.becauseTag, { pain: t.pain[ff.why[f]] })) + '</span>' : '';
          return '<li>' + cic(F.FEATURE_ICON[f][0], F.FEATURE_ICON[f][1]) + '<span><b>' + esc(t.feat[f][0]) + '</b> ' + esc(t.feat[f][1]) + because + '</span></li>';
        }).join('') + '</ul></div>';
      var offer = '<div class="card offer-mini"><h2>' + cic('i-tag', C.teal) + esc(t.afterTrial) + '</h2>' +
        '<div class="om"><b>' + esc(offerName(r)) + '</b><span class="pp">' + money(r.total) + ' ' + esc(t.da) + '<small>' + esc(t.vOnce) + '</small></span></div>' +
        '<p class="q-sub">' + esc(whyLine(r, d)) + '</p>' +
        '<div class="row"><button type="button" class="link" data-act="path:buy">' + esc(t.buyNow) + '</button>' +
        '<button type="button" class="link" data-act="go:prices">' + esc(t.allPrices) + '</button></div></div>';
      return '<h1>' + esc(t.tTitle) + '</h1><p class="lead">' + esc(fill(t.tSub, PRICE_VARS())) + '</p>' +
        answers +
        '<div class="card dl-card">' + downloadBlocks(d.pcs > 0, d.phones > 0) + '</div>' +
        startSteps(d) +
        advice +
        videosHtml() +
        offer +
        trustHtml() +
        faqHtml('trial') +
        helpHtml('install_help', installHelpMessage());
    },

    // ---- Direct download, no questions (owner brief §4 C) ----
    download: function () {
      var pcFirst = DEVICE !== 'android';
      return '<h1>' + esc(t.dlPageTitle) + '</h1><p class="lead">' + esc(fill(t.tSub, PRICE_VARS())) + '</p>' +
        '<div class="card dl-card">' + downloadBlocks(true, true, pcFirst) + '</div>' +
        startSteps({ pcs: pcFirst ? 1 : 0, phones: pcFirst ? 0 : 1 }) +
        trustHtml() +
        faqHtml('download') +
        helpHtml('install_help', installHelpMessage(pcFirst ? 'pc' : 'phone')) +
        '<div class="dock"><div class="row"><button type="button" class="link" data-act="go:prices">' + esc(t.seePrices) + '</button>' +
        '<button type="button" class="link" data-act="intent:trial">' + esc(t.helpMePick) + '</button></div></div>';
    },

    // ---- All the prices, without questions (owner brief §10) ----
    prices: function () {
      var cards = OFFER.listOrder.map(function (id) {
        var p = OFFER.plans[id];
        var usb = OFFER.usbPlans.indexOf(id) !== -1;
        var lines = [
          [cic('i-devices', C.both), t.planDevices[id]],
          [cic('i-check', C.green), t.licLine],
          [cic('i-cash', C.teal), usb ? fill(t.payLinePc, { cod: num(OFFER.orderTotal(id, 'cod')), pre: num(OFFER.orderTotal(id, 'prepaid')), delivery: num(OFFER.deliveryFee) }) : t.payLinePhone],
          [cic('i-cloudoff', C.blue), t.netLine]
        ];
        return '<div class="plan-card' + (id === 'pc' ? ' rec' : '') + '">' +
          (id === 'pc' ? '<span class="ribbon">' + esc(t.planTag) + '</span>' : '') +
          '<h2>' + esc(t.plan[id][0]) + '</h2>' +
          '<div class="price"><span class="amt">' + money(p.price) + '</span><span class="cur">' + esc(t.da) + '</span><span class="once">' + esc(t.once) + '</span></div>' +
          '<ul class="incl">' + lines.map(function (l) { return '<li>' + l[0] + '<span>' + esc(l[1]) + '</span></li>'; }).join('') + '</ul>' +
          '<button type="button" class="btn soft block" data-act="plan:' + id + '">' + esc(t.pickPlan) + '</button></div>';
      }).join('');
      return '<h1>' + esc(t.pricesTitle) + '</h1><p class="lead">' + esc(t.pricesSub) + '</p>' +
        '<p class="trialbar">' + cic('i-gift', C.pink) + esc(fill(t.inclTrial, PRICE_VARS())) + '</p>' +
        '<div class="plan-cards">' + cards + '</div>' +
        '<ul class="incl block"><li>' + cic('i-check', C.green) + '<span>' + esc(t.inclAll) + '</span></li>' +
        '<li>' + cic('i-cash', C.teal) + '<span>' + esc(t.inclNoSub) + '</span></li></ul>' +
        calcHtml() +
        trustHtml() +
        faqHtml('prices') +
        '<div class="dock"><button type="button" class="btn block" data-act="try-from-prices">' + esc(fill(t.tryDays, PRICE_VARS())) + '</button>' +
        '<div class="row"><button type="button" class="link" data-act="path:buy">' + esc(t.buyT) + '</button></div></div>';
    },

    // ---- v1 (older long path, ?fv=v1): features, price, lessons, download ----
    features: function () {
      var a = F.activity(state.activity) || F.activity('other');
      var ff = F.featuresFor(state);
      var list = ff.list.map(function (f) {
        var because = ff.why[f] ? '<span class="why-tag">' + esc(fill(t.becauseTag, { pain: t.pain[ff.why[f]] })) + '</span>' : '';
        return '<li><div class="feat">' +
          '<span class="ok" style="--c:' + F.FEATURE_ICON[f][1] + '">' + ic(F.FEATURE_ICON[f][0]) + '</span><span><b>' + esc(t.feat[f][0]) + '</b><span class="fd">' + esc(t.feat[f][1]) + '</span>' + because + '</span></div></li>';
      }).join('');
      return '<h1>' + esc(t.fTitle) + '</h1><span class="chip">' + ic(a.icon) + esc(activityName()) + '</span>' +
        '<p class="q-sub block">' + esc(t.fSub) + '</p>' +
        '<ul class="feats" style="margin-top:8px">' + list + '</ul>' +
        '<div class="dock"><button type="button" class="btn block" data-act="go:price">' + esc(t.toPrice) + '</button></div>';
    },

    price: function () {
      var r = rec();
      var d = devices();
      var primary = state.intent === 'buy' ?
        '<button type="button" class="btn block" data-act="path:buy">' + esc(t.goBuy) + '</button><div class="row"><button type="button" class="link" data-act="path:trial">' + esc(t.altTrial) + '</button>' :
        '<button type="button" class="btn block" data-act="path:trial">' + esc(t.goTrial) + '</button><div class="row"><button type="button" class="link" data-act="path:buy">' + esc(t.altBuy) + '</button>';
      return '<h1>' + esc(t.pTitle) + '</h1><p class="lead">' + esc(fill(state.intent === 'buy' ? t.pSubBuy : t.pSubTrial, PRICE_VARS())) + '</p>' +
        '<div class="offer"><span class="ribbon">' + esc(t.recTag) + '</span>' +
        '<h2>' + esc(offerName(r)) + '</h2><p class="od">' + esc(t.plan[r.type][1]) + '</p>' +
        '<div class="price"><span class="amt">' + money(r.total) + '</span><span class="cur">' + esc(t.da) + '</span><span class="once">' + esc(t.once) + '</span></div>' +
        '<ul class="incl"><li>' + cic('i-check', C.green) + '<span>' + esc(t.inclAll) + '</span></li>' +
        '<li>' + cic('i-cloudoff', C.blue) + '<span>' + esc(t.netLine) + '</span></li>' +
        '<li>' + cic('i-cash', C.teal) + '<span>' + esc(t.inclNoSub) + '</span></li>' +
        '<li>' + cic('i-gift', C.pink) + '<span>' + esc(fill(t.inclTrial, PRICE_VARS())) + '</span></li></ul></div>' +
        '<div class="why block"><h2>' + cic('i-help', C.blue) + esc(t.whyTitle) + '</h2><p class="q-sub">' + esc(whyLine(r, d)) + '</p></div>' +
        '<div class="dock">' + primary + '<button type="button" class="link" data-act="go:devices">' + esc(t.changeDevices) + '</button></div></div>';
    },

    course: function () {
      var ids = F.lessonsFor(state);
      var d = devices();
      return '<h1>' + esc(t.cTitle) + '</h1><p class="q-sub">' + esc(fill(t.cSub, { activity: activityName() })) + '</p>' +
        '<ol class="lessons">' + ids.map(function (i, k) { return lessonHtml(i, k === 0, 'tutorial'); }).join('') + '</ol>' +
        (d && d.pcs === 0 ? '<p class="q-sub block">' + esc(t.phoneLessonsNote) + '</p>' : '') +
        '<div class="dock"><button type="button" class="btn block" data-act="finish">' + esc(state.intent === 'buy' ? t.skipBuy : t.skipTrial) + '</button></div>';
    },

    trial: function () {
      var d = devices();
      return '<h1>' + esc(t.tTitle) + '</h1><p class="lead">' + esc(fill(t.tSub, PRICE_VARS())) + '</p>' +
        '<div class="card dl-card">' + downloadBlocks(d.pcs > 0, d.phones > 0) + '</div>' +
        startSteps(d) +
        '<div class="card"><h2>' + esc(t.tLessons) + '</h2><ol class="lessons">' + F.lessonsFor(state).slice(0, 3).map(function (i, k) { return lessonHtml(i, k === 0, 'tutorial'); }).join('') + '</ol></div>' +
        faqHtml('trial') +
        helpHtml('install_help', installHelpMessage()) +
        '<div class="actions"><div class="row"><button type="button" class="link" data-act="path:buy">' + esc(t.buyNow) + '</button></div></div>';
    },

    // ---- Checkout (owner brief §11-14) ----
    order: function () {
      var r = rec();
      if (!r.ok) return '<h1>' + esc(t.oTitle) + '</h1>';
      var pcOffer = r.type !== 'phone';
      var total = pcOffer ? OFFER.orderTotal(r.type, buyer.pay) : r.total;

      // A "pay at delivery" order that reached us: say so, and what happens next.
      if (codOrder.state === 'done') {
        return '<h1>' + esc(t.codDoneT) + '</h1><p class="lead">' + esc(fill(t.codDoneD, { phone: codOrder.phone })) + '</p>' +
          (codOrder.ref ? '<p class="ref">' + esc(t.refLabel) + ' <bdi class="ltr">' + esc(codOrder.ref) + '</bdi></p>' : '') +
          summaryHtml(r, codOrder.total, false) +
          '<div class="card"><h2>' + esc(t.nextTitle) + '</h2>' + stepsList(t.nextStepsCod) + '</div>' +
          '<div class="dock"><button type="button" class="btn block soft" data-act="path:trial">' + esc(t.codDoneTry) + '</button>' +
          '<div class="row">' + waButton('order', fill(WA_DZ.afterOrder, { ref: codOrder.ref || '' }), t.helpBtn, 'link') + '</div></div>';
      }

      // Phone offer: nothing to fill here; the order goes on WhatsApp, payment first.
      if (!pcOffer) {
        return '<h1>' + esc(t.oTitle) + '</h1><p class="lead">' + esc(t.phoneBuyText) + '</p>' +
          summaryHtml(r, total, true) +
          '<div class="card"><h2>' + cic('i-cash', C.teal) + esc(t.payTitle) + '</h2><p>' + esc(t.phonePay) + '</p></div>' +
          '<p class="warn block">' + esc(t.paySafe) + '</p>' +
          '<div class="card"><h2>' + esc(t.nextTitle) + '</h2>' + stepsList(t.nextStepsPhone) + '</div>' +
          '<div class="dock">' + waButton('order', phoneOrderMessage(), fill(t.sendWaTotal, { total: num(total) }), 'btn wa block') +
          '<div class="row"><button type="button" class="link" data-act="path:trial">' + esc(fill(t.tryFirst, PRICE_VARS())) + '</button></div></div>';
      }

      loadPlaces();
      var showErr = buyer.tried;
      var probs = F.checkoutProblems(buyerForCheck(), r.type);
      var errOf = function (f) { for (var i = 0; i < probs.length; i++) if (probs[i][0] === f) return probs[i][1]; return null; };

      // 1. Windows check (owner brief §14)
      var winErr = showErr && errOf('win') === 'missing';
      var win = '<div class="card' + (winErr ? ' invalid' : '') + '" id="win-card"><h2>' + cic('i-win', C.win, 'f') + esc(t.winQ) + '</h2><div class="pills" role="group" aria-label="' + esc(t.winQ) + '">' +
        pill('win:yes', t.winYes, buyer.win === 'yes', 'win-first') + pill('win:no', t.winNo, buyer.win === 'no') + pill('win:unknown', t.winUnknown, buyer.win === 'unknown') + '</div>' +
        (winErr ? '<p class="err" role="alert">' + esc(t.errWin) + '</p>' : '') +
        (buyer.win === 'unknown' ? winHelpHtml() : '') +
        (buyer.win === 'no' ? '<div class="warn block">' + esc(t.winNoText) + '<div class="actions" style="margin-top:10px"><button type="button" class="btn soft" data-act="tophone">' + esc(t.toPhoneOffer) + '</button>' +
          waButton('windows_help', WA_DZ.windowsHelp, t.helpBtn, 'link') + '</div></div>' : '') +
        '</div>';
      if (buyer.win === 'no') {
        return '<h1>' + esc(t.oTitle) + '</h1>' + summaryHtml(r, r.total, true) + win +
          '<div class="dock"><button type="button" class="btn block" data-act="tophone">' + esc(t.toPhoneOffer) + '</button>' +
          '<div class="row"><button type="button" class="link" data-act="path:trial">' + esc(fill(t.tryFirst, PRICE_VARS())) + '</button></div></div>';
      }

      // 2. Payment, with the real amounts (owner brief §12)
      var cod = buyer.pay === 'cod';
      var preTotal = OFFER.orderTotal(r.type, 'prepaid'), codTotal = OFFER.orderTotal(r.type, 'cod');
      var pay = '<div class="card" id="pay-card"><h2>' + cic('i-cash', C.teal) + esc(t.payTitle) + '</h2><div class="seg" role="radiogroup" aria-label="' + esc(t.payTitle) + '">' +
        choice('pay:cod', 'i-usb', t.payCodT, t.payCodD, { pressed: cod, color: C.orange, noGo: true, id: 'pay-first',
          price: money(codTotal) + ' ' + esc(t.da), tag: fill(t.deliveryTag, PRICE_VARS()) }) +
        choice('pay:prepaid', 'i-wa', t.payPreT, t.payPreD, { pressed: !cod, color: C.blue, noGo: true,
          price: money(preTotal) + ' ' + esc(t.da) }) +
        '</div></div>';

      // 3. Who you are / where to send the key: only for pay at delivery (paying first happens
      // in WhatsApp, where we already see the number).
      var details = '';
      if (cod) {
        details = '<div class="card" id="details-card"><h2>' + cic('i-home', C.orange) + esc(t.detailsTitle) + '</h2>' +
          // A trap for robots: people never see this field (CSS .hp), robots fill it.
          '<input id="b-website" class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          field('b-name', t.fName, '<input id="b-name" type="text" maxlength="60" autocomplete="name" enterkeyhint="next" value="' + esc(buyer.name) + '"' + invalidAttr(showErr && errOf('name'), 'b-name') + '>', showErr && errOf('name') && t.errName) +
          field('b-phone', t.fPhone, '<input id="b-phone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" enterkeyhint="next" dir="ltr" placeholder="' + esc(t.fPhonePh) + '" value="' + esc(buyer.phone) + '"' + invalidAttr(showErr && errOf('phone'), 'b-phone') + '>',
            showErr && errOf('phone') && (errOf('phone') === 'bad' ? t.errPhoneBad : t.errPhone)) +
          placeFields(showErr && errOf('wilaya'), showErr && errOf('commune')) + '</div>';
      }

      var sending = codOrder.state === 'sending';
      var send = cod ?
        '<button type="button" class="btn block" id="cod-btn" data-act="cod-send"' + (sending ? ' disabled aria-busy="true"' : '') + '>' +
          esc(sending ? t.codSending : fill(t.codBtnTotal, { total: num(total) })) + '</button>' +
          (codOrder.state === 'failed' ? '<p class="msg bad" role="alert">' + esc(t.codFail) + ' ' + waButton('order', pcOrderMessage(), t.codFailWa, 'link') + '</p>' : '') :
        '<a class="btn wa block" id="order-btn" data-wa="order" href="' + esc(waLink(pcOrderMessage())) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(fill(t.sendWaTotal, { total: num(total) })) + '</a>';
      var errBox = showErr && probs.length ? '<p class="msg bad" id="order-msg" role="alert">' + esc(fill(t.fixMissing, { fields: probs.map(function (p) { return t.fieldName[p[0]]; }).join(t.sep) })) + '</p>' : '<p class="msg" id="order-msg" role="status"></p>';
      return '<h1>' + esc(t.oTitle) + '</h1><p class="lead">' + esc(cod ? t.oSubCod : t.oSub) + '</p>' +
        summaryHtml(r, total, true) + win + pay + details +
        '<details class="tip card"><summary>' + esc(t.nextTitle) + '</summary>' + stepsList(cod ? t.nextStepsCod : t.nextSteps) + '</details>' +
        faqHtml('buy') +
        '<div class="dock">' + errBox + send +
        '<div class="row"><button type="button" class="link" data-act="path:trial">' + esc(fill(t.tryFirst, PRICE_VARS())) + '</button></div></div>';
    }
  };

  function stepsList(list) { return '<ol class="steps-list">' + list.map(function (s) { return '<li><span>' + esc(s) + '</span></li>'; }).join('') + '</ol>'; }

  // The order summary: offer, devices, shop type (each can be changed), the amount to pay.
  function summaryHtml(r, total, editable) {
    var rows = '<li><span><span class="k">' + esc(t.kOffer) + '</span><br><span class="v" style="text-align:start">' + esc(offerName(r)) + ' · ' + esc(devName()) + '</span></span>' +
      (editable ? '<button type="button" class="link edit" data-act="go:devices">' + esc(t.edit) + '</button>' : '') + '</li>';
    if (state.activity) rows += '<li><span><span class="k">' + esc(t.kActivity) + '</span><br><span class="v" style="text-align:start">' + esc(activityName()) + '</span></span>' +
      (editable ? '<button type="button" class="link edit" data-act="go:activity">' + esc(t.edit) + '</button>' : '') + '</li>';
    var delivery = total - r.total;
    if (delivery > 0) {
      rows += '<li><span class="k">' + esc(t.kLicence) + '</span><span class="v">' + money(r.total) + ' ' + esc(t.da) + '</span></li>' +
        '<li><span class="k">' + esc(t.kDelivery) + '</span><span class="v">' + money(delivery) + ' ' + esc(t.da) + '</span></li>';
    }
    rows += '<li class="total"><span class="k">' + esc(t.kTotal) + '</span><span class="v">' + money(total) + ' ' + esc(t.da) +
      '<small class="once">' + esc(t.vOnceLife) + '</small></span></li>';
    return '<ul class="sum">' + rows + '</ul>';
  }

  // "Why this offer?" in one line, from the visitor's own devices (owner brief §9).
  function whyLine(r, d) {
    if (!r.ok) return '';
    if (r.type === 'phone') return fill(t.whyPhone, { plan: t.plan.phone[0] });
    if (r.type === 'shop') return fill(t.whyShop, { plan: t.plan.shop[0], pc: t.plan.pc[0], diff: num(OFFER.plans.shop.price - OFFER.plans.pc.price) });
    return fill(d && d.phones > 0 ? t.whyBoth : t.whyPc, { plan: t.plan.pc[0] });
  }

  // Getting started, short (owner brief §17).
  function startSteps(d) {
    var list = d && d.pcs > 0 ? t.instPc : t.instPhone;
    var extra = d && d.pcs > 0 && d.pcs + d.phones > 1 ? '<p class="q-sub block">' + esc(t.instLink) + '</p>' : '';
    return '<div class="card"><h2>' + esc(t.installTitle) + '</h2>' + stepsList(list) + extra + '</div>';
  }

  // Videos (owner brief §16): ONE short demo that fits the visitor, more under "more videos".
  // Nothing loads from YouTube before a click (only small thumbnails, lazy).
  function videosHtml() {
    var d = devices();
    var demo = F.demoFor(state);
    var more = F.moreDemosFor(state, 3);
    var tut = F.tutorialsFor(state);
    return '<div class="card videos"><h2>' + cic('i-play-c', C.blue) + esc(t.demoTitle) + '</h2>' +
      (d && d.pcs === 0 ? '<p class="q-sub">' + esc(t.pcVideoNote) + '</p>' : '') +
      '<ol class="lessons">' + lessonHtml(demo, true, 'demo') + '</ol>' +
      '<details class="tip more"><summary>' + esc(t.moreVideos) + '</summary>' +
      (more.length ? '<h3 class="mini">' + esc(t.demosLabel) + '</h3><ol class="lessons">' + more.map(function (i) { return lessonHtml(i, false, 'demo'); }).join('') + '</ol>' : '') +
      '<h3 class="mini">' + esc(t.tutLabel) + '</h3><ol class="lessons">' + tut.map(function (i) { return lessonHtml(i, false, 'tutorial'); }).join('') + '</ol>' +
      '</details></div>';
  }

  // Trust, with things that can be checked (owner brief §15). No reviews, no counts.
  function trustHtml() {
    var V = PRICE_VARS();
    var items = [
      [cic('i-gift', C.pink), fill(t.trustTry, V)],
      [cic('i-check', C.green), t.trustPrice],
      [cic('i-dl', C.blue), t.trustUpdates],
      [cic('i-cloudoff', C.blue), t.trustData],
      [cic('i-phone', C.android), t.trustPlay],
      [cic('i-wa', C.green, 'f'), fill(t.trustTalk, { number: '⁦' + WA_SHOWN + '⁩' })]
    ];
    var quotes = F.TESTIMONIALS.filter(function (q) { return q && q.text && q.text[lang]; });
    return '<div class="card trust"><h2>' + cic('i-help', C.blue) + esc(t.trustTitle) + '</h2><ul class="incl">' +
      items.map(function (x) { return '<li>' + x[0] + '<span>' + esc(x[1]) + '</span></li>'; }).join('') +
      '<li>' + cic('i-help', C.slate) + '<span>' + esc(t.trustDev) + ' <bdi class="ltr">' + esc(DEV_NAME) + '</bdi> · ' +
        '<a href="mailto:' + DEV_EMAIL + '"><bdi class="ltr">' + esc(DEV_EMAIL) + '</bdi></a></span></li></ul>' +
      // Real customer words only (funnel.js TESTIMONIALS, empty today: nothing is shown).
      (quotes.length ? '<div class="quotes">' + quotes.map(function (q) {
        return '<blockquote><p>' + esc(q.text[lang]) + '</p><footer>' + esc(q.name) + (t.act[q.shop] ? ' · ' + esc(t.act[q.shop]) : '') + '</footer></blockquote>';
      }).join('') + '</div>' : '') +
      '<p class="row"><button type="button" class="link" data-act="demo">' + ic('i-play') + esc(t.seeDemo) + '</button></p></div>';
  }

  // FAQ (owner brief §18): collapsed, the questions this visitor most likely has first.
  function faqHtml(j) {
    var ids = F.faqFor(j), V = PRICE_VARS();
    function item(id) {
      return '<details class="faq-i" data-faq="' + id + '"><summary>' + esc(fill(t.faq[id][0], V)) + '</summary><p>' + esc(fill(t.faq[id][1], V)) + '</p></details>';
    }
    return '<div class="card faq"><h2>' + cic('i-help', C.blue) + esc(t.faqTitle) + '</h2>' +
      ids.slice(0, F.FAQ_OPEN_N).map(item).join('') +
      '<details class="tip more"><summary>' + esc(t.moreQuestions) + '</summary>' + ids.slice(F.FAQ_OPEN_N).map(item).join('') + '</details>' +
      '<p class="q-sub block">' + esc(t.faqNotFound) + '</p>' +
      waButton('help', WA_DZ.help, t.helpBtn, 'link') + '</div>';
  }

  // Optional loss calculator (owner brief §20): the visitor's own guess, never a promise.
  function calcHtml() {
    return '<details class="card calc" id="calc"><summary>' + cic('i-chart', C.green) + esc(t.calcTitle) + '</summary>' +
      '<p class="q-sub">' + esc(t.calcSub) + '</p>' +
      '<div class="calc-in">' +
      field('c-day', t.calcDay, '<input id="c-day" type="number" inputmode="numeric" min="1" max="10000000" step="50" placeholder="' + esc(t.calcDayPh) + '" dir="ltr">') +
      field('c-days', t.calcDays, '<input id="c-days" type="number" inputmode="numeric" min="1" max="31" value="26" dir="ltr">') +
      '</div><div id="c-out" class="calc-out" aria-live="polite"></div>' +
      '<p class="q-sub">' + esc(t.calcNote) + '</p></details>';
  }
  function updateCalc() {
    var out = $('c-out');
    if (!out) return;
    var r = F.losses($('c-day').value, $('c-days').value, OFFER.plans.pc.price);
    if (!r) { out.textContent = ''; return; }
    trackOnce('calc', 'calculator_used', {});
    out.innerHTML = '<p>' + esc(t.calcMonth) + ' <b>' + money(r.month) + ' ' + esc(t.da) + '</b></p>' +
      '<p>' + esc(t.calcYear) + ' <b>' + money(r.year) + ' ' + esc(t.da) + '</b></p>' +
      '<p class="q-sub">' + esc(fill(t.calcCompare, { plan: t.plan.pc[0], price: num(OFFER.plans.pc.price), days: r.daysToPrice })) + '</p>';
  }

  // WhatsApp help box (owner brief §19): the message is written for the visitor; they can
  // change it in WhatsApp before sending.
  function helpHtml(purpose, msg) {
    return '<div class="help"><h2>' + esc(t.helpTitle) + '</h2><p>' + esc(t.helpText) + '</p>' + waButton(purpose, msg, t.helpBtn) + '</div>';
  }
  function installHelpMessage(mode) {
    var d = F.devices({ mode: mode || state.mode }) || { pcs: 1, phones: 0 };
    return fill(WA_DZ.installHelp, { platform: d.pcs > 0 ? 'Windows' : 'Android' });
  }

  // "I don't know" my Windows: how to look, with a drawing of what to look for (owner brief §14).
  function winHelpHtml() {
    return '<div class="note block winhelp"><p>' + esc(t.winHow) + '</p>' +
      '<div class="keys" aria-hidden="true"><kbd>⊞ Win</kbd>+<kbd>R</kbd><span class="arrow">→</span><kbd class="typed">msinfo32</kbd><span class="arrow">→</span><kbd>Entrée ⏎</kbd></div>' +
      '<div class="msinfo" aria-hidden="true"><div><span>' + esc(t.winOsName) + '</span><b>Microsoft Windows 10 / 11</b></div>' +
      '<div><span>' + esc(t.winSysType) + '</span><b>x64-based PC</b></div></div>' +
      '<p class="q-sub">' + esc(t.winBad) + '</p>' +
      (winInfo ? '<b>' + esc(fill(t.winThis, { os: winInfo })) + '</b>' : '') +
      '<p class="q-sub">' + esc(t.winUnknownOk) + '</p></div>';
  }

  // ---- Download blocks: the device the visitor is on first ----
  function downloadBlocks(wantPc, wantPhone, pcFirst) {
    if (pcFirst == null) pcFirst = DEVICE !== 'android';
    var pc = wantPc ? pcBlock() : '', ph = wantPhone ? phoneBlock() : '';
    return '<h2>' + cic('i-dl', C.blue) + esc(t.dlTitle) + '</h2>' + (pcFirst ? pc + ph : ph + pc);
  }
  function pcBlock() {
    var head = '<h3 class="dl-h">' + cic('i-win', C.win, 'f') + ' ' + esc(t.pcBlock) + ' <small class="q-sub">· ' + esc(t.pcReq) + '</small></h3>';
    if (IS_PHONE) {
      return head + '<div class="get"><p>' + esc(t.onPhonePc) + '</p><div class="share-row">' +
        (navigator.share ? '<button type="button" class="btn soft" data-act="share-pc">' + ic('i-share') + esc(t.shareBtn) + '</button>' : '') +
        '<button type="button" class="btn soft" data-act="wa-pc">' + ic('i-wa', 'f') + esc(t.waShare) + '</button>' +
        '<button type="button" class="btn soft" data-act="copy-pc">' + ic('i-copy') + esc(t.copyBtn) + '</button>' +
        '<a class="btn soft" data-act="mail-pc" href="' + esc(mailLink()) + '">' + ic('i-mail') + esc(t.mailBtn) + '</a>' +
        '</div><p class="msg" id="pc-msg" role="status"></p></div>';
    }
    return head + '<div class="get"><a class="btn block" id="win-btn" href="' + esc(latest ? latest.url : RELEASE_PAGE) + '">' + ic('i-win', 'f') + esc(t.winBtn) + '</a>' +
      '<p class="msg" id="pc-msg" role="status"></p>' +
      '<details class="tip"' + (latest && latest.signed === true ? ' hidden' : '') + ' id="smartscreen"><summary>' + ic('i-warn') + esc(t.smartTitle) + '</summary><p>' + esc(t.smartBody) + '</p></details></div>';
  }
  function phoneBlock() {
    var head = '<h3 class="dl-h">' + cic('i-phone', C.android) + ' ' + esc(t.phoneBlock) + ' <small class="q-sub">· ' + esc(t.phoneReq) + '</small></h3>';
    var badge = '<a class="play-badge" id="play-btn" href="' + esc(playUrl()) + '" target="_blank" rel="noopener"><img src="https://play.google.com/intl/en_us/badges/static/images/badges/' + lang + '_badge_web_generic.png" width="646" height="250" alt="' + esc(t.playAlt) + '"></a>';
    if (DEVICE === 'ios') return head + '<p class="warn">' + esc(t.iosNote) + '</p>';
    if (IS_PHONE) return head + '<div class="get">' + badge + '</div>';
    return head + '<div class="get">' + badge + '<p>' + esc(t.onPcPhone) + '</p><div class="share-row">' +
      '<button type="button" class="btn soft" data-act="copy-play">' + ic('i-copy') + esc(t.copyBtn) + '</button>' +
      '<button type="button" class="btn soft" data-act="wa-play">' + ic('i-wa', 'f') + esc(t.waShare) + '</button></div>' +
      '<p class="msg" id="play-msg" role="status"></p></div>';
  }
  function mailLink() {
    return 'mailto:?subject=' + encodeURIComponent('Doukkany') + '&body=' + encodeURIComponent(t.shareText + '\n' + winLink('email'));
  }

  // ---- Lessons and demos ----
  function filmedNote() { var d = devices(); return current === 'download' ? DEVICE === 'android' : !!d && d.pcs === 0; }
  function lessonTitle(i) { return LESSONS.videos[i][{ ar: 1, fr: 2, en: 3 }[lang]]; }
  function mmss(sec) { return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
  function videoUrl(i) { return 'https://www.youtube.com/watch?v=' + LESSONS.videos[i][0] + '&list=' + LESSONS.playlistId + '&index=' + (i + 1); }
  function lessonHtml(i, first, kind) {
    var v = LESSONS.videos[i];
    var seen = state.watched.indexOf(v[0]) !== -1;
    return '<li><a class="lesson' + (first ? ' first' : '') + '" href="' + esc(videoUrl(i)) + '" target="_blank" rel="noopener" data-v="' + i + '" data-kind="' + (kind || 'demo') + '">' +
      '<span class="thumb"><img src="https://i.ytimg.com/vi/' + v[0] + '/mqdefault.jpg" alt="" loading="lazy" decoding="async" width="9" height="16"><span class="pl"><span>' + ic('i-play', 'f') + '</span></span></span>' +
      '<span class="tx"><span class="tt">' + esc(lessonTitle(i)) + '</span><span class="td"><bdi class="ltr">' + mmss(v[4]) + '</bdi>' +
      // The videos are filmed on the PC app: say so to a visitor who chose the phone only.
      (filmedNote() ? '<span class="pcv">' + ic('i-pc') + esc(t.filmedPc) + '</span>' : '') +
      (seen ? '<span class="seen">' + ic('i-check') + esc(t.seen) + '</span>' : '') + '</span></span></a></li>';
  }

  // ---------------------------------------------------------------------------------
  // Buying (owner, 2026-11-26 + brief §11-14). Phone offer: WhatsApp, payment first.
  // PC offers: pay at delivery (a USB key sent home; the order goes to the Admin CRM) or
  // BaridiMob / CCP first (code on WhatsApp, 1 000 DA less).
  // ---------------------------------------------------------------------------------
  var WA_DZ = window.DK_WA_DZ;
  var AR = TEXT.ar; // the WhatsApp messages are in Darija whatever the page language

  function activityLine() {
    if (!state.activity) return '';
    var name = AR.act[state.activity];
    if (state.activity === 'other' && state.other) name += ': ' + state.other;
    return fill(WA_DZ.activityLine, { activity: name });
  }
  function phoneOrderMessage() {
    return fill(WA_DZ.phone, { activityLine: activityLine(), devices: AR.devName.phone, offer: AR.plan.phone[0], total: num(OFFER.plans.phone.price) });
  }
  function pcOrderMessage() {
    var r = rec();
    var prepaid = buyer.pay === 'prepaid';
    return fill(prepaid ? WA_DZ.pcCode : WA_DZ.pc, {
      activityLine: activityLine(), devices: AR.devName[state.mode] || '', offer: AR.plan[r.type][0],
      total: num(OFFER.orderTotal(r.type, buyer.pay)), delivery: num(OFFER.deliveryFor(r.type, buyer.pay)),
      windows: WA_DZ.win[buyer.win] || WA_DZ.win.unknown,
      name: buyer.name.trim(), phone: buyer.phone.trim(), wilaya: wilayaText(), commune: communeText()
    });
  }

  // The buyer's answers: kept in this tab only (sessionStorage), cleared when the tab closes.
  var BUYER_KEY = 'dk-start-buyer';
  var buyer = (function () {
    var raw = null;
    try { raw = JSON.parse(sessionStorage.getItem(BUYER_KEY) || 'null'); } catch (e) {}
    raw = raw && typeof raw === 'object' ? raw : {};
    function txt(v, n) { return typeof v === 'string' ? v.replace(/[\u0000-\u001F<>]/g, ' ').slice(0, n) : ''; }
    return {
      win: ['yes', 'no', 'unknown'].indexOf(raw.win) !== -1 ? raw.win : '',
      name: txt(raw.name, 60), phone: txt(raw.phone, 20),
      wilaya: (raw.wilaya | 0) >= 1 && (raw.wilaya | 0) <= 99 ? raw.wilaya | 0 : 0, wilayaTxt: txt(raw.wilayaTxt, 60),
      commune: txt(raw.commune, 60), communeOther: txt(raw.communeOther, 60),
      // Pay at delivery is chosen by default (owner, 2026-11-26).
      pay: ['prepaid', 'cod'].indexOf(raw.pay) !== -1 ? raw.pay : 'cod',
      requestId: typeof raw.requestId === 'string' && /^[0-9a-f-]{36}$/.test(raw.requestId) ? raw.requestId : '',
      // The Meta Lead event id of this order (same lifetime as requestId): sent inside the
      // order and used by the browser Lead, so Meta counts the order once.
      leadEventId: typeof raw.leadEventId === 'string' && /^[0-9a-f-]{36}$/.test(raw.leadEventId) ? raw.leadEventId : '',
      tried: false // errors show only after a first try to send
    };
  })();
  function saveBuyer() {
    var copy = {};
    Object.keys(buyer).forEach(function (k) { if (k !== 'tried') copy[k] = buyer[k]; });
    try { sessionStorage.setItem(BUYER_KEY, JSON.stringify(copy)); } catch (e) {}
  }
  // The buyer changed the order: a new send is a new order.
  function buyerEdited() { buyer.requestId = ''; buyer.leadEventId = ''; saveBuyer(); }
  function buyerForCheck() {
    return { win: buyer.win, pay: buyer.pay, name: buyer.name, phone: buyer.phone, wilaya: wilayaText(), commune: communeText() };
  }

  // Wilayas and communes (../js/dz-places.json), loaded only when the order form is shown.
  var places = null, placesState = 'idle';
  function loadPlaces() {
    if (placesState !== 'idle' || buyer.pay !== 'cod') return;
    placesState = 'loading';
    fetch('../js/dz-places.json?v=1').then(function (r) { if (!r.ok) throw new Error('places'); return r.json(); })
      .then(function (d) { places = d.w; placesState = 'ok'; }, function () { placesState = 'failed'; })
      .then(function () { if (current === 'order') redrawOrder(document.activeElement && document.activeElement.id); });
  }
  function wilayaOf(code) { if (!places) return null; for (var i = 0; i < places.length; i++) if (places[i][0] === code) return places[i]; return null; }
  function wilayaText() {
    if (placesState === 'failed') return buyer.wilayaTxt.trim();
    var w = wilayaOf(buyer.wilaya);
    return w ? w[0] + ' - ' + w[2] + ' (' + w[1] + ')' : '';
  }
  function communeText() {
    if (placesState === 'failed' || buyer.commune === 'other') return buyer.communeOther.trim();
    var w = wilayaOf(buyer.wilaya);
    if (!w) return '';
    for (var i = 0; i < w[3].length; i++) if (w[3][i][0] === buyer.commune) return w[3][i][1] + (w[3][i][1] !== w[3][i][0] ? ' (' + w[3][i][0] + ')' : '');
    return '';
  }

  // ---- "Pay at delivery": the order goes to the Doukkany server (Edge Function site-order),
  // which adds it to the Admin CRM. Only on the real site; elsewhere (local checks) nothing is
  // sent: the body is kept in window.__dkOrderSent and ?dk_order=fail shows the error. ----
  var ORDER_URL = 'https://clseghjxpmlutwrrvmrf.supabase.co/functions/v1/site-order';
  var ORDER_LIVE = location.hostname === 'yousoft.site';
  var codOrder = { state: 'idle', phone: '', ref: '', total: 0 }; // idle | sending | failed | done
  function newRequestId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  // The checkout field each problem points at (owner brief §13: scroll to the first one).
  var FIELD_EL = { win: 'win-first', pay: 'pay-first', name: 'b-name', phone: 'b-phone', wilaya: 'b-wilaya', commune: 'b-commune' };
  function firstProblemEl(probs) {
    var f = probs[0][0];
    if (f === 'wilaya' && placesState === 'failed') return $('b-wilaya-txt');
    if (f === 'commune' && (placesState === 'failed' || buyer.commune === 'other')) return $('b-commune-txt');
    return $(FIELD_EL[f]);
  }
  function showProblems(probs) {
    buyer.tried = true;
    track('checkout_validation_failed', { license_type: rec().type, field: probs[0][0], field_count: Math.min(probs.length, 10), pay: buyer.pay });
    redrawOrder();
    var el = firstProblemEl(probs);
    if (el) { el.scrollIntoView({ block: 'center' }); try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  }
  // Local checks: ?dk_order=fail (network error), ?dk_order=old (a site-order that does not know
  // event_id / attribution yet: 422 invalid_order, then OK without them), ?dk_order_url=<local
  // address> (a local fake server; only on localhost).
  var LOCAL_ORDER_URL = (function () {
    var u = params.get('dk_order_url');
    return !ORDER_LIVE && u && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u) ? u : '';
  })();
  function postOnce(body) {
    if (!ORDER_LIVE && !LOCAL_ORDER_URL) {
      (window.__dkOrderSent = window.__dkOrderSent || []).push(body);
      var mode = params.get('dk_order');
      var res = mode === 'fail' ? { ok: false, error: 'network' } :
        mode === 'old' && (body.event_id || body.attribution) ? { ok: false, error: 'invalid_order' } : { ok: true };
      return new Promise(function (done) { setTimeout(function () { done(res); }, 400); });
    }
    return fetch(LOCAL_ORDER_URL || ORDER_URL, { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j && j.ok === true, error: j && j.error }; }, function () { return { ok: false }; }); },
        function () { return { ok: false, error: 'network' }; });
  }
  // A site-order deployed before it knew event_id / attribution refuses unknown fields
  // (422 invalid_order): send the same order once more without them, so the order is never
  // lost to a deploy order mistake. `lead` tells whether the server got the Lead event id.
  function postOrder(body) {
    return postOnce(body).then(function (res) {
      if (res.ok || res.error !== 'invalid_order' || !(body.event_id || body.attribution)) { res.lead = !!body.event_id; return res; }
      var plain = {};
      Object.keys(body).forEach(function (k) { if (k !== 'event_id' && k !== 'attribution') plain[k] = body[k]; });
      return postOnce(plain).then(function (res2) { res2.lead = false; return res2; });
    });
  }
  // site-order refuses bodies over 4 KB: drop the least useful attribution parts first (the
  // order itself always goes). fbclid is also inside fbc; the first touch is the oldest.
  function fitOrder(body) {
    function size() { var s = JSON.stringify(body); return window.TextEncoder ? new TextEncoder().encode(s).length : s.length * 3; }
    var a = body.attribution;
    if (!a || size() <= 3800) return;
    a.fbclid = null;
    if (size() <= 3800) return;
    a.first_touch = null;
    if (size() <= 3800) return;
    delete body.attribution;
  }
  // What the order carries for ad attribution (js/tracking.js decides what consent allows).
  function orderAttribution() {
    try {
      var a = tracking && tracking.attribution ? tracking.attribution() : null;
      if (!a) return null;
      a.funnel_version = state.fv;
      a.journey = journey || null;
      return a;
    } catch (e) { return null; }
  }
  function sendCodOrder() {
    if (codOrder.state === 'sending') return; // a double tap sends once
    var r = rec();
    var probs = F.checkoutProblems(buyerForCheck(), r.type);
    if (probs.length) { showProblems(probs); return; }
    var firstTry = !buyer.requestId;
    if (!buyer.requestId) {
      buyer.requestId = newRequestId();
      buyer.leadEventId = tracking && tracking.newEventId ? tracking.newEventId() : newRequestId();
      if (!/^[0-9a-f-]{36}$/.test(buyer.leadEventId)) buyer.leadEventId = newRequestId();
      saveBuyer();
    }
    var trap = $('b-website');
    var total = OFFER.orderTotal(r.type, 'cod');
    var body = {
      request_id: buyer.requestId, name: buyer.name.trim(), phone: buyer.phone.trim(),
      shop_type: state.activity ? activityLineValue() : AR.act.other,
      offer: r.type, devices: state.mode, pay: 'cod', total_dzd: total,
      wilaya: wilayaText(), commune: communeText(), language: lang, website: trap ? trap.value : ''
    };
    // Ad attribution (DOUKKANY-MARKETING/migration/01-website-tracking.md): the Lead event id
    // and where the visit came from. Never a name or a phone in them.
    if (buyer.leadEventId) body.event_id = buyer.leadEventId;
    var attr = orderAttribution();
    if (attr) body.attribution = attr;
    fitOrder(body);
    var leadId = buyer.leadEventId;
    // A valid order asked for (a retry of the same order is not a new request).
    if (firstTry) sendGtm('purchase_requested', ext(priceParams(r.type), { method: 'site_order', pay: 'cod' }));
    codOrder.state = 'sending';
    redrawOrder('cod-btn');
    postOrder(body).then(function (res) {
      if (!res.ok) {
        codOrder.state = 'failed';
        track('order_submission_failed', { license_type: r.type, pay: 'cod' });
        redrawOrder('cod-btn');
        return;
      }
      // Success only after the server said ok (owner brief §13). Only now the Meta Lead
      // (contact_form_submitted), with the event id the server got (when it got one).
      track('order_submitted', { license_type: r.type, pay: 'cod' });
      sendGtm('contact_form_submitted', ext(eventParams(), ext(priceParams(r.type), { pay: 'cod', method: 'site_order' })), res.lead ? { eventId: leadId } : null);
      sendGtm('funnel_completed', { method: 'site_order', pay: 'cod', license_type: r.type });
      codOrder.state = 'done';
      codOrder.phone = body.phone;
      codOrder.ref = F.orderRef(body.request_id);
      codOrder.total = total;
      // The order is with us now: forget the buyer's details in this tab.
      buyer.name = ''; buyer.phone = ''; buyer.wilaya = 0; buyer.wilayaTxt = ''; buyer.commune = '';
      buyer.communeOther = ''; buyer.requestId = ''; buyer.leadEventId = ''; buyer.tried = false; saveBuyer();
      render('order', true);
    });
  }
  // Other devices or another offer after a sent order: a new order (the "we got it" screen
  // belongs to the order that was sent).
  function newOrder() { if (codOrder.state !== 'sending') { codOrder.state = 'idle'; codOrder.ref = ''; } }
  function activityLineValue() {
    var name = AR.act[state.activity] || AR.act.other;
    if (state.activity === 'other' && state.other) name += ': ' + state.other;
    return name;
  }

  function refreshOrderLink() { var a = $('order-btn'); if (a && rec().type !== 'phone') a.href = waLink(pcOrderMessage()); }
  function redrawOrder(focusId) {
    var old = view.querySelector('.scroll');
    var y = old ? old.scrollTop : 0;
    render('order', false);
    var list = view.querySelector('.scroll');
    if (list) list.scrollTop = y;
    var f = focusId && ($(focusId) || view.querySelector('[data-act="' + focusId + '"]'));
    if (f) f.focus();
  }

  // "The computer you are on" for the Windows question (Chromium browsers on Windows only).
  var winInfo = null;
  if (DEVICE === 'windows' && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    navigator.userAgentData.getHighEntropyValues(['platformVersion', 'bitness']).then(function (v) {
      var major = parseInt(v.platformVersion, 10);
      if (isNaN(major)) return;
      winInfo = (major >= 13 ? 'Windows 11' : major >= 1 ? 'Windows 10' : 'Windows 7 / 8') + (v.bitness ? ' · ' + v.bitness + '-bit' : '');
    }, function () {});
  }

  function pill(act, label, pressed, id) {
    return '<button type="button" class="pill" data-act="' + act + '"' + (id ? ' id="' + id + '"' : '') + ' aria-pressed="' + pressed + '">' + esc(label) + '</button>';
  }
  function invalidAttr(bad, id) { return bad ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : ''; }
  function field(id, label, control, err) {
    return '<div class="field' + (err ? ' invalid' : '') + '"><label for="' + id + '">' + esc(label) + '</label>' + control +
      (err ? '<p class="err" id="' + id + '-err">' + esc(err) + '</p>' : '') + '</div>';
  }
  function placeFields(wErr, cErr) {
    if (placesState === 'failed') {
      return field('b-wilaya-txt', t.fWilaya, '<input id="b-wilaya-txt" type="text" maxlength="60" autocomplete="address-level1" value="' + esc(buyer.wilayaTxt) + '"' + invalidAttr(wErr, 'b-wilaya-txt') + '>', wErr && t.errWilaya) +
        field('b-commune-txt', t.fCommune, '<input id="b-commune-txt" type="text" maxlength="60" autocomplete="address-level2" value="' + esc(buyer.communeOther) + '"' + invalidAttr(cErr, 'b-commune-txt') + '>', cErr && t.errCommune);
    }
    if (placesState !== 'ok') {
      return field('b-wilaya', t.fWilaya, '<select id="b-wilaya" disabled><option>' + esc(t.fLoading) + '</option></select>');
    }
    var nameAt = lang === 'ar' ? 2 : 1;
    var wOpts = '<option value="">' + esc(t.fChoose) + '</option>' + places.map(function (w) {
      return '<option value="' + w[0] + '"' + (w[0] === buyer.wilaya ? ' selected' : '') + '>' + w[0] + ' - ' + esc(w[nameAt]) + '</option>';
    }).join('');
    var out = field('b-wilaya', t.fWilaya, '<select id="b-wilaya" autocomplete="address-level1"' + invalidAttr(wErr, 'b-wilaya') + '>' + wOpts + '</select>', wErr && t.errWilaya);
    var w = wilayaOf(buyer.wilaya);
    if (w) {
      var cAt = lang === 'ar' ? 1 : 0;
      var cOpts = '<option value="">' + esc(t.fChoose) + '</option>' + w[3].map(function (c) {
        return '<option value="' + esc(c[0]) + '"' + (c[0] === buyer.commune ? ' selected' : '') + '>' + esc(c[cAt]) + '</option>';
      }).join('') + '<option value="other"' + (buyer.commune === 'other' ? ' selected' : '') + '>' + esc(t.fOtherCommune) + '</option>';
      var otherBad = cErr && buyer.commune === 'other';
      out += field('b-commune', t.fCommune, '<select id="b-commune" autocomplete="address-level2"' + invalidAttr(cErr && !otherBad, 'b-commune') + '>' + cOpts + '</select>', cErr && !otherBad && t.errCommune);
      if (buyer.commune === 'other') out += field('b-commune-txt', t.fOtherPh, '<input id="b-commune-txt" type="text" maxlength="60" value="' + esc(buyer.communeOther) + '"' + invalidAttr(otherBad, 'b-commune-txt') + '>', otherBad && t.errCommune);
    } else if (cErr) {
      out += '<p class="err">' + esc(t.errCommune) + '</p>';
    }
    return out;
  }

  // After a failed try, a field that is now right loses its red mark at once, in place (never a
  // redraw while typing: it would move the focus and lose what is being typed).
  function clearFixed(field, el) {
    if (!buyer.tried || !el) return;
    var probs = F.checkoutProblems(buyerForCheck(), rec().type);
    if (!probs.some(function (p) { return p[0] === field; })) {
      var wrap = el.closest('.field');
      if (wrap) wrap.classList.remove('invalid');
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
      var err = $(el.id + '-err');
      if (err) err.parentNode.removeChild(err);
    }
    var om = $('order-msg');
    if (om) {
      om.textContent = probs.length ? fill(t.fixMissing, { fields: probs.map(function (p) { return t.fieldName[p[0]]; }).join(t.sep) }) : '';
      om.classList.toggle('bad', probs.length > 0);
    }
  }

  function bindOrderForm() {
    function onInput(id, key, field) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', function () {
        buyer[key] = el.value.replace(/[\u0000-\u001F<>]/g, ' ').slice(0, key === 'phone' ? 20 : 60);
        buyerEdited(); refreshOrderLink(); clearFixed(field, el);
      });
    }
    onInput('b-name', 'name', 'name');
    onInput('b-phone', 'phone', 'phone');
    onInput('b-wilaya-txt', 'wilayaTxt', 'wilaya');
    onInput('b-commune-txt', 'communeOther', 'commune');
    var ws = $('b-wilaya');
    if (ws) ws.addEventListener('change', function () { buyer.wilaya = ws.value | 0; buyer.commune = ''; buyerEdited(); redrawOrder('b-commune'); });
    var cs = $('b-commune');
    if (cs) cs.addEventListener('change', function () {
      var wasOther = buyer.commune === 'other';
      buyer.commune = cs.value; buyerEdited();
      if (wasOther || buyer.commune === 'other' || buyer.tried) redrawOrder(buyer.commune === 'other' ? 'b-commune-txt' : 'b-commune');
      else refreshOrderLink();
    });
  }

  // ---------------------------------------------------------------------------------
  // After a screen is drawn
  // ---------------------------------------------------------------------------------
  function afterRender(step, viewed) {
    if (viewed) {
      var n = F.progressIndex(step, state);
      track('step_viewed', { funnel_step: step, step_number: n < 0 ? undefined : n + 1 });
      var p = eventParams();
      var r = rec();
      // A price on screen (Meta ViewContent, and "price seen" for QualifiedDownload). Once per
      // screen per page load. The prices list shows three offers: no single value.
      if (step === 'prices') trackOnce('price:prices', 'pricing_viewed', ext(p, { funnel_step: 'prices' }));
      if (step === 'price' && r.ok) trackOnce('price:price', 'pricing_viewed', ext(p, ext(priceParams(r.type), { funnel_step: 'price' })));
      if (step === 'devices' && F.isBuy(state)) trackOnce('price:devices', 'pricing_viewed', ext(p, { funnel_step: 'devices' }));
      if (step === 'ready' || step === 'trial') track('recommendation_viewed', p);
      if (step === 'order' && codOrder.state !== 'done') {
        track('checkout_started', p);
        if (r.ok) {
          trackOnce('price:order', 'pricing_viewed', ext(p, ext(priceParams(r.type), { funnel_step: 'order' })));
          gtmOnce('checkout', 'purchase_form_started', ext(p, priceParams(r.type)));
        }
      }
      if (step === 'course') gtmOnce('course', 'quick_course_viewed', ext(p, { funnel_step: 'course' }));
    }
    // v2 end screen: the offer and the videos sit below the download buttons. They count as
    // seen only once they are really on screen (half visible).
    if (step === 'ready') {
      whenSeen(view.querySelector('.offer-mini'), function () {
        var r2 = rec();
        if (r2.ok) trackOnce('price:ready', 'pricing_viewed', ext(eventParams(), ext(priceParams(r2.type), { funnel_step: 'ready' })));
      });
      whenSeen(view.querySelector('.videos'), function () { gtmOnce('course', 'quick_course_viewed', ext(eventParams(), { funnel_step: 'ready' })); });
    }
    if (step === 'activity') {
      var input = $('other');
      if (input) input.addEventListener('input', function () { state.other = F.cleanState({ v: 1, other: input.value }).other; save(); });
      // A shop type picked by an ad link: show it (still easy to change).
      var picked = view.querySelector('.tile[aria-pressed="true"]');
      if (picked && viewed) picked.scrollIntoView({ block: 'nearest' });
    }
    if ((step === 'ready' || step === 'trial' || step === 'download') && (devices() || {}).pcs !== 0) resolveLatest();
    if (step === 'download') resolveLatest();
    if (step === 'order') bindOrderForm();
    if (step === 'prices') {
      ['c-day', 'c-days'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('input', updateCalc); });
    }
  }

  // Calls fn once when el is at least half on screen (inside the scrolling list). Browsers
  // without IntersectionObserver: never (a price we cannot see shown is not counted).
  function whenSeen(el, fn) {
    if (!el || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && en.intersectionRatio >= 0.5) { io.disconnect(); fn(); }
      });
    }, { threshold: [0.5] });
    io.observe(el);
  }

  function eventParams() {
    var d = devices(), r = rec();
    return {
      intention: state.intent || undefined, activity: state.activity || undefined,
      platform: d ? state.mode : undefined,
      device_count: d ? d.pcs + d.phones : undefined, license_type: r.ok ? r.type : undefined,
      pain_count: state.activity ? state.pains.length : undefined
    };
  }

  // ---- Latest Windows installer (same feed as the app's auto-update and /download/) ----
  var latest = null, latestPromise = null;
  function resolveLatest() {
    if (!latestPromise) {
      latestPromise = fetch(FEED_URL, { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('feed'); return r.json(); })
        .then(function (f) {
          if (!f.downloadUrl || !/\.exe$/i.test(f.downloadUrl)) throw new Error('feed');
          return { url: f.downloadUrl, label: f.version + ' (' + f.build + ')', signed: f.signed };
        })
        .catch(function () {
          return fetch(API_URL, { headers: { Accept: 'application/vnd.github+json' } })
            .then(function (r) { if (!r.ok) throw new Error('api'); return r.json(); })
            .then(function (rel) {
              var exe = (rel.assets || []).filter(function (a) { return /^Doukkany-.*\.exe$/i.test(a.name); })[0];
              if (!exe) throw new Error('api');
              return { url: exe.browser_download_url, label: rel.tag_name };
            });
        })
        .then(function (found) { latest = found; return found; })
        .catch(function () { return null; });
    }
    latestPromise.then(function (found) {
      var b = $('win-btn');
      if (b && found) b.href = found.url;
      var tip = $('smartscreen');
      if (tip && found && found.signed === true) tip.hidden = true;
    });
  }

  // ---------------------------------------------------------------------------------
  // Actions (one click handler for the whole page)
  // ---------------------------------------------------------------------------------
  function copy(text, msgId, okText) {
    function done() { var m = $(msgId); if (m) m.textContent = okText; }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { if (document.execCommand('copy')) done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  // Skipping the questions: the end screen with the device the visitor is on (can be changed).
  function skipAll() {
    if (!state.mode) { state.mode = F.defaultMode(DEVICE); save(); }
    go(F.trialEnd(state));
  }

  document.addEventListener('click', function (e) {
    var lessonA = e.target.closest && e.target.closest('a[data-v]');
    if (lessonA) { openLesson(e, lessonA); return; }

    var wa = e.target.closest && e.target.closest('a[data-wa]');
    if (wa) {
      // The PC order form: say what is missing instead of opening WhatsApp half empty.
      if (wa.id === 'order-btn' && current === 'order' && rec().type !== 'phone') {
        var probs = F.checkoutProblems(buyerForCheck(), rec().type);
        if (probs.length) { e.preventDefault(); showProblems(probs); return; }
        refreshOrderLink();
      }
      var purpose = wa.getAttribute('data-wa');
      var p = eventParams();
      p.purpose = purpose;
      if (purpose === 'order' && current === 'order') p.pay = rec().type === 'phone' ? 'prepaid' : buyer.pay;
      // A click opens WhatsApp; it is not a message sent, nor a purchase (owner brief §19).
      track('whatsapp_clicked', p);
      if (purpose === 'order' && current === 'order' && codOrder.state !== 'done') {
        var m = $('order-msg'); if (m) { m.classList.remove('bad'); m.textContent = t.orderOpened; }
      }
      return;
    }
    if (e.target.closest && e.target.closest('#win-btn')) {
      // A click on the download, not an install.
      track('download_clicked', { platform: 'windows', link_type: latest ? 'installer' : 'release_page', app_version: latest ? latest.label : undefined, funnel_step: current });
      var pm = $('pc-msg'); if (pm) pm.textContent = t.starting;
      return;
    }
    if (e.target.closest && e.target.closest('#play-btn')) {
      e.target.closest('#play-btn').href = playUrl(); // the consent answer may have come after the screen was drawn
      track('download_clicked', { platform: 'android', link_type: 'play_store', funnel_step: current });
      return;
    }

    var el = e.target.closest && e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var parts = act.split(':');
    switch (parts[0]) {
      case 'go':
        e.preventDefault();
        if (parts[1] === 'download') { journey = 'download'; track('direct_download_selected', {}); }
        if (parts[1] === 'prices') journey = journey || 'prices';
        go(parts[1]);
        break;
      case 'resume':
        go(F.allowedStep(state, state.last || (F.isBuy(state) ? 'order' : F.trialEnd(state))));
        break;
      case 'restart': reset(); hadProgress = false; journey = null; render('welcome', true); break;
      case 'demo': openDemo(); break;
      case 'intent':
        state.intent = parts[1]; save();
        journey = parts[1];
        track(parts[1] === 'trial' ? 'trial_journey_selected' : 'purchase_journey_selected', {});
        go('activity');
        break;
      case 'activity':
        state.activity = parts[1]; save();
        track('activity_selected', { activity: parts[1] });
        if (parts[1] === 'other') { render('activity', false); var inp = $('other'); if (inp) inp.focus(); }
        else go(F.isBuy(state) ? 'devices' : 'pain');
        break;
      case 'pain':
        var at = state.pains.indexOf(parts[1]);
        if (at === -1) state.pains.push(parts[1]); else state.pains.splice(at, 1);
        save();
        track('challenges_selected', { pain: parts[1], selected: at === -1 });
        rerenderKeepFocus(act);
        break;
      case 'pain-done':
        if (!state.pains.length) track('challenges_skipped', { activity: state.activity || undefined });
        go('devices');
        break;
      case 'skip-all':
        track('challenges_skipped', { activity: state.activity || undefined, funnel_step: current });
        skipAll();
        break;
      case 'mode':
        if (state.mode !== parts[1]) newOrder();
        state.mode = parts[1]; save();
        track('device_selected', { platform: parts[1] });
        // Devices is the last question of both paths: the configuration is complete.
        (function () {
          var r = rec();
          gtmOnce('config:' + (state.activity || '-') + ':' + parts[1], 'configuration_completed', ext(eventParams(), r.ok ? priceParams(r.type) : {}));
        })();
        go(F.isBuy(state) ? 'order' : F.isV1(state) ? 'features' : 'ready');
        break;
      case 'plan':
        // A plan picked on the prices list: buy it (the shop type can be added later or not).
        newOrder();
        state.mode = parts[1] === 'phone' ? 'phone' : parts[1] === 'shop' ? 'two' : (state.mode === 'both' ? 'both' : 'pc');
        state.intent = 'buy'; journey = 'buy'; save();
        track('offer_viewed', { license_type: parts[1] });
        go('order');
        break;
      case 'path':
        state.intent = parts[1]; journey = parts[1]; save();
        if (parts[1] === 'buy') go(state.mode ? 'order' : 'devices');
        else go(F.isV1(state) && current === 'price' ? 'course' : F.trialEnd(state));
        break;
      case 'win': buyer.win = parts[1]; buyerEdited(); redrawOrder(act); break;
      case 'pay':
        if (buyer.pay !== parts[1]) track('payment_method_selected', { pay: parts[1], license_type: rec().type });
        buyer.pay = parts[1]; buyerEdited(); loadPlaces(); redrawOrder(act);
        break;
      case 'tophone': newOrder(); state.mode = 'phone'; buyer.win = ''; save(); go(F.isBuy(state) ? 'order' : F.trialEnd(state)); break;
      case 'cod-send': sendCodOrder(); break;
      case 'finish': sendGtm('quick_course_skipped', ext(eventParams(), { funnel_step: 'course' })); go(state.intent === 'buy' ? 'order' : 'trial'); break;
      case 'try-from-prices':
        state.intent = 'trial'; journey = 'trial'; save();
        track('trial_journey_selected', {});
        go('activity');
        break;
      case 'share-pc':
        navigator.share({ title: 'Doukkany', text: t.shareText, url: winLink('share') }).then(function () {
          $('pc-msg').textContent = t.shared; track('download_link_shared', { method: 'web_share' });
        }, function () {});
        break;
      case 'wa-pc':
        track('download_link_shared', { method: 'whatsapp' });
        window.open('https://wa.me/?text=' + encodeURIComponent(t.shareText + '\n' + winLink('share')), '_blank', 'noopener');
        break;
      case 'copy-pc': copy(winLink('copy'), 'pc-msg', t.copied); track('download_link_copied', { method: 'clipboard' }); break;
      // The link is built at the click (the campaign and the QualifiedDownload mark may have
      // changed since the screen was drawn).
      case 'mail-pc': el.href = mailLink(); track('download_email_app_opened', { method: 'mailto' }); break;
      case 'copy-play': copy(playUrl(), 'play-msg', t.copied); track('download_link_copied', { method: 'clipboard', platform: 'android' }); break;
      case 'wa-play':
        track('download_link_shared', { method: 'whatsapp', platform: 'android' });
        window.open('https://wa.me/?text=' + encodeURIComponent(t.playShareText + '\n' + playUrl()), '_blank', 'noopener');
        break;
    }
  });

  // FAQ opens (the toggle event does not bubble: listen in the capture phase).
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d && d.open && d.matches && d.matches('details[data-faq]')) {
      trackOnce('faq:' + d.getAttribute('data-faq'), 'faq_opened', { faq_id: d.getAttribute('data-faq'), funnel_step: current });
    }
  }, true);

  function rerenderKeepFocus(act) {
    var old = view.querySelector('.scroll');
    var y = old ? old.scrollTop : 0;
    render(current, false);
    var list = view.querySelector('.scroll');
    if (list) list.scrollTop = y;
    var again = view.querySelector('[data-act="' + act + '"]');
    if (again && !again.disabled) again.focus();
  }

  // ---- Video player: YouTube loads only after a click (youtube-nocookie) ----
  var player = $('player');
  var canDialog = player && typeof player.showModal === 'function';
  var playing = null; // { id, kind, done }
  function openDemo() {
    var i = F.demoFor(state);
    var a = document.createElement('a');
    a.setAttribute('data-v', String(i)); a.setAttribute('data-kind', 'demo'); a.href = videoUrl(i);
    if (!canDialog) { window.open(a.href, '_blank', 'noopener'); track('video_played', { tutorial_id: LESSONS.videos[i][0], video_kind: 'demo' }); return; }
    openLesson({ preventDefault: function () {}, button: 0 }, a);
  }
  function openLesson(e, a) {
    var i = +a.getAttribute('data-v');
    var id = LESSONS.videos[i][0];
    var kind = a.getAttribute('data-kind') === 'tutorial' ? 'tutorial' : 'demo';
    track('video_played', { tutorial_id: id, video_kind: kind, tutorial_category: LESSONS.videos[i][5], funnel_step: current });
    if (state.watched.indexOf(id) === -1) { state.watched.push(id); save(); }
    if (!canDialog || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    playing = { id: id, kind: kind, done: false };
    $('player-title').textContent = lessonTitle(i);
    $('player-yt').href = videoUrl(i);
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1&enablejsapi=1&hl=' + lang +
      '&origin=' + encodeURIComponent(location.origin);
    f.title = lessonTitle(i);
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    // Ask the player to tell us its state, to know when a video was watched to the end.
    f.addEventListener('load', function () {
      try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (err) {}
    });
    $('player-frame').textContent = '';
    $('player-frame').appendChild(f);
    player.showModal();
  }
  window.addEventListener('message', function (e) {
    if (!playing || playing.done) return;
    var host = '';
    try { host = new URL(e.origin).hostname; } catch (err) { return; }
    if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return;
    var d;
    try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
    var ended = d && ((d.event === 'onStateChange' && d.info === 0) || (d.event === 'infoDelivery' && d.info && d.info.playerState === 0));
    if (ended) { playing.done = true; track('video_completed', { tutorial_id: playing.id, video_kind: playing.kind }); }
  });
  function afterPlayer() {
    if (!$('player-frame').firstChild) return;
    $('player-frame').textContent = '';
    playing = null;
    if (current === 'course' || current === 'trial' || current === 'ready') rerenderKeepFocus('none');
  }
  function closePlayer() { if (player.open) player.close(); afterPlayer(); }
  if (player) {
    $('player-close').addEventListener('click', closePlayer);
    player.addEventListener('click', function (e) { if (e.target === player) closePlayer(); });
    player.addEventListener('close', afterPlayer);
  }

  $('back').addEventListener('click', back);

  // ---------------------------------------------------------------------------------
  // Language (same choice as the other pages: ?lang= or the saved one, Arabic by default)
  // ---------------------------------------------------------------------------------
  function pickLang() {
    var asked = params.get('lang');
    if (TEXT[asked]) return asked;
    try { var saved = localStorage.getItem('doukkany-lang'); if (TEXT[saved]) return saved; } catch (e) {}
    return 'ar';
  }
  function setLang(next) {
    lang = next; t = TEXT[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t.title;
    document.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = t[n.getAttribute('data-t')]; });
    $('logo').setAttribute('aria-label', t.home);
    $('player-close').setAttribute('aria-label', t.close);
    document.querySelectorAll('.langs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    try { localStorage.setItem('doukkany-lang', lang); } catch (e) {}
  }
  document.querySelectorAll('.langs button').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = b.getAttribute('data-lang');
      if (next === lang) return;
      track('language_changed', { from_language: lang, to_language: next });
      setLang(next);
      if (current) render(current, false);
    });
  });

  // ---------------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------------
  // Full-screen layout (index.html "App shell"). The real visible height, because 100vh is
  // taller than the screen in some phone browsers (address bar) and older ones have no dvh.
  function setAppHeight() { document.documentElement.style.setProperty('--app-h', window.innerHeight + 'px'); }
  document.documentElement.classList.add('app');
  setAppHeight();
  window.addEventListener('resize', setAppHeight);
  setLang(pickLang());
  if (params.get('go') === 'prices' && !location.hash) history.replaceState(null, '', '#prices');
  if (params.get('go') === 'download' && !location.hash) history.replaceState(null, '', '#download');
  save();
  var first = F.allowedStep(state, stepFromHash());
  if (first === 'download') journey = 'download';
  else if (first === 'prices') journey = journey || 'prices';
  history.replaceState({ dk: 0 }, '', location.pathname + location.search + '#' + first);
  track('funnel_viewed', { funnel_step: first });
  render(first, false);
})();
