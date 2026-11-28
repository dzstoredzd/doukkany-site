// Run: node --test tests/*.test.js
// Checks the /start/ → /download/ split (start/split.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../start/split.js');

test('half of new visitors go to /download/', () => {
  assert.equal(S.SHARE, 0.5);
  assert.equal(S.decide({ search: '', random: 0.1 }), 'download');
  assert.equal(S.decide({ search: '', random: 0.49 }), 'download');
  assert.equal(S.decide({ search: '', random: 0.5 }), 'start');
  assert.equal(S.decide({ search: '', random: 0.9 }), 'start');
});

test('the saved pick wins, so a visitor always lands on the same page', () => {
  assert.equal(S.decide({ search: '', saved: 'download', random: 0.9 }), 'download');
  assert.equal(S.decide({ search: '', saved: 'start', random: 0.1 }), 'start');
  assert.equal(S.decide({ search: '', saved: 'junk', random: 0.1 }), 'download');
});

test('never moved: saved answers, forced version, buy links, split=0, share 0', () => {
  assert.equal(S.decide({ search: '', hasAnswers: true, random: 0.1 }), 'start');
  assert.equal(S.decide({ search: '?fv=v1', random: 0.1 }), 'start');
  assert.equal(S.decide({ search: '?intent=buy', saved: 'download', random: 0.1 }), 'start');
  assert.equal(S.decide({ search: '?split=0', saved: 'download', random: 0.1 }), 'start');
  assert.equal(S.decide({ search: '', random: 0.1, share: 0 }), 'start');
  // A trial link is moved like any other visit.
  assert.equal(S.decide({ search: '?lang=ar&intent=trial', random: 0.1 }), 'download');
});

test('the /download/ address keeps the ad words and adds the mark', () => {
  const url = new URL(S.target('https://yousoft.site/doukkany-site/start/?utm_source=facebook&fbclid=Iw1&lang=fr#x'));
  assert.equal(url.pathname, '/doukkany-site/download/');
  assert.equal(url.searchParams.get('utm_source'), 'facebook');
  assert.equal(url.searchParams.get('fbclid'), 'Iw1');
  assert.equal(url.searchParams.get('lang'), 'fr');
  assert.equal(url.searchParams.get('ab'), 'start_split');
  assert.equal(url.hash, '');
  assert.equal(new URL(S.target('https://yousoft.site/doukkany-site/start/index.html')).pathname, '/doukkany-site/download/');
});

function fakeWindow(search, stored) {
  const data = Object.assign({}, stored);
  const win = {
    replaced: null,
    location: {
      search, href: 'https://yousoft.site/doukkany-site/start/' + search,
      replace(u) { win.replaced = u; }
    },
    localStorage: { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } },
    data
  };
  return win;
}

test('run() redirects and keeps the pick on the device', () => {
  const orig = Math.random;
  try {
    Math.random = () => 0.2;
    const w = fakeWindow('?utm_source=fb', {});
    assert.equal(S.run(w), 'download');
    assert.match(w.replaced, /\/doukkany-site\/download\/\?utm_source=fb&ab=start_split$/);
    assert.equal(w.data[S.KEY], 'download');

    Math.random = () => 0.8;
    const w2 = fakeWindow('', {});
    assert.equal(S.run(w2), 'start');
    assert.equal(w2.replaced, null);
    assert.equal(w2.data[S.KEY], 'start');

    // A buy link stays on /start/ and does not change the saved pick.
    Math.random = () => 0.2;
    const w3 = fakeWindow('?intent=buy', { [S.KEY]: 'download' });
    assert.equal(S.run(w3), 'start');
    assert.equal(w3.replaced, null);
    assert.equal(w3.data[S.KEY], 'download');

    // ?split=0 keeps this device on /start/ from now on.
    const w4 = fakeWindow('?split=0', { [S.KEY]: 'download' });
    assert.equal(S.run(w4), 'start');
    assert.equal(w4.data[S.KEY], 'start');
  } finally {
    Math.random = orig;
  }
});

test('run() works when the browser blocks storage', () => {
  const w = fakeWindow('', {});
  Object.defineProperty(w, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.ok(['start', 'download'].includes(S.run(w)));
});
