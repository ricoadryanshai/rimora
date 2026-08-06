# Make Chapter Separator a full PWA

Goal: installable, offline-capable, auto-updating app that feels native on phone and desktop, without breaking the Lovable preview.

## What you'll get

- Install to home screen / desktop on Android, iOS, Windows, macOS (already partly working — manifest exists).
- App loads with no internet: shell, styles, fonts, icons, and your last saved chapter text + glossary session (kept in local storage today).
- Anything needing the server (URL import, cloud glossary sync, sign-in) shows a clear offline notice instead of failing silently; sync resumes automatically when back online.
- New versions install in the background; a small "Update available — Reload" toast appears when a fresh build is ready.
- Faster first load through route/component code splitting and image/icon cleanup.
- Accessibility and SEO pass: real page title and description, labelled icon-only buttons, correct heading order.

Push notifications and background sync are skipped per your choice (no event currently triggers a notification).

## Scope of changes

1. **Service worker (offline)** — add `vite-plugin-pwa` in generateSW mode: network-first for page navigations, cache-first for hashed build assets, `/~oauth` excluded. Registered only from a single guarded wrapper that refuses to register in dev, in an iframe, and on Lovable preview hosts, and supports `?sw=off` as a kill switch.
2. **Update flow** — `registerType: autoUpdate` plus a toast prompting reload when a new service worker takes control.
3. **Manifest polish** — keep the existing name/icons/theme, add `id`, maskable icon variants, `lang`, `categories`, and screenshots so Android/desktop show a proper install card and splash screen.
4. **Offline awareness in the UI** — reuse the existing offline banner; disable/annotate the URL import, Google Sheets import, and cloud-sync actions while offline, and retry queued auto-save once the connection returns.
5. **Performance** — lazy-load the Auth and NotFound routes and the heavier glossary/CSV panels with Suspense fallbacks using the existing skeleton components; memoize the card list rendering in `Index.tsx` (1127 lines, all eagerly loaded today).
6. **Accessibility / SEO** — replace the placeholder `<title>`/`<meta description>`/OG tags in `index.html` with real app copy, add `aria-label`s to icon-only buttons (theme toggle, share, copy, scroll-to-top), and verify contrast on the monochrome tokens.

## Technical notes

- `vite-plugin-pwa` with `injectRegister: null`, `devOptions.enabled: false`, SW served at `/sw.js`.
- Runtime caching: `NetworkFirst` for navigations, `CacheFirst` (expiring) for same-origin hashed assets and icons; Supabase API calls are not cached.
- Registration wrapper lives in `src/lib/pwa.ts`, called once from `src/main.tsx`.
- Offline behaviour is verifiable only in the published app, not in the editor preview iframe.
- HTTPS is already provided by Lovable hosting; no work needed there.
