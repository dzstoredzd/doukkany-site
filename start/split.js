/* Doukkany /start/: send a share of the visitors straight to /download/ (owner, 2026-11-28:
 * "redirect 50% of users that go to /start to /download page"). Loaded in the <head> of
 * start/index.html, before anything is drawn, so the visitor never sees /start/ flash.
 * Used by tests/split.test.js (node) too.
 *
 * Rules:
 * - The pick is kept on this device (localStorage 'dk-start-split': 'start' or 'download'),
 *   so the same visitor always lands on the same page. No storage = a new pick each visit.
 * - Never moved: a visitor who already has answers saved on /start/, a link that forces a
 *   funnel version (?fv=), a "buy" link (?intent=buy: the pay-at-delivery order is only on
 *   /start/), and ?split=0 (for the owner's own checks; it also saves 'start').
 * - The page address words (utm_*, fbclid, lang...) go along, so ads attribution and the
 *   language stay the same. 'ab=start_split' is added so GA4 and Meta can tell these visits.
 * - SHARE = 0 turns it off for new visitors (a device that already got 'download' keeps it).
 */
(function (root) {
  'use strict';

  var SHARE = 0.5;
  var KEY = 'dk-start-split';
  var ANSWERS_KEY = 'dk-start-v1'; // start/app.js STORE_KEY
  var MARK = 'start_split';

  // Pure rule. Returns 'start' or 'download'.
  // in: { search, saved, hasAnswers, random, share }
  function decide(o) {
    var q;
    try { q = new URLSearchParams(o.search || ''); } catch (e) { return 'start'; }
    if (q.get('split') === '0') return 'start';
    if (q.get('fv') || q.get('intent') === 'buy') return 'start';
    if (o.saved === 'start' || o.saved === 'download') return o.saved;
    if (o.hasAnswers) return 'start';
    var share = typeof o.share === 'number' ? o.share : SHARE;
    var r = typeof o.random === 'number' ? o.random : Math.random();
    return share > 0 && r < share ? 'download' : 'start';
  }

  // The /download/ address with this page's words plus the mark.
  function target(href) {
    var u = new URL('../download/', href);
    var q = new URLSearchParams(new URL(href).search);
    q.delete('split');
    q.set('ab', MARK);
    u.search = q.toString();
    u.hash = '';
    return u.href;
  }

  function run(win) {
    var store = null;
    try { store = win.localStorage; } catch (e) {}
    var saved = null;
    var hasAnswers = false;
    try { saved = store ? store.getItem(KEY) : null; } catch (e) {}
    try { hasAnswers = !!(store && store.getItem(ANSWERS_KEY)); } catch (e) {}
    var pick = decide({ search: win.location.search, saved: saved, hasAnswers: hasAnswers });
    // A forced link (?fv=, ?intent=buy) does not decide for later visits. Everything else is
    // kept (saved answers and ?split=0 keep 'start' on this device).
    var q = new URLSearchParams(win.location.search);
    var forced = q.get('fv') || q.get('intent') === 'buy';
    if (!forced && saved !== pick) {
      try { if (store) store.setItem(KEY, pick); } catch (e) {}
    }
    if (pick === 'download') win.location.replace(target(win.location.href));
    return pick;
  }

  var SPLIT = { decide: decide, target: target, run: run, SHARE: SHARE, KEY: KEY, MARK: MARK };
  if (typeof module === 'object' && module.exports) module.exports = SPLIT;
  else { try { run(root); } catch (e) {} }
})(this);
