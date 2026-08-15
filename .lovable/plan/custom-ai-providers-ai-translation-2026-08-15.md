# Custom AI Providers + AI Translation

## What you get

**1. AI Providers manager (new sidebar button)**
A new "AI Providers" item in the sidebar opens a manager panel where you can:
- Add a provider: Display Name, API URL (`https://api.xxx.ai/v1`), API Key (`sk-...`).
- Add one or more models under a provider: Model ID (`gpt-5.5`) + Display Name (`GPT-5.5`), organized into named groups you create (e.g. "Fast", "High quality").
- Edit/delete providers, models and groups.
- Pick the active model from any provider via a single selector; if a call fails, you can switch provider in one tap and retry.

API keys are encrypted before they are stored and are never returned to the browser — only the edge function can decrypt them to call your provider.

**2. AI Translation**
- A "Translate" button on the glossary-applied chapter text and on every separated card.
- Target language selector (remembered between sessions).
- Two modes: translate a single card, or translate everything into one continuous reading block.
- The prompt instructs the AI to translate, clean up leftover artifacts (e.g. remove `(Female)`/`(Male)` gender tags), and preserve paragraph structure — no glossary is sent, since terms are already replaced.
- Results stream in live, can be copied, and replace nothing until you choose to apply them.

**3. Fullscreen reading view**
The combined translation opens in a distraction-free reading overlay: fullscreen toggle (native Fullscreen API), adjustable font size, copy button, and swipe/scroll friendly on mobile. Existing card view stays unchanged.

## Technical details

Database (new migration, with GRANTs + RLS scoped to `auth.uid()`):
- `ai_providers` — `id, user_id, display_name, api_url, api_key_encrypted, created_at, updated_at`
- `ai_provider_groups` — `id, user_id, name, sort_order`
- `ai_models` — `id, user_id, provider_id, group_id (nullable), model_id, display_name, sort_order`
- `ai_settings` — `id, user_id, active_model_id (nullable), target_language, updated_at`

`api_key_encrypted` is AES-GCM ciphertext produced in the edge function using a new `AI_PROVIDER_ENC_KEY` secret; the column is never selected by client code (client reads go through explicit column lists, plus a `has_api_key` boolean derived server-side).

Edge functions:
- `ai-provider-keys` — write path: accepts a plaintext key, encrypts, upserts the row. Never returns key material.
- `ai-translate` — loads the selected model + provider for the caller, decrypts the key, and calls the provider's OpenAI-compatible `/chat/completions` endpoint with streaming; streams SSE back to the client. Surfaces 401/429/402 and provider errors verbatim so users can switch providers.

Frontend:
- `src/components/AiProviderManager.tsx` (new) — providers/groups/models CRUD, lazy-loaded.
- `src/components/TranslationView.tsx` (new) — streaming output, fullscreen reading overlay, font-size control.
- `src/hooks/useAiProviders.ts`, `src/hooks/useTranslate.ts` (new).
- `src/components/AppSidebar.tsx` — add the "AI Providers" entry.
- `src/pages/Index.tsx` — add Translate buttons on cards and on the applied chapter text, plus "Translate all → reading view". No changes to existing separation, glossary, PWA or persistence logic.

Offline-aware (uses the existing `use-online` hook) and mobile-first: 44px targets, stacked buttons, semantic monochrome tokens only.
