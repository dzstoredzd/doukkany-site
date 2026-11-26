// Run: node --test tests/*.test.js
// Checks the /start/ funnel rules (start/funnel.js) and that its texts are complete.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const F = require('../start/funnel.js');
const OFFER = require('../js/offer.js');
const LESSONS = require('../js/lessons.js');

function loadTexts() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../start/texts.js'), 'utf8'), sandbox);
  return sandbox.window.DK_START_TEXT;
}

test('every shop type has 4 to 6 real features and existing lessons', () => {
  assert.equal(F.ACTIVITIES.length, 13);
  for (const a of F.ACTIVITIES) {
    assert.ok(a.features.length >= 4 && a.features.length <= 6, a.id);
    for (const f of a.features) assert.ok(f in F.FEATURE_IMG, a.id + ' ' + f);
    for (const i of a.lessons) assert.ok(LESSONS.videos[i], a.id + ' lesson ' + i);
  }
});

test('no feature that is untested or hidden in the app is offered', () => {
  const all = F.ACTIVITIES.flatMap((a) => a.features).concat(Object.keys(F.FEATURE_IMG));
  for (const bad of ['staff', 'pin', 'drive', 'cloud', 'sync', 'internet', 'tunnel']) {
    assert.ok(!all.some((f) => f.includes(bad)), bad);
  }
});

test('pains: every answer points to real features and has words in every language', () => {
  const T = loadTexts();
  assert.ok(F.PAINS.length >= 5);
  for (const p of F.PAINS) {
    for (const f of p.features) assert.ok(f in F.FEATURE_IMG, p.id + ' ' + f);
    for (const lang of ['ar', 'fr', 'en']) assert.ok(T[lang].pain[p.id], lang + ' pain ' + p.id);
  }
  for (const lang of ['ar', 'fr', 'en']) assert.deepEqual(Object.keys(T[lang].pain).sort(), F.PAINS.map((p) => p.id).sort());
});

test('pains: only the ones that fit the shop type are offered', () => {
  const ids = (a) => F.painsFor(a).map((p) => p.id);
  assert.ok(ids('grocery').includes('expiry'));
  assert.ok(!ids('clothes').includes('expiry'), 'no expiry dates in a clothes shop');
  assert.ok(!ids('grocery').includes('repairs'));
  assert.ok(ids('phones').includes('repairs'));
  for (const a of F.ACTIVITIES) {
    for (const general of ['credit', 'profit', 'stockout', 'slow', 'cash']) assert.ok(ids(a.id).includes(general), a.id + ' ' + general);
  }
});

test('features: the fixes for the chosen pains come first, at most 6, each with its reason', () => {
  const s = { ...F.cleanState(null), activity: 'grocery' };
  assert.deepEqual(F.featuresFor(s), { list: F.activity('grocery').features, why: {} }, 'no pain: the shop type list as before');
  const r = F.featuresFor({ ...s, pains: ['cash', 'credit'] });
  assert.deepEqual(r.list.slice(0, 2), ['cash', 'credit']);
  assert.deepEqual(r.why, { cash: 'cash', credit: 'credit' });
  assert.ok(r.list.length <= 6);
  assert.equal(new Set(r.list).size, r.list.length);
  // A pain uses the tool the shop type already lists: clothes has no low-stock alert, so plain stock.
  assert.equal(F.featuresFor({ ...s, activity: 'clothes', pains: ['stockout'] }).list[0], 'stock');
  // Produce has no barcode: slow checkout is fixed by selling by weight.
  assert.equal(F.featuresFor({ ...s, activity: 'produce', pains: ['slow'] }).list[0], 'weight');
  // A pain that does not fit the shop type (left from an earlier shop type) is ignored.
  assert.deepEqual(F.featuresFor({ ...s, activity: 'clothes', pains: ['expiry'] }).why, {});
  for (const a of F.ACTIVITIES) {
    const all = F.featuresFor({ ...s, activity: a.id, pains: F.PAINS.map((p) => p.id) });
    assert.ok(all.list.length >= 4 && all.list.length <= 6, a.id);
  }
});

