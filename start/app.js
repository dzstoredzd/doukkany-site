/* Doukkany /start/ funnel: screens and actions.
 * Data and rules: funnel.js (shop types, lessons, steps), ../js/offer.js (prices),
 * ../js/lessons.js (the 25 videos), texts.js (words). Nothing here sends personal data:
 * the answers stay in this browser (localStorage) until the visitor sends a WhatsApp message. */
(function () {
  'use strict';
  var OFFER = window.DK_OFFER, LESSONS = window.DK_LESSONS, F = window.DK_FUNNEL, TEXT = window.DK_START_TEXT;
  var COUNTER = window.DK_COUNTER || null;
  var tracking = window.dkTracking || null;

  var WA_NUMBER = '213775452101'; // same as the app (kSupportPhone) and /download/
  var PLAY_URL = 'https://play.google.com/store/apps/details?id=com.yousoft.doukkany';
  var RELEASE_PAGE = 'https://github.com/dzstoredzd/doukkany-releases/releases/latest';
  var FEED_URL = 'https://raw.githubusercontent.com/dzstoredzd/doukkany-releases/main/doukkany/stable/latest.json';
  var API_URL = 'https://api.github.com/repos/dzstoredzd/doukkany-releases/releases/latest';
  var STORE_KEY = 'dk-start-v1';

  // Funnel events (owner, 2026-11-26: "events next"). They go to js/tracking.js, which sends
  // nothing before the visitor says OK on the consent bar, and only names/params it lists.
  var EVENTS_ON = true;
  function track(name, p) {
    // Our own anonymous counter: every visitor (counter.js says what it sends).
    try { if (ownCounter) ownCounter.count(name, p); } catch (e) {}
    if (!EVENTS_ON) return;
    try { if (tracking) tracking.track(name, p); } catch (e) {}
  }

  var view = document.getElementById('view');
  var params = new URLSearchParams(location.search);
  var lang = 'ar';
  var t = TEXT.ar;
  var current = null;
  var depth = 0;          // our own history entries above the first one

  // ---------------------------------------------------------------------------------
  // Saved answers
  // ---------------------------------------------------------------------------------
  var state = (function () {
    try { return F.cleanState(JSON.parse(localStorage.getItem(STORE_KEY) || 'null')); } catch (e) { return F.cleanState(null); }
  })();
  var hadProgress = !!(state.intent || state.activity || state.mode);
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
  function reset() { state = F.cleanState(null); save(); }

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
  function money(n) { return '<bdi class="ltr">' + OFFER.format(n) + '</bdi>'; }
  // A price inside plain text (summaries, WhatsApp messages): kept left-to-right, else Arabic
  // text shows "14 000" as "000 14".
  function num(n) { return '⁦' + OFFER.format(n) + '⁩'; }
  function $(id) { return document.getElementById(id); }

  var DEVICE = (function () {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/windows/i.test(ua)) return 'windows';
    return 'other';
  })();
  var IS_PHONE = DEVICE === 'android' || DEVICE === 'ios';

  // Own counter (owner, 2026-11-26). Real site only; with ?dk_debug=1 elsewhere it keeps the
  // batches in window.__dkCounterSent and sends nothing (for checks).
  var ownCounter = (function () {
    if (!COUNTER) return null;
    var live = location.hostname === 'yousoft.site';
    var debug = !live && params.get('dk_debug') === '1';
    var internal = false;
    try { internal = localStorage.getItem('dk_internal') === '1'; } catch (e) {}
    var ad = COUNTER.campaignFrom(location.search);
    var c = COUNTER.createCounter({
      on: live || debug, internal: internal,
      base: function () {
        var b = { page_language: lang, device: DEVICE };
        Object.keys(ad).forEach(function (k) { b[k] = ad[k]; });
        return b;
      },
      post: live ? COUNTER.browserPost : function (url, body) {
        (window.__dkCounterSent = window.__dkCounterSent || []).push(JSON.parse(body));
      }
    });
    function leave() { c.flush(true); }
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') leave(); });
    return c;
  })();

  function devices() { return F.devices(state); }
  function rec() { var d = devices(); return d ? OFFER.recommend(d.pcs, d.phones) : { ok: false, reason: 'none' }; }

  function activityName() {
    var name = t.act[state.activity] || '';
    if (state.activity === 'other' && state.other) name += ': ' + state.other;
    return name;
  }
  function devicesText(d) {
    d = d || devices();
    if (!d) return '';
    var parts = [];
    if (d.pcs) parts.push(t.devPc + ' × ' + d.pcs);
    if (d.phones) parts.push(t.devPhone + ' × ' + d.phones);
    var s = parts.join(' · ');
    if (d.pcs + d.phones > 1) s += ' (' + t.sharedYes + ')';
    return s;
  }
  function offerName(r) { return r.ok ? t.plan[r.type][0] : ''; }

  function waLink(text) { return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text); }
  function campaignQuery(via) { try { return tracking ? tracking.campaignQuery(via) : ''; } catch (e) { return ''; } }
  function withCampaign(url, via) { var q = campaignQuery(via); return q ? url + (url.indexOf('?') === -1 ? '?' : '&') + q : url; }
  function playUrl() { var q = campaignQuery(); return q ? PLAY_URL + '&referrer=' + encodeURIComponent(q) : PLAY_URL; }
  // The same PC link as /download/'s "send the link to your PC": on a PC it starts the download.
  function winLink(via) { return withCampaign(new URL('../download/', location.href).href + '?get=windows&lang=' + lang, via); }

  // ---------------------------------------------------------------------------------
  // Navigation: one history entry per step, so the phone's Back button works.
  // ---------------------------------------------------------------------------------
  function stepFromHash() { return (location.hash || '').replace(/^#/, '') || 'welcome'; }

  function go(step, replace) {
    step = F.allowedStep(state, step, OFFER);
    if (replace || step === current) history.replaceState({ dk: depth }, '', '#' + step);
    else { depth += 1; history.pushState({ dk: depth }, '', '#' + step); }
    render(step, true);
  }
  function back() {
    if (history.state && history.state.dk > 0) { history.back(); return; }
    var prev = current === 'prices' ? 'welcome' : F.previousStep(state, current);
    history.replaceState({ dk: 0 }, '', '#' + prev);
    render(prev, true);
  }
  window.addEventListener('popstate', function (e) {
    depth = e.state && e.state.dk ? e.state.dk : 0;
    var step = F.allowedStep(state, stepFromHash(), OFFER);
    if (step !== stepFromHash()) history.replaceState({ dk: depth }, '', '#' + step);
    render(step, true);
  });

  // ---------------------------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------------------------
  // `focus` = the visitor moved to this screen (not a redraw: language, +/−, closing a video).
  var firstRender = true;
  function render(step, focus) {
    current = step;
    // The first page is a normal page, so Chrome's slide-down refresh works there (owner).
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

  // The page itself never scrolls (owner, 2026-11-26): the question stays at the top, the
  // answers are the only part that scrolls, the buttons stay at the bottom. No site footer and
  // no "a question?" line on this page (owner, 2026-11-26).
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
    if (i >= 0) for (var k = 1; k <= total; k++) seg += '<i' + (k <= n ? ' class="on"' : '') + '></i>'; // none on the prices page
    $('bar').innerHTML = seg;
    $('prog-txt').textContent = i < 0 ? '' : fill(t.stepOf, { n: n, t: total });
    $('back-txt').textContent = t.back;
  }

  // A coloured icon: its colour says what it is (owner, 2026-11-26).
  function cic(id, color, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" style="color:' + color + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  var C = { win: '#0078D4', android: '#16A34A', both: '#7C3AED', blue: '#2563EB', green: '#16A34A',
    orange: '#EA580C', teal: '#0D9488', slate: '#475569', pink: '#DB2777', amber: '#D97706' };

  function choice(act, icon, title, desc, opts) {
    opts = opts || {};
    return '<button type="button" class="choice' + (opts.cls ? ' ' + opts.cls : '') + '" data-act="' + act + '"' +
      (opts.color ? ' style="--c:' + opts.color + '"' : '') +
      (opts.pressed != null ? ' aria-pressed="' + opts.pressed + '"' : '') + '>' +
      '<span class="ci">' + ic(icon, opts.fillIcon ? 'f' : '') + '</span>' +
      '<span class="ct"><b>' + esc(title) + '</b>' + (desc ? '<span class="cd">' + esc(desc) + '</span>' : '') + (opts.tag ? '<span class="tag">' + esc(opts.tag) + '</span>' : '') + '</span>' +
      '<span class="go">' + ic('i-next', 'flip') + '</span></button>';
  }

  var SCREENS = {
    welcome: function () {
      var resume = '';
      if (hadProgress && state.activity) {
        resume = '<div class="note resume"><p>' + esc(t.resumeTxt) + '</p>' +
          '<button type="button" class="btn soft" data-act="resume">' + esc(t.resumeBtn) + '</button>' +
          '<button type="button" class="link" data-act="restart">' + esc(t.restartBtn) + '</button></div>';
      }
      // Title on top, pills and the prices link in the middle, the two big choices at the
      // bottom within thumb reach (owner, 2026-11-26).
      function pick(act, icon, title, cls, color) {
        return '<button type="button" class="pick ' + cls + '" data-act="' + act + '"' + (color ? ' style="--c:' + color + '"' : '') + '>' +
          '<span class="pv">' + ic(icon) + '</span>' +
          '<span class="pl"><b>' + esc(title) + '</b>' + ic('i-next', 'flip') + '</span></button>';
      }
      return '<h1>' + esc(t.wTitle) + '</h1><p class="lead">' + esc(t.wSub) + '</p>' +
        '<div class="mid">' + resume +
        '<ul class="facts"><li>' + cic('i-cloudoff', C.blue) + esc(t.factOffline) + '</li><li>' + cic('i-check', C.green) + esc(t.factOnce) + '</li><li>' + cic('i-devices', C.both) + esc(t.factDevices) + '</li></ul>' +
        '</div>' +
        '<div class="dock picks">' + pick('intent:trial', 'i-play-c', t.trialT, 'primary') + pick('intent:buy', 'i-bag', t.buyT, '', C.blue) + '</div>';
    },

    activity: function () {
      // One shop type per row, each with its own colour (owner, 2026-11-26).
      var tiles = F.ACTIVITIES.map(function (a) {
        return '<button type="button" class="tile" style="--c:' + a.color + '" data-act="activity:' + a.id + '" aria-pressed="' + (state.activity === a.id) + '">' +
          '<span class="ci">' + ic(a.icon) + '</span><span class="tl">' + esc(t.act[a.id]) + '</span>' + ic('i-next', 'flip go') + '</button>';
      }).join('');
      var other = state.activity === 'other' ?
        '<div class="field"><label for="other">' + esc(t.otherLabel) + '</label>' +
        '<input id="other" type="text" maxlength="60" autocomplete="off" placeholder="' + esc(t.otherPh) + '" value="' + esc(state.other) + '">' +
        '</div>' +
        '<div class="dock"><button type="button" class="btn block" data-act="go:' + (F.isBuy(state) ? 'devices' : 'pain') + '">' + esc(t.next) + '</button></div>' : '';
      return '<h1>' + esc(t.aTitle) + '</h1><p class="q-sub">' + esc(t.aSub) + '</p><div class="tiles list">' + tiles + '</div>' + other;
    },

    // "What bothers you most?": several answers or none. A chosen answer shows its fix at once.
    pain: function () {
      var a = F.activity(state.activity);
      var shown = F.painsFor(state.activity);
      var chosen = 0;
      var tiles = shown.map(function (p) {
        var on = state.pains.indexOf(p.id) !== -1;
        if (on) chosen += 1;
        return '<button type="button" class="tile pain" style="--c:' + p.color + '" data-act="pain:' + p.id + '" aria-pressed="' + on + '">' +
          '<span class="ci">' + ic(p.icon) + '</span><span>' + esc(t.pain[p.id]) + '</span>' +
          (on ? '<span class="fix">' + ic('i-check') + esc(fill(t.painFix, { feature: t.feat[F.painFeature(p, a)][0] })) + '</span>' : '') +
          '</button>';
      }).join('');
      return '<h1>' + esc(t.painTitle) + '</h1>' +
        '<div class="tiles">' + tiles + '</div>' +
        '<div class="dock"><button type="button" class="btn block" data-act="go:devices">' + esc(chosen ? t.next : t.painSkip) + '</button></div>';
    },

    devices: function () {
      var hereTag = function (m) {
        if ((m === 'pc' && DEVICE === 'windows') || (m === 'phone' && DEVICE === 'android')) return t.here;
        return null;
      };
      // Three choices only, for buying and trying (owner, 2026-11-26): computer, phone,
      // computer + phone. Two PCs (shop pack) and "not sure" are no longer on this screen.
      return '<h1>' + esc(t.dTitle) + '</h1><p class="q-sub">' + esc(t.dSub) + '</p>' +
        '<div class="choices">' +
        choice('mode:pc', 'i-win', t.modePcT, t.modePcD, { pressed: state.mode === 'pc', tag: hereTag('pc'), fillIcon: true, color: C.win }) +
        choice('mode:phone', 'i-phone', t.modePhoneT, t.modePhoneD, { pressed: state.mode === 'phone', tag: hereTag('phone'), color: C.android }) +
        choice('mode:both', 'i-pcphone', t.modeBothT, t.modeBothD, { pressed: state.mode === 'both', color: C.both }) +
        '</div>';
    },

    features: function () {
      var a = F.activity(state.activity);
      var ff = F.featuresFor(state);
      // A plain list, no app screenshots (owner, 2026-11-26).
      var list = ff.list.map(function (f) {
        var because = ff.why[f] ? '<span class="why-tag">' + esc(fill(t.becauseTag, { pain: t.pain[ff.why[f]] })) + '</span>' : '';
        return '<li><div class="feat">' +
          '<span class="ok" style="--c:' + F.FEATURE_ICON[f][1] + '">' + ic(F.FEATURE_ICON[f][0]) + '</span><span><b>' + esc(t.feat[f][0]) + '</b><span class="fd">' + esc(t.feat[f][1]) + '</span>' + because + '</span></div></li>';
      }).join('');
      return '<h1>' + esc(t.fTitle) + '</h1><span class="chip">' + ic(a.icon) + esc(activityName()) + '</span>' +
        '<p class="q-sub block">' + esc(t.fSub) + '</p>' +
        '<ul class="feats" style="margin-top:8px">' + list + '</ul>' +
        '<ul class="facts"><li>' + cic('i-cloudoff', C.blue) + esc(t.factOffline) + '</li><li>' + cic('i-check', C.green) + esc(t.factOnce) + '</li></ul>' +
        '<div class="dock"><button type="button" class="btn block" data-act="go:price">' + esc(t.toPrice) + '</button></div>';
    },

    price: function () {
      var r = rec();
      var d = devices();
      var sub = state.intent === 'buy' ? t.pSubBuy : t.pSubTrial;
      var desc = t.plan[r.type][1];
      var extra = '';
      // A PC offer links its phone (and the 2nd PC) over the shop network: say how, plainly.
      if (r.type !== 'phone') extra += '<div class="note block"><b>' + esc(t.netTitle) + '</b>' + esc(t.netNote) + '</div>';
      if (r.type === 'shop') extra += '<p class="q-sub block">' + esc(t.trialRoom) + '</p>';
      var primary = state.intent === 'buy' ?
        buyLink('btn block', t.goBuy) + '<div class="row"><button type="button" class="link" data-act="path:trial">' + esc(t.altTrial) + '</button>' :
        '<button type="button" class="btn block" data-act="path:trial">' + esc(t.goTrial) + '</button><div class="row">' + buyLink('link', t.altBuy);
      return '<h1>' + esc(t.pTitle) + '</h1><p class="lead">' + esc(sub) + '</p>' +
        '<div class="offer"><span class="ribbon">' + esc(t.recTag) + '</span>' +
        '<h2>' + esc(offerName(r)) + '</h2><p class="od">' + esc(desc) + '</p>' +
        '<div class="price"><span class="amt">' + money(r.total) + '</span><span class="cur">' + esc(t.da) + '</span><span class="once">' + esc(t.once) + '</span></div>' +
        '<ul class="incl"><li>' + cic('i-devices', C.both) + '<span>' + esc(fill(t.worksOn, { devices: devicesText(r.includes) })) + '</span></li>' +
        '<li>' + cic('i-check', C.green) + '<span>' + esc(t.inclAll) + '</span></li>' +
        '<li>' + cic('i-cloudoff', C.blue) + '<span>' + esc(t.inclOffline) + '</span></li>' +
        '<li>' + cic('i-cash', C.teal) + '<span>' + esc(t.inclNoSub) + '</span></li>' +
        '<li>' + cic('i-gift', C.pink) + '<span>' + esc(t.inclTrial) + '</span></li></ul></div>' +
        whyHtml(r, d) +
        extra +
        '<div class="dock">' + primary + '<button type="button" class="link" data-act="go:devices">' + esc(t.changeDevices) + '</button></div></div>';
    },

    prices: function () {
      return '<h1>' + esc(t.pricesTitle) + '</h1><p class="lead">' + esc(t.pricesSub) + '</p>' +
        '<p class="block"><span class="trial-tag"><span class="n ltr">' + OFFER.trialDays + '</span>' + esc(t.vTrial.replace(/^\d+\s*/, '')) + '</span></p>' +
        '<div class="plans block">' + plansHtml(null) + '</div>' +
        '<ul class="incl block"><li>' + cic('i-check', C.green) + '<span>' + esc(t.inclAll) + '</span></li><li>' + cic('i-cloudoff', C.blue) + '<span>' + esc(t.inclOffline) + '</span></li><li>' + cic('i-cash', C.teal) + '<span>' + esc(t.inclNoSub) + '</span></li></ul>' +
        // "I want to try it" starts the trial path (owner, 2026-11-26).
        '<div class="dock"><button type="button" class="btn block" data-act="try-from-prices">' + esc(t.trialT) + '</button>' +
        // "Talk to us on WhatsApp" under it, where "Download" was (owner, 2026-11-26).
        '<div class="row"><a class="link" data-wa="help" href="' + esc(waLink(t.waHelp)) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(t.helpBtn) + '</a></div></div>';
    },

    course: function () {
      var ids = F.lessonsFor(state);
      var seen = ids.filter(function (i) { return state.watched.indexOf(LESSONS.videos[i][0]) !== -1; }).length;
      var d = devices();
      return '<h1>' + esc(t.cTitle) + '</h1><p class="q-sub">' + esc(fill(t.cSub, { activity: activityName() })) + '</p>' +
        (seen ? '<p class="chip">' + ic('i-check') + esc(fill(t.seenCount, { n: seen, t: ids.length })) + '</p>' : '') +
        '<ol class="lessons">' + ids.map(function (i, k) { return lessonHtml(i, k === 0); }).join('') + '</ol>' +
        (d && d.pcs === 0 ? '<p class="q-sub block">' + esc(t.phoneLessonsNote) + '</p>' : '') +
        '<p class="block">' + ytAll() + '</p>' +
        '<div class="dock"><button type="button" class="btn block" data-act="finish">' + esc(state.intent === 'buy' ? t.skipBuy : t.skipTrial) + '</button></div>';
    },

    trial: function () {
      var d = devices(), r = rec();
      var wantPc = d.pcs > 0, wantPhone = d.phones > 0;
      var blocks = '';
      if (wantPc) blocks += pcBlock();
      if (wantPhone) blocks += phoneBlock();
      var inst = '';
      if (wantPc) inst += '<ol class="steps-list">' + t.instPc.map(function (s) { return '<li><span>' + esc(s) + '</span></li>'; }).join('') + '</ol>';
      else inst += '<ol class="steps-list">' + t.instPhone.map(function (s) { return '<li><span>' + esc(s) + '</span></li>'; }).join('') + '</ol>';
      if (d.pcs > 0 && d.pcs + d.phones > 1) inst +='<p class="q-sub block">' + esc(t.instLink) + '</p>';
      var ids = F.lessonsFor(state).slice(0, 3);
      return '<h1>' + esc(t.tTitle) + '</h1><p class="lead">' + esc(t.tSub) + '</p>' +
        '<ul class="sum">' +
        sumRow(t.kActivity, activityName(), 'go:activity') +
        sumRow(t.kDevices, devicesText(), 'go:devices') +
        sumRow(t.kTrial, t.vTrial) +
        sumRow(t.kOffer, offerName(r) + ' · ' + num(r.total) + ' ' + t.da) +
        '</ul>' +
        '<div class="card"><h2>' + cic('i-dl', C.blue) + esc(t.dlTitle) + '</h2>' + blocks + '</div>' +
        '<div class="final-grid"><div class="card"><h2>' + esc(t.installTitle) + '</h2>' + inst + '</div>' +
        '<div class="card"><h2>' + esc(t.tLessons) + '</h2><ol class="lessons">' + ids.map(function (i, k) { return lessonHtml(i, k === 0); }).join('') + '</ol>' +
        '<p class="block">' + ytAll() + '</p></div></div>' +
        '<div class="help"><h2>' + esc(t.helpTitle) + '</h2><p>' + esc(t.helpText) + '</p>' +
        '<a class="btn wa" data-wa="trial" href="' + esc(waLink(fill(t.waTrial, { activity: activityName(), devices: devicesText() }))) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(t.helpBtn) + '</a></div>' +
        '<div class="actions"><div class="row">' + buyLink('link', t.buyNow) + '</div></div>';
    },

    order: function () {
      var r = rec();
      var total = r.type === 'phone' ? r.total : OFFER.orderTotal(r.type, buyer.pay);
      var sum = '<ul class="sum">' +
        sumRow(t.kActivity, activityName(), 'go:activity') +
        sumRow(t.kDevices, devicesText(), 'go:devices') +
        '<li><span class="k">' + esc(offerName(r)) + '</span><span class="v">' + money(r.total) + ' ' + esc(t.da) + '</span></li>' +
        (total !== r.total ? '<li><span class="k">' + esc(t.payPreT) + '</span><span class="v"><bdi class="ltr">−' + OFFER.format(r.total - total) + '</bdi> ' + esc(t.da) + '</span></li>' : '') +
        '<li class="total"><span class="k">' + esc(t.kTotal) + '</span><span class="v">' + money(total) + ' ' + esc(t.da) + '<br><small class="once" style="color:var(--green);font-size:.85rem">' + esc(t.once) + '</small></span></li>' +
        '</ul>';
      var dockEnd = '<p class="msg" id="order-msg" role="status"></p>' +
        '<div class="row"><button type="button" class="link" data-act="path:trial">' + esc(t.tryFirst) + '</button></div></div>';

      // Phone offer: nothing to fill, the WhatsApp message says it all.
      if (r.type === 'phone') {
        return '<h1>' + esc(t.oTitle) + '</h1><p class="lead">' + esc(t.phoneBuyText) + '</p>' + sum +
          '<p class="warn block">' + esc(t.paySafe) + '</p>' +
          '<div class="dock"><a class="btn wa block" id="order-btn" data-wa="order" href="' + esc(waLink(phoneOrderMessage())) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(t.buyWa) + '</a>' + dockEnd;
      }

      // A "pay at delivery" order that reached us: say so, and what happens next.
      if (codOrder.state === 'done') {
        return '<h1>' + esc(t.codDoneT) + '</h1><p class="lead">' + esc(fill(t.codDoneD, { phone: codOrder.phone })) + '</p>' + sum +
          '<div class="card"><h2>' + esc(t.nextTitle) + '</h2><ol class="steps-list">' + t.nextStepsCod.slice(1).map(function (s) { return '<li><span>' + esc(s) + '</span></li>'; }).join('') + '</ol></div>' +
          '<div class="dock"><button type="button" class="btn block soft" data-act="path:trial">' + esc(t.codDoneTry) + '</button></div>';
      }

      // PC offers: Windows check, the USB key, where to send it, how to pay.
      loadPlaces();
      var win = '<div class="card"><h2>' + ic('i-win', 'f') + esc(t.winQ) + '</h2><div class="pills">' +
        pill('win:yes', t.winYes, buyer.win === 'yes') + pill('win:no', t.winNo, buyer.win === 'no') + pill('win:unknown', t.winUnknown, buyer.win === 'unknown') + '</div>' +
        (buyer.win === 'unknown' ? '<p class="note block">' + esc(t.winHow) + (winInfo ? '<b style="margin-top:6px">' + esc(fill(t.winThis, { os: winInfo })) + '</b>' : '') + '</p>' : '') +
        (buyer.win === 'no' ? '<div class="warn block">' + esc(t.winNoText) + '<div class="actions" style="margin-top:10px"><button type="button" class="btn soft" data-act="tophone">' + esc(t.toPhoneOffer) + '</button>' +
          '<a class="link" data-wa="help" href="' + esc(waLink(t.waHelp)) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(t.helpBtn) + '</a></div></div>' : '') +
        '</div>';
      if (buyer.win === 'no') {
        return '<h1>' + esc(t.oTitle) + '</h1><p class="lead">' + esc(t.oSub) + '</p>' + win + sum +
          '<div class="dock"><button type="button" class="btn block" data-act="tophone">' + esc(t.toPhoneOffer) + '</button>' + dockEnd;
      }
      var usb = '<div class="card"><h2>' + cic('i-usb', C.slate) + esc(t.usbTitle) + '</h2><ul class="incl">' +
        t.usbItems.map(function (s) { return '<li>' + ic('i-check') + '<span>' + esc(s) + '</span></li>'; }).join('') + '</ul>' +
        '<p class="q-sub block">' + esc(t.usbPhone) + ' ' + esc(t.usbNote) + '</p></div>';
      var details = '<div class="card"><h2>' + cic('i-home', C.orange) + esc(t.detailsTitle) + '</h2>' +
        // A trap for robots: people never see this field (CSS .hp), robots fill it.
        '<input id="b-website" class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        field('b-name', t.fName, '<input id="b-name" type="text" maxlength="60" autocomplete="name" value="' + esc(buyer.name) + '">') +
        field('b-phone', t.fPhone, '<input id="b-phone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" dir="ltr" placeholder="' + esc(t.fPhonePh) + '" value="' + esc(buyer.phone) + '">') +
        placeFields() + '</div>';
      var pay = '<div class="card"><h2>' + cic('i-cash', C.teal) + esc(t.payTitle) + '</h2><div class="seg">' +
        choice('pay:prepaid', 'i-cash', t.payPreT, t.payPreD, { pressed: buyer.pay === 'prepaid', tag: fill(t.youSave, { discount: num(OFFER.prepaidDiscount) }), color: C.blue }) +
        choice('pay:cod', 'i-home', t.payCodT, t.payCodD, { pressed: buyer.pay === 'cod', color: C.orange }) + '</div>' +
        '<p class="warn block">' + esc(t.paySafe) + '</p></div>';
      // Pay at delivery: the order goes straight to us (Admin CRM), no WhatsApp. Paying first
      // (BaridiMob / CCP): the WhatsApp message, as before (owner, 2026-11-26).
      var cod = buyer.pay === 'cod';
      var steps = cod ? t.nextStepsCod : t.nextSteps;
      var sending = codOrder.state === 'sending';
      var send = cod ?
        '<button type="button" class="btn block" id="cod-btn" data-act="cod-send"' + (sending ? ' disabled' : '') + '>' + esc(sending ? t.codSending : t.codBtn) + '</button>' +
          (codOrder.state === 'failed' ? '<p class="msg bad" role="alert">' + esc(t.codFail) + ' <a class="link" data-wa="order" href="' + esc(waLink(pcOrderMessage())) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(t.codFailWa) + '</a></p>' : '') :
        '<a class="btn wa block" id="order-btn" data-wa="order" href="' + esc(waLink(pcOrderMessage())) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(t.sendOrder) + '</a>';
      return '<h1>' + esc(t.oTitle) + '</h1><p class="lead">' + esc(cod ? t.oSubCod : t.oSub) + '</p>' +
        sum + win + usb + details + pay +
        '<div class="card"><h2>' + esc(t.nextTitle) + '</h2><ol class="steps-list">' + steps.map(function (s) { return '<li><span>' + esc(s) + '</span></li>'; }).join('') + '</ol></div>' +
        (cod ? '<p class="q-sub block">' + esc(t.noDataCod) + ' <a class="link" href="../privacy.html#start-orders-' + lang + '" target="_blank" rel="noopener">' + esc(t.privacyLink) + '</a></p>'
          : '<p class="q-sub block">' + esc(t.noData) + '</p>') +
        '<div class="dock">' + send + dockEnd;
    }
  };

  function sumRow(k, v, editAct) {
    return '<li><span><span class="k">' + esc(k) + '</span><br><span class="v" style="text-align:start">' + esc(v) + '</span></span>' +
      (editAct ? '<button type="button" class="link edit" data-act="' + editAct + '">' + esc(t.edit) + '</button>' : '') + '</li>';
  }

  // "Why this offer?": the reasons, built from the visitor's own answers.
  function whyHtml(r, d) {
    var why = [];
    // Computer + phone is the same offer as computer alone, but say what the visitor chose.
    if (r.type === 'pc') why.push(fill(d && d.phones > 0 ? t.whyBoth : t.whyPc, { plan: t.plan.pc[0] }));
    else if (r.type === 'phone') why.push(fill(t.whyPhone, { plan: t.plan.phone[0] }));
    else if (r.type === 'shop') why.push(fill(t.whyShop, { plan: t.plan.shop[0], pc: t.plan.pc[0], diff: num(OFFER.plans.shop.price - OFFER.plans.pc.price) }));
    var ff = F.featuresFor(state);
    var fixed = ff.list.filter(function (f) { return ff.why[f]; }).map(function (f) { return t.feat[f][0]; });
    if (fixed.length) why.push(fill(t.whyPains, { features: fixed.join(t.sep) }));
    return '<div class="why block"><h2>' + cic('i-help', C.blue) + esc(t.whyTitle) + '</h2>' +
      '<p class="q-sub">' + esc(fill(t.whyFrom, { activity: activityName(), devices: devicesText(d) })) + '</p>' +
      '<ul>' + why.map(function (s) { return '<li>' + ic('i-next', 'flip') + '<span>' + esc(s) + '</span></li>'; }).join('') + '</ul></div>';
  }

  function plansHtml(r) {
    var recPlan = r && r.ok ? r.type : null;
    return OFFER.listOrder.map(function (id) {
      var p = OFFER.plans[id];
      return '<div class="plan' + (id === recPlan ? ' rec' : '') + '"><div><b>' + esc(t.plan[id][0]) + '</b><span class="pd">' + esc(t.plan[id][1]) + '</span></div>' +
        '<div class="pp">' + money(p.price) + ' ' + esc(t.da) + '<small>' + esc(t.vOnce) + '</small></div></div>';
    }).join('');
  }


  // "Watch all the episodes on YouTube": the whole playlist (owner, 2026-11-26).
  function ytAll() {
    return '<a class="link yt-all" data-yt-all href="https://www.youtube.com/playlist?list=' + LESSONS.playlistId + '" target="_blank" rel="noopener">' +
      ic('i-yt', 'f') + esc(t.ytAll) + '</a>';
  }
  function lessonTitle(i) { return LESSONS.videos[i][{ ar: 1, fr: 2, en: 3 }[lang]]; }
  function mmss(sec) { return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
  function videoUrl(i) { return 'https://www.youtube.com/watch?v=' + LESSONS.videos[i][0] + '&list=' + LESSONS.playlistId + '&index=' + (i + 1); }
  function lessonHtml(i, first) {
    var v = LESSONS.videos[i];
    var seen = state.watched.indexOf(v[0]) !== -1;
    return '<li><a class="lesson' + (first ? ' first' : '') + '" href="' + esc(videoUrl(i)) + '" target="_blank" rel="noopener" data-v="' + i + '">' +
      '<span class="thumb"><img src="https://i.ytimg.com/vi/' + v[0] + '/hq720.jpg" alt="" loading="lazy" decoding="async" width="9" height="16"><span class="pl"><span>' + ic('i-play', 'f') + '</span></span></span>' +
      '<span class="tx"><span class="tt">' + esc(lessonTitle(i)) + '</span><span class="td"><bdi class="ltr">' + mmss(v[4]) + '</bdi>' +
      (first ? '<span class="here">' + esc(t.startHere) + '</span>' : '') +
      (seen ? '<span class="seen">' + ic('i-check') + esc(t.seen) + '</span>' : '') + '</span></span></a></li>';
  }

  function pcBlock() {
    var head = '<h3 class="block" style="font-size:1.05rem">' + cic('i-win', C.win, 'f') + ' ' + esc(t.pcBlock) + ' <small class="q-sub">· ' + esc(t.pcReq) + '</small></h3>';
    if (IS_PHONE) {
      return head + '<div class="get"><p>' + esc(t.onPhonePc) + '</p><div class="share-row">' +
        (navigator.share ? '<button type="button" class="btn soft" data-act="share-pc">' + ic('i-share') + esc(t.shareBtn) + '</button>' : '') +
        '<button type="button" class="btn soft" data-act="wa-pc">' + ic('i-wa', 'f') + esc(t.waShare) + '</button>' +
        '<button type="button" class="btn soft" data-act="copy-pc">' + ic('i-copy') + esc(t.copyBtn) + '</button>' +
        '<a class="btn soft" data-act="mail-pc" href="' + esc(mailLink()) + '">' + ic('i-mail') + esc(t.mailBtn) + '</a>' +
        // The PC installer straight to this phone too (to copy it to the PC later; owner, 2026-11-26).
        '<a class="btn soft" id="win-btn" href="' + esc(latest ? latest.url : RELEASE_PAGE) + '">' + ic('i-dl') + esc(t.dlBtn) + '</a>' +
        '</div><p class="msg" id="pc-msg" role="status"></p></div>';
    }
    return head + '<div class="get"><a class="btn block" id="win-btn" href="' + esc(latest ? latest.url : RELEASE_PAGE) + '">' + ic('i-win', 'f') + esc(t.winBtn) + '</a>' +
      '<p class="msg" id="pc-msg" role="status"></p>' +
      '<details class="tip"' + (latest && latest.signed === true ? ' hidden' : '') + ' id="smartscreen"><summary>' + ic('i-warn') + esc(t.smartTitle) + '</summary><p>' + esc(t.smartBody) + '</p></details></div>';
  }

  function phoneBlock() {
    var head = '<h3 class="block" style="font-size:1.05rem">' + cic('i-phone', C.android) + ' ' + esc(t.phoneBlock) + ' <small class="q-sub">· ' + esc(t.phoneReq) + '</small></h3>';
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

  // ---------------------------------------------------------------------------------
  // Buying (owner, 2026-11-26). Phone offer: straight to WhatsApp with a Darija message.
  // PC offers: a Doukkany USB key sent home; the order form below. Nothing is sent to us by
  // the page: the details go only into the WhatsApp message the visitor sends.
  // ---------------------------------------------------------------------------------
  var WA_DZ = window.DK_WA_DZ;
  var AR = TEXT.ar; // the WhatsApp messages are in Darija whatever the page language

  function activityAr() {
    var name = AR.act[state.activity] || '';
    if (state.activity === 'other' && state.other) name += ': ' + state.other;
    return name;
  }
  function phoneOrderMessage() {
    return fill(WA_DZ.phone, { offer: AR.plan.phone[0], total: num(OFFER.plans.phone.price), activity: activityAr() });
  }
  // A buy button: a WhatsApp link for the phone offer, the order form for the PC offers.
  function buyLink(cls, label) {
    var r = rec();
    if (r.ok && r.type === 'phone') {
      return '<a class="' + cls + (cls.indexOf('btn') !== -1 ? ' wa' : '') + '" data-wa="order" href="' + esc(waLink(phoneOrderMessage())) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(cls.indexOf('btn') !== -1 ? t.buyWa : label) + '</a>';
    }
    return '<button type="button" class="' + cls + '" data-act="path:buy">' + esc(label) + '</button>';
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
      pay: ['prepaid', 'cod'].indexOf(raw.pay) !== -1 ? raw.pay : '',
      requestId: typeof raw.requestId === 'string' && /^[0-9a-f-]{36}$/.test(raw.requestId) ? raw.requestId : ''
    };
  })();
  function saveBuyer() { try { sessionStorage.setItem(BUYER_KEY, JSON.stringify(buyer)); } catch (e) {} }
  // The buyer changed the order: a new send is a new order (else, if an earlier send reached us
  // but its answer was lost, the server would keep the old details and drop the new ones).
  function buyerEdited() { buyer.requestId = ''; saveBuyer(); }

  // Wilayas and communes (../js/dz-places.json), loaded only when the order form is shown.
  var places = null, placesState = 'idle';
  function loadPlaces() {
    if (placesState !== 'idle') return;
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
  function phoneOk(p) { return /^(?:\+213|00213|0)[5-7]\d{8}$/.test(String(p).replace(/[\s.\-()]/g, '')); }

  // What is still missing before the order can go: [field id or act, its name].
  function orderMissing() {
    var miss = [];
    if (buyer.win !== 'yes') miss.push(['win:yes', 'Windows 10 · 64']);
    if (buyer.name.trim().length < 3) miss.push(['b-name', t.fName]);
    if (!phoneOk(buyer.phone)) miss.push(['b-phone', t.fPhone]);
    if (!wilayaText()) miss.push([placesState === 'failed' ? 'b-wilaya-txt' : 'b-wilaya', t.fWilaya]);
    if (!communeText()) miss.push([placesState === 'failed' || buyer.commune === 'other' ? 'b-commune-txt' : 'b-commune', t.fCommune]);
    if (!buyer.pay) miss.push(['pay:prepaid', t.payTitle]);
    return miss;
  }
  function pcOrderMessage() {
    var r = rec();
    return fill(WA_DZ.pc, {
      offer: AR.plan[r.type][0],
      pay: buyer.pay === 'prepaid' ? fill(WA_DZ.payPrepaid, { discount: num(OFFER.prepaidDiscount) }) : WA_DZ.payCod,
      total: num(OFFER.orderTotal(r.type, buyer.pay)),
      name: buyer.name.trim(), phone: buyer.phone.trim(), wilaya: wilayaText(), commune: communeText(),
      activity: activityAr()
    });
  }
  // ---- "Pay at delivery": the order goes to the Doukkany server (Edge Function site-order),
  // which adds it to the Admin CRM. Only on the real site; elsewhere (local checks) nothing is
  // sent: the body is kept in window.__dkOrderSent and ?dk_order=fail shows the error. ----
  var ORDER_URL = 'https://clseghjxpmlutwrrvmrf.supabase.co/functions/v1/site-order';
  var ORDER_LIVE = location.hostname === 'yousoft.site';
  var codOrder = { state: 'idle', phone: '' }; // idle | sending | failed | done
  function newRequestId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function showMissing(miss) {
    var om = $('order-msg');
    if (om) { om.textContent = fill(t.fixMissing, { fields: miss.map(function (m) { return m[1]; }).join(t.sep) }); om.classList.add('bad'); }
    var first = $(miss[0][0]) || view.querySelector('[data-act="' + miss[0][0] + '"]');
    if (first) { first.scrollIntoView({ block: 'center' }); first.focus({ preventScroll: true }); }
  }
  function postOrder(body) {
    if (!ORDER_LIVE) {
      (window.__dkOrderSent = window.__dkOrderSent || []).push(body);
      var fail = params.get('dk_order') === 'fail';
      return new Promise(function (res) { setTimeout(function () { res(!fail); }, 400); });
    }
    return fetch(ORDER_URL, { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return r.ok && j && j.ok === true; }, function () { return false; }); },
        function () { return false; });
  }
  function sendCodOrder() {
    if (codOrder.state === 'sending') return;
    var miss = orderMissing();
    if (miss.length) { showMissing(miss); return; }
    var r = rec();
    if (!buyer.requestId) { buyer.requestId = newRequestId(); saveBuyer(); }
    var trap = $('b-website');
    var body = {
      request_id: buyer.requestId, name: buyer.name.trim(), phone: buyer.phone.trim(), shop_type: activityAr(),
      offer: r.type, devices: state.mode, pay: 'cod', total_dzd: OFFER.orderTotal(r.type, 'cod'),
      wilaya: wilayaText(), commune: communeText(), language: lang, website: trap ? trap.value : ''
    };
    codOrder.state = 'sending';
    redrawOrder('cod-btn');
    postOrder(body).then(function (ok) {
      if (!ok) { codOrder.state = 'failed'; redrawOrder('cod-btn'); return; }
      track('purchase_requested', eventParams('order'));
      codOrder.state = 'done';
      codOrder.phone = body.phone;
      // The order is with us now: forget the buyer's details in this tab.
      buyer.name = ''; buyer.phone = ''; buyer.wilaya = 0; buyer.wilayaTxt = ''; buyer.commune = '';
      buyer.communeOther = ''; buyer.requestId = ''; saveBuyer();
      render('order', true);
    });
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

  function pill(act, label, pressed) {
    return '<button type="button" class="pill" data-act="' + act + '" aria-pressed="' + pressed + '">' + esc(label) + '</button>';
  }
  function field(id, label, control) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' + control + '</div>';
  }
  function placeFields() {
    if (placesState === 'failed') {
      return field('b-wilaya-txt', t.fWilaya, '<input id="b-wilaya-txt" type="text" maxlength="60" autocomplete="address-level1" value="' + esc(buyer.wilayaTxt) + '">') +
        field('b-commune-txt', t.fCommune, '<input id="b-commune-txt" type="text" maxlength="60" autocomplete="address-level2" value="' + esc(buyer.communeOther) + '">');
    }
    if (placesState !== 'ok') {
      return field('b-wilaya', t.fWilaya, '<select id="b-wilaya" disabled><option>' + esc(t.fLoading) + '</option></select>');
    }
    var nameAt = lang === 'ar' ? 2 : 1;
    var wOpts = '<option value="">' + esc(t.fChoose) + '</option>' + places.map(function (w) {
      return '<option value="' + w[0] + '"' + (w[0] === buyer.wilaya ? ' selected' : '') + '>' + w[0] + ' - ' + esc(w[nameAt]) + '</option>';
    }).join('');
    var out = field('b-wilaya', t.fWilaya, '<select id="b-wilaya" autocomplete="address-level1">' + wOpts + '</select>');
    var w = wilayaOf(buyer.wilaya);
    if (w) {
      var cAt = lang === 'ar' ? 1 : 0;
      var cOpts = '<option value="">' + esc(t.fChoose) + '</option>' + w[3].map(function (c) {
        return '<option value="' + esc(c[0]) + '"' + (c[0] === buyer.commune ? ' selected' : '') + '>' + esc(c[cAt]) + '</option>';
      }).join('') + '<option value="other"' + (buyer.commune === 'other' ? ' selected' : '') + '>' + esc(t.fOtherCommune) + '</option>';
      out += field('b-commune', t.fCommune, '<select id="b-commune" autocomplete="address-level2">' + cOpts + '</select>');
      if (buyer.commune === 'other') out += field('b-commune-txt', t.fOtherPh, '<input id="b-commune-txt" type="text" maxlength="60" value="' + esc(buyer.communeOther) + '">');
    }
    return out;
  }

  function bindOrderForm() {
    function onInput(id, key) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { buyer[key] = el.value.replace(/[\u0000-\u001F<>]/g, ' ').slice(0, key === 'phone' ? 20 : 60); buyerEdited(); refreshOrderLink(); });
    }
    onInput('b-name', 'name');
    onInput('b-phone', 'phone');
    onInput('b-wilaya-txt', 'wilayaTxt');
    onInput('b-commune-txt', 'communeOther');
    var ws = $('b-wilaya');
    if (ws) ws.addEventListener('change', function () { buyer.wilaya = ws.value | 0; buyer.commune = ''; buyerEdited(); redrawOrder('b-commune'); });
    var cs = $('b-commune');
    if (cs) cs.addEventListener('change', function () {
      var wasOther = buyer.commune === 'other';
      buyer.commune = cs.value; buyerEdited();
      if (wasOther || buyer.commune === 'other') redrawOrder(buyer.commune === 'other' ? 'b-commune-txt' : 'b-commune');
      else refreshOrderLink();
    });
  }

  // ---------------------------------------------------------------------------------
  // After a screen is drawn
  // ---------------------------------------------------------------------------------
  var STEP_EVENTS = { welcome: 'sales_funnel_viewed', features: 'personalized_features_viewed', price: 'pricing_viewed', prices: 'pricing_viewed', course: 'quick_course_viewed' };
  function afterRender(step, viewed) {
    if (viewed) {
      // One event per screen shown, with its place in the bar: the drop-off chart.
      var n = F.progressIndex(step, state);
      var p = eventParams(step);
      p.step_number = n < 0 ? undefined : n + 1;
      track('funnel_step_viewed', p);
      if (STEP_EVENTS[step]) track(STEP_EVENTS[step], eventParams(step));
    }
    if (step === 'activity') {
      var input = $('other');
      if (input) input.addEventListener('input', function () { state.other = F.cleanState({ v: 1, other: input.value }).other; save(); });
    }
    if (step === 'trial' && devices().pcs > 0) resolveLatest();
    if (step === 'order') bindOrderForm();
  }

  function eventParams(step) {
    var d = devices(), r = rec();
    return {
      funnel_step: step, intention: state.intent || undefined, activity: state.activity || undefined,
      platform: d ? (d.pcs && d.phones ? 'both' : d.pcs ? 'windows' : 'android') : undefined,
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

  function finishStep() { go(state.intent === 'buy' ? 'order' : 'trial'); }

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a[data-yt-all]')) { track('tutorial_clicked', { tutorial_id: 'playlist', tutorial_category: 'playlist' }); return; }
    var lessonA = e.target.closest && e.target.closest('a[data-v]');
    if (lessonA) { openLesson(e, lessonA); return; }

    var wa = e.target.closest && e.target.closest('a[data-wa]');
    if (wa) {
      // The PC order form: say what is missing instead of opening WhatsApp half empty.
      if (wa.id === 'order-btn' && current === 'order' && rec().type !== 'phone') {
        var miss = orderMissing();
        if (miss.length) { e.preventDefault(); showMissing(miss); return; }
        refreshOrderLink();
      }
      if (wa.getAttribute('data-wa') === 'order' && state.intent !== 'buy') { state.intent = 'buy'; save(); }
      track('whatsapp_support_clicked', { method: wa.getAttribute('data-wa'), funnel_step: current });
      if (wa.getAttribute('data-wa') === 'order') {
        var om2 = $('order-msg'); if (om2) om2.classList.remove('bad');
        track('purchase_requested', eventParams('order'));
        var m = $('order-msg'); if (m) m.textContent = t.orderOpened;
      }
      return;
    }
    if (e.target.closest && e.target.closest('#win-btn')) {
      track('windows_download_clicked', { platform: 'windows', download_trigger: 'funnel', link_type: latest ? 'installer' : 'release_page', app_version: latest ? latest.label : undefined });
      var pm = $('pc-msg'); if (pm) pm.textContent = t.starting;
      return;
    }
    if (e.target.closest && e.target.closest('#play-btn')) { track('google_play_clicked', { platform: 'android', link_type: 'play_store' }); return; }

    var el = e.target.closest && e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var parts = act.split(':');
    switch (parts[0]) {
      case 'go': e.preventDefault(); go(parts[1]); break;
      case 'resume': go(F.allowedStep(state, F.isBuy(state) ? 'order' : 'price', OFFER)); break;
      case 'restart': reset(); hadProgress = false; render('welcome', true); break;
      case 'intent':
        state.intent = parts[1]; save();
        track('intention_selected', { intention: parts[1] });
        track(parts[1] === 'trial' ? 'trial_selected' : 'purchase_selected', {});
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

        track('pain_selected', { pain: parts[1], selected: at === -1 });
        rerenderKeepFocus(act);
        break;
      case 'mode':
        state.mode = parts[1]; save();
        track('device_selected', { platform: parts[1] });
        go(F.isBuy(state) ? 'order' : 'features');
        break;
      case 'path':
        state.intent = parts[1]; save();
        track('license_selected', eventParams(current));
        // Buying goes straight to the order (the lessons come on the USB key); a trial shows them first.
        if (parts[1] === 'buy') go('order'); else go(current === 'price' ? 'course' : 'trial');
        break;
      case 'win': buyer.win = parts[1]; buyerEdited(); redrawOrder(act); break;
      case 'pay': buyer.pay = parts[1]; buyerEdited(); redrawOrder(act); break;
      case 'tophone': state.mode = 'phone'; save(); go(F.isBuy(state) ? 'order' : 'price'); break;
      case 'cod-send': sendCodOrder(); break;
      case 'finish':
        track('quick_course_skipped', eventParams('course'));
        finishStep();
        break;
      case 'try-from-prices': state.intent = 'trial'; save(); go('activity'); break;
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
      case 'mail-pc': track('download_email_app_opened', { method: 'mailto' }); break;
      case 'copy-play': copy(playUrl(), 'play-msg', t.copied); break;
      case 'wa-play': window.open('https://wa.me/?text=' + encodeURIComponent(t.playShareText + '\n' + playUrl()), '_blank', 'noopener'); break;
    }
  });

  function rerenderKeepFocus(act) {
    var old = view.querySelector('.scroll');
    var y = old ? old.scrollTop : 0;
    render(current, false);
    var list = view.querySelector('.scroll');
    if (list) list.scrollTop = y;
    var again = view.querySelector('[data-act="' + act + '"]');
    if (again && !again.disabled) again.focus();
  }

  // ---- Lesson player: YouTube loads only after a click (youtube-nocookie), like /learn/ ----
  var player = $('player');
  var canDialog = player && typeof player.showModal === 'function';
  function openLesson(e, a) {
    var i = +a.getAttribute('data-v');
    var id = LESSONS.videos[i][0];
    track('tutorial_clicked', { tutorial_id: id, tutorial_category: LESSONS.videos[i][5], tutorial_position: i + 1 });
    if (state.watched.indexOf(id) === -1) { state.watched.push(id); save(); }
    if (!canDialog || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    $('player-title').textContent = lessonTitle(i);
    $('player-yt').href = videoUrl(i);
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1&hl=' + lang;
    f.title = lessonTitle(i);
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    $('player-frame').textContent = '';
    $('player-frame').appendChild(f);
    player.showModal();
  }
  // Stops the video and shows the "watched" tick. Called directly by our close buttons; the
  // dialog's own 'close' event (Esc key) calls it too, and some browsers fire that event late.
  function afterPlayer() {
    if (!$('player-frame').firstChild) return;
    $('player-frame').textContent = '';
    if (current === 'course' || current === 'trial') rerenderKeepFocus('none');
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

  // ---- Keep the phone's bottom buttons above the consent bar while it is open ----
  function watchConsent() {
    var root = document.documentElement;
    function measure() {
      var b = document.querySelector('.dk-consent');
      // tracking.js removes the bar once answered. A fixed element has no offsetParent, so its
      // boxes say whether it is shown.
      var h = b && b.getClientRects().length ? b.getBoundingClientRect().height : 0;
      root.style.setProperty('--consent-h', Math.round(h) + 'px');
    }
    measure();
    if ('MutationObserver' in window) new MutationObserver(measure).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    window.addEventListener('resize', measure);
  }

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
  var first = F.allowedStep(state, stepFromHash(), OFFER);
  history.replaceState({ dk: 0 }, '', location.pathname + location.search + '#' + first);
  render(first, false);
  if (first === 'welcome') track('sales_funnel_started', {});
  watchConsent();
})();
