// Run: node --test tests/*.test.js
// Checks the website's prices and "which offer fits" rules (js/offer.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const OFFER = require('../js/offer.js');

function summary(r) {
  return r.ok ? r.type + '=' + r.total : 'no:' + r.reason;
}

test('three offers only, the owner offer of 2026-11-26', () => {
  const p = OFFER.plans;
  assert.deepEqual(Object.keys(p).sort(), ['pc', 'phone', 'shop']);
  assert.deepEqual(OFFER.listOrder, ['phone', 'pc', 'shop']);
  assert.equal(p.phone.price, 9000);
  assert.equal(p.pc.price, 12000);
  assert.equal(p.shop.price, 14000);
  assert.equal(OFFER.trialDays, 14);
  assert.equal(OFFER.currency, 'DZD');
});

test('what each offer covers: the phone is free with a PC offer', () => {
  const p = OFFER.plans;
  assert.deepEqual([p.phone.pcs, p.phone.phones], [0, 1]);
  assert.deepEqual([p.pc.pcs, p.pc.phones], [1, 1]);
  assert.deepEqual([p.shop.pcs, p.shop.phones], [2, 1]);
});

test('the offer for each device choice', () => {
  assert.equal(summary(OFFER.recommend(0, 1)), 'phone=9000');
  assert.equal(summary(OFFER.recommend(1, 0)), 'pc=12000');
  assert.equal(summary(OFFER.recommend(1, 1)), 'pc=12000', 'PC + phone costs the same as PC: the phone is free');
  assert.equal(summary(OFFER.recommend(2, 0)), 'shop=14000');
  assert.equal(summary(OFFER.recommend(2, 1)), 'shop=14000');
  assert.deepEqual(OFFER.recommend(1, 1).includes, { pcs: 1, phones: 1 });
  assert.deepEqual(OFFER.recommend(2, 1).includes, { pcs: 2, phones: 1 });
});

test('more than the shop pack, or phones without a PC: talk to us, never priced', () => {
  assert.equal(summary(OFFER.recommend(3, 1)), 'no:custom');
  assert.equal(summary(OFFER.recommend(1, 2)), 'no:custom');
  assert.equal(summary(OFFER.recommend(2, 2)), 'no:custom');
  assert.equal(summary(OFFER.recommend(0, 2)), 'no:custom');
  assert.equal(summary(OFFER.recommend(0, 0)), 'no:none');
  assert.equal(summary(OFFER.recommend(-3, 'x')), 'no:none');
});

test('an offer always covers the devices asked for', () => {
  for (let pcs = 0; pcs <= 4; pcs++) {
    for (let phones = 0; phones <= 4; phones++) {
      const r = OFFER.recommend(pcs, phones);
      if (!r.ok) continue;
      assert.ok(r.includes.pcs >= pcs && r.includes.phones >= phones, `${pcs}/${phones}`);
      assert.equal(r.total, OFFER.plans[r.type].price);
    }
  }
});

test('buying a PC offer: 1 000 DA off when paid first by BaridiMob / CCP, normal price at delivery', () => {
  assert.equal(OFFER.prepaidDiscount, 1000);
  assert.equal(OFFER.orderTotal('pc', 'prepaid'), 11000);
  assert.equal(OFFER.orderTotal('pc', 'cod'), 12000);
  assert.equal(OFFER.orderTotal('shop', 'prepaid'), 13000);
  assert.equal(OFFER.orderTotal('shop', 'cod'), 14000);
  assert.equal(OFFER.orderTotal('shop', ''), 14000, 'no payment chosen yet: normal price');
  assert.equal(OFFER.orderTotal('phone', 'prepaid'), 9000, 'the phone offer has no USB key and no discount');
  assert.equal(OFFER.orderTotal('nope', 'cod'), 0);
});

test('format writes thousands with a no-break space', () => {
  assert.equal(OFFER.format(14000), '14 000');
  assert.equal(OFFER.format(9000), '9 000');
  assert.equal(OFFER.format(500), '500');
  assert.equal(OFFER.format(123456), '123 456');
});
