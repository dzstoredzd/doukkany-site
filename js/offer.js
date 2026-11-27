/* Doukkany offers and prices: the ONLY place the website keeps them.
 *
 * Owner, 2026-11-26 ("simplify pages: make offers clear ... remove additional offers"):
 * three offers only, all in Algerian dinars (DZD), paid once, for life. No subscription, no
 * yearly renewal, no extra PC / extra phone add-ons on the website any more.
 *   - Phone only:  one Android phone or tablet, alone.                       9 000
 *   - One PC:      one Windows PC + the phone app free, linked to it.         12 000
 *   - Shop pack:   main PC + 2nd PC + the phone app free, all linked.         14 000
 * More devices than that: the shop talks to us on WhatsApp.
 * PC offers paid at delivery: + 1 500 delivery of the USB key (owner, 2026-11-27). No discount.
 *
 * Licence server note: "One PC + free phone" uses the `pc_phone` code kind (main PC + 1 phone,
 * live since 2026-11-26, Doukkany DECISIONS 2026-11-26). The older `pc` kind gives 0 phones:
 * never give it for this offer.
 *
 * If a price changes, change it here only: every page reads this file.
 */
(function (root) {
  'use strict';

  // Price in dinars. `code` = the licence code kind made by the licence server.
  // pcs / phones = the devices the offer covers (the phone is free in `pc` and `shop`).
  var PLANS = {
    phone: { code: 'phone', price: 9000,  pcs: 0, phones: 1 }, // one Android phone or tablet, alone
    pc:    { code: 'pc_phone', price: 12000, pcs: 1, phones: 1 }, // one Windows PC + phone app free
    shop:  { code: 'shop',  price: 14000, pcs: 2, phones: 1 }  // main PC + 2nd PC + phone app free
  };

  var OFFER = {
    currency: 'DZD',
    trialDays: 14,
    // During the trial a main PC can link 1 more PC and 1 phone (licence server "trial room").
    trialLinks: { pcs: 1, phones: 1 },
    plans: PLANS,
    // Order shown on the "all prices" list.
    listOrder: ['phone', 'pc', 'shop'],
    // PC offers paid at delivery come on a Doukkany USB key sent home. Home delivery of the key
    // costs this much on top of the licence (owner, 2026-11-27: "التوصيل للمنزل مع الفلاشة
    // 1500 دج", "لا تستعمل التخفيض": no discount any more for paying first). Paying first by
    // BaridiMob / CCP = the code on WhatsApp, no key, no delivery: the licence price only.
    deliveryFee: 1500,
    usbPlans: ['pc', 'shop'],

    // What the shop pays for an offer: `pay` = 'prepaid' (BaridiMob / CCP first) or 'cod'
    // (at delivery, with the USB key and its delivery).
    orderTotal: function (type, pay) {
      var p = PLANS[type];
      if (!p) return 0;
      return p.price + OFFER.deliveryFor(type, pay);
    },
    // The delivery fee in an order (0 when nothing is sent home).
    deliveryFor: function (type, pay) {
      return pay === 'cod' && OFFER.usbPlans.indexOf(type) !== -1 ? OFFER.deliveryFee : 0;
    },

    /* The offer for the devices a shop wants (all on the same products and sales).
     *   pcs, phones: how many Windows PCs and Android phones/tablets.
     * Returns { ok, type, total, includes: { pcs, phones } }
     * or { ok: false, reason } where reason is:
     *   'none'    no device chosen,
     *   'custom'  more than the shop pack covers (or several phones without a PC): talk to us.
     */
    recommend: function (pcs, phones) {
      pcs = Math.max(0, Math.floor(+pcs || 0));
      phones = Math.max(0, Math.floor(+phones || 0));
      if (pcs + phones === 0) return { ok: false, reason: 'none' };
      var type = null;
      if (pcs === 0 && phones === 1) type = 'phone';
      else if (pcs === 1 && phones <= 1) type = 'pc';
      else if (pcs === 2 && phones <= 1) type = 'shop';
      if (!type) return { ok: false, reason: 'custom' };
      var p = PLANS[type];
      return { ok: true, type: type, total: p.price, includes: { pcs: p.pcs, phones: p.phones } };
    },

    // 14000 -> "14 000" (a no-break space between thousands, the way the ads and the app write it).
    format: function (n) {
      return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
  };

  if (typeof module === 'object' && module.exports) module.exports = OFFER;
  else root.DK_OFFER = OFFER;
})(this);
