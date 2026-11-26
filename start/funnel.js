/* Doukkany /start/ funnel: the data and rules, without any screen code.
 * Used by start/index.html and by tests/funnel.test.js (node).
 *
 * Only real Doukkany features are listed here (checked against the app's code and
 * docs/marketing/FEATURES_FACEBOOK_AR.md, "ready" list). Features that are not tested on real
 * devices yet (staff PIN, Google Drive backup) and the internet link are never shown.
 *
 * Funnel versions (2026-11-27, owner brief "Interactive Sales Funnel & Conversion"):
 *   v2 (default): welcome → shop type → problems (optional) → devices → "ready" (download first,
 *                 then the advice and the offer). 5 places in the bar.
 *   v1: the older long path (… → features → price → lessons → download), kept for comparison
 *       (?fv=v1). Buying is the same in both: welcome → shop type (can skip) → devices → order.
 */
(function (root) {
  'use strict';

  // Shop types: id -> colour and icon, the features shown first (best first: the order the
  // advice uses), and the lessons (index in js/lessons.js videos, in watching order).
  // Owner brief §6: grocery = expiry, low stock, fast barcode sales, credit; clothes = stock,
  // profit, fast sales; cosmetics = expiry, stock, loyalty, promotions; auto parts = references,
  // barcode search, stock, customer accounts; phones = sales, stock, profit, references;
  // building = credit, stock, sales, customer accounts. Only features the app really has.
  var ACTIVITIES = [
    { id: 'grocery',    color: '#16A34A', icon: 'i-basket', features: ['expiry', 'lowstock', 'barcode', 'credit', 'profit', 'stock'], lessons: [1, 7, 16, 17, 11] },
    { id: 'clothes',    color: '#7C3AED', icon: 'i-shirt',  features: ['stock', 'profit', 'barcode', 'categories', 'discount', 'labels'], lessons: [3, 1, 6, 19, 15] },
    { id: 'phones',     color: '#2563EB', icon: 'i-phone',  features: ['barcode', 'stock', 'profit', 'search', 'repairs', 'credit'],    lessons: [22, 1, 7, 11, 15] },
    { id: 'cosmetics',  color: '#DB2777', icon: 'i-spark',  features: ['expiry', 'lowstock', 'loyalty', 'discount', 'barcode', 'profit'], lessons: [1, 7, 17, 23, 15] },
    { id: 'autoparts',  color: '#475569', icon: 'i-car',    features: ['search', 'barcode', 'stock', 'credit', 'suppliers', 'profit'],  lessons: [20, 7, 16, 11, 15] },
    { id: 'building',   color: '#EA580C', icon: 'i-brick',  features: ['credit', 'stock', 'units', 'weight', 'prices', 'suppliers'],   lessons: [2, 21, 11, 16, 15] },
    { id: 'household',  color: '#0D9488', icon: 'i-home',   features: ['categories', 'barcode', 'stock', 'discount', 'profit'],        lessons: [3, 1, 7, 6, 15] },
    { id: 'stationery', color: '#4F46E5', icon: 'i-book',   features: ['barcode', 'excel', 'categories', 'stock', 'profit'],           lessons: [20, 3, 7, 16, 15] },
    { id: 'wholesale',  color: '#B45309', icon: 'i-truck',  features: ['prices', 'units', 'credit', 'suppliers', 'stock', 'profit'],   lessons: [2, 21, 5, 11, 16] },
    { id: 'produce',    color: '#DC2626', icon: 'i-apple',  features: ['weight', 'cash', 'credit', 'profit'],                          lessons: [2, 4, 13, 11, 15] },
    { id: 'bakery',     color: '#D97706', icon: 'i-cake',   features: ['cash', 'expiry', 'credit', 'profit'],                          lessons: [1, 4, 13, 17, 15] },
    { id: 'services',   color: '#0891B2', icon: 'i-tool',   features: ['services', 'repairs', 'credit', 'cash', 'profit'],             lessons: [22, 11, 13, 15] },
    { id: 'other',      color: '#6B7280', icon: 'i-dots',   features: ['barcode', 'credit', 'stock', 'cash', 'profit'],                lessons: [1, 4, 11, 15] }
  ];

  // Feature -> app screen (start/assets/<img>-<lang>.webp). null = no screen.
  var FEATURE_IMG = {
    barcode: 'sell', credit: 'credit', stock: 'stock', lowstock: 'stock', expiry: 'stock',
    profit: 'today', cash: 'cash', categories: 'stock', discount: 'cart', labels: 'stock',
    prices: 'stock', units: 'cart', weight: 'cart', suppliers: 'stock', excel: 'stock',
    repairs: null, services: 'cart', loyalty: 'cart', search: 'stock'
  };

  // Feature -> its own icon and colour.
  var FEATURE_ICON = {
    barcode: ['i-barcode', '#2563EB'], credit: ['i-book', '#D97706'], stock: ['i-box', '#EA580C'],
    lowstock: ['i-warn', '#DC2626'], expiry: ['i-clock', '#DB2777'], profit: ['i-chart', '#16A34A'],
    cash: ['i-cash', '#0D9488'], categories: ['i-grid', '#7C3AED'], discount: ['i-percent', '#DC2626'],
    labels: ['i-tag', '#4F46E5'], prices: ['i-tag', '#0891B2'], units: ['i-box', '#B45309'],
    weight: ['i-scale', '#475569'], suppliers: ['i-truck', '#0D9488'], excel: ['i-grid', '#16A34A'],
    repairs: ['i-tool', '#475569'], services: ['i-tool', '#0891B2'], loyalty: ['i-heart', '#DB2777'],
    search: ['i-search', '#2563EB']
  };

  // Feature -> the short demo video (index in js/lessons.js) that shows it. These persuade
  // before the download; null = no video for it. All lessons are filmed on the PC app.
  var FEATURE_DEMO = {
    barcode: 7, credit: 11, stock: 16, lowstock: 17, expiry: 17, profit: 15, cash: 13,
    categories: 3, discount: 6, labels: 19, prices: 21, units: 21, weight: null, suppliers: 16,
    excel: 20, repairs: 22, services: 22, loyalty: 23, search: 7
  };
  // "Getting started" lessons, for after the download (owner brief §16): first start on PC,
  // quick add of a product, the first sale. The linking lesson is added when devices are linked.
  var TUTORIALS = [0, 1, 4];

  // "What bothers you most?" answers. `features`: the tool that fixes it, best first; the first
  // one the shop type lists wins, else the first one here. `only`: shown only to shop types that
  // list one of these features (expiry dates mean nothing in a clothes shop).
  var PAINS = [
    { id: 'credit',   icon: 'i-book',   color: '#D97706', features: ['credit'] },
    { id: 'profit',   icon: 'i-chart',  color: '#16A34A', features: ['profit'] },
    { id: 'stockout', icon: 'i-box',    color: '#EA580C', features: ['lowstock', 'stock'] },
    { id: 'expiry',   icon: 'i-clock',  color: '#DB2777', features: ['expiry'], only: true },
    { id: 'slow',     icon: 'i-bolt',   color: '#CA8A04', features: ['barcode', 'search', 'weight'] },
    { id: 'cash',     icon: 'i-cash',   color: '#0D9488', features: ['cash'] },
    { id: 'search',   icon: 'i-search', color: '#2563EB', features: ['search', 'barcode'] },
    { id: 'repairs',  icon: 'i-tool',   color: '#475569', features: ['repairs'], only: true }
  ];
  var MAX_FEATURES = 6;

  var LESSON_FIRST_START = 0;  // "First start of Doukkany on PC"
  var LESSON_DEVICES = 14;     // "A second computer and a phone in the shop"
  // Device choices, one per offer: 'phone' = phone only; 'pc' and 'both' = the One PC offer (its
  // phone is free); 'two' = the shop pack (chosen from the prices list only).
  var MODES = ['pc', 'both', 'phone', 'two'];
  var BUY_MODES = ['pc', 'both', 'phone'];
  var INTENTS = ['trial', 'buy'];
  var VERSIONS = ['v2', 'v1'];
  var DEFAULT_VERSION = 'v2';
  // Saved answers older than this are dropped (a visitor coming back months later starts fresh).
  var MAX_AGE_DAYS = 120;

  // Real customer words, when there are some (owner brief §15). EMPTY: Doukkany has no
  // testimonials yet, and the page shows no testimonials block while this list is empty. Never
  // put an invented one here. Each: { name, shop: activity id, text: { ar, fr, en }, source }.
  var TESTIMONIALS = [];

  // The FAQ (owner brief §18): every id has a question and an answer in texts.js `faq`. Order =
  // what that visitor most likely asks first. The first FAQ_OPEN_N show, the rest under "more".
  var FAQ_IDS = ['price', 'monthly', 'updates', 'offline', 'phone', 'pc', 'both', 'remote', 'trial', 'after14',
    'buy', 'pay', 'activate', 'scanner', 'printer', 'pcreq', 'change', 'data'];
  var FAQ_ORDER = {
    trial:    ['trial', 'after14', 'offline', 'pcreq', 'both', 'remote', 'scanner', 'printer', 'data', 'price', 'monthly', 'updates', 'activate', 'phone', 'pc', 'buy', 'pay', 'change'],
    buy:      ['pay', 'activate', 'updates', 'pcreq', 'both', 'remote', 'change', 'monthly', 'price', 'offline', 'data', 'scanner', 'printer', 'buy', 'trial', 'after14', 'phone', 'pc'],
    prices:   ['price', 'monthly', 'updates', 'trial', 'after14', 'pay', 'both', 'remote', 'offline', 'change', 'activate', 'buy', 'pcreq', 'phone', 'pc', 'scanner', 'printer', 'data'],
    download: ['trial', 'pcreq', 'phone', 'pc', 'after14', 'activate', 'offline', 'both', 'remote', 'scanner', 'printer', 'data', 'price', 'monthly', 'updates', 'buy', 'pay', 'change']
  };
  var FAQ_OPEN_N = 6;

  function activity(id) {
    for (var i = 0; i < ACTIVITIES.length; i++) if (ACTIVITIES[i].id === id) return ACTIVITIES[i];
    return null;
  }
  function pain(id) {
    for (var i = 0; i < PAINS.length; i++) if (PAINS[i].id === id) return PAINS[i];
    return null;
  }

  // The tool that fixes a pain in this shop type.
  function painFeature(p, a) {
    for (var i = 0; i < p.features.length; i++) if (a.features.indexOf(p.features[i]) !== -1) return p.features[i];
    return p.features[0];
  }

  // The answers that make sense for this shop type, the ones its own features fix first.
  function painsFor(activityId) {
    var a = activity(activityId) || activity('other');
    var list = PAINS.filter(function (p) {
      return !p.only || p.features.some(function (f) { return a.features.indexOf(f) !== -1; });
    });
    function rank(p) { var i = a.features.indexOf(painFeature(p, a)); return i === -1 ? 99 : i; }
    return list.map(function (p, i) { return [p, i]; })
      .sort(function (x, y) { return (rank(x[0]) - rank(y[0])) || (x[1] - y[1]); })
      .map(function (x) { return x[0]; });
  }

  // Features to show: the ones that fix the visitor's pains first (in their order), then the
  // shop type's own list. At most 6. `why[feature]` = the pain it answers.
  function featuresFor(state) {
    var a = activity(state.activity) || activity('other');
    var list = [], why = {};
    var allowed = painsFor(a.id);
    (state.pains || []).forEach(function (id) {
      var p = pain(id);
      if (!p || allowed.indexOf(p) === -1) return;
      var f = painFeature(p, a);
      if (list.indexOf(f) === -1) { list.push(f); why[f] = id; }
    });
    a.features.forEach(function (f) { if (list.indexOf(f) === -1) list.push(f); });
    return { list: list.slice(0, MAX_FEATURES), why: why };
  }

  // The one demo video worth showing before the download: for the first problem picked, else the
  // shop type's first feature that has a video.
  function demoFor(state) {
    var list = featuresFor(state).list;
    for (var i = 0; i < list.length; i++) if (FEATURE_DEMO[list[i]] != null) return FEATURE_DEMO[list[i]];
    return 4; // "Selling step by step"
  }
  // More demos (under "more videos"): the other features' videos, no repeats, at most `n`.
  function moreDemosFor(state, n) {
    var first = demoFor(state), out = [];
    featuresFor(state).list.forEach(function (f) {
      var v = FEATURE_DEMO[f];
      if (v != null && v !== first && out.indexOf(v) === -1) out.push(v);
    });
    return out.slice(0, n || 4);
  }
  // Getting-started lessons for after the download.
  function tutorialsFor(state) {
    var out = TUTORIALS.slice();
    var d = devices(state);
    if (d && d.pcs > 0 && d.pcs + d.phones > 1) out.push(LESSON_DEVICES);
    return out;
  }

  // How many devices of each kind the shop will use.
  function devices(state) {
    switch (state.mode) {
      case 'pc': return { pcs: 1, phones: 0 };
      case 'both': return { pcs: 1, phones: 1 };
      case 'phone': return { pcs: 0, phones: 1 };
      case 'two': return { pcs: 2, phones: 1 };
      default: return null;
    }
  }

  // The device choice to start from when the visitor skips the questions: the kind of device
  // they are on (an Android phone → phone; anything else → computer).
  function defaultMode(device) { return device === 'android' ? 'phone' : 'pc'; }

  // Lessons for the v1 "lessons" screen: the shop's own list; the PC "first start" lesson first
  // when a PC is used; the linking lesson when devices are linked. At most 6.
  function lessonsFor(state) {
    var a = activity(state.activity) || activity('other');
    var d = devices(state) || { pcs: 0, phones: 0 };
    var out = [];
    function add(i) { if (out.indexOf(i) === -1) out.push(i); }
    if (d.pcs > 0) add(LESSON_FIRST_START);
    a.lessons.forEach(add);
    if (d.pcs > 0 && d.pcs + d.phones > 1) add(LESSON_DEVICES);
    if (out.length > 6) {
      var keep = out.slice(0, 5);
      if (out.indexOf(LESSON_DEVICES) > 4) keep.push(LESSON_DEVICES); else keep.push(out[5]);
      out = keep;
    }
    return out;
  }

  // The saved answers (localStorage), checked: anything unknown is dropped. `now` (ms) lets the
  // tests check the age rule.
  function cleanState(raw, now) {
    var s = { v: 1, fv: DEFAULT_VERSION, intent: null, activity: null, other: '', pains: [], mode: null, watched: [], last: null, at: 0 };
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return s;
    var at = typeof raw.at === 'number' && isFinite(raw.at) ? raw.at : 0;
    if (at && now && now - at > MAX_AGE_DAYS * 864e5) return s;
    s.at = at;
    // Answers saved before v2 have no `fv`: they load into v2 (same answers, shorter path).
    if (VERSIONS.indexOf(raw.fv) !== -1) s.fv = raw.fv;
    if (INTENTS.indexOf(raw.intent) !== -1) s.intent = raw.intent;
    if (activity(raw.activity)) s.activity = raw.activity;
    if (typeof raw.other === 'string') s.other = raw.other.replace(/[\u0000-\u001F<>]/g, ' ').trim().slice(0, 60);
    if (Array.isArray(raw.pains)) {
      raw.pains.forEach(function (id) { if (pain(id) && s.pains.indexOf(id) === -1) s.pains.push(id); });
    }
    if (MODES.indexOf(raw.mode) !== -1) s.mode = raw.mode;
    if (Array.isArray(raw.watched)) {
      s.watched = raw.watched.filter(function (x) { return typeof x === 'string' && /^[\w-]{6,20}$/.test(x); }).slice(0, 30);
    }
    if (STEPS.indexOf(raw.last) !== -1) s.last = raw.last;
    return s;
  }

  // Ad and greeting links (owner brief §28): ?activity=grocery&intent=trial&device=phone&lang=fr
  // &fv=v1. Only known values are kept; everything else is ignored. `device`: phone | pc | both.
  function linkAnswers(search) {
    var out = {};
    var q;
    try { q = new URLSearchParams(search || ''); } catch (e) { return out; }
    var a = q.get('activity');
    if (activity(a)) out.activity = a;
    var i = q.get('intent');
    if (INTENTS.indexOf(i) !== -1) out.intent = i;
    var d = q.get('device');
    if (d === 'android') d = 'phone';
    if (d === 'windows') d = 'pc';
    if (BUY_MODES.indexOf(d) !== -1) out.mode = d;
    var fv = q.get('fv');
    if (VERSIONS.indexOf(fv) !== -1) out.fv = fv;
    return out;
  }

  // Lightweight A/B tests (owner brief §29). OFF: Doukkany has little traffic, so no split runs
  // until the owner picks ONE test. To run one: set `split` to the share (0..1) of NEW visitors
  // who get `variant`. The pick is kept on the device (localStorage) so a visitor always sees
  // the same version; ?fv= forces one. Every event carries funnel_version.
  var EXPERIMENT = { variant: 'v1', split: 0 };
  function pickVersion(saved, forced, random) {
    if (VERSIONS.indexOf(forced) !== -1) return forced;
    if (VERSIONS.indexOf(saved) !== -1) return saved;
    var r = typeof random === 'number' ? random : Math.random();
    return EXPERIMENT.split > 0 && r < EXPERIMENT.split ? EXPERIMENT.variant : DEFAULT_VERSION;
  }

  // Steps in order. 'trial' (v1), 'ready' (v2) and 'order' are the ends.
  var PROGRESS_V1 = ['welcome', 'activity', 'pain', 'devices', 'features', 'price', 'course', 'final'];
  var PROGRESS_V2 = ['welcome', 'activity', 'pain', 'devices', 'final'];
  var PROGRESS_BUY = ['welcome', 'activity', 'devices', 'final'];
  var STEPS = ['welcome', 'activity', 'pain', 'devices', 'ready', 'features', 'price', 'course', 'trial', 'order', 'prices', 'download'];
  var V1_ONLY = ['features', 'price', 'course', 'trial'];

  function isBuy(state) { return !!state && state.intent === 'buy'; }
  function isV1(state) { return !!state && state.fv === 'v1'; }
  function progressFor(state) { return isBuy(state) ? PROGRESS_BUY : isV1(state) ? PROGRESS_V1 : PROGRESS_V2; }
  // The trial's last screen for this version.
  function trialEnd(state) { return isV1(state) ? 'trial' : 'ready'; }

  // The step's place in the bar for this visitor (-1: not in the bar).
  function progressIndex(step, state) {
    var list = progressFor(state);
    if (step === 'trial' || step === 'order' || step === 'ready') return list.indexOf('final');
    return list.indexOf(step);
  }

  // The first step whose answer is missing before `step` can be shown, or `step` itself.
  // v2: the shop type and the problems can be skipped; the end screens only need the devices.
  function allowedStep(state, step) {
    if (STEPS.indexOf(step) === -1) return 'welcome';
    if (step === 'welcome' || step === 'prices' || step === 'download' || step === 'activity') return step;
    if (V1_ONLY.indexOf(step) !== -1 && !isV1(state)) return state.mode ? 'ready' : 'devices';
    if (step === 'ready' && isV1(state)) return allowedStep(state, 'trial');
    if (isV1(state) && !state.activity) return 'activity';
    if (step === 'pain' || step === 'devices') return step;
    if (!state.mode) return 'devices';
    return step;
  }

  // The step before `step` (the in-page Back button when the browser has no history for it).
  function previousStep(state, step) {
    switch (step) {
      case 'activity': return 'welcome';
      case 'pain': return 'activity';
      case 'devices': return isBuy(state) ? 'activity' : 'pain';
      case 'features': return 'devices';
      case 'price': return 'features';
      case 'course': return 'price';
      case 'trial': return 'course';
      case 'ready': return 'devices';
      case 'order': return isBuy(state) ? 'devices' : isV1(state) ? 'price' : 'ready';
      default: return 'welcome';
    }
  }

  // FAQ ids for a journey, in order.
  function faqFor(journey) { return (FAQ_ORDER[journey] || FAQ_ORDER.prices).slice(); }

  // Optional loss calculator (owner brief §20). Inputs are the visitor's own guess.
  // Returns null when the inputs are not usable numbers.
  function losses(perDay, days, price) {
    perDay = Math.floor(+perDay); days = Math.floor(+days);
    if (!(perDay > 0) || perDay > 1e7 || !(days >= 1 && days <= 31)) return null;
    var month = perDay * days;
    return { month: month, year: month * 12, daysToPrice: price > 0 ? Math.ceil(price / perDay) : null };
  }

  // Checkout check (owner brief §13): what is still missing or wrong, first one first.
  // buyer: { win, name, phone, pay, wilaya (text), commune (text) }, type: offer id.
  // Each item: [field id, reason] with reason 'missing' | 'bad'.
  function phoneOk(p) { return /^(?:\+213|00213|0)[5-7]\d{8}$/.test(String(p || '').replace(/[\s.\-()]/g, '')); }
  function checkoutProblems(buyer, type) {
    var out = [];
    if (type === 'phone') return out; // the phone offer is ordered in WhatsApp, nothing to fill here
    if (buyer.win !== 'yes' && buyer.win !== 'unknown') out.push(['win', buyer.win === 'no' ? 'bad' : 'missing']);
    if (!buyer.pay) out.push(['pay', 'missing']);
    // Paying first goes on WhatsApp: the chat already gives us the number, so nothing to type.
    // Pay at delivery comes straight to us: we need who, how to call, and where to send the key.
    if (buyer.pay === 'cod') {
      if (String(buyer.name || '').trim().length < 3) out.push(['name', 'missing']);
      if (!phoneOk(buyer.phone)) out.push(['phone', String(buyer.phone || '').trim() ? 'bad' : 'missing']);
      if (!String(buyer.wilaya || '').trim()) out.push(['wilaya', 'missing']);
      if (!String(buyer.commune || '').trim()) out.push(['commune', 'missing']);
    }
    return out;
  }

  // The order reference the buyer sees, made from the order's request id (the CRM keeps the
  // same id): 'DK-' + its first 8 letters/digits. '' when there is no request id.
  function orderRef(requestId) {
    return typeof requestId === 'string' && /^[0-9a-f]{8}-/i.test(requestId) ? 'DK-' + requestId.slice(0, 8).toUpperCase() : '';
  }

  var FUNNEL = {
    ACTIVITIES: ACTIVITIES, FEATURE_IMG: FEATURE_IMG, FEATURE_ICON: FEATURE_ICON, FEATURE_DEMO: FEATURE_DEMO,
    TUTORIALS: TUTORIALS, PAINS: PAINS, TESTIMONIALS: TESTIMONIALS, FAQ_IDS: FAQ_IDS, FAQ_ORDER: FAQ_ORDER, FAQ_OPEN_N: FAQ_OPEN_N,
    PROGRESS: PROGRESS_V1, PROGRESS_V1: PROGRESS_V1, PROGRESS_V2: PROGRESS_V2, PROGRESS_BUY: PROGRESS_BUY,
    STEPS: STEPS, BUY_MODES: BUY_MODES, VERSIONS: VERSIONS, DEFAULT_VERSION: DEFAULT_VERSION, EXPERIMENT: EXPERIMENT,
    isBuy: isBuy, isV1: isV1, progressFor: progressFor, trialEnd: trialEnd,
    activity: activity, pain: pain, painsFor: painsFor, painFeature: painFeature, featuresFor: featuresFor,
    demoFor: demoFor, moreDemosFor: moreDemosFor, tutorialsFor: tutorialsFor,
    devices: devices, defaultMode: defaultMode, lessonsFor: lessonsFor, cleanState: cleanState, linkAnswers: linkAnswers,
    pickVersion: pickVersion, progressIndex: progressIndex, allowedStep: allowedStep, previousStep: previousStep,
    faqFor: faqFor, losses: losses, phoneOk: phoneOk, checkoutProblems: checkoutProblems, orderRef: orderRef
  };
  if (typeof module === 'object' && module.exports) module.exports = FUNNEL;
  else root.DK_FUNNEL = FUNNEL;
})(this);
