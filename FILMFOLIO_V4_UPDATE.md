# FilmFolio — v4 Update Spec
## For Claude Code — iterate on existing codebase at filmfolio-pi.vercel.app

Apply all changes to the existing React/Vite codebase. Do not start over. Reference `CLAUDE.md` for the full design system, file structure, and API conventions. All changes must respect existing color tokens, typography, and component patterns.

---

## Summary of What's Changing

1. **MyList poster grid is now always shown** — no 10-film threshold
2. **Explore page checkbox is fully interactive** — uncheckable directly from the grid
3. **Explore pool expands to 500+ films** — TMDB Discover replaces popular/top_rated, Load More is fixed
4. **Poster accuracy** — agent to audit and fix TMDB ID → poster mismatch root cause
5. **MyList cap raised to 100, hard block at 100** — "extended list" popup removed
6. **Expand List page and button eliminated** — replaced by inline search bar on MyList
7. **Poster size standardized** — Explore card dimensions used on all pages
8. **Subgenre lists auto-sync from MyList** — with MyList rank-derived ordering

---

## 1. MyList — Always Show Poster Grid

### Current behavior
MyList switches from a builder/list UI to a poster grid only once 10 films are present.

### New behavior
- Show the poster grid layout **at all times**, regardless of how many films are in MyList (even 1, even 0)
- The empty state (0 films) shows the grid container with a centered prompt: *"Search for a film above to start building your list"*
- Drag-to-reorder remains active at all times
- Rank badge (gold, top-left) visible on every card from the first entry
- No behavioral change to drag-and-drop or reorder logic — only the display threshold is removed

### Implementation note
Remove whatever conditional gates the grid render on `myList.length >= 10`. The grid is always the active view.

---

## 2. Explore Page — Checkbox Directly Uncheckable

### Current behavior
The "Seen It" checkbox on Explore film cards can only be unchecked from inside the film detail popup/modal, not from the card itself on the grid.

### New behavior
- The checkbox on the Explore grid card is fully toggleable — clicking it marks seen **and** clicking it again unmarks seen, without opening the modal
- Clicking the poster or title area still opens the modal as before
- The checkbox must stopPropagation so the click does not also trigger the modal open
- Seen state must remain synced: toggling on the card is identical in effect to toggling inside the modal

---

## 3. Explore Page — Expanded Pool and Fixed Load More

### Pool composition
Replace the current `GET /movie/popular` + `GET /movie/top_rated` pool with **TMDB Discover**, filtered as follows:

```
GET /discover/movie
  sort_by=vote_average.desc
  vote_count.gte=1000
  vote_average.gte=7.0
  page={n}
```

- Gabe's Top 100 (from `movies.json`) remain in the pool with the gold **Featured** badge, interspersed naturally — do not deduplicate them out
- Deduplicate by `tmdb_id` across all pages fetched so far to prevent duplicates as pages accumulate
- Target a minimum of **500 unique films** available before the user hits Load More (i.e. pre-fetch enough pages on initial load to reach 500, then continue paginating from there)
- Cache keys: use prefix `ff_tmdb_disc_` per page, 24-hour TTL, consistent with existing cache pattern in `tmdb.js`

### Load More — fix
The existing "Load More Films" button does not actually load additional films. Fix this so that:
- Each click fetches the next page of Discover results
- New results are appended to the existing grid (no full re-render / scroll reset)
- A loading spinner replaces the button while the fetch is in flight
- If TMDB returns fewer results than expected or an error, show a graceful message: *"No more films to load"*

### Filter compatibility
All existing filters (Genre, Decade, Seen/Unseen, Featured toggle) must continue to work against the expanded pool. Filtering is client-side against the accumulated pool — do not re-fetch on filter change.

---

## 4. Poster Accuracy — TMDB ID Audit

### Problem
Several films display incorrect posters. Known examples: *Dazed and Confused* shows the *Serendipity* poster; *The Peanut Butter Falcon* shows a poster for *Levellers*. The root cause is likely a title-string search fallback being used somewhere in the poster fetch path instead of a direct `/movie/{tmdb_id}` lookup.

