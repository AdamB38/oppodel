# Funnel tracking — drop-in template

Copy `oq-track.js` into a build, add one script tag, add three one-liners, done.
Every quote form then reports where customers get to and where they leave.

---

## 1. Add the script

Put `oq-track.js` somewhere the page can reach, then:

```html
<script src="/track/oq-track.js"
        data-site="clientname"
        data-endpoint="https://oppodel.com/.netlify/functions/collect"
        defer></script>
```

- **`data-site`** — a short slug per client. This is how the numbers get
  separated in the dashboard, so make it unique and keep it stable.
- **`data-endpoint`** — leave pointing at oppodel.com so everything lands in
  one place, wherever the client's site is hosted.
- Add `data-debug="true"` while wiring it up to see events in the console.

That alone gives you sessions, traffic source, device, time on page, form
submissions, and an exit event. The rest needs three calls.

---

## 2. Mark the funnel

Find wherever the build moves the customer forward and add:

```js
OQ.step(2, 'services');                              // reached a step
OQ.price({ service: 'window', price: 26 });          // a price was shown
OQ.lead({ service: 'window', price: 26 });           // they submitted
```

`OQ.lead()` fires automatically on any `<form>` submit, so you often don't
need to call it by hand. Add `data-oq-ignore` to a form to exclude it.

Step indexes should climb (0, 1, 2…) — that's what builds the funnel. The
name is only for reading the dashboard.

### Typical wiring

Most of these builds have one function that changes step. Hook that:

```js
function goStep(n) {
  // ...existing code...
  if (window.OQ) OQ.step(n, STEP_NAMES[n]);
}
```

And wherever the total is rendered:

```js
if (window.OQ) OQ.price({ service: sv.id, price: total, config: sv.detail(state) });
```

---

## 3. Prompt for a new build

Paste this into a Claude Code chat along with `oq-track.js`:

> Add funnel tracking to this quote form using the attached `oq-track.js`.
> Include the script with `data-site="CLIENTSLUG"` and
> `data-endpoint="https://oppodel.com/.netlify/functions/collect"`.
> Call `OQ.step(index, name)` wherever the wizard advances, `OQ.price({service, price, config})`
> wherever a price is displayed, and let form submits fire `OQ.lead()` automatically.
> Send no personal data — no names, emails, phone numbers, postcodes or free text.

---

## What gets stored

Per session: a random id that dies with the tab, the step reached, prices
shown, whether they converted, device class, coarse traffic source, country
code, and seconds on page.

**No personal data, no cookies, no cross-site identifiers.** The session id is
in `sessionStorage`, not a cookie, and it isn't linked to anything that could
identify a person. `navigator.doNotTrack` disables it entirely.

This keeps it well clear of the messy end of UK GDPR and PECR — but it is the
client's data about the client's customers, so:

- tell the client it's there and what it collects;
- put a line in their privacy notice;
- put it in the contract if you intend to use aggregated patterns across
  clients to inform pricing.

Adding names or emails to it changes that picture completely. Don't, unless
you've dealt with the consent side properly.

---

## Performance

- ~4 KB, no dependencies, loaded `defer` — never blocks rendering.
- Events are queued and sent in batches (on a 2s idle timer, or when 12 pile
  up), not one request per click.
- Sends use `sendBeacon` / `fetch(keepalive)` — fire-and-forget, off the
  critical path, and they survive the tab closing.
- Nothing is awaited. A form submit never waits on tracking.
- If the endpoint is slow, down, or blocked, failures are swallowed and the
  page behaves exactly as if tracking weren't there.

---

## Viewing the numbers

`https://oppodel.com/stats.html` — enter the token, pick a site and period.

Set `STATS_TOKEN` in Netlify under **Site settings → Environment variables**.
Anyone with that token can read every site's numbers, so treat it as a
password and don't hand it to clients. If you want to show a client their own
figures, screenshot it or export a summary rather than sharing the token.

---

## Changing where data lands

The client script only POSTs JSON to a URL — it knows nothing about storage.
To move off Netlify Blobs (to Postgres, Supabase, a spreadsheet, anything),
change the `store.setJSON` call in `netlify/functions/collect.js` and the read
in `stats.js`. No client changes, no redeploys of client sites.

### Payload shape

```json
{
  "ctx": {
    "site": "brightside", "sid": "m8x2...", "path": "/quote",
    "device": "mobile", "framed": false,
    "source": { "utm": { "source": "google-ads" }, "referrer": "google.com" }
  },
  "events": [
    { "t": "view",  "at": 0,     "d": {} },
    { "t": "step",  "at": 4210,  "d": { "i": 1, "name": "services" } },
    { "t": "price", "at": 18400, "d": { "service": "window", "price": 26, "config": "3 bed semi · 4-weekly" } },
    { "t": "lead",  "at": 25100, "d": { "service": "window", "price": 26, "step": 4 } },
    { "t": "exit",  "at": 26000, "d": { "step": 4, "converted": true, "seconds": 26 } }
  ]
}
```
