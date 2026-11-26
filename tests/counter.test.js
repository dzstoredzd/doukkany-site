// Run: node --test tests/*.test.js
// Checks start/counter.js: the anonymous /start/ counter sends only fixed details, never
// personal text, and matches what the server (doukkany_backend site-events) accepts.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../start/counter.js');

function make(extra = {}) {
  const sent = [];
  const c = C.createCounter({ on: true, internal: false, post: (url, body, leaving) => sent.push({ url, body: JSON.parse(body), leaving }),
    base: () => ({ page_language: 'ar', device: 'android', ad_source: 'facebook' }), ...extra });
  return { c, sent };
}

test('only the listed details are sent, with the visit id and the base details', () => {
  const { c, sent } = make();
  c.count('activity_selected', { activity: 'grocery', other: 'لعب 0555123456', name: 'Ali', email: 'a@b.dz' });
  c.count('pain_selected', { pain: 'credit', selected: true, step_number: undefined, intention: null });
  c.flush(true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, C.URL);
  assert.equal(sent[0].leaving, true);
  const b = sent[0].body;
  assert.match(b.visit_id, /^[0-9a-f-]{36}$/);
  assert.equal(b.internal, false);
  assert.deepEqual(b.events.map(e => e.event), ['activity_selected', 'pain_selected']);
  assert.deepEqual(b.events[0].details, { page_language: 'ar', device: 'android', ad_source: 'facebook', activity: 'grocery' });
  assert.deepEqual(b.events[1].details, { page_language: 'ar', device: 'android', ad_source: 'facebook', pain: 'credit', selected: true });
  assert.ok(!JSON.stringify(sent).includes('0555123456'));
  assert.ok(!JSON.stringify(sent).includes('@'));
  assert.notEqual(b.events[0].event_id, b.events[1].event_id);
});

test('off = nothing queued or sent; batches of at most 30, 20 send at once', () => {
  const off = make({ on: false });
  off.c.count('sales_funnel_started', {});
  off.c.flush(true);
  assert.equal(off.sent.length, 0);
  const { c, sent } = make();
  for (let i = 0; i < 19; i++) c.count('funnel_step_viewed', { step_number: 1 });
  assert.equal(sent.length, 0);
  c.count('funnel_step_viewed', { step_number: 1 });
  assert.equal(sent.length, 1, 'the 20th event sends the batch');
  assert.equal(sent[0].body.events.length, 20);
  assert.equal(c.pending(), 0);
});

test('a failing send never breaks the page', () => {
  const c = C.createCounter({ on: true, post: () => { throw new Error('offline'); } });
  c.count('sales_funnel_started', {});
  assert.doesNotThrow(() => c.flush(true));
});

test('campaign words from the link: kept when clean, dropped when they look personal', () => {
  assert.deepEqual(C.campaignFrom('?utm_source=facebook&utm_campaign=DK_01%20credit&utm_content=v1&utm_term=x'),
    { ad_source: 'facebook', ad_campaign: 'DK_01 credit', ad_content: 'v1' });
  assert.deepEqual(C.campaignFrom('?utm_source=a%40b.dz&utm_campaign=0555123456&utm_medium=%3Cb%3E'), {});
  assert.deepEqual(C.campaignFrom(''), {});
});

// The server lives in the app repo next to this one (my_projects/doukkany). Skipped elsewhere.
const SERVER = path.join(__dirname, '../../doukkany/doukkany_backend/supabase/functions/site-events/handler.mjs');
test('every detail the counter sends is one the server accepts (same list both sides)', { skip: !fs.existsSync(SERVER) && 'app repo not next to this one' }, () => {
  const server = fs.readFileSync(SERVER, 'utf8');
  for (const k of C.KEYS.concat(['ad_source', 'ad_medium', 'ad_campaign', 'ad_content'])) {
    assert.ok(new RegExp('\\b' + k + ':').test(server), 'server does not accept ' + k);
  }
  // Every event start/app.js sends is one the server accepts.
  const app = fs.readFileSync(path.join(__dirname, '../start/app.js'), 'utf8');
  const sentNames = new Set([...app.matchAll(/track\('([a-z_]+)'/g)].map(m => m[1]));
  for (const m of app.matchAll(/:\s*'([a-z_]+_(?:viewed|started))'/g)) sentNames.add(m[1]);
  assert.ok(sentNames.size > 15);
  for (const name of sentNames) assert.ok(server.includes(`'${name}'`), 'server does not accept event ' + name);
  // Values the page builds from its own lists: device choices (device_selected `platform`)
  // and WhatsApp buttons (`purpose`). The server drops an unknown value, so a renamed choice
  // would silently disappear from the Admin page: catch it here.
  const listOf = key => (server.match(new RegExp(key + ": oneOf\\(\\[([^\\]]*)\\]")) || [, ''])[1];
  const F = require('../start/funnel.js');
  const modes = (fs.readFileSync(path.join(__dirname, '../start/funnel.js'), 'utf8').match(/var MODES = \[([^\]]*)\]/) || [, ''])[1];
  for (const m of modes.match(/'[a-z_]+'/g) || []) assert.ok(listOf('platform').includes(m), 'server platform list misses ' + m);
  for (const m of new Set([...app.matchAll(/data-wa="([a-z_]+)"/g)].map(x => x[1]))) {
    assert.ok(listOf('purpose').includes(`'${m}'`), 'server purpose list misses ' + m);
  }
  for (const s of F.STEPS) assert.ok(listOf('funnel_step').includes(`'${s}'`), 'server funnel_step list misses ' + s);
});
