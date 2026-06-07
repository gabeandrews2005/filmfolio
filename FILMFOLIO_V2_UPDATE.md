# FilmFolio — v2 Update Spec
## For Claude Code — iterate on existing codebase at filmfolio-pi.vercel.app

This document captures Gabe's handwritten product notes (4 pages) plus architectural decisions.
Apply all changes to the existing React/Vite codebase. Do not start over.

---

## Summary of What's Changing

1. **Gabe's personal "Top 100" concept is retired as a ranked list** — replaced by a hybrid Explore page
2. **Navigation is simplified** with a hamburger overflow menu
3. **User's own lists become the product** — top 10 expandable to top 100, plus genre/category lists
4. **Friends & Profiles** stubbed with localStorage (no real auth yet, but UI designed as if it exists)
5. **"Universe" view** — a new page compiling all of a user's lists
6. **Smart auto-populate** for genre lists based on user's top 100
7. **Recommendation algorithm gets an actor/director signal layer**
8. **Poster accuracy fix** — audit TMDB ID mismatches

---

## 1. Explore Page (replaces "My Top 100")

### Concept
The Explore page is an infinite, searchable, filterable movie discovery pool. It is no longer Gabe's personal ranked list. Instead:

**Hybrid pool:**
- Gabe's curated picks (from `movies.json`) are still loaded first and receive a visual "Featured" badge — a small gold bookmark or star icon on the card
- TMDB `/movie/popular` and `/movie/top_rated` fill the rest of the pool (paginate with infinite scroll or a "Load More" button)
- No rank numbers displayed anywhere on Explore — Gabe's picks are featured, not ranked

