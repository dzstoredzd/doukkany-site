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
  assert.deepEqual(F.devices({ ...s, mode: 'pc' }), { pcs: 1, phones: 0, shared: true });
  assert.deepEqual(F.devices({ ...s, mode: 'phone' }), { pcs: 0, phones: 1, shared: true });
  assert.deepEqual(F.devices({ ...s, mode: 'both' }), { pcs: 1, phones: 1, shared: true });
  assert.deepEqual(F.devices({ ...s, mode: 'several', pcs: 3, phones: 2, shared: false }), { pcs: 3, phones: 2, shared: false });
});

test('lessons: PC start first, linking lesson when devices share, at most 6', () => {
  const s = F.cleanState(null);
  assert.deepEqual(F.lessonsFor({ ...s, activity: 'grocery', mode: 'phone' }), [1, 7, 16, 17, 11]);
  assert.deepEqual(F.lessonsFor({ ...s, activity: 'grocery', mode: 'pc' }).slice(0, 2), [0, 1]);
  const linked = F.lessonsFor({ ...s, activity: 'grocery', mode: 'both' });
  assert.ok(linked.includes(14));
  assert.ok(linked.length <= 6);
  assert.equal(linked[0], 0);
  assert.ok(!F.lessonsFor({ ...s, activity: 'grocery', mode: 'several', pcs: 2, phones: 0, shared: false }).includes(14));
  for (const a of F.ACTIVITIES) {
    for (const mode of ['pc', 'phone', 'both']) {
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
  assert.equal(s.pcs, 10);
  assert.equal(s.phones, 0);
  assert.equal(s.shared, true);
  assert.ok(!/[<>]/.test(s.other));
  assert.ok(s.other.length <= 60);
  assert.deepEqual(s.watched, ['l487p3PcKrs']);
  assert.deepEqual(F.cleanState({ v: 2, intent: 'trial' }).intent, null, 'unknown version is ignored');
  assert.equal(F.cleanState('{}').intent, null);
});

test('steps cannot be skipped: missing answers send back to the right step', () => {
  const s = F.cleanState(null);
  assert.equal(F.allowedStep(s, 'price', OFFER), 'activity');
  assert.equal(F.allowedStep(s, 'prices', OFFER), 'prices');
  assert.equal(F.allowedStep(s, 'nope', OFFER), 'welcome');
  const a = { ...s, activity: 'grocery' };
  assert.equal(F.allowedStep(a, 'order', OFFER), 'devices');
  assert.equal(F.allowedStep({ ...a, mode: 'both' }, 'order', OFFER), 'order');
  assert.equal(F.allowedStep({ ...a, mode: 'several', pcs: 0, phones: 3, shared: true }, 'price', OFFER), 'several');
  assert.equal(F.allowedStep({ ...a, mode: 'several', pcs: 0, phones: 3, shared: false }, 'price', OFFER), 'price');
});

test('back goes one step back', () => {
  const s = { ...F.cleanState(null), activity: 'grocery', mode: 'several' };
  assert.equal(F.previousStep(s, 'features'), 'several');
  assert.equal(F.previousStep({ ...s, mode: 'pc' }, 'features'), 'devices');
  assert.equal(F.previousStep(s, 'order'), 'course');
  assert.equal(F.previousStep(s, 'activity'), 'welcome');
});
