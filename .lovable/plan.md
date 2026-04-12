

## Mobile UX Polish — Final Round

After reviewing the full current codebase, here are the remaining mobile improvements:

### 1. Glossary section cards have excessive padding on mobile
The "Glossary Library" and "Text Glossary" cards use `p-6` padding on `CardContent` (lines 743, and the library card). On a 390px-wide screen, this wastes ~48px of horizontal space. Reduce to `p-3 sm:p-6`.

**File:** `src/components/WordReplacements.tsx` — update CardContent padding on both glossary cards

### 2. "Add New Glossary Entry" form box has heavy padding on mobile
The form wrapper div (line 744) uses `p-6` inside an already-padded card. On mobile this creates a double-padding effect. Reduce to `p-3 sm:p-6`.

**File:** `src/components/WordReplacements.tsx` — line 744

### 3. Mobile card navigator height is fixed at `h-80` regardless of content
The single-card view (line 668) forces a 320px height. Short cards waste space; long cards are cramped. Change to `min-h-[200px] max-h-[60vh]` so it adapts to content while capping at 60% viewport height.

**File:** `src/pages/Index.tsx` — line 668

### 4. Sticky CTA bar lacks safe-area padding for notched iPhones
The fixed bottom bar (line 333) uses `p-3` but doesn't account for the home indicator on iPhones with notches. Add `pb-[env(safe-area-inset-bottom,12px)]` to prevent the button from sitting behind the home bar.

**File:** `src/pages/Index.tsx` — line 333

### 5. CSV import/export section not optimized for mobile
The `CSVManager` component buttons likely render side-by-side and may overflow on small screens. Wrap them in a responsive grid that stacks on mobile.

**File:** `src/components/CSVManager.tsx` — add `flex-col sm:flex-row` to button containers

### 6. Empty glossary state has oversized icon on mobile
The "No glossary entries yet" empty state (line 1083) uses a 64px icon container. Reduce on mobile with `w-12 h-12 sm:w-16 sm:h-16`.

**File:** `src/components/WordReplacements.tsx` — line 1083

---

### Summary

| Priority | Change | Effort |
|----------|--------|--------|
| High | Safe-area padding for notched iPhones | Tiny |
| High | Reduce glossary card padding on mobile | Tiny |
| Medium | Adaptive card navigator height | Small |
| Medium | Reduce form box padding | Tiny |
| Low | CSV buttons responsive stacking | Small |
| Low | Compact empty glossary icon | Tiny |

All changes are Tailwind-only. No new dependencies.

