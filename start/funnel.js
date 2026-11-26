/* Doukkany /start/ funnel: the data and rules, without any screen code.
 * Used by start/index.html and by tests/funnel.test.js (node).
 *
 * Only real Doukkany features are listed here (checked against the app's texts and
 * docs/marketing/FEATURES_FACEBOOK_AR.md, "ready" list). Features that are not tested on real
 * devices yet (staff PIN, Google Drive backup) and the internet link are never shown.
 */
(function (root) {
  'use strict';

  // Shop types: id -> icon, the 4-6 features shown first, and the lessons (index in
  // js/lessons.js videos, in watching order).
  var ACTIVITIES = [
    { id: 'grocery',    icon: 'i-basket', features: ['barcode', 'credit', 'stock', 'lowstock', 'expiry', 'profit'], lessons: [1, 7, 16, 17, 11] },
    { id: 'clothes',    icon: 'i-shirt',  features: ['categories', 'stock', 'discount', 'labels', 'profit'],        lessons: [3, 1, 6, 19, 15] },
    { id: 'phones',     icon: 'i-phone',  features: ['repairs', 'barcode', 'stock', 'credit', 'profit'],            lessons: [22, 1, 7, 11, 15] },
    { id: 'cosmetics',  icon: 'i-spark',  features: ['stock', 'expiry', 'barcode', 'profit', 'loyalty'],            lessons: [1, 7, 17, 23, 15] },
    { id: 'autoparts',  icon: 'i-car',    features: ['search', 'stock', 'credit', 'suppliers', 'profit'],           lessons: [20, 7, 16, 11, 15] },
    { id: 'building',   icon: 'i-brick',  features: ['prices', 'units', 'weight', 'credit', 'suppliers', 'stock'],  lessons: [2, 21, 11, 16, 15] },
    { id: 'household',  icon: 'i-home',   features: ['categories', 'barcode', 'stock', 'discount', 'profit'],       lessons: [3, 1, 7, 6, 15] },
    { id: 'stationery', icon: 'i-book',   features: ['barcode', 'excel', 'categories', 'stock', 'profit'],          lessons: [20, 3, 7, 16, 15] },
    { id: 'wholesale',  icon: 'i-truck',  features: ['prices', 'units', 'credit', 'suppliers', 'stock', 'profit'],  lessons: [2, 21, 5, 11, 16] },
    { id: 'produce',    icon: 'i-apple',  features: ['weight', 'cash', 'credit', 'profit'],                         lessons: [2, 4, 13, 11, 15] },
    { id: 'bakery',     icon: 'i-cake',   features: ['cash', 'expiry', 'credit', 'profit'],                         lessons: [1, 4, 13, 17, 15] },
    { id: 'services',   icon: 'i-tool',   features: ['services', 'repairs', 'credit', 'cash', 'profit'],            lessons: [22, 11, 13, 15] },
    { id: 'other',      icon: 'i-dots',   features: ['barcode', 'credit', 'stock', 'cash', 'profit'],               lessons: [1, 4, 11, 15] }
  ];

  // Feature -> app screen shown next to it (start/assets/<img>-<lang>.webp). null = no screen.
  var FEATURE_IMG = {
    barcode: 'sell', credit: 'credit', stock: 'stock', lowstock: 'stock', expiry: 'stock',
    profit: 'today', cash: 'cash', categories: 'stock', discount: 'cart', labels: 'stock',
    prices: 'stock', units: 'cart', weight: 'cart', suppliers: 'stock', excel: 'stock',
    repairs: null, services: 'cart', loyalty: 'cart', search: 'stock'
  };

  // "What bothers you most?" answers. `features`: the tool that fixes it, best first; the first
  // one the shop type already lists wins, else the first one here. `only`: shown only to shop
  // types that list one of these features (expiry dates mean nothing in a clothes shop).
  var PAINS = [
    { id: 'credit',   icon: 'i-book',   features: ['credit'] },
    { id: 'profit',   icon: 'i-chart',  features: ['profit'] },
    { id: 'stockout', icon: 'i-box',    features: ['lowstock', 'stock'] },
    { id: 'expiry',   icon: 'i-clock',  features: ['expiry'], only: true },
    { id: 'slow',     icon: 'i-bolt',   features: ['barcode', 'search', 'weight'] },
    { id: 'cash',     icon: 'i-cash',   features: ['cash'] },
    { id: 'repairs',  icon: 'i-tool',   features: ['repairs'], only: true }
  ];
  var MAX_FEATURES = 6;

  var LESSON_FIRST_START = 0;  // "First start of Doukkany on PC"
  var LESSON_DEVICES = 14;     // "A second computer and a phone in the shop"
  var MODES = ['pc', 'phone', 'both', 'several'];
  var INTENTS = ['trial', 'buy'];

  function activity(id) {
    for (var i = 0; i < ACTIVITIES.length; i++) if (ACTIVITIES[i].id === id) return ACTIVITIES[i];
    return null;
  }

  function pain(id) {
    for (var i = 0; i < PAINS.length; i++) if (PAINS[i].id === id) return PAINS[i];
    return null;
  }

  // The answers that make sense for this shop type.
  function painsFor(activityId) {
    var a = activity(activityId) || activity('other');
    return PAINS.filter(function (p) {
      return !p.only || p.features.some(function (f) { return a.features.indexOf(f) !== -1; });
    });
  }

  // The tool that fixes a pain in this shop type.
  function painFeature(p, a) {
    for (var i = 0; i < p.features.length; i++) if (a.features.indexOf(p.features[i]) !== -1) return p.features[i];
    return p.features[0];
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

  // How many devices of each kind, and whether they share data, for a device choice.
  function devices(state) {
    switch (state.mode) {
      case 'pc': return { pcs: 1, phones: 0, shared: true };
      case 'phone': return { pcs: 0, phones: 1, shared: true };
      case 'both': return { pcs: 1, phones: 1, shared: true };
      case 'several': return { pcs: state.pcs, phones: state.phones, shared: state.shared };
      default: return null;
    }
  }

  // Lessons for a shop: its own list; the PC "first start" lesson first when a PC is used;
  // the "second computer and a phone" lesson when devices are linked. At most 6.
  function lessonsFor(state) {
    var a = activity(state.activity) || activity('other');
    var d = devices(state) || { pcs: 0, phones: 0, shared: false };
    var out = [];
    function add(i) { if (out.indexOf(i) === -1) out.push(i); }
    if (d.pcs > 0) add(LESSON_FIRST_START);
    a.lessons.forEach(add);
    if (d.shared && d.pcs > 0 && d.pcs + d.phones > 1) add(LESSON_DEVICES);
    if (out.length > 6) {
      var keep = out.slice(0, 5);
      if (out.indexOf(LESSON_DEVICES) > 4) keep.push(LESSON_DEVICES); else keep.push(out[5]);
      out = keep;
    }
    return out;
  }

  function clampCount(n) {
    n = Math.floor(+n);
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(n, 10);
  }

  // The saved answers (localStorage), checked: anything unknown is dropped.
  function cleanState(raw) {
    var s = { v: 1, intent: null, activity: null, other: '', pains: [], mode: null, pcs: 2, phones: 1, shared: true, watched: [] };
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return s;
    if (INTENTS.indexOf(raw.intent) !== -1) s.intent = raw.intent;
    if (activity(raw.activity)) s.activity = raw.activity;
    if (typeof raw.other === 'string') s.other = raw.other.replace(/[\u0000-\u001F<>]/g, ' ').trim().slice(0, 60);
    if (Array.isArray(raw.pains)) {
      raw.pains.forEach(function (id) { if (pain(id) && s.pains.indexOf(id) === -1) s.pains.push(id); });
    }
    if (MODES.indexOf(raw.mode) !== -1) s.mode = raw.mode;
    if (raw.pcs != null) s.pcs = clampCount(raw.pcs);
    if (raw.phones != null) s.phones = clampCount(raw.phones);
    if (typeof raw.shared === 'boolean') s.shared = raw.shared;
    if (Array.isArray(raw.watched)) {
      s.watched = raw.watched.filter(function (x) { return typeof x === 'string' && /^[\w-]{6,20}$/.test(x); }).slice(0, 30);
    }
    return s;
  }

  // Steps in order. 'several' belongs to the devices step; 'trial' and 'order' are the end.
  // 'pain' can be skipped, so later steps never wait for it.
  var PROGRESS = ['welcome', 'activity', 'pain', 'devices', 'features', 'price', 'course', 'final'];
  var STEPS = ['welcome', 'activity', 'pain', 'devices', 'several', 'features', 'price', 'course', 'trial', 'order', 'prices'];

  function progressIndex(step) {
    if (step === 'several') return PROGRESS.indexOf('devices');
    if (step === 'trial' || step === 'order') return PROGRESS.indexOf('final');
    return PROGRESS.indexOf(step);
  }

  // The first step whose answer is missing before `step` can be shown, or `step` itself.
  function allowedStep(state, step, offer) {
    if (STEPS.indexOf(step) === -1) return 'welcome';
    if (step === 'welcome' || step === 'prices' || step === 'activity') return step;
    if (!state.activity) return 'activity';
    if (step === 'pain' || step === 'devices') return step;
    if (step === 'several') return step;
    if (!state.mode) return 'devices';
    if (state.mode === 'several') {
      var d = devices(state);
      if (!offer.recommend(d.pcs, d.phones, d.shared).ok) return 'several';
    }
    return step;
  }

  // The step before `step` (the in-page Back button when the browser has no history for it).
  function previousStep(state, step) {
    switch (step) {
      case 'activity': return 'welcome';
      case 'pain': return 'activity';
      case 'devices': return 'pain';
      case 'several': return 'devices';
      case 'features': return state.mode === 'several' ? 'several' : 'devices';
      case 'price': return 'features';
      case 'course': return 'price';
      case 'trial': case 'order': return 'course';
      default: return 'welcome';
    }
  }

  var FUNNEL = {
    ACTIVITIES: ACTIVITIES, FEATURE_IMG: FEATURE_IMG, PAINS: PAINS, PROGRESS: PROGRESS, STEPS: STEPS,
    activity: activity, pain: pain, painsFor: painsFor, painFeature: painFeature, featuresFor: featuresFor, devices: devices, lessonsFor: lessonsFor, cleanState: cleanState,
    progressIndex: progressIndex, allowedStep: allowedStep, previousStep: previousStep
  };
  if (typeof module === 'object' && module.exports) module.exports = FUNNEL;
  else root.DK_FUNNEL = FUNNEL;
})(this);
