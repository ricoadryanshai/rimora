

## Mobile UX Polish — Remaining Items

After reviewing the full codebase, here are the final mobile improvements worth making:

### 1. Header card ignores dark mode
The `Header` component (line 25) uses `bg-white/80` which looks broken in dark mode. Replace with `bg-card/80` to respect the theme.

**File:** `src/components/Header.tsx` — line 25

### 2. Add `viewport-fit=cover` for full iPhone safe-area support
The `index.html` viewport meta tag lacks `viewport-fit=cover`, which is required for `env(safe-area-inset-bottom)` to actually work on notched iPhones. Without it, the safe-area padding added to the sticky CTA has no effect.

**File:** `index.html` — line 5, append `, viewport-fit=cover`

### 3. Sign-in prompt icon container too large on mobile
The sign-in card (line 351) uses `p-3` on the icon circle, making it disproportionately large on small screens. Reduce to `p-2 sm:p-3`.

**File:** `src/pages/Index.tsx` — line 351

### 4. Main heading too large on very small screens
The `h1` (line 385) starts at `text-2xl` which combined with the icon creates a two-line wrap on iPhone SE (320px). Use `text-xl` as the base and `sm:text-2xl`.

**File:** `src/pages/Index.tsx` — line 385

### 5. Drag-and-drop zone not useful on mobile
The `DragDropUpload` component shows drag-and-drop instructions that don't apply to touch devices. Hide the drag text and show a simpler "Tap to upload CSV" label on mobile.

**File:** `src/components/DragDropUpload.tsx` — update copy with responsive text

---

### Summary

| Priority | Change | Effort |
|----------|--------|--------|
| High | Fix Header dark mode `bg-white/80` | Tiny |
| High | Add `viewport-fit=cover` to viewport meta | Tiny |
| Medium | Smaller sign-in icon on mobile | Tiny |
| Medium | Reduce h1 font size for iPhone SE | Tiny |
| Low | Mobile-friendly drag-drop copy | Small |

All changes are CSS/HTML only. No new dependencies.