test('WhatsApp order messages: Darija, every detail asked, no price written in them', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../start/texts.js'), 'utf8'), sandbox);
  const W = sandbox.window.DK_WA_DZ;
  for (const k of ['{offer}', '{total}', '{activity}']) assert.ok(W.phone.includes(k), 'phone ' + k);
  for (const k of ['{offer}', '{pay}', '{total}', '{name}', '{phone}', '{wilaya}', '{commune}', '{activity}']) assert.ok(W.pc.includes(k), 'pc ' + k);
  for (const k of ['{offer}', '{pay}', '{total}', '{name}', '{phone}', '{activity}']) assert.ok(W.pcCode.includes(k), 'pcCode ' + k);
  // Paying first = the code on WhatsApp, nothing sent home: no address asked in that message.
  assert.ok(!W.pcCode.includes('{wilaya}') && !W.pcCode.includes('{commune}'));
  assert.ok(W.payPrepaid.includes('{discount}'));
  assert.ok(/[؀-ۿ]/.test(W.pc) && /[؀-ۿ]/.test(W.phone), 'Arabic script');
});

test('wilayas and communes list: 69 wilayas, each with its communes, no duplicates', () => {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '../js/dz-places.json'), 'utf8'));
  assert.equal(d.w.length, 69);
  d.w.forEach((w, i) => {
    assert.equal(w[0], i + 1, 'codes 1..69 in order');
    assert.ok(w[1] && w[2], 'latin and arabic name ' + w[0]);
    assert.ok(w[3].length >= 2, 'communes of ' + w[1]);
    const names = w[3].map((c) => c[0].toLowerCase());
    assert.equal(new Set(names).size, names.length, 'no duplicate commune in ' + w[1]);
    for (const c of w[3]) assert.ok(c[0] && c[1] && !/[<>]/.test(c[0] + c[1]));
  });
  // The source file had the names of 49-58 in the wrong order; the official order is kept here.
  assert.equal(d.w[48][1], 'Timimoun');
  assert.ok(d.w[48][3].some((c) => c[0] === 'Aougrout'));
  assert.equal(d.w[56][1], "El M'Ghair");
  assert.equal(d.w[15][1], 'Alger');
});

test('feature screens exist for every language', () => {
  for (const img of new Set(Object.values(F.FEATURE_IMG).filter(Boolean))) {
    for (const lang of ['ar', 'fr', 'en']) {
      assert.ok(fs.existsSync(path.join(__dirname, '../start/assets', `${img}-${lang}.webp`)), img + '-' + lang);
    }
  }
});

test('texts: ar, fr and en have the same keys, every activity, feature and plan', () => {
  const T = loadTexts();
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(T.fr), keys(T.ar));
  assert.deepEqual(keys(T.en), keys(T.ar));
  for (const lang of ['ar', 'fr', 'en']) {
    for (const a of F.ACTIVITIES) assert.ok(T[lang].act[a.id], lang + ' act ' + a.id);
    for (const f of Object.keys(F.FEATURE_IMG)) assert.equal(T[lang].feat[f].length, 2, lang + ' feat ' + f);
    for (const p of OFFER.listOrder) assert.equal(T[lang].plan[p].length, 2, lang + ' plan ' + p);
    assert.equal(T[lang].instPc.length, T.ar.instPc.length);
    assert.equal(T[lang].nextSteps.length, T.ar.nextSteps.length);
  }
});

test('texts never write a price, a payment account or a fake promise', () => {
  const src = fs.readFileSync(path.join(__dirname, '../start/texts.js'), 'utf8');
  assert.ok(!/\d[\d\s ]*000/.test(src), 'a price is written in texts.js; prices come from js/offer.js');
  for (const bad of [/لأول 100/, /19 ?000/, /first 100/i, /premiers? 100/i, /RIP|IBAN|\b\d{8,}\b/]) {
    assert.ok(!bad.test(src), String(bad));
  }
});

