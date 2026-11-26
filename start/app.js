/* Doukkany /start/ funnel: screens and actions.
 * Data and rules: funnel.js (shop types, lessons, steps), ../js/offer.js (prices),
 * ../js/lessons.js (the 25 videos), texts.js (words). Nothing here sends personal data:
 * the answers stay in this browser (localStorage) until the visitor sends a WhatsApp message. */
(function () {
  'use strict';
  var OFFER = window.DK_OFFER, LESSONS = window.DK_LESSONS, F = window.DK_FUNNEL, TEXT = window.DK_START_TEXT;
  var tracking = window.dkTracking || null;

  var WA_NUMBER = '213775452101'; // same as the app (kSupportPhone) and /download/
  var PLAY_URL = 'https://play.google.com/store/apps/details?id=com.yousoft.doukkany';
  var RELEASE_PAGE = 'https://github.com/dzstoredzd/doukkany-releases/releases/latest';
  var FEED_URL = 'https://raw.githubusercontent.com/dzstoredzd/doukkany-releases/main/doukkany/stable/latest.json';
  var API_URL = 'https://api.github.com/repos/dzstoredzd/doukkany-releases/releases/latest';
  var STORE_KEY = 'dk-start-v1';

  // Funnel events are written at every step but not sent yet (owner, 2026-11-26: "start with
  // the website, then we add events"). Turning this on also needs the names in js/tracking.js
  // EVENTS and GTM triggers.
  var EVENTS_ON = false;
  function track(name, p) {
    if (!EVENTS_ON) return;
    try { if (tracking) tracking.track(name, p); } catch (e) {}
  }

  var view = document.getElementById('view');
  var params = new URLSearchParams(location.search);
  var lang = 'ar';
  var t = TEXT.ar;
  var current = null;
  var depth = 0;          // our own history entries above the first one
  var selectedFeature = null;

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

  function devices() { return F.devices(state); }
  function rec() { var d = devices(); return d ? OFFER.recommend(d.pcs, d.phones, d.shared) : { ok: false, reason: 'none' }; }

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
    if (d.pcs + d.phones > 1) s += ' (' + (d.shared ? t.sharedYes : t.sharedNo) + ')';
    return s;
  }
  function offerName(r) {
    if (!r.ok) return '';
    if (r.type === 'separate') return t.separateT;
    return t.plan[r.type][0];
  }
  function lineText(l) { return l.qty + ' × ' + t.plan[l.plan][0]; }

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
  function render(step, focus) {
    current = step;
    var html = SCREENS[step]();
    view.innerHTML = '<section class="step" data-step="' + step + '">' + html + helpLine(step) + '</section>';
    renderProgress(step);
    afterRender(step);
    if (focus) {
      var h = view.querySelector('h1');
      if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
      window.scrollTo(0, 0);
    }
  }

  function renderProgress(step) {
    var i = F.progressIndex(step);
    var show = step !== 'welcome';
    $('prog').hidden = !show;
    if (!show) return;
    var total = F.PROGRESS.length;
    var n = i < 0 ? 0 : i + 1;
    $('bar').style.width = (i < 0 ? 0 : Math.round(n / total * 100)) + '%';
    $('prog-txt').textContent = i < 0 ? '' : fill(t.stepOf, { n: n, t: total });
    $('back-txt').textContent = t.back;
  }

  function helpLine(step) {
    if (step === 'trial' || step === 'order') return '';
    return '<p class="help-line"><span>' + esc(t.helpQ) + '</span><a class="link" data-wa="help" href="' + esc(waLink(t.waHelp)) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(t.helpBtn) + '</a></p>';
  }

  function choice(act, icon, title, desc, opts) {
    opts = opts || {};
    return '<button type="button" class="choice' + (opts.cls ? ' ' + opts.cls : '') + '" data-act="' + act + '"' +
      (opts.pressed != null ? ' aria-pressed="' + opts.pressed + '"' : '') + '>' +
      '<span class="ci">' + ic(icon, opts.fillIcon ? 'f' : '') + '</span>' +
      '<span class="ct"><b>' + esc(title) + '</b><span class="cd">' + esc(desc) + '</span>' + (opts.tag ? '<span class="tag">' + esc(opts.tag) + '</span>' : '') + '</span>' +
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
      return '<h1>' + esc(t.wTitle) + '</h1><p class="lead">' + esc(t.wSub) + '</p>' + resume +
        '<div class="choices two">' +
        choice('intent:trial', 'i-play-c', t.trialT, t.trialD, { cls: 'hero primary' }) +
        choice('intent:buy', 'i-bag', t.buyT, t.buyD, { cls: 'hero' }) +
        '</div>' +
        '<div class="actions"><div class="row"><button type="button" class="link" data-act="go:prices">' + ic('i-tag') + esc(t.pricesLink) + '</button></div></div>' +
        '<ul class="facts"><li>' + ic('i-cloudoff') + esc(t.factOffline) + '</li><li>' + ic('i-check') + esc(t.factOnce) + '</li><li>' + ic('i-devices') + esc(t.factDevices) + '</li></ul>';
    },

    activity: function () {
      var tiles = F.ACTIVITIES.map(function (a) {
        return '<button type="button" class="tile" data-act="activity:' + a.id + '" aria-pressed="' + (state.activity === a.id) + '">' +
          '<span class="ci">' + ic(a.icon) + '</span><span>' + esc(t.act[a.id]) + '</span></button>';
      }).join('');
      var other = state.activity === 'other' ?
        '<div class="field"><label for="other">' + esc(t.otherLabel) + '</label>' +
        '<input id="other" type="text" maxlength="60" autocomplete="off" placeholder="' + esc(t.otherPh) + '" value="' + esc(state.other) + '">' +
        '<small>' + esc(t.otherHint) + '</small></div>' +
        '<div class="dock"><button type="button" class="btn block" data-act="go:devices">' + esc(t.next) + '</button></div>' : '';
      return '<h1>' + esc(t.aTitle) + '</h1><p class="q-sub">' + esc(t.aSub) + '</p><div class="tiles">' + tiles + '</div>' + other;
    },

    devices: function () {
      var hereTag = function (m) {
        if ((m === 'pc' && DEVICE === 'windows') || (m === 'phone' && DEVICE === 'android')) return t.here;
        return null;
      };
      var devName = DEVICE === 'android' ? t.devAndroid : DEVICE === 'windows' ? t.devWindows : t.devOther;
      return '<h1>' + esc(t.dTitle) + '</h1><p class="q-sub">' + esc(t.dSub) + '</p>' +
        '<div class="choices four">' +
        choice('mode:pc', 'i-win', t.modePcT, t.modePcD, { pressed: state.mode === 'pc', tag: hereTag('pc'), fillIcon: true }) +
        choice('mode:phone', 'i-phone', t.modePhoneT, t.modePhoneD, { pressed: state.mode === 'phone', tag: hereTag('phone') }) +
        choice('mode:both', 'i-pcphone', t.modeBothT, t.modeBothD, { pressed: state.mode === 'both' }) +
        choice('mode:several', 'i-devices', t.modeSeveralT, t.modeSeveralD, { pressed: state.mode === 'several' }) +
        '</div>' +
        (DEVICE !== 'other' && DEVICE !== 'ios' ? '<p class="q-sub block">' + esc(fill(t.hereNote, { device: devName })) + '</p>' : '');
    },

    several: function () {
      var r = OFFER.recommend(state.pcs, state.phones, state.shared);
      function counter(key, icon, label, value) {
        return '<div class="count"><span class="cl">' + ic(icon, icon === 'i-win' ? 'f' : '') + '<span id="l-' + key + '">' + esc(label) + '</span></span>' +
          '<span class="stepper" role="group" aria-labelledby="l-' + key + '">' +
          '<button type="button" data-act="count:' + key + ':-1" aria-label="' + esc(t.minus + ' · ' + label) + '"' + (value <= 0 ? ' disabled' : '') + '>−</button>' +
          '<output aria-live="polite">' + value + '</output>' +
          '<button type="button" data-act="count:' + key + ':1" aria-label="' + esc(t.plus + ' · ' + label) + '"' + (value >= OFFER.maxDevices ? ' disabled' : '') + '>+</button></span></div>';
      }
      var problem = '';
      if (!r.ok && r.reason === 'needs_pc') problem = '<div class="warn block">' + esc(t.needsPc) + '<div class="actions"><button type="button" class="btn soft" data-act="addpc">' + esc(t.addPc) + '</button></div></div>';
      else if (!r.ok && r.reason === 'none') problem = '<div class="warn block">' + esc(t.noneErr) + '</div>';
      else if (!r.ok && r.reason === 'too_many') problem = '<div class="warn block">' + esc(t.tooMany) + '</div>';
      var multi = state.pcs + state.phones > 1;
      return '<h1>' + esc(t.sTitle) + '</h1>' +
        counter('pcs', 'i-win', t.pcsL, state.pcs) + counter('phones', 'i-phone', t.phonesL, state.phones) +
        (multi ? '<h2 class="block" style="font-size:1.1rem">' + esc(t.shareQ) + '</h2><div class="seg">' +
          choice('shared:1', 'i-wifi', t.shareYesT, t.shareYesD, { pressed: state.shared }) +
          choice('shared:0', 'i-devices', t.shareNoT, t.shareNoD, { pressed: !state.shared }) + '</div>' : '') +
        (multi && state.shared ? '<div class="note block"><b>' + esc(t.netTitle) + '</b>' + esc(t.netNote) + '</div>' : '') +
        problem +
        '<div class="dock"><button type="button" class="btn block" data-act="go:features"' + (r.ok ? '' : ' disabled') + '>' + esc(t.next) + '</button></div>';
    },

    features: function () {
      var a = F.activity(state.activity);
      if (!selectedFeature || a.features.indexOf(selectedFeature) === -1) selectedFeature = a.features[0];
      var list = a.features.map(function (f) {
        return '<li><button type="button" class="feat" data-act="feat:' + f + '" aria-pressed="' + (f === selectedFeature) + '">' +
          '<span class="ok">' + ic('i-check') + '</span><span><b>' + esc(t.feat[f][0]) + '</b><span class="fd">' + esc(t.feat[f][1]) + '</span></span></button>' +
          '<div class="ishot">' + (f === selectedFeature ? inlineShot(f) : '') + '</div></li>';
      }).join('');
      return '<h1>' + esc(t.fTitle) + '</h1><span class="chip">' + ic(a.icon) + esc(activityName()) + '</span>' +
        '<div class="feat-grid"><div><p class="q-sub">' + esc(t.fSub) + ' <span class="sr">' + esc(t.fTap) + '</span></p>' +
        '<ul class="feats block" style="margin-top:8px">' + list + '</ul>' +
        '<ul class="facts"><li>' + ic('i-cloudoff') + esc(t.factOffline) + '</li><li>' + ic('i-check') + esc(t.factOnce) + '</li></ul></div>' +
        '<div class="shot"><div class="phn"><div class="scr" id="shot">' + shotHtml(selectedFeature) + '</div></div></div></div>' +
        '<div class="dock"><button type="button" class="btn block" data-act="go:price">' + esc(t.toPrice) + '</button></div>';
    },

    price: function () {
      var r = rec();
      var d = devices();
      var sub = state.intent === 'buy' ? t.pSubBuy : t.pSubTrial;
      var lines = r.lines.length > 1 || r.lines[0].qty > 1 ?
        '<ul class="lines">' + r.lines.map(function (l) { return '<li><span>' + esc(lineText(l)) + '</span><span>' + money(l.total) + ' ' + esc(t.da) + '</span></li>'; }).join('') + '</ul>' : '';
      var desc = r.type === 'separate' ? t.separateD : t.plan[r.type][1];
      var extra = '';
      if (r.type === 'shop' && d.phones === 0) extra += '<p class="note block">' + esc(t.giftNote) + '</p>';
      if (r.type === 'separate' && d.pcs > 0) {
        var shared = OFFER.recommend(d.pcs, d.phones, true);
        if (shared.ok && shared.total < r.total) {
          extra += '<div class="note block">' + esc(fill(t.cheaperShared, { price: num(shared.total) })) +
            '<div class="actions" style="margin-top:8px"><button type="button" class="btn soft" data-act="makeshared">' + esc(t.makeShared) + '</button></div></div>';
        }
      }
      if (r.type === 'shop' || (state.mode === 'several' && d.shared)) extra += '<p class="q-sub block">' + esc(t.trialRoom) + '</p>';
      var primary = state.intent === 'buy' ?
        '<button type="button" class="btn block" data-act="path:buy">' + esc(t.goBuy) + '</button><div class="row"><button type="button" class="link" data-act="path:trial">' + esc(t.altTrial) + '</button>' :
        '<button type="button" class="btn block" data-act="path:trial">' + esc(t.goTrial) + '</button><div class="row"><button type="button" class="link" data-act="path:buy">' + esc(t.altBuy) + '</button>';
      return '<h1>' + esc(t.pTitle) + '</h1><p class="lead">' + esc(sub) + '</p>' +
        '<div class="offer"><span class="ribbon">' + esc(t.recTag) + '</span>' +
        '<h2>' + esc(offerName(r)) + '</h2><p class="od">' + esc(desc) + '</p>' +
        '<div class="price"><span class="amt">' + money(r.total) + '</span><span class="cur">' + esc(t.da) + '</span><span class="once">' + esc(t.once) + '</span></div>' +
        lines +
        '<ul class="incl"><li>' + ic('i-devices') + '<span>' + esc(fill(t.worksOn, { devices: devicesText(r.includes && { pcs: r.includes.pcs, phones: r.includes.phones, shared: d.shared }) })) + '</span></li>' +
        '<li>' + ic('i-check') + '<span>' + esc(t.inclAll) + '</span></li>' +
        '<li>' + ic('i-check') + '<span>' + esc(t.inclOffline) + '</span></li>' +
        '<li>' + ic('i-check') + '<span>' + esc(t.inclNoSub) + '</span></li>' +
        '<li>' + ic('i-check') + '<span>' + esc(t.inclTrial) + '</span></li></ul></div>' +
        extra +
        '<details class="cmp"><summary>' + esc(t.compare) + '</summary><div class="plans">' + plansHtml(r) + '<p class="q-sub">' + esc(t.addOnNote) + '</p></div></details>' +
        '<div class="dock">' + primary + '<button type="button" class="link" data-act="go:devices">' + esc(t.changeDevices) + '</button></div></div>';
    },

    prices: function () {
      return '<h1>' + esc(t.pricesTitle) + '</h1><p class="lead">' + esc(t.pricesSub) + '</p>' +
        '<p class="block"><span class="trial-tag"><span class="n ltr">' + OFFER.trialDays + '</span>' + esc(t.vTrial.replace(/^\d+\s*/, '')) + '</span></p>' +
        '<div class="plans block">' + plansHtml(null) + '</div><p class="q-sub block">' + esc(t.addOnNote) + '</p>' +
        '<ul class="incl block"><li>' + ic('i-check') + '<span>' + esc(t.inclAll) + '</span></li><li>' + ic('i-check') + '<span>' + esc(t.inclOffline) + '</span></li><li>' + ic('i-check') + '<span>' + esc(t.inclNoSub) + '</span></li></ul>' +
        '<div class="dock"><button type="button" class="btn block" data-act="help-choose">' + esc(t.pricesHelp) + '</button>' +
        '<div class="row"><button type="button" class="link" data-act="try-from-prices">' + esc(t.pricesTry) + '</button><a class="link" href="../download/">' + esc(t.fDownload) + '</a></div></div>';
    },

    course: function () {
      var ids = F.lessonsFor(state);
      var seen = ids.filter(function (i) { return state.watched.indexOf(LESSONS.videos[i][0]) !== -1; }).length;
      var d = devices();
      return '<h1>' + esc(t.cTitle) + '</h1><p class="q-sub">' + esc(fill(t.cSub, { activity: activityName() })) + '</p>' +
        (seen ? '<p class="chip">' + ic('i-check') + esc(fill(t.seenCount, { n: seen, t: ids.length })) + '</p>' : '') +
        '<ol class="lessons">' + ids.map(function (i, k) { return lessonHtml(i, k === 0); }).join('') + '</ol>' +
        (d && d.pcs === 0 ? '<p class="q-sub block">' + esc(t.phoneLessonsNote) + '</p>' : '') +
        '<p class="block"><a class="link" href="../learn/">' + esc(t.allLessons) + '</a></p>' +
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
      if (d.shared && d.pcs > 0 && d.pcs + d.phones > 1) inst += '<p class="q-sub block">' + esc(t.instLink) + '</p>';
      var ids = F.lessonsFor(state).slice(0, 3);
      return '<h1>' + esc(t.tTitle) + '</h1><p class="lead">' + esc(t.tSub) + '</p>' +
        '<ul class="sum">' +
        sumRow(t.kActivity, activityName(), 'go:activity') +
        sumRow(t.kDevices, devicesText(), 'go:devices') +
        sumRow(t.kTrial, t.vTrial) +
        sumRow(t.kOffer, offerName(r) + ' · ' + num(r.total) + ' ' + t.da) +
        '</ul>' +
        '<div class="card"><h2>' + ic('i-dl') + esc(t.dlTitle) + '</h2>' + blocks + '</div>' +
        '<div class="final-grid"><div class="card"><h2>' + esc(t.installTitle) + '</h2>' + inst + '</div>' +
        '<div class="card"><h2>' + esc(t.tLessons) + '</h2><ol class="lessons">' + ids.map(function (i, k) { return lessonHtml(i, k === 0); }).join('') + '</ol>' +
        '<p class="block"><a class="link" href="../learn/">' + esc(t.moreLessons) + '</a></p></div></div>' +
        '<div class="help"><h2>' + esc(t.helpTitle) + '</h2><p>' + esc(t.helpText) + '</p>' +
        '<a class="btn wa" data-wa="trial" href="' + esc(waLink(fill(t.waTrial, { activity: activityName(), devices: devicesText() }))) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(t.helpBtn) + '</a></div>' +
        '<div class="actions"><div class="row"><button type="button" class="link" data-act="path:buy">' + esc(t.buyNow) + '</button></div></div>';
    },

    order: function () {
      var r = rec();
      var rows = r.lines.map(function (l) { return '<li><span class="k">' + esc(lineText(l)) + '</span><span class="v">' + money(l.total) + ' ' + esc(t.da) + '</span></li>'; }).join('');
      return '<h1>' + esc(t.oTitle) + '</h1><p class="lead">' + esc(t.oSub) + '</p>' +
        '<ul class="sum">' +
        sumRow(t.kActivity, activityName(), 'go:activity') +
        sumRow(t.kDevices, devicesText(), 'go:devices') +
        rows +
        '<li class="total"><span class="k">' + esc(t.kTotal) + '</span><span class="v">' + money(r.total) + ' ' + esc(t.da) + '<br><small class="once" style="color:var(--green);font-size:.85rem">' + esc(t.once) + '</small></span></li>' +
        '</ul>' +
        '<div class="card"><h2>' + esc(t.payTitle) + '</h2><p>' + esc(t.payText) + '</p><div class="pay"><span>CCP</span><span>BaridiMob</span></div>' +
        '<p class="warn block">' + esc(t.paySafe) + '</p></div>' +
        '<div class="card"><h2>' + esc(t.nextTitle) + '</h2><ol class="steps-list">' + t.nextSteps.map(function (s) { return '<li><span>' + esc(s) + '</span></li>'; }).join('') + '</ol></div>' +
        '<p class="q-sub block">' + esc(t.noData) + '</p>' +
        '<div class="dock"><a class="btn wa block" id="order-btn" data-wa="order" href="' + esc(waLink(orderMessage(r))) + '" target="_blank" rel="noopener">' + ic('i-wa', 'f') + esc(t.sendOrder) + '</a>' +
        '<p class="msg" id="order-msg" role="status"></p>' +
        '<div class="row"><button type="button" class="link" data-act="path:trial">' + esc(t.tryFirst) + '</button></div></div>';
    }
  };

  function sumRow(k, v, editAct) {
    return '<li><span><span class="k">' + esc(k) + '</span><br><span class="v" style="text-align:start">' + esc(v) + '</span></span>' +
      (editAct ? '<button type="button" class="link edit" data-act="' + editAct + '">' + esc(t.edit) + '</button>' : '') + '</li>';
  }

  function plansHtml(r) {
    var recPlans = r && r.ok ? r.lines.map(function (l) { return l.plan; }) : [];
    return OFFER.listOrder.map(function (id) {
      var p = OFFER.plans[id];
      var addon = id === 'add_pc' || id === 'add_phone';
      return '<div class="plan' + (recPlans.indexOf(id) !== -1 ? ' rec' : '') + '"><div><b>' + esc(t.plan[id][0]) + '</b><span class="pd">' + esc(t.plan[id][1]) + '</span></div>' +
        '<div class="pp">' + money(p.price) + ' ' + esc(t.da) + '<small>' + esc(addon ? t.perDevice : t.vOnce) + '</small></div></div>';
    }).join('');
  }

  function shotHtml(f) {
    var img = F.FEATURE_IMG[f];
    if (!img) return '<div class="none">' + esc(t.fNoShot) + '</div>';
    return '<img src="assets/' + img + '-' + lang + '.webp" width="360" height="640" alt="' + esc(fill(t.fAlt, { feature: t.feat[f][0] })) + '">';
  }

  // Phones: the screen of the tapped feature, right under it (the side phone is for wide screens).
  function inlineShot(f) { return '<div class="phn"><div class="scr">' + shotHtml(f) + '</div></div>'; }

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
    var head = '<h3 class="block" style="font-size:1.05rem">' + ic('i-win', 'f') + ' ' + esc(t.pcBlock) + ' <small class="q-sub">· ' + esc(t.pcReq) + '</small></h3>';
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
    var head = '<h3 class="block" style="font-size:1.05rem">' + ic('i-phone') + ' ' + esc(t.phoneBlock) + ' <small class="q-sub">· ' + esc(t.phoneReq) + '</small></h3>';
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

  function orderMessage(r) {
    return fill(t.waOrder, {
      offer: offerName(r),
      // One plan once: the "offer" line already says it all.
      lines: r.lines.length === 1 && r.lines[0].qty === 1 ? '' :
        r.lines.map(function (l) { return '- ' + lineText(l) + ': ' + num(l.total) + ' ' + t.da + '\n'; }).join(''),
      total: num(r.total),
      devices: devicesText(),
      activity: activityName()
    });
  }

  // ---------------------------------------------------------------------------------
  // After a screen is drawn
  // ---------------------------------------------------------------------------------
  var STEP_EVENTS = { welcome: 'sales_funnel_viewed', features: 'personalized_features_viewed', price: 'pricing_viewed', prices: 'pricing_viewed', course: 'quick_course_viewed' };
  function afterRender(step) {
    if (STEP_EVENTS[step]) track(STEP_EVENTS[step], eventParams(step));
    if (step === 'activity') {
      var input = $('other');
      if (input) input.addEventListener('input', function () { state.other = F.cleanState({ v: 1, other: input.value }).other; save(); });
    }
    if (step === 'trial' && devices().pcs > 0 && !IS_PHONE) resolveLatest();
  }

  function eventParams(step) {
    var d = devices(), r = rec();
    return {
      funnel_step: step, intention: state.intent || undefined, activity: state.activity || undefined,
      platform: d ? (d.pcs && d.phones ? 'both' : d.pcs ? 'windows' : 'android') : undefined,
      device_count: d ? d.pcs + d.phones : undefined, license_type: r.ok ? r.type : undefined
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
    var lessonA = e.target.closest && e.target.closest('a[data-v]');
    if (lessonA) { openLesson(e, lessonA); return; }

    var wa = e.target.closest && e.target.closest('a[data-wa]');
    if (wa) {
      track('whatsapp_support_clicked', { method: wa.getAttribute('data-wa'), funnel_step: current });
      if (wa.getAttribute('data-wa') === 'order') {
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
      case 'resume': go(F.allowedStep(state, 'price', OFFER)); break;
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
        else go('devices');
        break;
      case 'mode':
        state.mode = parts[1]; save();
        track('device_selected', { platform: parts[1] });
        go(parts[1] === 'several' ? 'several' : 'features');
        break;
      case 'count':
        var key = parts[1];
        state[key] = Math.max(0, Math.min(OFFER.maxDevices, state[key] + (+parts[2]))); save();
        rerenderKeepFocus(act);
        break;
      case 'shared': state.shared = parts[1] === '1'; save(); rerenderKeepFocus(act); break;
      case 'addpc': state.pcs = Math.max(1, state.pcs); save(); rerenderKeepFocus('count:pcs:1'); break;
      case 'makeshared': state.mode = 'several'; var dd = devices(); state.pcs = dd.pcs; state.phones = dd.phones; state.shared = true; save(); render('price', false); break;
      case 'feat':
        selectedFeature = parts[1];
        view.querySelectorAll('.feat').forEach(function (b) {
          var on = b.getAttribute('data-act') === act;
          b.setAttribute('aria-pressed', String(on));
          b.nextElementSibling.innerHTML = on ? inlineShot(selectedFeature) : '';
        });
        $('shot').innerHTML = shotHtml(selectedFeature);
        break;
      case 'path':
        state.intent = parts[1]; save();
        track('license_selected', eventParams(current));
        if (current === 'price') go('course'); else go(parts[1] === 'buy' ? 'order' : 'trial');
        break;
      case 'finish':
        track('quick_course_skipped', eventParams('course'));
        finishStep();
        break;
      case 'help-choose': if (!state.intent) { state.intent = 'buy'; save(); } go('activity'); break;
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
    var y = window.scrollY;
    render(current, false);
    window.scrollTo(0, y);
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
  setLang(pickLang());
  if (params.get('go') === 'prices' && !location.hash) history.replaceState(null, '', '#prices');
  var first = F.allowedStep(state, stepFromHash(), OFFER);
  history.replaceState({ dk: 0 }, '', location.pathname + location.search + '#' + first);
  render(first, false);
  if (first === 'welcome') track('sales_funnel_started', {});
  watchConsent();
})();
