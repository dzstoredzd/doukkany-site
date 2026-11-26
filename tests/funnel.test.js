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

test('WhatsApp messages: Darija, every detail asked, no price written in them', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../start/texts.js'), 'utf8'), sandbox);
  const W = sandbox.window.DK_WA_DZ;
  for (const k of ['{offer}', '{total}', '{activityLine}', '{devices}']) assert.ok(W.phone.includes(k), 'phone ' + k);
  for (const k of ['{offer}', '{total}', '{delivery}', '{name}', '{phone}', '{wilaya}', '{commune}', '{activityLine}', '{windows}']) assert.ok(W.pc.includes(k), 'pc ' + k);
  for (const k of ['{offer}', '{total}', '{activityLine}', '{windows}']) assert.ok(W.pcCode.includes(k), 'pcCode ' + k);
  assert.ok(!JSON.stringify(W).includes('{discount}'), 'no discount any more (owner 2026-11-27)');
  // Paying first happens in WhatsApp: the chat already shows the number, so no name, phone or
  // address goes into that link (owner brief section 19: no personal data in URLs when not needed).
  for (const k of ['{name}', '{phone}', '{wilaya}', '{commune}']) {
    assert.ok(!W.pcCode.includes(k) && !W.phone.includes(k), 'no ' + k + ' in a pay-first message');
  }
  assert.ok(W.installHelp.includes('{platform}') && W.afterOrder.includes('{ref}'));
  assert.deepEqual(Object.keys(W.win).sort(), ['no', 'unknown', 'yes']);
  assert.ok(/[؀-ۿ]/.test(W.pc) && /[؀-ۿ]/.test(W.phone), 'Arabic script');
  assert.ok(!/\d[\d\s ]*000/.test(JSON.stringify(W)), 'no price written');
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

test('v2 steps: questions can be skipped, the end screens only need the devices', () => {
  const s = F.cleanState(null);
  assert.equal(s.fv, 'v2');
  assert.equal(F.allowedStep(s, 'prices'), 'prices');
  assert.equal(F.allowedStep(s, 'download'), 'download', 'direct download: no questions');
  assert.equal(F.allowedStep(s, 'nope'), 'welcome');
  assert.equal(F.allowedStep(s, 'pain'), 'pain', 'the shop type can be skipped');
  assert.equal(F.allowedStep(s, 'ready'), 'devices');
  assert.equal(F.allowedStep(s, 'order'), 'devices');
  assert.equal(F.allowedStep({ ...s, mode: 'phone' }, 'ready'), 'ready');
  assert.equal(F.allowedStep({ ...s, mode: 'pc' }, 'order'), 'order', 'buying without a shop type');
  // The old long-path screens are not part of v2: they send to the end screen.
  assert.equal(F.allowedStep({ ...s, mode: 'pc' }, 'features'), 'ready');
  assert.equal(F.allowedStep(s, 'course'), 'devices');
  assert.equal(F.allowedStep({ ...s, mode: 'pc' }, 'several'), 'welcome', 'the old "several" screen is gone');
});

test('v1 (kept for comparison, ?fv=v1): the long path, every answer needed', () => {
  const s = { ...F.cleanState(null), fv: 'v1' };
  assert.equal(F.allowedStep(s, 'price'), 'activity');
  assert.equal(F.allowedStep(s, 'pain'), 'activity');
  const a = { ...s, activity: 'grocery' };
  assert.equal(F.allowedStep(a, 'order'), 'devices');
  assert.equal(F.allowedStep({ ...a, mode: 'two' }, 'price'), 'price');
  assert.equal(F.allowedStep({ ...a, mode: 'pc' }, 'ready'), 'trial', 'v1 ends on its own download screen');
  assert.equal(F.progressFor(a).length, 8);
  assert.equal(F.progressIndex('features', a), 4);
  assert.equal(F.trialEnd(a), 'trial');
  assert.equal(F.previousStep({ ...a, mode: 'pc' }, 'order'), 'price');
});

test('back goes one step back', () => {
  const s = { ...F.cleanState(null), activity: 'grocery', mode: 'both' };
  assert.equal(F.previousStep(s, 'activity'), 'welcome');
  assert.equal(F.previousStep(s, 'pain'), 'activity');
  assert.equal(F.previousStep(s, 'devices'), 'pain');
  assert.equal(F.previousStep(s, 'ready'), 'devices');
  assert.equal(F.previousStep(s, 'order'), 'ready', 'trying, then "buy now" on the ready screen');
  assert.equal(F.previousStep(s, 'download'), 'welcome');
  assert.equal(F.previousStep({ ...s, intent: 'buy' }, 'order'), 'devices');
});

test('trial path v2 = 5 places in the bar; buying = 4', () => {
  const trial = { ...F.cleanState(null), intent: 'trial', activity: 'grocery', mode: 'both' };
  assert.deepEqual(F.progressFor(trial), ['welcome', 'activity', 'pain', 'devices', 'final']);
  assert.equal(F.progressIndex('ready', trial), 4);
  assert.equal(F.progressIndex('features', trial), -1);
  assert.equal(F.trialEnd(trial), 'ready');
  const buy = { ...trial, intent: 'buy' };
  assert.deepEqual(F.progressFor(buy), ['welcome', 'activity', 'devices', 'final']);
  assert.equal(F.progressIndex('order', buy), 3);
  assert.equal(F.progressIndex('pain', buy), -1, 'no problems screen when buying');
  assert.equal(F.previousStep(buy, 'devices'), 'activity');
  assert.deepEqual(F.BUY_MODES, ['pc', 'both', 'phone']);
});

test('skipping the questions picks the device the visitor is on', () => {
  assert.equal(F.defaultMode('android'), 'phone');
  assert.equal(F.defaultMode('windows'), 'pc');
  assert.equal(F.defaultMode('ios'), 'pc', 'no iPhone app: the PC one');
  assert.equal(F.defaultMode('other'), 'pc');
});

test('ad links: only known values are taken', () => {
  assert.deepEqual(F.linkAnswers('?activity=grocery&intent=trial&device=android&fv=v1&utm_source=facebook'),
    { activity: 'grocery', intent: 'trial', mode: 'phone', fv: 'v1' });
  assert.deepEqual(F.linkAnswers('?device=windows'), { mode: 'pc' });
  assert.deepEqual(F.linkAnswers('?device=both'), { mode: 'both' });
  assert.deepEqual(F.linkAnswers('?activity=<script>&intent=hack&device=two&fv=v9'), {}, 'the shop pack is chosen on the prices list only');
  assert.deepEqual(F.linkAnswers(''), {});
});

test('version pick: forced by the link, then the saved one, else the default (no split running)', () => {
  assert.equal(F.EXPERIMENT.split, 0, 'no A/B test runs until the owner picks one');
  assert.equal(F.pickVersion(null, null, 0), 'v2');
  assert.equal(F.pickVersion('v1', null, 0.9), 'v1', 'the same visitor keeps the same version');
  assert.equal(F.pickVersion('v1', 'v2', 0.9), 'v2');
  assert.equal(F.pickVersion('junk', null, 0.1), 'v2');
});

test('saved answers: kept with the version, the last screen and the date; old ones expire', () => {
  const now = Date.UTC(2026, 10, 27);
  const s = F.cleanState({ v: 1, fv: 'v1', intent: 'buy', activity: 'grocery', mode: 'pc', last: 'order', at: now - 864e5 }, now);
  assert.equal(s.fv, 'v1'); assert.equal(s.last, 'order'); assert.equal(s.mode, 'pc');
  assert.equal(F.cleanState({ v: 1, last: 'evil' }, now).last, null);
  const old = F.cleanState({ v: 1, intent: 'trial', activity: 'grocery', at: now - 200 * 864e5 }, now);
  assert.equal(old.activity, null, 'answers older than 120 days are dropped');
  assert.equal(F.cleanState({ v: 1, intent: 'trial', activity: 'grocery' }, now).fv, 'v2', 'answers saved before v2 load into v2');
});

test('checkout check: the first problem first; pay-first needs no name or address', () => {
  const ok = { win: 'yes', pay: 'cod', name: 'Ali Ben', phone: '0555 12 34 56', wilaya: '16 - Alger', commune: 'Bab El Oued' };
  assert.deepEqual(F.checkoutProblems(ok, 'pc'), []);
  assert.deepEqual(F.checkoutProblems({ ...ok, win: 'unknown' }, 'pc'), [], 'not knowing is not "incompatible"');
  assert.deepEqual(F.checkoutProblems({ ...ok, win: 'no' }, 'pc')[0], ['win', 'bad']);
  assert.deepEqual(F.checkoutProblems({ ...ok, win: '' }, 'pc')[0], ['win', 'missing']);
  assert.deepEqual(F.checkoutProblems({ ...ok, phone: '0212345678' }, 'pc'), [['phone', 'bad']]);
  assert.deepEqual(F.checkoutProblems({ ...ok, phone: '' }, 'pc'), [['phone', 'missing']]);
  assert.deepEqual(F.checkoutProblems({ ...ok, name: 'A', commune: '' }, 'pc').map((x) => x[0]), ['name', 'commune']);
  assert.deepEqual(F.checkoutProblems({ win: 'yes', pay: 'prepaid' }, 'pc'), [], 'pay first: WhatsApp gives the number');
  assert.deepEqual(F.checkoutProblems({}, 'phone'), [], 'the phone offer is ordered in WhatsApp');
  assert.ok(F.phoneOk('+213 661 23 45 67') && F.phoneOk('00213771234567') && !F.phoneOk('0812345678'));
});

test('order reference: DK- + the first 8 characters of the request id', () => {
  assert.equal(F.orderRef('3f2a9c1e-1111-4222-8333-444455556666'), 'DK-3F2A9C1E');
  assert.equal(F.orderRef(''), '');
  assert.equal(F.orderRef('nope'), '');
});

test('loss calculator: the visitor\'s own numbers only', () => {
  assert.deepEqual(F.losses(300, 26, 12000), { month: 7800, year: 93600, daysToPrice: 40 });
  assert.equal(F.losses('', 26, 12000), null);
  assert.equal(F.losses(-5, 26, 12000), null);
  assert.equal(F.losses(300, 40, 12000), null, 'at most 31 days a month');
});

test('videos: one fitting demo before the download, more without repeats, tutorials after', () => {
  const s = { ...F.cleanState(null), activity: 'grocery', mode: 'pc' };
  assert.equal(F.demoFor(s), 17, 'grocery: stock and expiry alerts');
  assert.equal(F.demoFor({ ...s, pains: ['credit'] }), 11, 'the first problem picked wins');
  const more = F.moreDemosFor(s, 3);
  assert.ok(more.length <= 3 && !more.includes(17) && new Set(more).size === more.length);
  assert.deepEqual(F.tutorialsFor(s), [0, 1, 4]);
  assert.ok(F.tutorialsFor({ ...s, mode: 'both' }).includes(14), 'the linking lesson when a phone is linked');
  for (const v of Object.values(F.FEATURE_DEMO)) if (v != null) assert.ok(LESSONS.videos[v], 'lesson ' + v);
  for (const a of F.ACTIVITIES) assert.ok(LESSONS.videos[F.demoFor({ ...s, activity: a.id })], a.id);
});

test('FAQ: every question has words in every language, every journey lists each once', () => {
  const T = loadTexts();
  for (const lang of ['ar', 'fr', 'en']) {
    assert.deepEqual(Object.keys(T[lang].faq).sort(), [...F.FAQ_IDS].sort(), lang);
    for (const id of F.FAQ_IDS) assert.equal(T[lang].faq[id].length, 2, lang + ' ' + id);
  }
  for (const j of ['trial', 'buy', 'prices', 'download']) {
    assert.deepEqual([...F.faqFor(j)].sort(), [...F.FAQ_IDS].sort(), j);
  }
  // Prices in the FAQ come from js/offer.js.
  assert.ok(T.ar.faq.price[1].includes('{phone}') && T.ar.faq.price[1].includes('{pc}') && T.ar.faq.price[1].includes('{shop}'));
});

test('claims stay true: no remote access, cloud sync or reviews promised', () => {
  const T = loadTexts();
  const all = JSON.stringify(T);
  // Remote access and sync are only ever said to be NOT available.
  assert.ok(T.ar.faq.remote[1].startsWith('حاليا لا'));
  assert.ok(T.en.faq.remote[1].startsWith('Not yet'));
  // Free updates for life: the owner's policy (2026-11-27), so it may be said.
  assert.ok(T.ar.faq.updates && T.ar.trustUpdates);
  for (const bad of [/\b\d+\s*(shops|magasins|clients satisfaits|happy customers)\b/i, /★/, /\b(guarantee[ds]?|garanti[es]?)\b(?! pas)/i]) {
    assert.ok(!bad.test(all), String(bad));
  }
  assert.deepEqual(F.TESTIMONIALS, [], 'no testimonials until real ones exist');
});

test('pains: each shows a plain sentence of what Doukkany does, in every language', () => {
  const T = loadTexts();
  for (const lang of ['ar', 'fr', 'en']) {
    assert.deepEqual(Object.keys(T[lang].painFix).sort(), F.PAINS.map((p) => p.id).sort(), lang);
    for (const a of F.ACTIVITIES) assert.ok(T[lang].pitch[a.id], lang + ' pitch ' + a.id);
  }
  // A shop type's own problems come first (grocery: expiry before credit).
  const g = F.painsFor('grocery').map((p) => p.id);
  assert.ok(g.indexOf('expiry') < g.indexOf('credit'));
});

test('texts: the checkout words exist in every language', () => {
  const T = loadTexts();
  for (const lang of ['ar', 'fr', 'en']) {
    for (const k of ['whyBoth', 'whyPc', 'whyPhone', 'whyShop', 'oSubCod', 'codBtnTotal', 'codSending', 'codFail', 'codFailWa', 'codDoneT', 'codDoneD', 'codDoneTry', 'refLabel', 'deliveryTag', 'kLicence', 'kDelivery', 'errWin', 'errPhoneBad', 'winHow', 'winUnknownOk']) {
      assert.ok(T[lang][k], lang + ' ' + k);
    }
    assert.equal(T[lang].nextStepsCod.length, 4, lang);
    assert.equal(T[lang].nextStepsPhone.length, T.ar.nextStepsPhone.length, lang);
    assert.ok(T[lang].codDoneD.includes('{phone}'), lang);
    assert.ok(T[lang].codBtnTotal.includes('{total}') && T[lang].sendWaTotal.includes('{total}'), lang);
    assert.deepEqual(Object.keys(T[lang].fieldName).sort(), ['commune', 'name', 'pay', 'phone', 'wilaya', 'win']);
    assert.deepEqual(Object.keys(T[lang].devName).sort(), ['both', 'pc', 'phone', 'two']);
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

test('link preview: a 1200x630 JPG that exists (WhatsApp shows WebP badly)', () => {
  const page = fs.readFileSync(path.join(__dirname, '../start/index.html'), 'utf8');
  const m = page.match(/<meta property="og:image" content="https:\/\/yousoft\.site\/doukkany-site\/([^"]+)">/);
  assert.ok(m, 'og:image on the live site');
  assert.ok(/\.jpe?g$/.test(m[1]), 'a JPG');
  const file = path.join(__dirname, '..', m[1]);
  assert.ok(fs.existsSync(file), m[1] + ' exists');
  assert.ok(fs.statSync(file).size < 300 * 1024, 'under 300 KB');
  assert.ok(page.includes('<meta property="og:image:width" content="1200">') && page.includes('<meta property="og:image:height" content="630">'));
});
