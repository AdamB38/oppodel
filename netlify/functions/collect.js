/*
  collect.js — receives batches from oq-track.js and stores them.

  Storage is Netlify Blobs: one blob per request, keyed by site and date, so
  concurrent writes can never clobber each other. Swapping this for Postgres
  or anything else means changing only the `store.set` call below — the
  client script neither knows nor cares where events land.
*/
import { getStore } from '@netlify/blobs';

const MAX_BODY = 64 * 1024;   // a batch should be a couple of KB; reject silly payloads

function reply(status, body) {
  /* 204/304 must have a null body — passing even an empty string throws. */
  const payload = body == null ? null : JSON.stringify(body);
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store'
  };
  if (payload !== null) headers['Content-Type'] = 'application/json';
  return new Response(payload, { status, headers });
}

export default async (request) => {
  if (request.method === 'OPTIONS') return reply(204);
  if (request.method !== 'POST')    return reply(405, { error: 'POST only' });

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, { error: 'too large' });
    payload = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'bad json' });
  }

  const ctx    = payload?.ctx || {};
  const events = Array.isArray(payload?.events) ? payload.events.slice(0, 50) : [];
  if (!events.length) return reply(204);

  const site = String(ctx.site || 'unknown').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'unknown';
  const now  = new Date();
  const day  = now.toISOString().slice(0, 10);          // YYYY-MM-DD

  /* Country comes free from Netlify's edge; it's coarse enough not to identify
     anyone, and useful for spotting where traffic is actually coming from. */
  const country = request.headers.get('x-nf-geo')
    ? (() => { try { return JSON.parse(request.headers.get('x-nf-geo'))?.country?.code || null; } catch { return null; } })()
    : null;

  const record = {
    site,
    sid:      String(ctx.sid || '').slice(0, 40),
    path:     String(ctx.path || '').slice(0, 120),
    device:   ctx.device || null,
    framed:   !!ctx.framed,
    source:   ctx.source || {},
    country,
    receivedAt: now.toISOString(),
    events
  };

  try {
    const store = getStore('oq-events');
    const key   = `${site}/${day}/${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    await store.setJSON(key, record);
  } catch (err) {
    /* Never surface storage problems to the customer's browser. */
    console.error('[collect] store failed', err);
    return reply(204);
  }

  return reply(204);
};

export const config = { path: '/.netlify/functions/collect' };
