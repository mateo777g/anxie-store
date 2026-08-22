# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Anxie Store — a static storefront for selling game accounts (Fortnite/V-Bucks), backed by Supabase for data and Cloudflare R2 for images. Spanish-language UI and codebase; comments, variable names, and user-facing strings are in Spanish. Keep it that way.

There is no build step, no package manager, no test suite, and no linter. Three hand-written HTML pages plus plain `.css` and `.js` files served as-is. The only server-side component is a Cloudflare Worker (`worker/`) that proxies image uploads/deletes to R2.

## Running locally

Serve over HTTP rather than opening files directly — the Supabase SDK and `sessionStorage` cache behave differently on `file://`:

```sh
python -m http.server 8000    # then http://localhost:8000/index.html
```

A `venv/` exists in the working tree but is untracked and holds nothing project-specific — it's only a convenient Python for the above.

To develop the Worker locally: `cd worker && npx wrangler dev`. This gives you a local R2 binding so uploads go to a local emulated bucket instead of production.

Deploy the storefront = copy the tracked files (everything except `venv/`, `worker/`, and the `_respaldo_*` dirs) to any static host.
Deploy the Worker = `cd worker && npx wrangler deploy`.

## The three pages

| Page | Role | Supabase client |
|---|---|---|
| `index.html` + `style.css` | Landing page: 3D hero, sticky-scroll sections, two "most expensive account" cards | shared anon (`supabase-config.js`) |
| `catalogo.html` + `style.css` + `catalogo.css` | Full catalog grid, sort, search modal, contact modal | shared anon (`supabase-config.js`) |
| `lilshop.html` + `lilshop.css` | Admin panel: login, create/edit/delete accounts, image upload via Worker/R2, stats | **its own** client, created inline |

`catalogo.html` loads `style.css` *before* `catalogo.css` — `style.css` owns the shared nav/sidebar/footer, `catalogo.css` owns catalog-only styles and overrides. Changing shared chrome means checking both pages.

## Data layer

**Database:** One Supabase table, `Cuentas`.

Columns: `id`, `titulo`, `preciomxn`, `preciousd`, `image_url`, `disponibilidad`, `descripcion`, `vbucks`, `created_at`. The public catalog only ever selects the first six plus `created_at`; `descripcion` and `vbucks` are admin-only fields today.

`disponibilidad` is a free-text field that doubles as a platform tag. `renderPlataformasHTML()` in `catalogo.html` regex-matches it for PC / XBOX / PLAY / NINTENDO (including typos like `SWUICH`) and swaps in inline SVG badges; unmatched text is escaped and shown raw. Adding a platform means adding an entry to that `platforms` array.

**Images:** Cloudflare R2 bucket `anxie-store-fotos`, public URL base `https://pub-221a2b6aa265453ea4b027de0d0c4ed4.r2.dev`. All images are WebP, quality 80%, max 1600px on the long side. `image_url` in `Cuentas` stores the full R2 public URL.

**Image uploads/deletes go through the Cloudflare Worker** (`worker/index.js`, deployed at `https://anxie-store-uploads.matthewsantreys13.workers.dev`). The Worker has a native R2 binding (no S3 keys in the browser). `lilshop.html` sends the admin's Supabase Auth `access_token` in the `Authorization` header; the Worker validates it against `SUPABASE_URL/auth/v1/user` and checks the email matches `ADMIN_EMAIL` before touching the bucket. File names are server-generated (`Date.now() + .webp`), and a regex guard (`/^[0-9]+\.webp$/`) blocks path-traversal on delete. There is a 5 MB server-side size limit.

**Legacy:** The Supabase Storage bucket `cuentas-fotos` is no longer used. Images were migrated from it to R2 in August 2026. Local backups of the original PNGs and the intermediate WebP conversions exist in `_respaldo_png_originales/` and `_respaldo_webp_supabase/` (both gitignored).

### Deliberate performance decisions — don't undo them

