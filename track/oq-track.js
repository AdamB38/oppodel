/*
  oq-track.js — drop-in funnel tracking for quote forms.
  ---------------------------------------------------------------------------
  Add one line to any build and you get: page views, step-by-step drop-off,
  prices shown, and lead submissions.

    <script src="/track/oq-track.js"
            data-site="brightside"
            data-endpoint="/.netlify/functions/collect" defer></script>

  Then mark up the funnel with three one-liners wherever the build moves
  the customer along:

    OQ.step(2, 'services');                       // customer reached a step
    OQ.price({ service:'window', price:26 });     // a price was shown
    OQ.lead();                                    // they submitted

  Everything else is automatic — session id, traffic source, device, time on
  page, and an exit event recording how far they got before leaving.

  PRIVACY: this deliberately sends NO personal data. No names, emails, phone
  numbers, postcodes or free text — only which step was reached and what the
  quote was for. Don't add PII to it without a lawful basis and a privacy
  notice that covers it. There are no cookies; the session id lives in
  sessionStorage and dies with the tab.

  PERFORMANCE: events are queued and flushed in batches, out of band. Nothing
  here blocks rendering, and nothing blocks a form submit. If the endpoint is
  slow or down, the page is unaffected.
*/
(function () {
  'use strict';

  /* ---------- config ---------- */
  var el  = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();

  var cfg = window.OQ_CONFIG || {};
  var SITE     = cfg.site     || (el && el.getAttribute('data-site'))     || 'unknown';
  var ENDPOINT = cfg.endpoint || (el && el.getAttribute('data-endpoint')) || '';
  var DEBUG    = cfg.debug    || (el && el.getAttribute('data-debug') === 'true');

  if (!ENDPOINT) {
    if (DEBUG) console.warn('[oq] no endpoint set — tracking disabled');
    return;
  }

  /* Respect the browser's do-not-track signal. */
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') {
    window.OQ = { step: noop, price: noop, lead: noop, event: noop, disabled: true };
    if (DEBUG) console.info('[oq] DNT set — tracking disabled');
    return;
  }

  function noop() {}

  /* ---------- session ---------- */
  function rand() {
    return Math.random().toString(36).slice(2, 10);
  }

  var sid;
  try {
    sid = sessionStorage.getItem('oq_sid');
    if (!sid) {
      sid = Date.now().toString(36) + rand();
      sessionStorage.setItem('oq_sid', sid);
    }
  } catch (e) {
    sid = Date.now().toString(36) + rand();   // private mode / storage blocked
  }

  var startedAt   = Date.now();
  var maxStep     = 0;      // furthest step index reached
  var maxStepName = null;
  var lastPrice   = null;
  var converted   = false;

  /* ---------- context (sent once, on the first event) ---------- */
  function source() {
    var q = new URLSearchParams(location.search);
    var utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      var v = q.get(k);
      if (v) utm[k.replace('utm_', '')] = v.slice(0, 60);
    });
    if (q.get('gclid')) utm.source = utm.source || 'google-ads';
    if (q.get('fbclid')) utm.source = utm.source || 'facebook';

    var ref = '';
    try {
      ref = document.referrer ? new URL(document.referrer).hostname : '';
    } catch (e) {}
    if (ref === location.hostname) ref = '';   // internal navigation isn't a source

    return { utm: utm, referrer: ref };
  }

  function device() {
    var w = window.innerWidth || 0;
    return w < 640 ? 'mobile' : (w < 1024 ? 'tablet' : 'desktop');
  }

  var ctx = {
    site:    SITE,
    sid:     sid,
    path:    location.pathname.slice(0, 120),
    device:  device(),
    source:  source(),
    framed:  window.self !== window.top
  };

  /* ---------- queue ---------- */
  var queue = [];
  var timer = null;
  var MAX_BATCH = 12;
  var IDLE_MS   = 2000;

  function push(type, data) {
    queue.push({
      t:  type,
      at: Date.now() - startedAt,   // ms since page load, not a wall clock
      d:  data || {}
    });
    if (DEBUG) console.info('[oq]', type, data || '');
    if (queue.length >= MAX_BATCH) return flush();
    clearTimeout(timer);
    timer = setTimeout(flush, IDLE_MS);
  }

  function flush(useBeacon) {
    clearTimeout(timer);
    if (!queue.length) return;

    var body = JSON.stringify({ ctx: ctx, events: queue, ts: Date.now() });
    queue = [];

    /* sendBeacon survives the page being closed and never blocks. */
    if (useBeacon && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
        return;
      } catch (e) { /* fall through to fetch */ }
    }

    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        mode: 'cors'
      }).catch(noop);           // failures are silent by design
    } catch (e) { /* nothing we can or should do */ }
  }

  /* ---------- automatic events ---------- */
  push('view', {});

  /* Any form submit counts as a lead unless it opted out with data-oq-ignore. */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.hasAttribute('data-oq-ignore')) return;
    api.lead({ form: f.getAttribute('name') || f.id || 'form' });
  }, true);

  /* One exit event per session, flushed with the page. */
  var exited = false;
  function exit() {
    if (exited) return;
    exited = true;
    push('exit', {
      step:      maxStep,
      stepName:  maxStepName,
      price:     lastPrice,
      converted: converted,
      seconds:   Math.round((Date.now() - startedAt) / 1000)
    });
    flush(true);
  }

  window.addEventListener('pagehide', exit);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });

  /* ---------- public api ---------- */
  var api = {
    /* Customer reached a step. index should climb; name is for reading. */
    step: function (index, name) {
      index = Number(index) || 0;
      if (index > maxStep) { maxStep = index; maxStepName = name || String(index); }
      push('step', { i: index, name: name || String(index) });
    },

    /* A price was shown. Keep `config` short and free of personal data. */
    price: function (o) {
      o = o || {};
      lastPrice = o.price != null ? Number(o.price) : null;
      push('price', {
        service: o.service || null,
        price:   lastPrice,
        config:  o.config ? String(o.config).slice(0, 120) : null
      });
    },

    /* They submitted / booked. No personal details — just the fact of it. */
    lead: function (o) {
      if (converted) return;      // once per session
      converted = true;
      o = o || {};
      push('lead', {
        service: o.service || null,
        price:   o.price != null ? Number(o.price) : lastPrice,
        step:    maxStep
      });
      flush();                    // send promptly; still doesn't block the submit
    },

    /* Anything else worth counting. */
    event: function (name, data) { push(String(name).slice(0, 40), data); },

    flush: function () { flush(); }
  };

  window.OQ = api;
})();