test('devices for each choice', () => {
  const s = F.cleanState(null);
  assert.equal(F.devices(s), null);
  assert.deepEqual(F.devices({ ...s, mode: 'pc' }), { pcs: 1, phones: 0 });
  assert.deepEqual(F.devices({ ...s, mode: 'both' }), { pcs: 1, phones: 1 });
  assert.deepEqual(F.devices({ ...s, mode: 'phone' }), { pcs: 0, phones: 1 });
  assert.deepEqual(F.devices({ ...s, mode: 'two' }), { pcs: 2, phones: 1 });
});

test('every device choice gets one of the three offers', () => {
  const s = F.cleanState(null);
  const offerOf = (mode) => { const d = F.devices({ ...s, mode }); return OFFER.recommend(d.pcs, d.phones).type; };
  assert.equal(offerOf('phone'), 'phone');
  assert.equal(offerOf('pc'), 'pc');
  assert.equal(offerOf('both'), 'pc');
  assert.equal(offerOf('two'), 'shop');
});

test('lessons: PC start first, linking lesson when devices share, at most 6', () => {
  const s = F.cleanState(null);
  assert.deepEqual(F.lessonsFor({ ...s, activity: 'grocery', mode: 'phone' }), [1, 7, 16, 17, 11]);
  assert.deepEqual(F.lessonsFor({ ...s, activity: 'grocery', mode: 'pc' }).slice(0, 2), [0, 1]);
  const linked = F.lessonsFor({ ...s, activity: 'grocery', mode: 'both' });
  assert.ok(linked.includes(14));
  assert.ok(linked.length <= 6);
  assert.equal(linked[0], 0);
  assert.ok(F.lessonsFor({ ...s, activity: 'grocery', mode: 'two' }).includes(14));
  assert.ok(!F.lessonsFor({ ...s, activity: 'grocery', mode: 'pc' }).includes(14));
  for (const a of F.ACTIVITIES) {
    for (const mode of ['pc', 'phone', 'both', 'two']) {
      const l = F.lessonsFor({ ...s, activity: a.id, mode });
      assert.ok(l.length >= 3 && l.length <= 6, a.id + mode);
      assert.equal(new Set(l).size, l.length);
    }
  }
});

test('saved answers are checked before use', () => {
  const s = F.cleanState({ v: 1, intent: 'hack', activity: 'nope', mode: 'x', pcs: 99, phones: -2, shared: 'yes', other: '<script>alert(1)</script>' + 'x'.repeat(100), watched: ['abc', 'l487p3PcKrs', '"><img>'] });
  assert.equal(s.intent, null);
  assert.equal(s.activity, null);
  assert.equal(s.mode, null);
  assert.equal(s.pcs, undefined, 'device counts are gone with the add-ons');
  assert.equal(F.cleanState({ v: 1, mode: 'several', pcs: 3, phones: 2, shared: true }).mode, null, 'old "several" answer: ask the devices again');
  assert.equal(F.cleanState({ v: 1, mode: 'both' }).mode, 'both', 'old PC + phone answer still loads');
  assert.ok(!/[<>]/.test(s.other));
  assert.ok(s.other.length <= 60);
  assert.deepEqual(s.watched, ['l487p3PcKrs']);
  assert.deepEqual(F.cleanState({ v: 1, pains: ['credit', 'credit', 'nope', 5, 'cash'] }).pains, ['credit', 'cash']);
  assert.deepEqual(F.cleanState({ v: 1, pains: 'credit' }).pains, []);
  assert.deepEqual(F.cleanState({ v: 1, intent: 'trial', activity: 'grocery', mode: 'pc' }).pains, [], 'answers saved before this change still load');
  assert.deepEqual(F.cleanState({ v: 2, intent: 'trial' }).intent, null, 'unknown version is ignored');
  assert.equal(F.cleanState('{}').intent, null);
});

