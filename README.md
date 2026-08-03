# Wedd Book 婚礼小册

A small web app for wedding guests — 26–28 September 2026, Guiyang → Qianxi, Guizhou.

Instead of a ceremony, the couple is hosting a three-day trip. This app carries the
itinerary, an icebreaker bingo game, a blind "disposable camera", and a gallery that
opens when the couple decides.

## Where this is now

**All five committed features are built and deployed.** Identity, itinerary, blind
camera, bingo and gallery. What remains is content, hardening and a rehearsal.

Outstanding:

1. **Pending migrations on production.** `supabase db push` applies them, but the
   database ports are blocked on some networks — tether to a phone, or paste the files
   in `supabase/migrations/` into the SQL Editor in filename order. Until then the
   camera preview toggle and the gallery will error.
2. **Workers Builds is not activating deployments.** Assets upload, but the deployment
   never goes live, so `npm run deploy` is currently the only working path. The prime
   suspect is the reused API token — it likely lacks Workers Scripts: Edit. This needs
   fixing before the 26th; a manual deploy can't be the arrangement on the day.
3. **Blind capture is verified on real hardware**, including orientation on both iOS and
   Android, which took several rounds. Re-test after any change to `captureFrame`.

### Local development

`npm run dev` talks to the local Docker stack, not production, because
`.env.development.local` overrides `.env.local` in dev. That keeps testing from burning
real invite codes. To create a local admin fixture after `npm run db:reset`, add a user
via the local Auth admin API and insert them into `admin_profiles`.

### Build phases

Guests start using the app on **26 September**, so the ship date is **~20 September**.

| # | Window | Scope | Status |
|---|---|---|---|
| 0 | Aug 1–7 | Scaffold, schema, RLS, RPCs, verification harness | ✅ done |
| 1 | Aug 8–14 | Identity: redeem flow, admin auth, guest CRUD, printable QR sheet | ✅ done |
| 2 | Aug 15–24 | Programme: public, offline, seeded with the real itinerary | ✅ done |
| 3 | Aug 25–Sep 5 | Camera: blind capture, compression, IndexedDB queue, quota UI | ✅ done |
| 4 | Sep 6–11 | Bingo: per-guest private answers, replace flow, review-night view | ✅ done |
| 5 | Sep 12–16 | Gallery: reveal, signed thumbnails, anonymity toggle | ✅ done |
| 6 | Sep 12–16 | Custom domains live (~Sep 7); optional extras only if the above is signed off | |
| 7 | Sep 17–20 | Freeze: real-device tests in-region, Supabase Pro, rehearsal | |

Programme ships early on purpose — it's the only feature with value *before* the trip,
and it doubles as a real China-reachability test seven weeks out instead of on the day.

Priorities if time gets tight: the five features in the table above are the commitment.
The slideshow, bulk-export UI and guestbook are droppable, in that order.

### Still needed from the couple

- Logo and brand images → `public/brand/` (the palette is provisional until then)
- Programme photos → `public/program/`
- The guest list (~20 names), to generate invite codes and the QR sheet
- Qianxi banquet hotel name and address
- Exact reveal times — bingo review ≈ 27 Sep afternoon, disposable reveal ≈ after the
  banquet on the 28th. Both are editable in the admin panel, so neither blocks anything.

## What it does

| Feature | Notes |
|---|---|
| **Itinerary** | Public — no invite code, works offline, readable in WeChat |
| **Invite codes** | 3-character code redeemed onto a Supabase anonymous session |
| **Disposable camera** | Truly blind: no viewfinder, and you never see your own shots until reveal |
| **Daily quota** | 20 credits/guest/day. In-app capture costs 1, camera-roll upload costs 2 |
| **Bingo** | 16 shared prompts, one private answer per guest per question, quota-free |
| **Review night** | The couple opens everyone's bingo answers, browsed question by question |
| **Gallery** | Admin-controlled reveal, per-photo named or anonymous |

## Constraints that shape the code

Guests are on mainland-China mobile networks, so three rules hold everywhere:

1. **No third-party CDNs.** Google Fonts is blocked and will hang page load until timeout.
   Fonts, icons and libraries are bundled or self-hosted.
2. **No CJK webfont.** Chinese font files are 3–10 MB — Chinese text uses the system stack.
3. **No Google Maps.** Also blocked. Programme links use Amap (高德) or Baidu.

There is no signal inside Zhijin Cave, and venue Wi-Fi may collapse entirely. Photos are
therefore queued in IndexedDB and uploaded opportunistically — guests keep shooting and
everything syncs later, even after they get home.

## Stack

Vite + React + TypeScript + Tailwind, built static and served from Cloudflare Pages.
Supabase (Tokyo region) for Postgres, Auth and Storage.

**No Edge Functions.** Every privileged operation is a Postgres `SECURITY DEFINER`
function called via `supabase.rpc()`, which keeps cold starts off the critical path.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in from the Supabase dashboard
supabase start               # local Postgres + Auth + Storage (needs Docker)
npm run db:reset             # apply migrations and seed
npm run dev
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type-check and build |
| `npm run db:reset` | Recreate the local database from migrations + seed |
| `npm run types:gen` | Regenerate `src/lib/database.types.ts` from the local schema |
| `npm run verify` | Security checks against the local stack — see below |

## Verification

`npm run verify` exercises the properties that cannot be wrong on the day: the daily
quota under concurrency, blind mode at both the row and byte level, bingo answers staying
private until review night, and the fact that guests cannot write to any table directly.

Run it after any change to the schema, RLS policies, or the RPCs. It needs a running
local stack (`supabase start && npm run db:reset`).

## Layout

```
src/
  i18n/         bilingual strings and the locale context
  lib/          supabase client, generated DB types, UA detection
  components/   layout, language toggle, WeChat guard
  pages/        guest screens
  admin/        the couple's panel — one lazy chunk, never shipped to guests
supabase/
  migrations/   schema, then functions + RLS
  seed.sql      the 16 bingo prompts and the three days
scripts/
  verify-rls.mjs
```
