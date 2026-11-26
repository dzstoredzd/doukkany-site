// Run: node --test tests/
// Checks the website's prices and "which offer fits" rules (js/offer.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const OFFER = require('../js/offer.js');

function summary(r) {
  return r.ok ? r.lines.map((l) => l.qty + 'x' + l.plan).join('+') + '=' + r.total : 'no:' + r.reason;
}

test('prices are the owner offer of 2026-11-23', () => {
  const p = OFFER.plans;
  assert.equal(p.phone.price, 9000);
  assert.equal(p.pc.price, 12000);
  assert.equal(p.shop.price, 14000);
  assert.equal(p.add_pc.price, 7000);
  assert.equal(p.add_phone.price, 5000);
  assert.equal(OFFER.trialDays, 14);
  assert.equal(OFFER.currency, 'DZD');
});

test('one device alone', () => {
  assert.equal(summary(OFFER.recommend(1, 0, true)), '1xpc=12000');
  assert.equal(summary(OFFER.recommend(0, 1, true)), '1xphone=9000');
  assert.equal(summary(OFFER.recommend(1, 0, false)), '1xpc=12000');
});

test('PC and phone sharing data: shop pack, never PC + extra phone', () => {
  const r = OFFER.recommend(1, 1, true);
  assert.equal(summary(r), '1xshop=14000');
  assert.deepEqual(r.includes, { pcs: 2, phones: 1 });
  assert.ok(r.total < OFFER.plans.pc.price + OFFER.plans.add_phone.price);
});

test('bigger shops: shop pack plus add-ons', () => {
  assert.equal(summary(OFFER.recommend(2, 0, true)), '1xshop=14000');
  assert.equal(summary(OFFER.recommend(2, 1, true)), '1xshop=14000');
  assert.equal(summary(OFFER.recommend(3, 1, true)), '1xshop+1xadd_pc=21000');
  assert.equal(summary(OFFER.recommend(2, 3, true)), '1xshop+2xadd_phone=24000');
  assert.equal(summary(OFFER.recommend(4, 4, true)), '1xshop+2xadd_pc+3xadd_phone=43000');
  assert.deepEqual(OFFER.recommend(4, 4, true).includes, { pcs: 4, phones: 4 });
});

test('devices that do not share data: one licence each', () => {
  assert.equal(summary(OFFER.recommend(0, 2, false)), '2xphone=18000');
  assert.equal(summary(OFFER.recommend(2, 1, false)), '2xpc+1xphone=33000');
});

test('unsupported or empty choices are refused, never priced', () => {
  assert.equal(summary(OFFER.recommend(0, 2, true)), 'no:needs_pc');
  assert.equal(summary(OFFER.recommend(0, 0, true)), 'no:none');
  assert.equal(summary(OFFER.recommend(11, 0, true)), 'no:too_many');
  assert.equal(summary(OFFER.recommend(1, 11, true)), 'no:too_many');
  assert.equal(summary(OFFER.recommend(-3, 'x', true)), 'no:none');
});

test('the total is always the sum of its lines', () => {
  for (let pcs = 0; pcs <= 10; pcs++) {
    for (let phones = 0; phones <= 10; phones++) {
      for (const shared of [true, false]) {
        const r = OFFER.recommend(pcs, phones, shared);
        if (!r.ok) continue;
        assert.equal(r.total, r.lines.reduce((s, l) => s + l.price * l.qty, 0));
        assert.ok(r.includes.pcs >= pcs && r.includes.phones >= phones, `${pcs}/${phones}/${shared}`);
      }
    }
  }
});

test('format writes thousands with a space', () => {
  assert.equal(OFFER.format(14000), '14 000');
  assert.equal(OFFER.format(9000), '9 000');
  assert.equal(OFFER.format(500), '500');
  assert.equal(OFFER.format(123456), '123 456');
});
