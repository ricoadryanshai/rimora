

## Mobile UX Improvement Recommendations

Based on reviewing the current codebase, here are actionable improvements targeting iPhone/mobile users:

### 1. Reduce visual clutter on mobile — collapse the hero section
The large hero with title, subtitle, and 3 badges takes up most of the initial viewport on mobile. On small screens, hide the subtitle and badges so users see the input area immediately.

**Files:** `src/pages/Index.tsx` (lines 344-373) — add `hidden sm:block` to subtitle paragraph and badges wrapper.

### 2. Sticky "Separate Chapter" button on mobile
The primary CTA is buried below the text area and settings. Add a sticky bottom bar on mobile so users can always tap "Apply Glossary & Separate Chapter" without scrolling back up.

**Files:** `src/pages/Index.tsx` — wrap the button in a sticky footer container visible only on mobile (`fixed bottom-0 left-0 right-0 md:hidden`).

### 3. Collapsible settings panel
The separation mode and paragraph/card count inputs occupy space above the text area. Wrap them in a collapsible/accordion so mobile users can focus on text input first and tweak settings when needed.

**Files:** `src/pages/Index.tsx` — use the existing `Collapsible` or `Accordion` component around the settings grid (lines 387-468).

### 4. Bottom sheet for result cards on mobile
Instead of a long scrollable grid, use a swipeable bottom sheet (Drawer) or a simplified single-card-at-a-time view with prev/next navigation on mobile. This prevents endless scrolling through many cards.

**Files:** `src/pages/Index.tsx` (results section, lines 522-594) — add a mobile card navigator with prev/next buttons, shown only on `sm:hidden`.

### 5. Larger touch targets for glossary table actions
The glossary replacement table uses small icon buttons for delete/select. Increase button padding and hit areas on mobile for easier tapping.

**Files:** `src/components/WordReplacements.tsx` — increase icon button sizes with `min-h-[44px] min-w-[44px]` on mobile.

### 6. "Copy All" button for result cards
iPhone users copying cards one by one is tedious. Add a "Copy All Cards" button at the top of the results section that copies all card content separated by dividers.

**Files:** `src/pages/Index.tsx` — add a button in the results CardHeader.

---

### Summary of changes

| Priority | Change | Effort |
|----------|--------|--------|
| High | Collapse hero on mobile | Small |
| High | Sticky CTA button | Small |
| Medium | Collapsible settings | Small |
| Medium | Copy All button | Small |
| Low | Mobile card navigator | Medium |
| Low | Larger touch targets | Small |

All changes use existing UI components (Collapsible, Drawer, Button) and Tailwind responsive classes — no new dependencies needed.

