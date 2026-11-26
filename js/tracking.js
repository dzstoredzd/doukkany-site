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
  function campaignQuery(via) {
    var parts = [];
    if (campaign) {
      UTM.forEach(function (k) {
        if (campaign[k]) parts.push(k + '=' + encodeURIComponent(campaign[k]));
      });
    }
    if (via) parts.push('dk_via=' + encodeURIComponent(via));
    return parts.join('&');
  }

  // ---------------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------------
  var EVENTS = {
    windows_download_clicked: 1,
    google_play_clicked: 1,
    // The email form opens the visitor's own email app; we can never know it was sent.
    // 'download_email_sent' is kept for a future backend that confirms the send.
    download_email_app_opened: 1,
    download_link_copied: 1,
    download_link_shared: 1,
    tutorial_clicked: 1,
    whatsapp_support_clicked: 1,
    language_changed: 1,
    // /start/ funnel (start/app.js). Clicks and screens, never a real order: an order is
    // only real once the visitor sends the WhatsApp message and pays.
    sales_funnel_started: 1,
    sales_funnel_viewed: 1,
    funnel_step_viewed: 1,
    intention_selected: 1,
    trial_selected: 1,
    purchase_selected: 1,
    activity_selected: 1,
    pain_selected: 1,
    device_unsure_clicked: 1,
    device_selected: 1,
    personalized_features_viewed: 1,
    pricing_viewed: 1,
    license_selected: 1,
    quick_course_viewed: 1,
    quick_course_skipped: 1,
    purchase_requested: 1,
    // Funnel v2 (2026-11-27, owner brief section 21). The first names above stay: the GTM
    // triggers use them (start/app.js sends both while the container is not updated).
    funnel_viewed: 1, trial_journey_selected: 1, purchase_journey_selected: 1,
    direct_download_selected: 1, challenges_selected: 1, challenges_skipped: 1, step_viewed: 1,
    step_completed: 1, step_back: 1, recommendation_viewed: 1, offer_viewed: 1, faq_opened: 1,
    video_played: 1, video_completed: 1, download_clicked: 1, checkout_started: 1,
    payment_method_selected: 1, checkout_validation_failed: 1, order_submitted: 1,
    order_submission_failed: 1, whatsapp_clicked: 1, calculator_used: 1
  };
  var PARAMS = [
    'event_id', 'platform', 'page_language', 'tutorial_id', 'tutorial_category',
    'tutorial_position', 'app_version', 'link_type', 'download_trigger', 'method',
    'from_language', 'to_language', 'arrived_via', 'ad_source', 'ad_medium',
    'ad_campaign', 'ad_content', 'ad_term',
    // /start/ funnel. `activity` and `pain` are fixed ids (never the visitor's "other" text).
    'funnel_step', 'step_number', 'intention', 'activity', 'pain', 'selected',
    'pain_count', 'device_count', 'license_type',
    // Funnel v2: fixed values only (never a name, a phone or an address).
    'funnel_version', 'journey', 'pay', 'purpose', 'faq_id', 'video_kind', 'field', 'field_count'
  ];

  function newEventId() {
    if (w.crypto && typeof w.crypto.randomUUID === 'function') return w.crypto.randomUUID();
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function track(name, params) {
    if (!EVENTS[name]) {
      if (debug && w.console) console.warn('[dk-track] unknown event, not sent:', name);
      return;
    }
    // Every key is written on every push. GTM merges pushes, so a key left out would
    // keep the value of the previous event (for example tutorial_id on a download).
    var out = { event: name };
    PARAMS.forEach(function (k) { out[k] = undefined; });
    out.event_id = newEventId();
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
    }
    params = params || {};
    PARAMS.forEach(function (k) {
      if (k === 'event_id') return;
      if (Object.prototype.hasOwnProperty.call(params, k)) out[k] = clean(params[k]);
    });
    w.dataLayer.push(out);
    if (debug && w.console) console.info('[dk-track]', name, out);
  }

  // ---------------------------------------------------------------------------------
  // Consent
  // ---------------------------------------------------------------------------------
  var CONSENT_KEY = 'dk-consent';
  var gtmLoaded = false;

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
    rememberCampaign(c.analytics);
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
    openConsent: showBanner
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})();
