# Assets needed to finish quotal.org

Every placeholder panel on the site is listed here with the file that replaces it.
Placeholders are live on purpose (decided 6 Sep 2026) so the layout can be judged
before the assets exist. Replace, don't add: each `.ph` panel becomes an `<img>` or
`<video>` of the same aspect ratio.

Brand rules for every asset: light, warm, real. No stock photography of generic
houses, no corporate smiles, no filters. Amber `#F2A93C` only as an accent, never
as text. Faces and hands beat renders.

## Photos (you, your work)

| Slot | Page / section | Spec | What it should show |
|---|---|---|---|
| Portrait | Home — who builds it | **4:5**, ≥1600px tall | You on a ladder, by the van, or mid-install. Not a headshot. Daylight. |
| Done-for-you header | Home — routes, left panel | **16:9**, ≥1600px wide | A finished install at dusk, or your crew on site. Real job, your business. |
| Booked job | Home — chain, stage 03 | **3:2**, ≥1200px wide | A phone in a hand showing the lead notification / quote landing. Shoot it, don't mock it. |
| Ad creative | Pricing — traffic starter kit | **1:1**, 1080×1080 | A lit house at dusk, or a phone with the quote page held up against one. Becomes the image inside the ad mockup. |

## Screenshots (the product)

| Slot | Page / section | Spec | What it should show |
|---|---|---|---|
| Ad in the feed | Home — chain, stage 01 | **3:2** | A real Facebook feed with your ad in it, homeowner-facing copy visible. |
| Drawing the lights | Home — chain, stage 02 | **3:2** | The demo mid-draw — roofline run half-drawn, price visible. Crop tight. |
| Lead inbox | Home — routes, right panel | **16:9** | The software's lead inbox once it exists. Until then, leave the panel. |

## Video

| Slot | Page / section | Spec | Notes |
|---|---|---|---|
| Demo loop | Home hero + pricing main build | **16:9 mp4, 8–12s, silent, loops** | Roofline drawn, price ticks up, render appears. Win+Alt+R over the live demo. The single highest-value asset on the site. |
| Homepage VSL | Home hero | 16:9, YouTube | Exists (EJKc-09czHU). Re-cut to ≤90s if you re-shoot; content viewers have seen the long version. |
| Thank-you VSL | Thank-you page | 16:9, YouTube | Exists (8cYTTJxndv0). Says "thirty minutes" — the call is fifteen. |
| Case-study videos ×3 | Home — case studies | **4:5, 20–45s, captioned** | Client on camera (Roofle style): what they do, what changed, one number. Replaces the typographic poster; the status line becomes the number. |

## Case-study results

For each of MKM Exteriors, JamBikes, Keltic Grounds: one headline number with a
unit and a time span ("41 quotes in 30 days", "first $2,400 job in week two").
Nothing goes on the page until it's real. Keltic Grounds stays labelled "my own
business".

## Identity files

| Item | Spec | Why |
|---|---|---|
| Logo mark + wordmark | SVG (have), plus PNG @2x on transparent | Footer, favicon set, third-party listings. |
| Favicon set | 32/180/512px PNG + `site.webmanifest` | The tab icon is currently the default. Small, but every "professional" site has one. |
| Open Graph image | **1200×630** PNG, brand ground, wordmark + one line | What shows when a link is pasted into iMessage, Slack, Facebook. Currently none. |
| Client logos ×3 | SVG or 800px PNG, mono-friendly | Only once each client has agreed to be named. |

## Not assets, but on the same list

- Social channel links for the footer (once channels exist).
- The series name (stays off the site; needed for the channels).
- Real numbers for the hidden proof strip: quotes generated, jobs booked, seconds to a price, metros live.