**Per-film interaction (on card click — modal or expanded view):**
- Poster
- Title, year, director, runtime, TMDB rating
- **"Seen It"** toggle button
- **"+ Top 10"** button (adds to user's list builder)
- **"Description"** button/section — expands to show full TMDB overview text
- If the film features an actor or director that appears elsewhere in the user's lists, show a small gold star indicator with a tooltip: e.g. ★ *Directed by Martin Scorsese*

**Filters:** Genre | Decade | Seen/Unseen | Featured (Gabe's picks only)

---

## 2. Navigation Restructure

### Main Nav Bar (always visible)
```
FilmFolio logo | Homepage | Explore | My Top 10 | Picks for You | ☰
```

### Hamburger Menu (☰, far right) — slide-out drawer or dropdown
Contains:
- Actors
- Shows
- Directors
- Animated
- Horror
- Comedies
- Seasonal
- Universe *(see section 6)*
- Watchlist
- Friends
- Account
- About

Remove all nav items beyond the 4 main ones from the top bar. Everything else lives in the hamburger.

---

## 3. My Top 10 (updated)

### Builder behavior (unchanged from v1)
- Drag-to-rank interface
- Search any movie via TMDB
- Max 10 slots

### Display once completed
- Switch from builder UI to a **poster grid layout** — same visual style as Explore page
- Each poster shows rank number badge (1–10) in gold
- Tap and hold (or drag handle on desktop) to reorder — live drag reordering within the completed list
- Edit button to go back to builder mode

### Expand to Top 100
- Below the top 10 grid, show an **"Expand to Top 100"** button
- Clicking it reveals slots 11–100, which the user can fill using the same search/drag interface
- Slots 11–100 are optional — only filled slots are displayed
- The full list (however many entries) is what feeds the recommendation algorithm and auto-populates genre lists

---

## 4. Extended Lists (via Hamburger Menu)

After the user has at least started their top 10, the extended list pages become available.

### List types and sizes
| List | Max Entries |
|------|-------------|
| Actors | 50 |
| Shows | 25 |
| Directors | 25 |
| Horror | 50 |
| Seasonal | 25 |
| Comedies | 50 |
| Animated | 50 |

### Smart auto-populate (genre lists only)
For **Horror, Seasonal, Comedies, Animated** lists only (not Actors, Shows, Directors — those are non-movie lists):

- When the user opens one of these genre list pages, scan their top 100 (however many they've filled in)
- Any movie in their top 100 that matches the genre automatically appears at the **top of that list**, pre-populated
- Show a gold rank badge in the top-left corner of the card indicating its rank from their top 100 (e.g. "#4")
- These auto-populated entries are locked at the top — user can fill remaining slots below them
- User can still manually reorder or remove the auto-populated entries if they choose

### Non-movie lists (Actors, Shows, Directors)
- Simple ranked list builder — user types a name, gets suggestions, drags to rank
- For Actors and Directors: use TMDB `/search/person` for suggestions, pull headshot from TMDB
- For Shows: use TMDB `/search/tv` for suggestions, pull poster art
- No auto-populate from movie lists

### All list pages
- Same poster/card grid display as Explore and Top 10
- Tap-and-hold or drag handle to reorder
- Accessible from hamburger menu

---

## 5. Friends & Profiles (localStorage stub)

Design the full UI as if auth exists. Wire everything to a localStorage-based mock user system for now. A future Supabase auth integration should be a clean drop-in.

### Mock user system
- On first visit, prompt user to create a "profile" — enter a username and optionally upload a profile photo (store as base64 in localStorage)
- Store as `ff_user` in localStorage: `{ username, avatar, createdAt }`
- All list data already in localStorage becomes "owned" by this user

### Profile Page (`/profile/:username`)
- Shows user's avatar, username
- All lists they've filled out, displayed as poster grids (read-only when viewing another user)
- Like button on profiles and individual lists

### Friends Page (`/friends`)
- Search bar: type a username to "find" them
- Since there's no real backend, stub this with a small set of **hardcoded demo profiles** (3–5 fake users with pre-filled lists) so the feature feels real and testable
- Viewing a friend's profile: see all their lists in read-only mode
- From a friend's list, user can tap any movie and use the standard "+ Top 10" / "Add to Watchlist" actions on their own lists
- Like button on their lists

### Demo profiles (hardcode these)
Create 3 fake users with varied, realistic top 10 lists to make Friends feel populated. Use real TMDB IDs. Name them something like "alex_films", "maya_watches", "dev_cinema".

---

## 6. Universe Page (`/universe`)

Accessible from hamburger menu. This is the emotional centerpiece for power users.

**Layout:** A single scrollable page divided into sections, one per list the user has filled out. Each section shows:
- Section header (e.g. "My Top 10", "My Horror List", "My Actors")
- Horizontal scrolling strip of poster cards (or person headshots for Actors/Directors)
- "Edit" link jumping to that list's page

Think of it as a dashboard of everything — the user's full film identity at a glance.

Only show sections for lists the user has actually started. If they've only done top 10, only top 10 shows.

---

## 7. Recommendation Algorithm Update ("Picks for You")

Keep the existing TMDB `/movie/{id}/recommendations` frequency-scoring approach.

**Add actor/director signal layer:**
- After scoring movies by recommendation frequency, apply a **bonus multiplier** to any result that features:
  - An actor appearing in the user's Actors list (if filled out), OR
  - A director appearing in the user's Directors list (if filled out)
- Bonus: +2 to the frequency score per matching person
- On the recommendation card, if a bonus was applied, show the gold star indicator: ★ *Features [Actor Name]* or ★ *Directed by [Director Name]*

**On Explore page film cards:** If a film in the Explore pool features someone from the user's Actors or Directors list, show the same gold star indicator as a passive discovery signal — even before the user adds it to anything.

---

## 8. Bug Fixes & Polish

### Poster accuracy
- Audit all entries in `movies.json` for TMDB ID correctness — several IDs may be mismatched causing wrong posters
- Add a validation step on load: if a TMDB fetch returns a title that doesn't closely match the expected title in `movies.json`, log a warning to the console and fall back to a placeholder poster
- Known duplicates in the JSON to fix: Pan's Labyrinth (rank 47 duplicated), The Conversation/The Conversations (ranks 92/100 are the same film), Annie Hall and Taxi Driver share tmdb_id 703 — audit and correct all

### General polish
- Ensure all poster images load correctly and match their titles
- Add graceful loading skeletons on Explore (poster grid shimmer while TMDB fetches)
- "Seen It" state should persist across Explore and all list views — if you mark something seen on Explore, it shows as seen on your profile and vice versa

---

## 9. Data & State (localStorage keys)

Update the localStorage schema to accommodate new lists:

```javascript
ff_user          // { username, avatar, createdAt }
ff_seen          // Set of tmdb_ids marked as seen
ff_top100        // Array of { tmdb_id, rank } — user's personal top 10 expanded to 100
ff_actors        // Array of { person_id, name, headshot_path, rank }
ff_shows         // Array of { tmdb_id, rank }
ff_directors     // Array of { person_id, name, headshot_path, rank }
ff_horror        // Array of { tmdb_id, rank }
ff_seasonal      // Array of { tmdb_id, rank }
ff_comedies      // Array of { tmdb_id, rank }
ff_animated      // Array of { tmdb_id, rank }
ff_watchlist     // Array of tmdb_ids
ff_not_interested // Array of tmdb_ids (excluded from Picks for You)
```

---

## 10. File / Component Changes Needed

### New pages
- `/universe` → `Universe.jsx`
- `/profile/:username` → `Profile.jsx`
- `/friends` → `Friends.jsx`
- `/lists/actors` → `ActorsList.jsx`
- `/lists/shows` → `ShowsList.jsx`
- `/lists/directors` → `DirectorsList.jsx`
- `/lists/horror` → `HorrorList.jsx`
- `/lists/seasonal` → `SeasonalList.jsx`
- `/lists/comedies` → `ComediesList.jsx`
- `/lists/animated` → `AnimatedList.jsx`

### Modified pages
- `Movies.jsx` → becomes `Explore.jsx` — hybrid pool, remove rank display, add Featured badge
- `MyList.jsx` → add expand-to-100 feature, switch to poster grid on completion
- `Recommendations.jsx` → add actor/director bonus signal and gold star display

### New components
- `HamburgerMenu.jsx` — slide-out drawer
- `FilmCard.jsx` — unified card used across all movie list pages (replaces MovieCard)
- `PersonCard.jsx` — for Actors/Directors lists
- `UniverseSection.jsx` — horizontal scroll strip used in Universe page
- `ProfileSetupModal.jsx` — first-visit username prompt
- `StarSignal.jsx` — the gold star actor/director indicator (reusable)

### Modified components
- `Nav.jsx` — simplify to 4 items + hamburger
- `FilmContext.jsx` — extend state to cover all new lists + user profile

---

## Deployment Note

All changes push to GitHub → Vercel auto-deploys. No manual Vercel steps needed.
TMDB API key already set in Vercel environment variables.

---

## Out of Scope for This Iteration

- Real authentication (Supabase) — future
- Real friends/social graph — future  
- Backend database — future
- "Shows" list full TV integration (stub UI is fine)
