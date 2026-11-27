// js/tracking.js in a fake browser: event names, QualifiedDownload, attribution, consent.
// Run: node --test tests/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'tracking.js'), 'utf8');

function storage(seed) {
  const m = new Map(Object.entries(seed || {}));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    dump: () => Object.fromEntries(m)
  };
}

// Loads tracking.js on `url` with the given storages and cookies. Returns the window.
function load(url, opts) {
  opts = opts || {};
  const u = new URL(url);
  const win = {
    dataLayer: [],
    localStorage: opts.local || storage(),
    sessionStorage: opts.session || storage(),
    crypto: require('node:crypto').webcrypto,
    console: { info() {}, warn() {} },
    addEventListener() {},
    history: { state: null, replaceState(s, t, next) { win.__replaced = next; } }
  };
  const doc = {
    readyState: 'complete',
    referrer: opts.referrer || '',
    cookie: opts.cookie || '',
    documentElement: { lang: 'ar' },
    currentScript: { src: u.origin + '/doukkany-site/js/tracking.js' },
    head: { appendChild(el) { win.__loaded = (win.__loaded || []).concat(el.src || 'style'); } },
    body: { appendChild() {}, style: {} },
    createElement() { return { style: {}, setAttribute() {}, querySelector() { return { addEventListener() {}, style: {} }; } }; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener() {}
  };
  const location = {
    href: u.href, search: u.search, hash: u.hash, hostname: u.hostname,
    pathname: u.pathname, origin: u.origin
  };
  const ctx = { window: win, document: doc, location, URLSearchParams, URL, Date, JSON, Math, String, Object, Array, RegExp, encodeURIComponent, decodeURIComponent, parseInt, isNaN };
  win.document = doc;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return win;
}

const events = w => w.dataLayer.filter(x => x && x.event && !/^(gtm|dk_consent)/.test(x.event));
const names = w => events(w).map(x => x.event);
const CONSENT_OK = JSON.stringify({ v: 1, analytics: true, ads: true, at: '2026-11-27T00:00:00Z' });
const CONSENT_NO = JSON.stringify({ v: 1, analytics: false, ads: false, at: '2026-11-27T00:00:00Z' });

test('never a trial start, a purchase or a first sale from the website', () => {
  const w = load('http://localhost/doukkany-site/start/');
  for (const n of ['StartTrial', 'start_trial', 'Purchase', 'purchase', 'FirstSale', 'first_sale', 'Lead', 'qualified_download'])
    w.dkTrack(n, {});
  assert.deepEqual(names(w), []);
});

test('QualifiedDownload: shop type + device + price + a download click, once per visitor', () => {
  const local = storage({ 'dk-consent': CONSENT_OK });
  const w = load('http://localhost/doukkany-site/start/', { local });
  w.dkTrack('windows_download_clicked', { platform: 'windows' });       // nothing answered yet
  w.dkTrack('activity_selected', { activity: 'grocery' });
  w.dkTrack('device_selected', { platform: 'pc' });
  w.dkTrack('google_play_clicked', { platform: 'android' });            // no price seen yet
  w.dkTrack('pricing_viewed', { funnel_step: 'ready' });
  w.dkTrack('windows_download_clicked', { platform: 'windows', link_type: 'installer' });
  w.dkTrack('windows_download_clicked', { platform: 'windows', link_type: 'installer' });
  const n = names(w);
  assert.equal(n.filter(x => x === 'qualified_download').length, 1);
  assert.equal(n.filter(x => x === 'windows_download_clicked').length, 3, 'every click still counted');
  assert.equal(n.filter(x => x === 'funnel_completed').length, 1);
  const q = events(w).find(x => x.event === 'qualified_download');
  assert.equal(q.activity, 'grocery');
  assert.equal(q.platform, 'windows');
  assert.equal(q.method, 'same_device');
  // A new page load on the same device (the move to /download/): still once.
  const w2 = load('http://localhost/doukkany-site/download/', { local });
  w2.dkTrack('windows_download_clicked', { platform: 'windows' });
  assert.ok(!names(w2).includes('qualified_download'));
});

test('QualifiedDownload survives the move from /start/ to /download/ in the same tab', () => {
  const session = storage();
  const local = storage({ 'dk-consent': CONSENT_OK });
  const w = load('http://localhost/doukkany-site/start/', { session, local });
  w.dkTrack('activity_selected', { activity: 'clothes' });
  w.dkTrack('device_selected', { platform: 'both' });
  w.dkTrack('pricing_viewed', { funnel_step: 'ready' });
  const w2 = load('http://localhost/doukkany-site/download/', { session, local });
  w2.dkTrack('google_play_clicked', { platform: 'android', link_type: 'play_store' });
  assert.deepEqual(names(w2), ['google_play_clicked', 'qualified_download', 'funnel_completed']);
});

test('direct download without the questions: a plain download click only', () => {
  const w = load('http://localhost/doukkany-site/download/', { local: storage({ 'dk-consent': CONSENT_OK }) });
  w.dkTrack('windows_download_clicked', { platform: 'windows', download_trigger: 'button' });
  assert.deepEqual(names(w), ['windows_download_clicked']);
});

test('before a consent answer the "once" flag is not used up (nothing could be sent)', () => {
  const local = storage();
  const session = storage();
  const w = load('http://localhost/doukkany-site/start/', { local, session });
  ['activity_selected', 'device_selected', 'pricing_viewed'].forEach(n => w.dkTrack(n, { activity: 'grocery', platform: 'pc' }));
  w.dkTrack('windows_download_clicked', { platform: 'windows' });
  w.dkTrack('windows_download_clicked', { platform: 'windows' });
  assert.equal(names(w).filter(x => x === 'qualified_download').length, 2);
  assert.equal(local.getItem('dk-qd'), null, 'nothing kept on the device without consent');
});

test('a handed-out link carries dk_q=1 only while qualified and not yet counted; the PC visit counts it', () => {
  const local = storage({ 'dk-consent': CONSENT_OK });
  const w = load('http://localhost/doukkany-site/start/?utm_source=facebook&utm_medium=paid&utm_content=c1&placement=Facebook_Mobile_Feed', { local });
  assert.ok(!/dk_q/.test(w.dkTracking.campaignQuery('share')));
  ['activity_selected', 'device_selected', 'pricing_viewed'].forEach(n => w.dkTrack(n, { activity: 'grocery', platform: 'pc' }));
  const q = w.dkTracking.campaignQuery('share');
  assert.match(q, /utm_content=c1/);
  assert.match(q, /placement=Facebook_Mobile_Feed/);
  assert.match(q, /dk_q=1/);
  assert.ok(!/dk_q/.test(w.dkTracking.campaignQuery()), 'not on the Play referrer');
  // The shop PC opens the link (another browser).
  const pc = load('http://localhost/doukkany-site/download/?get=windows&' + q, { local: storage({ 'dk-consent': CONSENT_OK }) });
  pc.dkTrack('windows_download_clicked', { platform: 'windows', download_trigger: 'shared_link' });
  const qd = events(pc).find(x => x.event === 'qualified_download');
  assert.ok(qd);
  assert.equal(qd.method, 'shared_link');
  assert.equal(qd.download_trigger, 'shared_link');
  assert.equal(qd.ad_content, 'c1');
  // Counted on the phone: later links no longer carry it.
  w.dkTrack('google_play_clicked', { platform: 'android' });
  assert.ok(!/dk_q/.test(w.dkTracking.campaignQuery('share')));
});

test('attribution: first and last touch kept apart; Meta ids only with ads consent; _fbc only real or from a real fbclid', () => {
  const local = storage({ 'dk-consent': CONSENT_OK });
  const session = storage();
  const fbclid = 'IwAR2abcDEF_ghij-KLmn0123456789';
  load('http://localhost/doukkany-site/start/?utm_source=facebook&utm_medium=paid&utm_campaign=launch&utm_content=c1&fbclid=' + fbclid,
    { local, session, referrer: 'https://m.facebook.com/' });
  const w = load('http://localhost/doukkany-site/start/?utm_source=whatsapp&utm_medium=social', { local, session, cookie: '_fbp=fb.1.1795780000000.1234567890' });
  const a = w.dkTracking.attribution();
  assert.equal(a.consent_ads, 'granted');
  assert.equal(a.first_touch.utm_content, 'c1');
  assert.equal(a.first_touch.referrer_host, 'm.facebook.com');
  assert.equal(a.last_touch.utm_source, 'whatsapp');
  assert.equal(a.last_touch.utm_content, null);
  assert.equal(a.fbp, 'fb.1.1795780000000.1234567890');
  assert.match(a.fbc, new RegExp('^fb\\.1\\.\\d{13}\\.' + fbclid + '$'));
  assert.equal(a.fbclid, fbclid);
  assert.equal(a.event_source_url, 'http://localhost/doukkany-site/start/');
  // A real _fbc cookie wins.
  const w2 = load('http://localhost/doukkany-site/start/', { local, session, cookie: '_fbc=fb.1.1795000000000.' + fbclid });
  assert.equal(w2.dkTracking.attribution().fbc, 'fb.1.1795000000000.' + fbclid);
  // Consent "No": no Meta ids, nothing kept on the device.
  const lno = storage({ 'dk-consent': CONSENT_NO });
  const w3 = load('http://localhost/doukkany-site/start/?utm_source=facebook&fbclid=' + fbclid, { local: lno, cookie: '_fbp=fb.1.1795780000000.1' });
  const a3 = w3.dkTracking.attribution();
  assert.equal(a3.consent_ads, 'denied');
  assert.equal(a3.fbp, null); assert.equal(a3.fbc, null); assert.equal(a3.fbclid, null);
  assert.equal(a3.last_touch.utm_source, 'facebook', 'campaign words stay for our own order records');
  assert.equal(lno.getItem('dk-touch-first'), null);
  assert.equal(lno.getItem('dk-fbclid'), null);
  // No answer yet.
  const w4 = load('http://localhost/doukkany-site/start/?fbclid=' + fbclid);
  assert.equal(w4.dkTracking.attribution().consent_ads, 'unset');
  assert.equal(w4.dkTracking.attribution().fbc, null);
});

test('Play referrer: campaign words always; dk_ads=1 + real fbclid only with ads consent', () => {
  const fbclid = 'IwAR2abcDEF_ghij-KLmn0123456789';
  const url = 'http://localhost/doukkany-site/start/?utm_source=facebook&utm_medium=paid_social&utm_content=W01&utm_id=120215000000000001&dk_adset=120215000000000002&dk_ad=120215000000000003&fbclid=' + fbclid;
  const yes = load(url, { local: storage({ 'dk-consent': CONSENT_OK }) });
  const r = yes.dkTracking.playReferrer();
  assert.match(r, /utm_content=W01/);
  assert.match(r, /utm_id=120215000000000001/);
  assert.match(r, /dk_ad=120215000000000003/);
  assert.match(r, /dk_ads=1/);
  assert.match(r, new RegExp('fbclid=' + fbclid));
  const a = yes.dkTracking.attribution();
  assert.equal(a.last_touch.dk_adset, '120215000000000002');
  assert.equal(a.last_touch.utm_id, '120215000000000001');
  const no = load(url, { local: storage({ 'dk-consent': CONSENT_NO }) });
  assert.ok(!/(^|&)dk_ads=1|fbclid=/.test(no.dkTracking.playReferrer()));
  assert.match(no.dkTracking.playReferrer(), /utm_content=W01/);
  const unset = load(url);
  assert.ok(!/(^|&)dk_ads=1|fbclid=/.test(unset.dkTracking.playReferrer()));
  // Ids must be digits.
  const bad = load('http://localhost/doukkany-site/start/?dk_ad=abc&utm_id=12');
  assert.equal(bad.dkTracking.attribution().last_touch, null);
});

test('a fake fbclid or personal data in the link is never kept', () => {
  const local = storage({ 'dk-consent': CONSENT_OK });
  const w = load('http://localhost/doukkany-site/start/?fbclid=<script>&utm_source=0555123456&utm_campaign=x%40y.com&placement=feed', { local });
  const a = w.dkTracking.attribution();
  assert.equal(a.fbclid, null);
  assert.equal(a.fbc, null);
  assert.equal(a.last_touch.utm_source, null);
  assert.equal(a.last_touch.utm_campaign, null);
  assert.equal(a.last_touch.placement, 'feed');
  assert.ok(!JSON.stringify(a).includes('0555123456'));
});

test('the Lead keeps the event id it is given (same id as in the order); other events get their own', () => {
  const w = load('http://localhost/doukkany-site/start/');
  const id = w.dkTracking.newEventId();
  w.dkTrack('contact_form_submitted', { license_type: 'pc', value: 12000, currency: 'DZD' }, { eventId: id });
  w.dkTrack('contact_form_submitted', {}, { eventId: 'not-a-uuid' });
  const e = events(w);
  assert.equal(e[0].event_id, id);
  assert.equal(e[0].value, 12000);
  assert.notEqual(e[1].event_id, 'not-a-uuid');
});

test('every event push writes every parameter (no leftover from the previous event)', () => {
  const w = load('http://localhost/doukkany-site/start/?utm_source=facebook&placement=ig_stories');
  w.dkTrack('tutorial_clicked', { tutorial_id: 'abc' });
  w.dkTrack('windows_download_clicked', { platform: 'windows' });
  const e = events(w);
  assert.ok('tutorial_id' in e[1] && e[1].tutorial_id === undefined);
  assert.equal(e[1].ad_placement, 'ig_stories');
});

test('funnel_completed: once per page load', () => {
  const w = load('http://localhost/doukkany-site/start/');
  w.dkTrack('funnel_completed', { method: 'site_order' });
  w.dkTrack('funnel_completed', { method: 'whatsapp_order' });
  assert.deepEqual(names(w), ['funnel_completed']);
});

test('the GTM import knows every website event and maps the Meta ones', { skip: !fs.existsSync(path.join(__dirname, '..', '..', 'doukkany', 'DOUKKANY-MARKETING', 'gtm', 'build-gtm-import.js')) && 'marketing folder not next to this repo' }, () => {
  const gtm = fs.readFileSync(path.join(__dirname, '..', '..', 'doukkany', 'DOUKKANY-MARKETING', 'gtm', 'build-gtm-import.js'), 'utf8');
  const listed = SRC.match(/var EVENTS = \{([\s\S]*?)\};/)[1].match(/^\s+([a-z_]+):/gm).map(s => s.trim().replace(':', ''));
  for (const n of listed) assert.ok(gtm.includes("'" + n + "'"), 'GTM import misses ' + n);
  for (const m of ['ViewContent', 'InitiateCheckout', 'Lead', 'FunnelStarted', 'TrialSelected', 'BuySelected', 'ActivitySelected', 'DeviceSelected', 'QualifiedDownload'])
    assert.ok(gtm.includes(m), 'Meta event missing: ' + m);
  for (const bad of ['StartTrial', "'Purchase'", 'FirstSale']) assert.ok(!gtm.includes(bad), bad);
});