**1. `persistSession: false` in `supabase-config.js`.** Edge/Safari tracking prevention blocks the CDN-loaded Supabase SDK from writing to `localStorage`. When that write failed, the SDK re-ran full auth init on every page, which produced hundreds of `pg_timezone_names` queries and dominated database time. The three `auth` flags there are the fix; the file's header comment records the whole story. This is why public pages use this shared client and the admin does not — `lilshop.html` needs real, persisted auth, so it builds its own `createClient` with defaults.

**2. The `sessionStorage` cache in `catalog-cache.js`.** `getCatalogData()` serves the catalog from `sessionStorage` key `anxie_catalog_v1` for 5 minutes before hitting Supabase, so navigating index → catalog costs one query instead of two. Every read/write is wrapped in `try/catch` because privacy modes can block the API outright — preserve that.

The cache invariant: **any admin write must clear the cache.** `lilshop.html` does this via `invalidarCacheCatalogo()` after every insert, update, and delete. `clearCatalogCache()` exists in `catalog-cache.js` but that file isn't loaded by the admin page. If you add a write path, call `invalidarCacheCatalogo()` (or `sessionStorage.removeItem('anxie_catalog_v1')` directly) there too, or the public catalog serves stale data for up to 5 minutes.

`index.html` deliberately does *not* use `getCatalogData()`. It reads the same cache key by hand, and on a miss runs a two-row `order + limit` query rather than fetching the whole catalog for two cards. It also subscribes to `postgres_changes` on `Cuentas` for live updates — the only realtime subscription in the project. The realtime handler invalidates the cache and forces a fresh query (bypassing the 5-min TTL).

**3. Client-side WebP conversion in `lilshop.html`.** Images are compressed to WebP 80% quality and capped at 1600px on the longest side *before* upload, using `<canvas>`. This keeps R2 storage and egress low. The Worker also enforces a 5 MB server-side limit as a safety net.

**4. Orphan prevention in `lilshop.html`.** If a new image is uploaded to R2 but the subsequent Supabase insert/update fails, the image is immediately deleted from R2 to avoid orphans. When editing with a new image, the old image is deleted from R2 only *after* the database update succeeds. When deleting a cuenta, the database row is deleted first, then the R2 image.

## 3D viewers

`index.html` uses both `<spline-viewer>` (five scenes, from unpkg) and `<model-viewer>` (`assets/chanti.glb`); `catalogo.html` uses `<spline-viewer>` only. Both pages duplicate two functions verbatim, `limpiarSplineViewer()` and `ocultarLogosSpline()`, which inject a `display:none` stylesheet into each viewer's shadow root and run a `MutationObserver` to keep the Spline watermark hidden as the component re-renders. Edits to that logic need to be applied in both files.

Both pages also stop `wheel` events on `spline-viewer` at capture phase so 3D scenes don't hijack page scroll.

## Conventions worth matching

- Scripts are inline `<script>` blocks at the bottom of each HTML file; only `supabase-config.js` and `catalog-cache.js` are extracted, and they must load in that order (the cache module references `_supabase`).
- Rendering is string-template `innerHTML` assignment. All user-facing values (`titulo`, `disponibilidad`, `image_url`, etc.) are passed through `escapeHTML()` before insertion — each page has its own copy of this function. Maintain this when adding new `innerHTML` writes.
- Section headers use the `/* ====== TITLE ====== */` banner style in CSS and emoji-prefixed comments in JS.
- Status messages in `lilshop.html` use a single floating toast (`#toast`, via `mostrarMensaje(texto, tipo)`). Don't mix `alert()` back in.
- Mobile is handled with `@media (max-width: 900px)` blocks throughout, plus a separate hamburger sidebar (`#sidebar`, `#sidebarOverlay`). Several commits in the history are mobile-only fixes; check phone layout after touching shared chrome.

## Worker (`worker/`)

| File | Purpose |
|---|---|
| `wrangler.toml` | Config: worker name, R2 binding `FOTOS`, env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_EMAIL`, `R2_PUBLIC_BASE`) |
| `index.js` | Two endpoints: `POST /upload` (receives raw WebP body, returns `{ ok, fileName, url }`), `DELETE /delete?file=<name>` (returns `{ ok }`) |

Deploy: `cd worker && npx wrangler deploy`. Requires `wrangler login` (OAuth) or a `CLOUDFLARE_API_TOKEN` env var.
