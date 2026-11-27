/*
 * Doukkany website tracking: consent banner, campaign memory and one place for events.
 *
 * Rules (see DOUKKANY-MARKETING/TRACKING_SETUP.md in the app repo):
 * - Nothing leaves the browser before the visitor accepts. Google Tag Manager is the only
 *   third-party script this file loads, and only after "OK". (Visitors who chose the old
 *   "Statistics only" button keep that choice: analytics on, ads off.)
 * - GA4 and the Meta Pixel live inside the GTM container, never here. If Microsoft Clarity
 *   is added later: add it to the banner text and privacy.html, and raise consentVersion.
 * - Events never carry an email, a phone number or a name: dkTrack() keeps only the
 *   parameters listed in PARAMS and drops values that look like an email or a phone.
 * - With an empty gtmId nothing is loaded and no banner is shown.
 * - If this file fails to load, the pages keep working (they call window.dkTrack only if
 *   it exists).
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------------
  // Settings: the only part to edit.
  // ---------------------------------------------------------------------------------
  var CONFIG = {
    // Google Tag Manager web container, for example 'GTM-ABC1234'. Empty = no tracking.
    gtmId: 'GTM-K5D2KFV3',
    // Hosts that count as the real website. Any other host is development traffic:
    // GTM loads there only with ?dk_debug=1, and every event is marked internal.
    productionHosts: ['yousoft.site'],
    // Raise this number when the banner text or the tools change: everyone is asked again.
    consentVersion: 1,
    // How long a campaign link is remembered on this device after "Accept" (days).
    campaignDays: 90
  };

  var w = window;
  var d = document;

  // ---------------------------------------------------------------------------------
  // Small storage helpers (private mode and blocked storage must never break the page).
  // ---------------------------------------------------------------------------------
  function store(kind) {
    return {
      get: function (k) { try { return w[kind].getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { w[kind].setItem(k, v); } catch (e) {} },
      remove: function (k) { try { w[kind].removeItem(k); } catch (e) {} }
    };
  }
  var local = store('localStorage');
  var session = store('sessionStorage');

  function readJson(s, k) {
    var raw = s.get(k);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  var query;
  try { query = new URLSearchParams(location.search); } catch (e) { query = { get: function () { return null; } }; }

  // ?name=1 turns a flag on, ?name=0 turns it off.
  function flag(s, name) {
    var v = query.get(name);
    if (v === '1') s.set(name, '1');
    else if (v === '0') s.remove(name);
    return s.get(name) === '1';
  }

  var isProduction = CONFIG.productionHosts.indexOf(location.hostname) !== -1;
  // Debug for this tab only: logs every event in the console and allows GTM on localhost.
  var debug = flag(session, 'dk_debug');
  // Marks this browser as ours (owner, testers) until ?dk_internal=0.
  var internal = flag(local, 'dk_internal');
  var trackingPossible = !!CONFIG.gtmId && (isProduction || debug);

  // ---------------------------------------------------------------------------------
  // Consent Mode v2 defaults: everything denied until the visitor chooses.
  // ---------------------------------------------------------------------------------
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted'
  });
  gtag('set', 'ads_data_redaction', true);
  // GA4 "Internal traffic" filter. A gtag 'set' reaches every GA4 hit, including Google's
  // automatic page_view; settings on the GTM Google tag did not (checked live 2026-11-25).
  if (!isProduction || internal) gtag('set', { traffic_type: 'internal' });

  w.dataLayer.push({
    dk_env: isProduction ? 'production' : 'development',
    // GA4 "Internal traffic" filter: only the value 'internal' is ever set.
    dk_traffic_type: (!isProduction || internal) ? 'internal' : undefined,
    dk_debug: debug ? 'true' : undefined,
    dk_consent_analytics: 'denied',
    dk_consent_ads: 'denied'
  });

  // ---------------------------------------------------------------------------------
  // Values that must never reach analytics.
  // ---------------------------------------------------------------------------------
  function looksPersonal(v) {
    if (v.indexOf('@') !== -1) return true; // email
    var digits = v.replace(/[\s.\-()\/]/g, '');
    // Algerian mobile (05/06/07 + 8 digits) or any +213 / 00213 number.
    return /(^|\D)(0[5-7]\d{8}|(\+|00)?213\d{8,9})(\D|$)/.test(digits);
  }

  function clean(v) {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    v = String(v).trim().slice(0, 100);
    if (!v || looksPersonal(v)) return undefined;
    return v;
  }

  // GA4 and the Meta Pixel also read the page address itself. If a link carries an email
  // or a phone number in any parameter, remove it from the address before GTM can load.
  (function scrubAddress() {
    if (!w.history || !w.history.replaceState || !location.search) return;
    var kept = [];
    var removed = false;
    location.search.slice(1).split('&').forEach(function (pair) {
      if (!pair) return;
      var value = pair.split('=').slice(1).join('=');
      var decoded;
      try { decoded = decodeURIComponent(value.replace(/\+/g, ' ')); } catch (e) { decoded = value; }
      if (looksPersonal(decoded)) removed = true;
      else kept.push(pair);
    });
    if (!removed) return;
    w.history.replaceState(w.history.state, '',
      location.pathname + (kept.length ? '?' + kept.join('&') : '') + location.hash);
    try { query = new URLSearchParams(location.search); } catch (e) {}
  })();

  // ---------------------------------------------------------------------------------
  // Campaign memory (utm_*), last click wins.
  // ---------------------------------------------------------------------------------
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var CAMPAIGN_KEY = 'dk-campaign';
  var VIA_KEY = 'dk-via';

  function campaignFromUrl() {
    var found = null;
    UTM.forEach(function (k) {
      var v = clean(query.get(k));
      if (v !== undefined) { found = found || {}; found[k] = v; }
    });
    return found;
  }

  var campaign = (function () {
    var fromUrl = campaignFromUrl();
    if (fromUrl) {
      fromUrl.at = Date.now();
      session.set(CAMPAIGN_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    var fromSession = readJson(session, CAMPAIGN_KEY);
    if (fromSession) return fromSession;
    return null; // the saved one (after "Accept") is read once consent is known
  })();

  var arrivedVia = (function () {
    var v = query.get('dk_via');
    if (v === 'email' || v === 'copy' || v === 'share') { session.set(VIA_KEY, v); return v; }
    return session.get(VIA_KEY) || undefined;
  })();

  function rememberCampaign(allowed) {
    if (!allowed) { local.remove(CAMPAIGN_KEY); return; }
    if (campaign) {
      local.set(CAMPAIGN_KEY, JSON.stringify(campaign));
      return;
    }
    var saved = readJson(local, CAMPAIGN_KEY);
    if (saved && saved.at && Date.now() - saved.at < CONFIG.campaignDays * 864e5) {
      campaign = saved;
      session.set(CAMPAIGN_KEY, JSON.stringify(saved));
    } else if (saved) {
      local.remove(CAMPAIGN_KEY);
    }
  }

  // Query string to add to links we hand out (email, copy, share, Play referrer).
  // A link handed out (via) by a visitor who is qualified for QualifiedDownload but has not
  // downloaded yet also carries dk_q=1, so the download on the other device (the shop PC)
  // still counts as qualified. dk_q holds no answer and no id: only "qualified".
  function campaignQuery(via) {
    var parts = [];
    if (campaign) {
      UTM.forEach(function (k) {
        if (campaign[k]) parts.push(k + '=' + encodeURIComponent(campaign[k]));
      });
      if (campaign.placement) parts.push('placement=' + encodeURIComponent(campaign.placement));
    }
    if (lastTouch) ID_KEYS.forEach(function (k) { if (lastTouch[k]) parts.push(k + '=' + lastTouch[k]); });
    if (via) parts.push('dk_via=' + encodeURIComponent(via));
    if (via && qualified() && !qd.f) parts.push('dk_q=1');
    return parts.join('&');
  }

  // ---------------------------------------------------------------------------------
  // Attribution for orders (Meta Conversions API in site-order, see
  // DOUKKANY-MARKETING/migration/01-website-tracking.md). Two "touches", kept apart:
  //   first touch = the first ad/campaign link seen on this device (never overwritten),
  //   last touch  = the latest one.
  // A touch is a page address with utm_*, placement or fbclid. Kept for this tab
  // (sessionStorage) for everyone, on the device (localStorage, 90 days) only after "OK".
  // fbclid (Meta's click id) is kept apart and only ever leaves the browser with ads consent.
  // ---------------------------------------------------------------------------------
  var FIRST_KEY = 'dk-touch-first', LAST_KEY = 'dk-touch-last', FBCLID_KEY = 'dk-fbclid';
  var TOUCH_KEYS = UTM.concat(['placement']);
  // Meta campaign / ad set / ad ids from the ads' URL parameters (ads plan, 2026-11-27):
  // utm_id={{campaign.id}}&dk_adset={{adset.id}}&dk_ad={{ad.id}}. Digits only.
  var ID_KEYS = ['utm_id', 'dk_adset', 'dk_ad'];

  function hostOf(url) {
    try { var h = new URL(url).hostname.toLowerCase(); return /^[a-z0-9.-]{1,100}$/.test(h) ? h : undefined; } catch (e) { return undefined; }
  }
  function touchFromUrl() {
    var t = null;
    TOUCH_KEYS.forEach(function (k) {
      var v = clean(query.get(k));
      if (k === 'placement' && v === undefined) v = clean(query.get('utm_placement'));
      if (v !== undefined) { t = t || {}; t[k] = v; }
    });
    ID_KEYS.forEach(function (k) {
      var v = query.get(k);
      if (v && /^\d{5,20}$/.test(v)) { t = t || {}; t[k] = v; }
    });
    if (!t && !fbclidFromUrl) return null;
    t = t || {};
    t.landing_path = location.pathname.slice(0, 200);
    var ref = d.referrer ? hostOf(d.referrer) : undefined;
    if (ref && ref !== location.hostname) t.referrer_host = ref;
    t.at = new Date().toISOString();
    return t;
  }
  // Meta's click id: letters, digits, - and _ only (anything else is not a real one).
  var fbclidFromUrl = (function () {
    var v = query.get('fbclid');
    return v && /^[A-Za-z0-9_-]{10,500}$/.test(v) ? v : null;
  })();
  var firstTouch = readJson(session, FIRST_KEY);
  var lastTouch = readJson(session, LAST_KEY);
  var fbclid = readJson(session, FBCLID_KEY); // { v, at (ms) }
  (function () {
    var now = touchFromUrl();
    if (now) {
      lastTouch = now;
      if (!firstTouch) firstTouch = now;
      session.set(LAST_KEY, JSON.stringify(lastTouch));
      session.set(FIRST_KEY, JSON.stringify(firstTouch));
    }
    if (fbclidFromUrl && (!fbclid || fbclid.v !== fbclidFromUrl)) {
      fbclid = { v: fbclidFromUrl, at: Date.now() };
      session.set(FBCLID_KEY, JSON.stringify(fbclid));
    }
    // The last campaign link's placement goes on events as ad_placement.
    if (campaign && lastTouch && lastTouch.placement && !campaign.placement) campaign.placement = lastTouch.placement;
  })();

  function fresh(t) { return t && t.at && Date.now() - Date.parse(t.at) < CONFIG.campaignDays * 864e5; }

  // Called with the consent answer: keep the touches on the device, or forget them.
  function rememberTouches(c) {
    var keep = c.analytics || c.ads;
    if (!keep) { [FIRST_KEY, LAST_KEY, FBCLID_KEY].forEach(function (k) { local.remove(k); }); return; }
    var savedFirst = readJson(local, FIRST_KEY), savedLast = readJson(local, LAST_KEY);
    if (fresh(savedFirst) && (!firstTouch || Date.parse(savedFirst.at) < Date.parse(firstTouch.at))) firstTouch = savedFirst;
    if (!lastTouch && fresh(savedLast)) lastTouch = savedLast;
    if (firstTouch) { local.set(FIRST_KEY, JSON.stringify(firstTouch)); session.set(FIRST_KEY, JSON.stringify(firstTouch)); }
    if (lastTouch) { local.set(LAST_KEY, JSON.stringify(lastTouch)); session.set(LAST_KEY, JSON.stringify(lastTouch)); }
    if (c.ads) {
      var savedClick = readJson(local, FBCLID_KEY);
      if (!fbclid && savedClick && savedClick.at && Date.now() - savedClick.at < CONFIG.campaignDays * 864e5) fbclid = savedClick;
      if (fbclid) local.set(FBCLID_KEY, JSON.stringify(fbclid));
    } else local.remove(FBCLID_KEY);
  }

  function cookie(name) {
    var m = d.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  // Real Meta cookies only. _fbc may be built from a real fbclid in Meta's documented
  // format fb.1.<time the click id was seen, ms>.<fbclid>; never made up otherwise.
  function metaIds() {
    var fbp = cookie('_fbp'), fbc = cookie('_fbc');
    if (fbp && !/^fb\.\d\.\d{10,}\.\d+$/.test(fbp)) fbp = null;
    if (fbc && !/^fb\.\d\.\d{10,}\.[A-Za-z0-9_-]{10,500}$/.test(fbc)) fbc = null;
    if (!fbc && fbclid) fbc = 'fb.1.' + fbclid.at + '.' + fbclid.v;
    return { fbp: fbp, fbc: fbc, fbclid: fbclid ? fbclid.v : null };
  }

  // Google Play `referrer` (read by the app's Play Install Referrer, backend-capi contract):
  // the campaign words, and only with ads consent dk_ads=1 + Meta's real click id.
  function playReferrer() {
    var q = campaignQuery();
    if (consentNow && consentNow.ads) {
      q += (q ? '&' : '') + 'dk_ads=1';
      if (fbclid) q += '&fbclid=' + fbclid.v;
    }
    return q;
  }

  function consentWord(on) { return consentNow ? (on ? 'granted' : 'denied') : 'unset'; }

  // What a website order (site-order) carries besides the order itself. Meta ids only with
  // ads consent; never a name, phone or email (touches hold cleaned utm words only).
  function attribution() {
    var ads = !!(consentNow && consentNow.ads);
    var ids = ads ? metaIds() : { fbp: null, fbc: null, fbclid: null };
    function pick(t) {
      if (!t) return null;
      var o = {};
      TOUCH_KEYS.concat(['landing_path', 'referrer_host', 'at']).forEach(function (k) { o[k] = t[k] == null ? null : String(t[k]).slice(0, 200); });
      ID_KEYS.forEach(function (k) { if (t[k]) o[k] = String(t[k]); });
      return o;
    }
    return {
      consent_ads: consentWord(consentNow && consentNow.ads),
      consent_analytics: consentWord(consentNow && consentNow.analytics),
      first_touch: pick(firstTouch),
      last_touch: pick(lastTouch),
      fbclid: ids.fbclid, fbp: ids.fbp, fbc: ids.fbc,
      event_source_url: (location.origin + location.pathname).slice(0, 200)
    };
  }

  // ---------------------------------------------------------------------------------
  // QualifiedDownload (owner, 2026-11-27): shop type chosen + device chosen + a price seen
  // + an official Windows / Google Play button clicked. Fired once per visitor (browser).
  // The answers come from the events themselves (activity_selected, device_selected,
  // pricing_viewed), so every page that loads this file (/start/, /download/, /windows/)
  // counts the same way. Every download click is still sent as its own event.
  // Kept for this tab for everyone; on the device (30 days) only after "OK".
  // ---------------------------------------------------------------------------------
  var QD_KEY = 'dk-qd', QD_DAYS = 30;
  var qd = readJson(session, QD_KEY) || {};
  if (query.get('dk_q') === '1') { // a link handed out by a qualified visitor (see campaignQuery)
    ['a', 'd', 'p'].forEach(function (k) { if (!qd[k]) qd[k] = 'link'; });
    qd.at = Date.now();
    session.set(QD_KEY, JSON.stringify(qd));
  }
  function qualified() {
    return !!(qd.a && qd.d && qd.p) && !!qd.at && Date.now() - qd.at < QD_DAYS * 864e5;
  }
  function saveQd() {
    session.set(QD_KEY, JSON.stringify(qd));
    if (consentNow && (consentNow.analytics || consentNow.ads)) local.set(QD_KEY, JSON.stringify(qd));
  }
  function rememberQd(c) {
    if (!(c.analytics || c.ads)) { local.remove(QD_KEY); return; }
    var saved = readJson(local, QD_KEY);
    if (saved) {
      if (saved.f && !qd.f) qd.f = saved.f;
      if (saved.at && Date.now() - saved.at < QD_DAYS * 864e5) {
        ['a', 'd', 'p'].forEach(function (k) { if (!qd[k] && saved[k]) qd[k] = saved[k]; });
        qd.at = Math.max(qd.at || 0, saved.at);
      }
    }
    saveQd();
  }
  function markQd(k, v) {
    if (v === undefined || v === null || v === '') return;
    qd[k] = String(v).slice(0, 40);
    qd.at = Date.now();
    saveQd();
  }

  // ---------------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------------
  // The only names that reach the dataLayer (GTM → GA4, and the Meta Pixel for the ones
  // mapped in GTM). Event definitions: DOUKKANY-MARKETING/migration/01-website-tracking.md.
  // All are screens or clicks. Never StartTrial, Purchase or a first sale: those happen in
  // the app or on the licence server, not on this website.
  var EVENTS = {
    windows_download_clicked: 1,
    google_play_clicked: 1,
    // The email button opens the visitor's own email app; we can never know it was sent,
    // so 'download_email_sent' is NOT used (it needs a server that confirms the send).
    download_email_app_opened: 1,
    download_link_copied: 1,
    download_link_shared: 1,
    tutorial_clicked: 1,
    whatsapp_support_clicked: 1,
    language_changed: 1,
    // /start/ funnel (start/app.js maps its own names to these).
    sales_funnel_viewed: 1,      // the funnel page was opened
    sales_funnel_started: 1,     // first journey choice (trial / buy / download / a plan)
    funnel_step_viewed: 1,       // drop-off chart
    intention_selected: 1,       // intention = trial | buy | download
    activity_selected: 1,
    pain_selected: 1,
    device_selected: 1,
    configuration_completed: 1,  // the last question (devices) answered
    pricing_viewed: 1,           // a price was on screen
    license_selected: 1,         // a plan picked on the prices list
    quick_course_viewed: 1,
    quick_course_skipped: 1,
    qualified_download: 1,       // fired here only (see QualifiedDownload above)
    purchase_form_started: 1,    // the order screen was opened
    purchase_requested: 1,       // method = site_order (valid form sent) | whatsapp (click)
    contact_form_submitted: 1,   // the order form was stored: site-order answered ok → Meta Lead
    funnel_completed: 1          // method = qualified_download | site_order | whatsapp_order
  };
  var PARAMS = [
    'event_id', 'platform', 'page_language', 'tutorial_id', 'tutorial_category',
    'tutorial_position', 'app_version', 'link_type', 'download_trigger', 'method',
    'from_language', 'to_language', 'arrived_via', 'ad_source', 'ad_medium',
    'ad_campaign', 'ad_content', 'ad_term', 'ad_placement',
    // /start/ funnel. `activity` and `pain` are fixed ids (never the visitor's "other" text).
    'funnel_step', 'step_number', 'intention', 'activity', 'pain', 'selected',
    'pain_count', 'device_count', 'license_type',
    // Funnel v2: fixed values only (never a name, a phone or an address).
    'funnel_version', 'journey', 'pay', 'purpose', 'faq_id', 'video_kind', 'field', 'field_count',
    // Offer price shown or ordered, from js/offer.js only (never typed here).
    'value', 'currency'
  ];

  function newEventId() {
    if (w.crypto && typeof w.crypto.randomUUID === 'function') return w.crypto.randomUUID();
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  var EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  var completedOnce = false; // funnel_completed: once per page load

  // opts.eventId: a caller's own id (the Lead uses the event_id sent with the order, so
  // Meta can match the browser event with the server one).
  function push(name, params, opts) {
    // Every key is written on every push. GTM merges pushes, so a key left out would
    // keep the value of the previous event (for example tutorial_id on a download).
    var out = { event: name };
    PARAMS.forEach(function (k) { out[k] = undefined; });
    out.event_id = opts && typeof opts.eventId === 'string' && EVENT_ID.test(opts.eventId) ? opts.eventId : newEventId();
    out.page_language = d.documentElement.lang || undefined;
    out.arrived_via = arrivedVia;
    // Not named campaign_*: GA4 reserves those names and would turn them into the
    // session's traffic source instead of event details. GA4 still reads utm_* from the
    // page address by itself.
    if (campaign) {
      out.ad_source = campaign.utm_source;
      out.ad_medium = campaign.utm_medium;
      out.ad_campaign = campaign.utm_campaign;
      out.ad_content = campaign.utm_content;
      out.ad_term = campaign.utm_term;
      out.ad_placement = campaign.placement;
    }
    params = params || {};
    PARAMS.forEach(function (k) {
      if (k === 'event_id') return;
      if (Object.prototype.hasOwnProperty.call(params, k)) out[k] = clean(params[k]);
    });
    w.dataLayer.push(out);
    if (debug && w.console) console.info('[dk-track]', name, out);
    return out;
  }

  function track(name, params, opts) {
    if (!EVENTS[name] || name === 'qualified_download') {
      if (debug && w.console) console.warn('[dk-track] unknown event, not sent:', name);
      return;
    }
    if (name === 'funnel_completed') { if (completedOnce) return; completedOnce = true; }
    var out = push(name, params, opts);
    // QualifiedDownload progress, from the events themselves.
    if (name === 'activity_selected') markQd('a', out.activity);
    else if (name === 'device_selected') markQd('d', out.platform);
    else if (name === 'pricing_viewed') markQd('p', out.funnel_step || 'seen');
    else if ((name === 'windows_download_clicked' || name === 'google_play_clicked') && qualified() && !qd.f) {
      push('qualified_download', {
        platform: out.platform, link_type: out.link_type, app_version: out.app_version,
        download_trigger: out.download_trigger || 'button', funnel_step: out.funnel_step,
        activity: qd.a !== 'link' ? qd.a : undefined, method: qd.a === 'link' ? 'shared_link' : 'same_device',
        journey: out.journey, funnel_version: out.funnel_version
      });
      // Once per visitor. Before any consent answer GTM has not loaded and replays the
      // event with consent "denied" (nothing sent), so the flag waits for an answer.
      if (consentNow) { qd.f = Date.now(); saveQd(); }
      track('funnel_completed', { method: 'qualified_download', platform: out.platform, journey: out.journey, funnel_version: out.funnel_version });
    }
  }

  // ---------------------------------------------------------------------------------
  // Consent
  // ---------------------------------------------------------------------------------
  var CONSENT_KEY = 'dk-consent';
  var gtmLoaded = false;
  var consentNow = null; // { analytics, ads } once the visitor answered (now or before)

  function readConsent() {
    var c = readJson(local, CONSENT_KEY);
    if (!c || c.v !== CONFIG.consentVersion) return null;
    return { analytics: !!c.analytics, ads: !!c.ads };
  }

  function loadGtm() {
    if (gtmLoaded || !trackingPossible) return;
    if (!/^GTM-[A-Z0-9]+$/.test(CONFIG.gtmId)) {
      if (w.console) console.warn('[dk-track] gtmId is not a GTM container id:', CONFIG.gtmId);
      return;
    }
    gtmLoaded = true;
    // Google's official snippet, loaded after consent instead of in <head>.
    w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var s = d.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(CONFIG.gtmId);
    // Development only (never on the real site): ?dk_debug=1&gtm_auth=…&gtm_preview=env-…
    // loads an unpublished GTM workspace, to test it before anything is published.
    if (!isProduction && debug && /^[\w-]{10,40}$/.test(query.get('gtm_auth') || '') && /^env-\d{1,4}$/.test(query.get('gtm_preview') || '')) {
      s.src += '&gtm_auth=' + query.get('gtm_auth') + '&gtm_preview=' + query.get('gtm_preview') + '&gtm_cookies_win=x';
    }
    d.head.appendChild(s);
  }

  // Doukkany's own analytics cookies. _fbp/_fbc are left alone: they sit on the whole
  // yousoft.site domain and are shared with other pages there.
  function clearAnalyticsCookies() {
    var names = d.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); })
      .filter(function (n) { return /^(_ga|_ga_.+|_gid|_clck|_clsk)$/.test(n); });
    var paths = ['/', location.pathname.replace(/[^\/]*$/, ''), '/doukkany-site/'];
    var host = location.hostname;
    var domains = ['', host, '.' + host, '.' + host.split('.').slice(-2).join('.')];
    names.forEach(function (n) {
      paths.forEach(function (p) {
        domains.forEach(function (dom) {
          d.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + p +
            (dom ? '; domain=' + dom : '');
        });
      });
    });
  }

  function applyConsent(c, fromChoice) {
    var a = c.analytics ? 'granted' : 'denied';
    var ad = c.ads ? 'granted' : 'denied';
    gtag('consent', 'update', {
      analytics_storage: a,
      ad_storage: ad,
      ad_user_data: ad,
      ad_personalization: ad
    });
    w.dataLayer.push({ event: 'dk_consent', dk_consent_analytics: a, dk_consent_ads: ad });
    consentNow = { analytics: !!c.analytics, ads: !!c.ads };
    rememberCampaign(c.analytics);
    rememberTouches(consentNow);
    rememberQd(consentNow);
    if (c.analytics || c.ads) loadGtm();
    else if (fromChoice) clearAnalyticsCookies();
  }

  function saveConsent(analytics, ads) {
    local.set(CONSENT_KEY, JSON.stringify({
      v: CONFIG.consentVersion, analytics: analytics, ads: ads, at: new Date().toISOString()
    }));
    applyConsent({ analytics: analytics, ads: ads }, true);
    hideBanner();
  }

  // ---------------------------------------------------------------------------------
  // Banner: one short sentence and two equal buttons (standard Arabic, French, English;
  // follows the page language). The details are on privacy.html.
  // ---------------------------------------------------------------------------------
  var TEXT = {
    ar: {
      text: 'نستعمل أدوات Google وFacebook لقياس الزيارات والإعلانات.',
      accept: 'موافق',
      refuse: 'لا',
      more: 'التفاصيل'
    },
    fr: {
      text: 'Nous utilisons des outils Google et Facebook pour mesurer les visites et les publicités.',
      accept: 'D’accord',
      refuse: 'Non',
      more: 'Détails'
    },
    en: {
      text: 'We use Google and Facebook tools to measure visits and ads.',
      accept: 'OK',
      refuse: 'No',
      more: 'Details'
    }
  };

  // Site root, from this file's own address (works from / and from /download/).
  var siteRoot = (function () {
    var src = d.currentScript && d.currentScript.src;
    return src ? src.replace(/js\/tracking\.js(\?.*)?$/, '') : '';
  })();

  var banner = null;

  function lang() {
    var l = (d.documentElement.lang || 'ar').slice(0, 2);
    return TEXT[l] ? l : 'ar';
  }

  function injectStyle() {
    if (d.getElementById('dk-consent-style')) return;
    var st = d.createElement('style');
    st.id = 'dk-consent-style';
    st.textContent =
      '.dk-consent{position:fixed;left:0;right:0;bottom:0;z-index:1000;padding:0 10px 10px;pointer-events:none}' +
      '.dk-consent-box{pointer-events:auto;max-width:640px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;background:#fff;color:#1d2421;border:1px solid #dfe5e2;border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.14);padding:10px 12px;font:inherit;font-size:.9rem;line-height:1.5}' +
      '.dk-consent-box p{margin:0;flex:1 1 240px}' +
      '.dk-consent-box a{color:#1f8a4c;white-space:nowrap}' +
      '.dk-consent-row{display:flex;gap:8px;flex:0 0 auto}' +
      '.dk-consent-row button{font:inherit;font-weight:600;min-height:44px;min-width:88px;padding:6px 16px;border-radius:12px;cursor:pointer;border:2px solid #1f8a4c;background:#1f8a4c;color:#fff}' +
      '@media (max-width:480px){.dk-consent-row{flex:1 1 100%}.dk-consent-row button{flex:1 1 0}}';
    d.head.appendChild(st);
  }

  function renderBanner() {
    if (!banner) return;
    var t = TEXT[lang()];
    banner.querySelector('[data-k="text"]').textContent = t.text + ' ';
    var more = banner.querySelector('[data-k="more"]');
    more.textContent = t.more;
    more.href = siteRoot + 'privacy.html#website-' + lang();
    banner.querySelector('[data-k="accept"]').textContent = t.accept;
    banner.querySelector('[data-k="refuse"]').textContent = t.refuse;
    banner.setAttribute('aria-label', t.more);
    padBody();
  }

  function padBody() {
    if (!banner) return;
    d.body.style.paddingBottom = (banner.offsetHeight + 8) + 'px';
  }

  function showBanner() {
    if (!trackingPossible || !d.body) return;
    if (banner) { renderBanner(); return; }
    injectStyle();
    banner = d.createElement('div');
    banner.className = 'dk-consent';
    banner.setAttribute('role', 'region');
    banner.innerHTML =
      '<div class="dk-consent-box">' +
      '<p><span data-k="text"></span><a data-k="more" href="#"></a></p>' +
      '<div class="dk-consent-row">' +
      '<button type="button" data-k="accept"></button>' +
      '<button type="button" data-k="refuse"></button>' +
      '</div></div>';
    banner.querySelector('[data-k="accept"]').addEventListener('click', function () { saveConsent(true, true); });
    banner.querySelector('[data-k="refuse"]').addEventListener('click', function () { saveConsent(false, false); });
    d.body.appendChild(banner);
    renderBanner();
  }

  function hideBanner() {
    if (!banner) return;
    banner.parentNode.removeChild(banner);
    banner = null;
    d.body.style.paddingBottom = '';
  }

  // Links that reopen the choice: <a href="#" data-dk-consent-open>. Hidden when no
  // tracking can run (no GTM id yet), together with their [data-dk-consent-wrap].
  function wireOpenLinks() {
    var links = d.querySelectorAll('[data-dk-consent-open]');
    Array.prototype.forEach.call(links, function (el) {
      var box = (el.closest && el.closest('[data-dk-consent-wrap]')) || el;
      if (!trackingPossible) { box.hidden = true; return; }
      box.hidden = false;
      el.addEventListener('click', function (e) { e.preventDefault(); showBanner(); });
    });
  }

  // A choice made on an earlier visit applies right away (before the page's own script
  // runs), so the saved campaign is already known when the page builds its links.
  var savedConsent = readConsent();
  if (savedConsent) applyConsent(savedConsent, false);

  function start() {
    wireOpenLinks();
    if (!savedConsent) showBanner();
    // The download page changes language without reloading.
    if (w.MutationObserver) {
      new MutationObserver(function () { if (banner) renderBanner(); })
        .observe(d.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
    w.addEventListener('resize', padBody);
  }

  // ---------------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------------
  w.dkTrack = track;
  w.dkTracking = {
    track: track,
    campaign: function () { return campaign; },
    campaignQuery: campaignQuery,
    playReferrer: playReferrer,
    openConsent: showBanner,
    newEventId: newEventId,
    // For the order request (start/app.js → site-order): consent, first/last touch, Meta ids.
    attribution: attribution,
    // 'granted' | 'denied' | 'unset' for ads (Meta) and analytics (GA4).
    consent: function () {
      return { ads: consentWord(consentNow && consentNow.ads), analytics: consentWord(consentNow && consentNow.analytics) };
    },
    qualified: qualified
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})();
