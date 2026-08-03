# Programme images

Photos referenced by `program_items.image_paths`, e.g. `/program/batik-after.jpg`.

They live here rather than in Supabase Storage on purpose: they are few and
static, so Cloudflare serves them and the service worker precaches them. That
is what lets the itinerary render — photos included — on the road to Qianxi
and inside Zhijin Cave, where there is no signal at all.

Still needed from the couple:

| Suggested filename        | Shot                              |
|---------------------------|-----------------------------------|
| `batik-before.jpg`        | Batik cloth before dyeing         |
| `batik-after.jpg`         | The finished piece                |
| `qingyun-market.jpg`      | Qingyun night market              |
| `zhijin-cave.jpg`         | Inside Zhijin Cave                |
| `zhijin-canyon-boat.jpg`  | The canyon boat trip              |
| `dafuba.jpg`              | Dafuba street food                |

Compress before committing — aim for under ~300 KB each, longest edge ~1600px.
Then add the paths to the relevant row's `image_paths` in `supabase/seed.sql`.
