/* Doukkany /start/ funnel: the data and rules, without any screen code.
 * Used by start/index.html and by tests/funnel.test.js (node).
 *
 * Only real Doukkany features are listed here (checked against the app's texts and
 * docs/marketing/FEATURES_FACEBOOK_AR.md, "ready" list). Features that are not tested on real
 * devices yet (staff PIN, Google Drive backup) and the internet link are never shown.
 */
(function (root) {
  'use strict';

  // Shop types: id -> colour and icon (the shop type list), the 4-6 features shown first, and the lessons (index in
  // js/lessons.js videos, in watching order).
  var ACTIVITIES = [
    { id: 'grocery',    color: '#16A34A', icon: 'i-basket', features: ['barcode', 'credit', 'stock', 'lowstock', 'expiry', 'profit'], lessons: [1, 7, 16, 17, 11] },
    { id: 'clothes',    color: '#7C3AED', icon: 'i-shirt',  features: ['categories', 'stock', 'discount', 'labels', 'profit'],        lessons: [3, 1, 6, 19, 15] },
    { id: 'phones',     color: '#2563EB', icon: 'i-phone',  features: ['repairs', 'barcode', 'stock', 'credit', 'profit'],            lessons: [22, 1, 7, 11, 15] },
    { id: 'cosmetics',  color: '#DB2777', icon: 'i-spark',  features: ['stock', 'expiry', 'barcode', 'profit', 'loyalty'],            lessons: [1, 7, 17, 23, 15] },
    { id: 'autoparts',  color: '#475569', icon: 'i-car',    features: ['search', 'stock', 'credit', 'suppliers', 'profit'],           lessons: [20, 7, 16, 11, 15] },
    { id: 'building',   color: '#EA580C', icon: 'i-brick',  features: ['prices', 'units', 'weight', 'credit', 'suppliers', 'stock'],  lessons: [2, 21, 11, 16, 15] },
    { id: 'household',  color: '#0D9488', icon: 'i-home',   features: ['categories', 'barcode', 'stock', 'discount', 'profit'],       lessons: [3, 1, 7, 6, 15] },
    { id: 'stationery', color: '#4F46E5', icon: 'i-book',   features: ['barcode', 'excel', 'categories', 'stock', 'profit'],          lessons: [20, 3, 7, 16, 15] },
    { id: 'wholesale',  color: '#B45309', icon: 'i-truck',  features: ['prices', 'units', 'credit', 'suppliers', 'stock', 'profit'],  lessons: [2, 21, 5, 11, 16] },
    { id: 'produce',    color: '#DC2626', icon: 'i-apple',  features: ['weight', 'cash', 'credit', 'profit'],                         lessons: [2, 4, 13, 11, 15] },
    { id: 'bakery',     color: '#D97706', icon: 'i-cake',   features: ['cash', 'expiry', 'credit', 'profit'],                         lessons: [1, 4, 13, 17, 15] },
    { id: 'services',   color: '#0891B2', icon: 'i-tool',   features: ['services', 'repairs', 'credit', 'cash', 'profit'],            lessons: [22, 11, 13, 15] },
    { id: 'other',      color: '#6B7280', icon: 'i-dots',   features: ['barcode', 'credit', 'stock', 'cash', 'profit'],               lessons: [1, 4, 11, 15] }
  ];

  // Feature -> app screen shown next to it (start/assets/<img>-<lang>.webp). null = no screen.
  var FEATURE_IMG = {
    barcode: 'sell', credit: 'credit', stock: 'stock', lowstock: 'stock', expiry: 'stock',
    profit: 'today', cash: 'cash', categories: 'stock', discount: 'cart', labels: 'stock',
    prices: 'stock', units: 'cart', weight: 'cart', suppliers: 'stock', excel: 'stock',
    repairs: null, services: 'cart', loyalty: 'cart', search: 'stock'
  };

  // Feature -> its own icon and colour in the features list (owner, 2026-11-26: "colored
  // meaningful icons in all the screens").
  var FEATURE_ICON = {
    barcode: ['i-barcode', '#2563EB'], credit: ['i-book', '#D97706'], stock: ['i-box', '#EA580C'],
    lowstock: ['i-warn', '#DC2626'], expiry: ['i-clock', '#DB2777'], profit: ['i-chart', '#16A34A'],
    cash: ['i-cash', '#0D9488'], categories: ['i-grid', '#7C3AED'], discount: ['i-percent', '#DC2626'],
    labels: ['i-tag', '#4F46E5'], prices: ['i-tag', '#0891B2'], units: ['i-box', '#B45309'],
    weight: ['i-scale', '#475569'], suppliers: ['i-truck', '#0D9488'], excel: ['i-grid', '#16A34A'],
    repairs: ['i-tool', '#475569'], services: ['i-tool', '#0891B2'], loyalty: ['i-heart', '#DB2777'],
    search: ['i-search', '#2563EB']
  };

  // "What bothers you most?" answers. `features`: the tool that fixes it, best first; the first
  // one the shop type already lists wins, else the first one here. `only`: shown only to shop
  // types that list one of these features (expiry dates mean nothing in a clothes shop).
  var PAINS = [
    { id: 'credit',   icon: 'i-book',   color: '#D97706', features: ['credit'] },
    { id: 'profit',   icon: 'i-chart',  color: '#16A34A', features: ['profit'] },
    { id: 'stockout', icon: 'i-box',    color: '#EA580C', features: ['lowstock', 'stock'] },
    { id: 'expiry',   icon: 'i-clock',  color: '#DB2777', features: ['expiry'], only: true },
    { id: 'slow',     icon: 'i-bolt',   color: '#CA8A04', features: ['barcode', 'search', 'weight'] },
    { id: 'cash',     icon: 'i-cash',   color: '#0D9488', features: ['cash'] },
    { id: 'repairs',  icon: 'i-tool',   color: '#475569', features: ['repairs'], only: true }
  ];
  var MAX_FEATURES = 6;

  var LESSON_FIRST_START = 0;  // "First start of Doukkany on PC"
  var LESSON_DEVICES = 14;     // "A second computer and a phone in the shop"
  // Device choices, one per offer (owner 2026-11-26, three offers only): 'phone' = phone only;
  // 'pc' and 'both' = the One PC offer (its phone is free); 'two' = the shop pack.
  // ('several', with counts and add-ons, was removed; old saved answers with it ask again.)
  var MODES = ['pc', 'both', 'phone', 'two'];
  // "I want to buy" shows only these three (owner 2026-11-26): computer, computer + phone, phone.
  var BUY_MODES = ['pc', 'both', 'phone'];
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

  // How many devices of each kind the shop will use, for a device choice. Linked devices always
  // share the same products and sales (the PC is the main one).
  function devices(state) {
    switch (state.mode) {
      case 'pc': return { pcs: 1, phones: 0 };
      case 'both': return { pcs: 1, phones: 1 };
      case 'phone': return { pcs: 0, phones: 1 };
      case 'two': return { pcs: 2, phones: 1 };
      default: return null;
    }
  }

  // Lessons for a shop: its own list; the PC "first start" lesson first when a PC is used;
  // the "second computer and a phone" lesson when devices are linked. At most 6.
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

  // The saved answers (localStorage), checked: anything unknown is dropped.
  function cleanState(raw) {
    var s = { v: 1, intent: null, activity: null, other: '', pains: [], mode: null, watched: [] };
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return s;
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
    return s;
  }

  // Steps in order. 'trial' and 'order' are the end.
  // 'pain' can be skipped, so later steps never wait for it.
  var PROGRESS = ['welcome', 'activity', 'pain', 'devices', 'features', 'price', 'course', 'final'];
  // "I want to buy" (owner 2026-11-26): shop type, devices, then the order. No problems,
  // features, price or lessons screens.
  var PROGRESS_BUY = ['welcome', 'activity', 'devices', 'final'];
  var STEPS = ['welcome', 'activity', 'pain', 'devices', 'features', 'price', 'course', 'trial', 'order', 'prices'];

  function isBuy(state) { return !!state && state.intent === 'buy'; }
  function progressFor(state) { return isBuy(state) ? PROGRESS_BUY : PROGRESS; }

  // The step's place in the bar for this visitor (-1: not in the bar).
  function progressIndex(step, state) {
    var list = progressFor(state);
    if (step === 'trial' || step === 'order') return list.indexOf('final');
    return list.indexOf(step);
  }

  // The first step whose answer is missing before `step` can be shown, or `step` itself.
  function allowedStep(state, step) {
    if (STEPS.indexOf(step) === -1) return 'welcome';
    if (step === 'welcome' || step === 'prices' || step === 'activity') return step;
    if (!state.activity) return 'activity';
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
      case 'order': return isBuy(state) ? 'devices' : 'price'; // buying skips the lessons (they come on the USB key)
      default: return 'welcome';
    }
  }

  var FUNNEL = {
    ACTIVITIES: ACTIVITIES, FEATURE_IMG: FEATURE_IMG, FEATURE_ICON: FEATURE_ICON, PAINS: PAINS, PROGRESS: PROGRESS, PROGRESS_BUY: PROGRESS_BUY,
    STEPS: STEPS, BUY_MODES: BUY_MODES, isBuy: isBuy, progressFor: progressFor,
    activity: activity, pain: pain, painsFor: painsFor, painFeature: painFeature, featuresFor: featuresFor, devices: devices, lessonsFor: lessonsFor, cleanState: cleanState,
    progressIndex: progressIndex, allowedStep: allowedStep, previousStep: previousStep
  };
  if (typeof module === 'object' && module.exports) module.exports = FUNNEL;
  else root.DK_FUNNEL = FUNNEL;
})(this);
