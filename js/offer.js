/* Doukkany offers and prices: the ONLY place the website keeps them.
 *
 * Source: the owner's offer of 2026-11-23 (doukkany/DOUKKANY-MARKETING/MARKETING_PLAN.md,
 * "Prices") and the licence code kinds on the licence server (doukkany_backend, DECISIONS
 * 2026-11-21 "Licence plans" and 2026-11-23 "Licence plan pc"). All prices are in Algerian
 * dinars (DZD), paid once, for life. No subscription, no yearly renewal.
 *
 * If a price changes, change it here only: every page reads this file.
 */
(function (root) {
  'use strict';

  // Price in dinars. `code` = the licence code kind made by the licence server.
  var PLANS = {
    phone:     { code: 'phone',     price: 9000,  pcs: 0, phones: 1 }, // one Android phone or tablet, alone
    pc:        { code: 'pc',        price: 12000, pcs: 1, phones: 0 }, // one Windows PC, alone
    shop:      { code: 'shop',      price: 14000, pcs: 2, phones: 1 }, // main PC + 2nd PC + 1 phone (the phone is a gift)
    add_pc:    { code: 'add_pc',    price: 7000,  pcs: 1, phones: 0 }, // one more PC linked to the main PC
    add_phone: { code: 'add_phone', price: 5000,  pcs: 0, phones: 1 }  // one more phone linked to the main PC
  };

  var OFFER = {
    currency: 'DZD',
    trialDays: 14,
    // During the trial a main PC can link 1 more PC and 1 phone (licence server "trial room").
    trialLinks: { pcs: 1, phones: 1 },
    maxDevices: 10, // more than this per kind: we talk with the shop first
    plans: PLANS,
    // Order shown on the "all prices" list.
    listOrder: ['phone', 'pc', 'shop', 'add_pc', 'add_phone'],

    /* The cheapest offer that really works for a set of devices.
     *   pcs, phones: how many Windows PCs and Android phones/tablets the shop wants.
     *   shared: true = all devices work on the same products, sales and credit
     *           (one Windows PC is the main PC; the others link to it on the shop network).
     * Returns { ok, type, lines: [{ plan, qty, price, total }], total, includes: { pcs, phones } }
     * or { ok: false, reason } where reason is:
     *   'none'      no device chosen,
     *   'too_many'  more than maxDevices of one kind,
     *   'needs_pc'  several phones that must share data but no PC (a phone cannot be the main device).
     */
    recommend: function (pcs, phones, shared) {
      pcs = Math.max(0, Math.floor(+pcs || 0));
      phones = Math.max(0, Math.floor(+phones || 0));
      if (pcs + phones === 0) return { ok: false, reason: 'none' };
      if (pcs > OFFER.maxDevices || phones > OFFER.maxDevices) return { ok: false, reason: 'too_many' };

      var lines = [];
      function add(id, qty) {
        if (qty > 0) lines.push({ plan: id, qty: qty, price: PLANS[id].price, total: PLANS[id].price * qty });
      }

      var type;
      if (pcs + phones === 1) {
        type = pcs ? 'pc' : 'phone';
        add(type, 1);
      } else if (!shared) {
        // Each device works alone, with its own data: one licence per device.
        type = 'separate';
        add('pc', pcs);
        add('phone', phones);
      } else if (pcs === 0) {
        return { ok: false, reason: 'needs_pc' };
      } else {
        // Shared data: the shop pack is always the cheapest start (1 PC + 1 phone alone would
        // be 12 000 + 5 000 = 17 000), then one add-on per extra device.
        type = 'shop';
        add('shop', 1);
        add('add_pc', Math.max(0, pcs - PLANS.shop.pcs));
        add('add_phone', Math.max(0, phones - PLANS.shop.phones));
      }

      var total = 0, inc = { pcs: 0, phones: 0 };
      lines.forEach(function (l) {
        total += l.total;
        inc.pcs += PLANS[l.plan].pcs * l.qty;
        inc.phones += PLANS[l.plan].phones * l.qty;
      });
      return { ok: true, type: type, lines: lines, total: total, includes: inc };
    },

    // 14000 -> "14 000" (a plain space between thousands, the way the ads and the app write it).
    format: function (n) {
      return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
  };

  if (typeof module === 'object' && module.exports) module.exports = OFFER;
  else root.DK_OFFER = OFFER;
})(this);
