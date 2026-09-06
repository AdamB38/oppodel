# Quotal website (quotal.org)

**Before any work, read the master business context: `D:\Quotal\App\QUOTAL-CONTEXT.md`.**
That file is the single source of truth shared with the app project (`D:\Quotal\App`).
If a decision made in this chat affects the business or the app, record it there and
bump its "Last updated" date — that is how the two workstreams stay in sync.

Rules specific to this repo:

- Static site, no build step. Push to `main` → Netlify deploys quotal.org.
- **The website is the professional company face.** The weekly content series and all
  personable content live on social channels only — never add them here (decided 6 Sep 2026).
- **Two routes on the homepage** (decided 6 Sep 2026): done-for-you (raised, live product)
  beside the software. The software appears **only as a 2027 waitlist — never a price,
  never "buy now"** — so it can't undercut the bespoke pitch during a season.
- **Traffic is warm** (decided 6 Sep 2026): visitors arrive from value content — short form,
  case studies, tutorials — and already know Adam. Pages assume familiarity: explain less,
  route to the two ways of working faster. Don't rewrite heroes for cold traffic.
- **High end is project work.** No retainer on either tier; ongoing help is a post-project
  conversation or the client moves onto the software.
- No prices on the site; figures are given on the 15-minute call.
- Brand: light theme only, tokens in `css/quotal.css`. Filament `#F2A93C` is fill-only —
  amber as text is `#8A5510`. Voice is "I", not "we". Never promise a cost per lead.
- The lead form is named `founders` on BOTH the home and pricing pages. Netlify builds
  ONE schema per form name, from the homepage markup: any field added to the pricing
  form MUST be mirrored as a hidden input on the homepage form, or it is silently
  dropped from Netlify and Zapier. This has bitten before.
- Form submits: the Cloudflare worker is the primary capture; Netlify Forms is the
  backup and must POST with `keepalive: true`, because the redirect to `/thank-you/`
  kills a normal in-flight fetch.
