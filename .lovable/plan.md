

## Additional Mobile UX Improvements

After reviewing the current codebase (post previous round of fixes), here are further improvements to enhance the mobile experience:

### 1. Glossary table: switch to card layout on mobile
The glossary entries table (`WordReplacements.tsx`, lines 854-919) uses a horizontal `<Table>` with columns for checkbox, original term, preferred term, and actions. On mobile this requires horizontal scrolling (`overflow-x-auto`). Replace the table with a stacked card layout on small screens (each entry as a vertical card showing original/preferred terms and action buttons), hidden on `sm:` and above where the table remains.

**Files:** `src/components/WordReplacements.tsx` (lines 854-919)

### 2. Add bottom padding to prevent sticky CTA overlap
The sticky mobile CTA at the bottom of the screen (Index.tsx, line 331) overlaps content at the bottom of the page. The results section has `mb-20 sm:mb-0` but other sections (glossary, text input) can still be obscured when scrolling to the bottom. Add `pb-20 sm:pb-0` to the main container to ensure all content clears the sticky bar.

**Files:** `src/pages/Index.tsx` (line 343, the container div)

### 3. Improve "Add New Glossary Entry" form for mobile
The 3-column grid for adding glossary entries (lines 727-793) collapses to a single column on mobile, but the "Add Entry" button is inside a `flex items-end` wrapper that may not align well. Make the button full-width with consistent padding on mobile, matching other CTAs.

**Files:** `src/components/WordReplacements.tsx` (lines 782-793)

### 4. Auto-scroll to results after separation
After tapping "Separate Chapter" on mobile, the user must manually scroll down to see the results. Add an automatic scroll-to-results behavior after `separateChapter()` completes so the output is immediately visible.

**Files:** `src/pages/Index.tsx` — add `resultsRef.current?.scrollIntoView({ behavior: 'smooth' })` after `setSeparatedCards(cards)`.

### 5. Compact header on mobile
The app header bar (line 318-323) and the `Header` component both take vertical space. On mobile, reduce the header padding and font size slightly, and consider combining the sidebar trigger + title into a more compact bar.

**Files:** `src/pages/Index.tsx` (lines 318-323), `src/components/Header.tsx`

### 6. Search bar full-width on mobile in glossary
The search input in the glossary section (line 798) has `max-w-md` which limits its width. On mobile, it should be full-width for easier tap targeting.

**Files:** `src/components/WordReplacements.tsx` (line 798) — change to `max-w-full sm:max-w-md`

---

### Summary

| Priority | Change | Effort |
|----------|--------|--------|
| High | Card layout for glossary table on mobile | Medium |
| High | Auto-scroll to results after separation | Small |
| Medium | Bottom padding for sticky CTA clearance | Small |
| Medium | Full-width search bar on mobile | Small |
| Low | Compact header on mobile | Small |
| Low | Better Add Entry button alignment | Small |

All changes use existing Tailwind responsive classes and minor JS additions. No new dependencies needed.