test('steps cannot be skipped: missing answers send back to the right step', () => {
  const s = F.cleanState(null);
  assert.equal(F.allowedStep(s, 'price', OFFER), 'activity');
  assert.equal(F.allowedStep(s, 'prices', OFFER), 'prices');
  assert.equal(F.allowedStep(s, 'nope', OFFER), 'welcome');
  assert.equal(F.allowedStep(s, 'pain', OFFER), 'activity');
  const a = { ...s, activity: 'grocery' };
  assert.equal(F.allowedStep(a, 'pain', OFFER), 'pain');
  assert.equal(F.allowedStep(a, 'order', OFFER), 'devices', 'the pain step can be skipped');
  assert.equal(F.allowedStep({ ...a, mode: 'both' }, 'order', OFFER), 'order');
  assert.equal(F.allowedStep({ ...a, mode: 'two' }, 'price', OFFER), 'price');
  assert.equal(F.allowedStep({ ...a, mode: 'pc' }, 'several', OFFER), 'welcome', 'the old "several" screen is gone');
});

test('back goes one step back', () => {
  const s = { ...F.cleanState(null), activity: 'grocery', mode: 'two' };
  assert.equal(F.previousStep(s, 'features'), 'devices');
  assert.equal(F.previousStep(s, 'order'), 'price', 'buying goes price -> order');
  assert.equal(F.previousStep(s, 'trial'), 'course');
  assert.equal(F.previousStep(s, 'activity'), 'welcome');
  assert.equal(F.previousStep(s, 'pain'), 'activity');
  assert.equal(F.previousStep(s, 'devices'), 'pain');
});

test('"I want to buy": shop type, devices (3 choices), order', () => {
  const buy = { ...F.cleanState(null), intent: 'buy', activity: 'grocery', mode: 'both' };
  assert.deepEqual(F.progressFor(buy), ['welcome', 'activity', 'devices', 'final']);
  assert.equal(F.progressIndex('devices', buy), 2);
  assert.equal(F.progressIndex('order', buy), 3);
  assert.equal(F.progressIndex('pain', buy), -1, 'no problems screen when buying');
  assert.equal(F.previousStep(buy, 'order'), 'devices');
  assert.equal(F.previousStep(buy, 'devices'), 'activity');
  assert.deepEqual(F.BUY_MODES, ['pc', 'both', 'phone']);
  // Trying keeps the long path.
  const trial = { ...buy, intent: 'trial' };
  assert.equal(F.progressFor(trial).length, 8);
  assert.equal(F.previousStep(trial, 'devices'), 'pain');
  assert.equal(F.progressIndex('features', trial), 4);
});

test('texts: the pay-at-delivery order words exist in every language', () => {
  const T = loadTexts();
  for (const lang of ['ar', 'fr', 'en']) {
    for (const k of ['whyBoth', 'whyPc', 'oSubCod', 'codBtn', 'codSending', 'codFail', 'codFailWa', 'codDoneT', 'codDoneD', 'codDoneTry']) {
      assert.ok(T[lang][k], lang + ' ' + k);
    }
    assert.equal(T[lang].nextStepsCod.length, 4, lang);
    assert.ok(T[lang].codDoneD.includes('{phone}'), lang);
  }
});

test('coloured icons: every feature and answer has one, and every icon is drawn in the page', () => {
  const page = fs.readFileSync(path.join(__dirname, '../start/index.html'), 'utf8');
  const color = /^#[0-9A-F]{6}$/i;
  for (const f of Object.keys(F.FEATURE_IMG)) {
    const [icon, c] = F.FEATURE_ICON[f] || [];
    assert.ok(icon && page.includes(`<symbol id="${icon}"`), f + ' icon ' + icon);
    assert.match(c, color, f);
  }
  for (const p of F.PAINS) {
    assert.ok(page.includes(`<symbol id="${p.icon}"`), p.id);
    assert.match(p.color, color, p.id);
  }
  for (const a of F.ACTIVITIES) {
    assert.ok(page.includes(`<symbol id="${a.icon}"`), a.id);
    assert.match(a.color, color, a.id);
  }
});

test('nothing in the page is pushed far sideways (an RTL page then grows wide and phones zoom out)', () => {
  const page = fs.readFileSync(path.join(__dirname, '../start/index.html'), 'utf8');
  assert.ok(!/(left|right|inset-inline-start|inset-inline-end)\s*:\s*-\d{3,}px/.test(page), 'a big negative left/right offset');
});
