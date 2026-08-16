# Persist card translations

## Problem

In the Separated Chapter Cards section, translating a card replaces that card's text only in local React state — the apply handler updates the card list and nothing else. The session is never written to the database after applying a translation, and when the app reopens the last session is reloaded from the database, overwriting the locally cached copy. Result: translations disappear and users pay AI tokens again.

## What will change

1. Applying a translation (single card or the whole reading view) saves the session immediately, so the translated text survives a reload.
2. Translations are stored alongside the original card text instead of silently overwriting it, so the original is never lost and a card already translated can be recognised on reload.
3. Each card that has a stored translation shows an indicator and an Original / Translated toggle, so reopening the app shows the translated text without re-running the AI.
4. Offline behaviour matches the existing pattern: the local session cache keeps the translation and it syncs when the connection returns.

## Technical details

- Database: add a `translated_cards` jsonb column (nullable, default `null`) to `public.chapter_sessions`. Index-by-position array matching `separated_cards`, with `null` entries for untranslated cards. No new table, no RLS changes needed — existing per-user policies cover it.
- `src/pages/Index.tsx`:
  - New `translatedCards: (string | null)[]` state kept in sync with `separatedCards` length; reset when a new separation runs.
  - `openTranslation` apply callbacks write into `translatedCards` (not `separatedCards`) and then call `saveToDatabase` with the updated arrays.
  - `saveToDatabase` accepts and persists `translated_cards`; `loadLastSession` reads it back; the localStorage session cache includes it.
  - Card rendering (both desktop grid and mobile single-card view) displays the translation when present, with a small toggle to view the original; copy/share/"Copy All Cards" use the currently displayed text.
- `src/components/TranslationView.tsx` unchanged apart from continuing to call `onApply`.
