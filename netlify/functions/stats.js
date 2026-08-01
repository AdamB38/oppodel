/*
  stats.js — aggregates stored events into a funnel.

  Protected by a shared token. Set STATS_TOKEN in Netlify:
    Site settings -> Environment variables -> STATS_TOKEN

  GET /.netlify/functions/stats?site=brightside&days=30&token=...
*/
import { getStore } from '@netlify/blobs';

const MAX_BLOBS = 4000;   // plenty at this scale; stops a runaway read

function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default async (request) => {
  const url    = new URL(request.url);
  const token  = url.searchParams.get('token') || '';
  const expect = process.env.STATS_TOKEN || '';

  if (!expect)      return reply(500, { error: 'STATS_TOKEN is not configured on the site' });
  if (token !== expect) return reply(401, { error: 'bad token' });

  const site = (url.searchParams.get('site') || '').replace(/[^a-z0-9_-]/gi, '');
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));

  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  let blobs = [];
  try {
    const store = getStore('oq-events');
    const res   = await store.list({ prefix: site ? `${site}/` : '' });
    blobs = (res.blobs || [])
      .filter(b => {
        const parts = b.key.split('/');          // site/date/file
        return parts.length >= 3 && parts[1] >= since;
      })
      .slice(0, MAX_BLOBS);

    const store2 = store;
    const records = await Promise.all(
      blobs.map(b => store2.get(b.key, { type: 'json' }).catch(() => null))
    );
    return reply(200, aggregate(records.filter(Boolean), days));
  } catch (err) {
    console.error('[stats] failed', err);
    return reply(500, { error: 'read failed' });
  }
};

function aggregate(records, days) {
  const sessions  = new Map();   // sid -> rolled-up session
  const sites     = new Set();
  const stepNames = new Map();   // step index -> readable name, from any session

  for (const r of records) {
    if (!r || !r.sid) continue;
    sites.add(r.site);

    let s = sessions.get(r.sid);
    if (!s) {
      s = {
        site: r.site, device: r.device, country: r.country,
        source: sourceLabel(r.source), day: (r.receivedAt || '').slice(0, 10),
        maxStep: 0, maxStepName: null, priced: false, lead: false,
        service: null, price: null, seconds: 0, steps: new Set()
      };
      sessions.set(r.sid, s);
    }

    for (const e of (r.events || [])) {
      if (e.t === 'step') {
        const i = Number(e.d?.i) || 0;
        s.steps.add(i);
        if (e.d?.name && !stepNames.has(i)) stepNames.set(i, e.d.name);
        if (i >= s.maxStep) { s.maxStep = i; s.maxStepName = e.d?.name || String(i); }
      } else if (e.t === 'price') {
        s.priced  = true;
        /* the priced service is the interesting one — a later lead label
           shouldn't overwrite what they actually configured */
        s.service = e.d?.service || s.service;
        if (e.d?.price != null) s.price = Number(e.d.price);
      } else if (e.t === 'lead') {
        s.lead    = true;
        if (!s.service) s.service = e.d?.service || null;
        if (s.price == null && e.d?.price != null) s.price = Number(e.d.price);
      } else if (e.t === 'exit') {
        s.seconds = Math.max(s.seconds, Number(e.d?.seconds) || 0);
        if (e.d?.converted) s.lead = true;
      }
    }
  }

  const all   = [...sessions.values()];
  const total = all.length;

  /* funnel: how many sessions reached each step index */
  const maxIdx = all.reduce((m, s) => Math.max(m, s.maxStep), 0);
  const funnel = [];
  for (let i = 0; i <= maxIdx; i++) {
    const reached = all.filter(s => s.steps.has(i) || s.maxStep >= i).length;
    funnel.push({
      step: i,
      name: stepNames.get(i) || `Step ${i}`,
      reached,
      pct: total ? Math.round((reached / total) * 1000) / 10 : 0
    });
  }
  /* drop-off between consecutive steps */
  funnel.forEach((f, i) => {
    const prev = funnel[i - 1];
    f.dropFromPrev = prev && prev.reached
      ? Math.round(((prev.reached - f.reached) / prev.reached) * 1000) / 10
      : 0;
  });

  const leads  = all.filter(s => s.lead);
  const priced = all.filter(s => s.priced);
  const prices = priced.map(s => s.price).filter(p => typeof p === 'number' && !isNaN(p));

  return {
    generatedAt: new Date().toISOString(),
    days,
    sites: [...sites],
    totals: {
      sessions:   total,
      reachedPrice: priced.length,
      leads:      leads.length,
      quoteRate:  total ? pct(priced.length / total) : 0,   // got as far as a price
      leadRate:   total ? pct(leads.length / total) : 0,    // submitted
      closeRate:  priced.length ? pct(leads.length / priced.length) : 0,
      medianPrice: median(prices),
      medianSeconds: median(all.map(s => s.seconds).filter(Boolean))
    },
    funnel,
    byDevice:  group(all, s => s.device || 'unknown'),
    bySource:  group(all, s => s.source),
    byService: group(priced, s => s.service || 'unspecified'),
    byDay:     group(all, s => s.day || 'unknown'),
    priceBands: bands(all)
  };
}

function pct(n) { return Math.round(n * 1000) / 10; }

function sourceLabel(src) {
  if (!src) return 'direct';
  if (src.utm && src.utm.source) return String(src.utm.source);
  if (src.referrer) return String(src.referrer);
  return 'direct';
}

function group(list, keyFn) {
  const m = new Map();
  for (const s of list) {
    const k = keyFn(s);
    const e = m.get(k) || { key: k, sessions: 0, leads: 0 };
    e.sessions++;
    if (s.lead) e.leads++;
    m.set(k, e);
  }
  return [...m.values()]
    .map(e => ({ ...e, leadRate: e.sessions ? pct(e.leads / e.sessions) : 0 }))
    .sort((a, b) => b.sessions - a.sessions);
}

/* Does conversion fall off as the quoted price rises? */
function bands(all) {
  const withPrice = all.filter(s => typeof s.price === 'number' && !isNaN(s.price));
  if (withPrice.length < 4) return [];
  const edges = [0, 25, 50, 100, 200, 400, Infinity];
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i], hi = edges[i + 1];
    const inBand = withPrice.filter(s => s.price >= lo && s.price < hi);
    if (!inBand.length) continue;
    const leads = inBand.filter(s => s.lead).length;
    out.push({
      key: hi === Infinity ? `£${lo}+` : `£${lo}–${hi}`,
      sessions: inBand.length,
      leads,
      leadRate: pct(leads / inBand.length)
    });
  }
  return out;
}

function median(nums) {
  const a = nums.filter(n => typeof n === 'number' && !isNaN(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

export const config = { path: '/.netlify/functions/stats' };