### What to investigate and fix
- Audit the full poster fetch pipeline in `tmdb.js` and any component that constructs a poster URL
- Wherever a TMDB ID is already known (i.e. any film from `movies.json`, any film already in a user's list), **always** use `GET /movie/{tmdb_id}` directly — never fall back to a title search for known films
- Add a validation guard: after fetching details for a known film, compare the returned `title` against the expected title from `movies.json`. If they do not closely match (case-insensitive, ignoring articles), log a console warning: `[FilmFolio] Poster mismatch: expected "{expected}" got "{returned}" for tmdb_id {id}` and render the placeholder SVG poster instead of the wrong image
- Do not modify `movies.json` as part of this fix — if a `tmdb_id` in `movies.json` is confirmed wrong, flag it in the console warning and document the corrections needed in a comment block at the top of `tmdb.js` so they can be manually corrected later
- `movies.json` is SACRED — never auto-overwrite

---

## 5. MyList — Remove 10-Film Cap on Addition, Hard Block at 100

### Current behavior
- MyList enforces a 10-film cap from the Explore popup
- When at 10 films, the popup asks if the film should be added to an "extended list"
- `LIST_MAX.myList` is currently 100 in FilmContext

### New behavior
- Remove the 10-film cap entirely from the Explore popup and any other addition flow
- Remove the "add to extended list" prompt/popup — it no longer exists
- When a user adds a film via the Explore modal "+ My List" button, it appends directly to `myList` with no intermediate dialog
- **Hard block at 100**: if `myList.length >= 100`, the "+ My List" button is disabled and shows a tooltip: *"Your list is full (100/100) — remove a film to add more"*
- `LIST_MAX.myList` remains 100 in FilmContext — this is correct, no change needed there
- The localStorage key `ff_top100` is retained as-is — no rename needed
- Update `addToList('myList', movie)` call sites in Explore modal to remove any branching logic around the old 10-film threshold

---

## 6. MyList — Remove Expand List Page, Add Inline Search Bar

### Remove entirely
- The "Expand List" button on MyList page — delete it
- The Expand List page and its route — delete the component file and remove the route from `App.jsx`
- Any navigation links pointing to the Expand List page

### Add inline search bar to MyList
At the top of the MyList page, above the poster grid, add a search bar with the following behavior:

- **Placeholder text:** *"Search to add a film…"*
- As the user types (debounced ~300ms), call `GET /search/movie?query={input}` and display a dropdown of up to 8 results beneath the search bar
- Each result row shows: poster thumbnail (small, ~40px tall), title, year
- Each result row has a **+** button on the right
- Clicking **+** calls `addToList('myList', movie)` — subject to the 100-film hard block above
- If the film is already in `myList`, show a checkmark instead of **+** (disabled, not clickable)
- Clicking outside the dropdown or pressing Escape closes it without adding anything
- After a successful add, the dropdown remains open so the user can add additional films; the added film's row updates to show the checkmark
- Clear the search input on Escape or when the user clicks the × clear button in the field
- Style consistent with existing search inputs in the codebase (dark background, gold focus ring, DM Sans)

---

## 7. Poster Size — Standardize to Explore Card Dimensions

### Current problem
Card/poster sizes are inconsistent across pages. The Explore page has the correct target size.

### New behavior
- Extract the Explore page card dimensions (width, height, border-radius, font sizes for title/year overlay) into shared CSS custom properties or a shared CSS Module class
- Apply these same dimensions to cards/posters on: **MyList**, **Actors page**, **Directors page**, and all **genre subpages** (Animated, Horror, Comedies, Seasonal)
- On mobile, cards should scale the same way Explore cards already do at each breakpoint — do not introduce new breakpoint logic, mirror whatever Explore currently does
- PersonCard (Actors, Directors) headshots should match the same outer dimensions as film posters — the headshot image itself is naturally portrait, so it will fill the same card footprint

---

## 8. Subgenre Lists — Auto-Sync from MyList

### Concept
If a film in `myList` matches a subgenre's genre mapping, it is **automatically present** in that subgenre list and ordered by its MyList rank. This replaces the current behavior where auto-populated genre films appear as a separate locked section.

### Genre mapping (use existing `GENRE_MAP` in codebase)
| Subgenre page | Genres that qualify |
|---|---|
| Animated | Animation |
| Horror | Horror, Thriller |
| Comedies | Comedy |
| Seasonal | (manual only — no auto-sync for Seasonal) |

### Display and ordering
- On each genre subpage, the film list is composed of two layers, merged and displayed as one unified list:
  1. **MyList-sourced films** — any film in `myList` matching the genre, ordered by their MyList rank (rank 1 = top of subgenre, rank 10 = below rank 9, etc.)
  2. **Manually added films** — films added directly on the subgenre page (not via MyList), appended below the MyList-sourced films in user-defined order
- MyList-sourced films show a gold **#N** rank badge reflecting their MyList rank (not their position in the subgenre list)
- Manually added films show no rank badge, or a neutral position indicator — they are not ranked
- The subgenre list is **read-only for the MyList-sourced portion** — the user cannot drag-reorder MyList-sourced films from the subgenre page (their order is determined by MyList). They can still remove them from the subgenre page if they choose — doing so does **not** affect MyList
- The manually added portion remains drag-reorderable
- A visual divider or subtle label separates the two sections (e.g. *"From My List"* / *"Added Here"*) — keep it minimal and consistent with the design system

### Persistence
- MyList-sourced films in subgenre lists are **derived at render time** from `myList` + `GENRE_MAP` — they are not separately stored in `ff_horror`, `ff_animated`, etc.
- Manually added films continue to be stored in their respective localStorage keys (`ff_horror`, `ff_animated`, `ff_comedies`)
- If a film is removed from `myList`, it disappears from the derived section of the subgenre list automatically (since it's derived, not stored). This is acceptable and expected behavior — it is the natural consequence of removal from MyList
- If a film is manually added to a subgenre page and later also added to MyList, it moves from the "Added Here" section to the "From My List" section and gains a rank badge — deduplicate by `tmdb_id` so it only appears once

### Addition flow
- The subgenre pages retain their existing search/add interface for manual additions
- Films already present in the MyList-sourced section cannot be added again via the manual search (show a checkmark / disabled state if the user searches for a film already in MyList for that genre)

---

## Files to Change (non-exhaustive — agent should audit)

| File | Change |
|---|---|
| `MyList.jsx` | Remove grid threshold; add inline search bar; remove Expand List button |
| `MyList.module.css` | Styles for inline search bar and dropdown |
| `Explore.jsx` | Fix checkbox toggle; switch pool to Discover; fix Load More |
| `tmdb.js` | Add Discover endpoint + `ff_tmdb_disc_` cache; poster audit/validation guard |
| `FilmContext.jsx` | Remove 10-film branching from add logic; confirm LIST_MAX.myList=100 |
| `App.jsx` | Remove Expand List route |
| `GenreList.jsx` | Implement two-layer derived+manual list with divider |
| `FilmCard.jsx` | Ensure checkbox stopPropagation on Explore; standardize card size |
| `MovieCard.module.css` / shared CSS | Extract Explore card dimensions to shared tokens |
| `PersonCard.jsx` / `.module.css` | Match poster dimensions |
| Expand List component | **Delete entirely** |

---

## Constraints (carry forward from CLAUDE.md)

- `movies.json` is SACRED — never auto-overwrite
- No backend — all persistence via localStorage
- Never commit `.env`
- TMDB enrichment is always live — poster URLs fetched and cached, never baked into JSON
- Use `addToList` / `removeFromList` / `reorderList` for all list mutations — no direct setState on list state
- Mobile first — 2-col minimum on poster grids
- Fallback: if TMDB unreachable, render from seed data with placeholder SVG poster
