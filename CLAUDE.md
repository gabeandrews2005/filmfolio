# FilmFolio — Project Reference

## What This Is

**FilmFolio** is Gabe's personal movie curator web app. It showcases his curated Top 100 film list, lets visitors mark what they've seen, build their own ranked list (up to 100 films), and receive TMDB-powered recommendations enhanced by favorite actor and director signals. A full "Universe" dashboard lets users build and manage their own genre lists, person lists, and show lists alongside Gabe's picks.

**Status:** Phase 2 complete. Fully built, deployed, and live on Vercel. GitHub repo: `jmandrews1975/filmfolio`.

**Division of labor:** Engineering via Claude Code. Creative direction by Gabe (site owner).

---

## Design System

### Aesthetic: "Criterion meets Letterboxd"

Personal film journal feel — darkened theater, warm light, Criterion booklet tactility. Sophisticated but warm. Not corporate.

**Color tokens (`src/index.css`):**
```css
--bg-primary:     #0d0d0d;   /* near-black */
--bg-secondary:   #141414;   /* card backgrounds */
--bg-tertiary:    #1e1e1e;   /* elevated surfaces */
--accent-gold:    #c9a84c;   /* primary accent */
--accent-red:     #8b1a1a;   /* secondary accent */
--text-primary:   #f0ece4;   /* warm off-white */
--text-secondary: #a09a8e;   /* muted warm gray */
--text-muted:     #5a5550;
--border:         #2a2520;
--nav-height:     64px;
--transition:     200ms ease;
```

**Typography (loaded via Google Fonts in `index.html`):**
- `Playfair Display` — display headings, editorial
- `DM Sans` — UI and body copy
- `DM Mono` — ratings, counts, codes, table data

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite 5 |
| Styling | CSS Modules + custom design tokens |
| State | React Context + `localStorage` |
| Routing | React Router v6 |
| Drag-to-rank | `@dnd-kit` (My List poster grid — supports reordering within a wrapping grid); `@hello-pangea/dnd` (single-column lists and other grids) |
| API | TMDB v3 (Bearer JWT auth) |
| Deployment | Vercel (auto-deploy from `main` branch) |

---

## TMDB API

### Auth
Uses a **Bearer read-access token** (long JWT), not an API key. Set in `.env`:
```
VITE_TMDB_READ_TOKEN=eyJ...
```

In `src/api/tmdb.js`, every request uses:
```js
headers: { Authorization: `Bearer ${READ_TOKEN}`, accept: 'application/json' }
```

`.env` is gitignored. The Vercel deployment has `VITE_TMDB_READ_TOKEN` set as an environment variable in the project settings.

### Endpoints used
- `GET /movie/{tmdb_id}` — details, overview, runtime, vote average
- `GET /movie/{tmdb_id}/credits` — director, top 5 cast (also returns castIds + directorId for star signals)
- `GET /movie/{tmdb_id}/recommendations` — powers recommendation algorithm
- `GET /search/movie` — film search in My List builder and Explore
- `GET /search/person` — person search for Actors and Directors list builders
- `GET /search/tv` — TV search for Shows list builder
- `GET /movie/popular` — Explore page pool (paginated)
- `GET /movie/top_rated` — Explore page pool (paginated)

### Caching
24-hour TTL in `localStorage`. Cache keys prefixed `ff_tmdb_d_` (details), `ff_tmdb_c_` (credits), `ff_tmdb_r_` (recommendations), `ff_tmdb_pop_` (popular by page), `ff_tmdb_top_` (top_rated by page).

### Fallback
If `VITE_TMDB_READ_TOKEN` is unset or the API is unreachable, the grid still renders from `movies.json` seed data with a placeholder SVG poster. No hard failure.

### Recommendation algorithm — `buildRecommendationsEnhanced`
1. For each movie in the user's top 10 (first 10 of `myList`), call `/movie/{tmdb_id}/recommendations`
2. Collect all results, deduplicate by `tmdb_id`
3. Exclude movies already in `myList` or in Gabe's Top 100
4. Score by **frequency of appearance** across all calls
5. **Actor/director bonus**: +2 per film if any cast member matches a `person_id` in the user's `actorsList`, or director matches a `person_id` in `directorsList`; matched names stored in `bonusActors`/`bonusDirectors` arrays on each result
6. Sort descending by score; surface top 20 with a full queue behind them
7. "Not Interested" pops the next item from the queue without re-fetching

Original `buildRecommendations` kept for backwards compat.

### Profile image helper
`getProfileUrl(path)` — returns `https://image.tmdb.org/t/p/w185{path}` for person headshots.

---

## Data Files (`src/data/`)

### `movies.json` — SACRED, never auto-overwrite
Gabe's actual personal Top 100 films. Format:
```json
{
  "rank": 1,
  "title": "A Star Is Born",
  "year": 2018,
  "tmdb_id": 332562,
  "director": "Bradley Cooper",
  "genres": ["Romance", "Drama", "Music"],
  "rt_score": 90,
  "overall_rating": 10.0,
  "avg_score": 8.2
}
```
Fields: `rt_score` (integer %), `overall_rating` (out of 10), `avg_score` (composite out of 10). `genres` used by FilterBar.

### Supplementary seed data (static, read-only)
These files exist for reference but the live supplementary lists are now **user-curated in localStorage**, not read from these files at runtime.

| File | Contents |
|---|---|
| `shows.json` | Top 15 TV shows |
| `actors.json` | Top 50 actors |
| `directors.json` | Top 26 directors |
| `animated.json` | Top 25 animated films |
| `comedies.json` | Top 17 comedies |
| `horror.json` | Top 10 horror films |
| `seasonal.json` | Top 10 seasonal films |
| `nostalgic.json` | Top 10 nostalgic films |
| `songs.json` | Top 21 original film songs |

---

## File Structure

```
filmfolio/
├── src/
│   ├── api/
│   │   └── tmdb.js                    # TMDB fetches, cache, enrichment, recommendations
│   ├── context/
│   │   └── FilmContext.jsx            # global state — all lists, generic CRUD, migration
│   ├── data/
│   │   ├── movies.json                # Gabe's Top 100 — SACRED
│   │   ├── shows.json
│   │   ├── actors.json
│   │   ├── directors.json
│   │   ├── animated.json
│   │   ├── comedies.json
│   │   ├── horror.json
│   │   ├── seasonal.json
│   │   ├── nostalgic.json
│   │   └── songs.json
│   ├── components/
│   │   ├── Nav.jsx + Nav.module.css              # 3 main links + hamburger button
│   │   ├── HamburgerMenu.jsx + .module.css       # slide-out drawer, overflow links
│   │   ├── FilmCard.jsx + .module.css            # unified card + FilmModal inline
│   │   ├── StarSignal.jsx + .module.css          # actor/director bonus badge
│   │   ├── PersonCard.jsx + .module.css          # headshot card for person lists
│   │   ├── UniverseSection.jsx + .module.css     # horizontal scroll strip
│   │   ├── MovieCard.jsx + MovieCard.module.css  # legacy (Explore still uses it)
│   │   ├── MovieGrid.jsx + MovieGrid.module.css
│   │   ├── FilterBar.jsx + FilterBar.module.css
│   │   ├── ProgressTracker.jsx + ProgressTracker.module.css
│   │   ├── TopTenBuilder.jsx + TopTenBuilder.module.css
│   │   └── RecommendationCard.jsx + RecommendationCard.module.css
│   ├── pages/
│   │   ├── Home.jsx + Home.module.css
│   │   ├── Explore.jsx + Explore.module.css      # hybrid pool: Gabe's 100 + TMDB popular
│   │   ├── MyList.jsx + MyList.module.css        # drag-to-rank, up to 100 films
│   │   ├── Recommendations.jsx + Recommendations.module.css
│   │   ├── Universe.jsx + Universe.module.css    # user dashboard, filled lists
│   │   ├── Friends.jsx + Friends.module.css      # demo profiles, social foundation
│   │   ├── Profile.jsx + Profile.module.css      # user profile with avatar + stats
│   │   ├── Account.jsx + Account.module.css      # create/edit account (username, avatar), sign out
│   │   ├── About.jsx + About.module.css
│   │   └── lists/
│   │       ├── GenreList.jsx + .module.css        # horror, comedies, animated, seasonal
│   │       ├── PersonList.jsx + .module.css       # actors, directors
│   │       └── ShowsList.jsx                      # TV shows (reuses GenreList CSS)
│   ├── App.jsx                        # BrowserRouter, Routes, FilmProvider
│   ├── index.css                      # global tokens, reset, scrollbar
│   └── main.jsx                       # ReactDOM entry point
├── index.html                         # Google Fonts link tags
├── vite.config.js
├── package.json
├── .env                               # VITE_TMDB_READ_TOKEN — gitignored, never commit
├── .env.example
└── .gitignore
```

---

## Pages & Routes

### `/` — Home
Hero with crossfading TMDB backdrops (6s interval), SVG film grain overlay, vignette. Stats strip (100 films, year range, seen count). Horizontal scrolling "From the Collection" strip. CTAs link to `/explore` and `/my-list`.

### `/explore` — Explore Films
Hybrid grid: Gabe's Top 100 (Featured badge, gold star) + TMDB popular/top_rated pool. Load-more pagination. Filters: Genre, Decade, Seen/Unseen, Featured toggle. Star signals on cards where cast/director matches user's person lists. Loading skeleton with shimmer animation.

*Legacy redirect: `/movies` → `/explore`*

### `/my-list` — My List
Two view modes — **grid** (DragDropContext poster grid, drag-to-reorder) and **builder** (search + drag list). Expandable from Top 10 (10 slots) to Top 100 (100 slots) via "Expand to Top 100" section. Uses `addToList('myList', movie)` for slots 11-100.

### `/recommendations` — Picks For You
Calls `buildRecommendationsEnhanced` with actor/director person IDs from context. Displays 20 at a time, full queue behind them. Star signal badge above each card when bonus actors/directors match. "Not Interested" pops next from queue without re-fetching.

### `/universe` — My Universe
Personal dashboard: stats strip (total films ranked, people, shows, seen count). Horizontal scroll strips for each list that has at least 1 item. Empty state with links to start building. Links to individual list edit pages.

### `/friends` — Friends
Demo profiles (gabe_films, alex_films, maya_watches, dev_cinema) with avatars, bios, and top 10 poster grids. Search bar filters profiles. Notice banner that social features are coming. Foundation for Phase 3 social layer.

### `/profile` — Profile
Avatar circle (base64 or initial letter). Username, stats (films ranked, seen count). Link to Universe. All filled lists as horizontal UniverseSection strips. Redirects to `/account` if no user set.

### `/account` — Account
Dedicated page (not a popup) to create or edit the local profile: username + optional avatar upload. Pre-fills from `user` when editing. "Sign out" clears `ff_user` (lists/other data are untouched) and returns to `/`. Linked from the hamburger menu — "Create Account" CTA when no user is set, "Account" link when one exists.

### `/about` — About
Placeholder for Gabe's personal story, photo, contact info.

### List Pages
| Route | Component | Max Items |
|---|---|---|
| `/lists/horror` | GenreList (horror) | 50 |
| `/lists/comedies` | GenreList (comedies) | 50 |
| `/lists/animated` | GenreList (animated) | 50 |
| `/lists/seasonal` | GenreList (seasonal) | 25 |
| `/lists/actors` | PersonList (actors) | 50 |
| `/lists/directors` | PersonList (directors) | 25 |
| `/lists/shows` | ShowsList | 25 |

GenreList auto-populates matching films from `myList` using `GENRE_MAP` (horror→Horror/Thriller, comedies→Comedy, animated→Animation, seasonal→null/manual). PersonList searches TMDB `/search/person` and stores `person_id` for recommendation bonus scoring.

---

## State & Persistence

All state lives in `localStorage` (no backend). Managed via `FilmContext.jsx`.

### localStorage keys

| Key | Type | Contents |
|---|---|---|
| `ff_seen` | JSON array | tmdb_ids of seen films |
| `ff_top100` | JSON array | user's full ranked list (up to 100, replaces ff_top10) |
| `ff_actors` | JSON array | user's actors list `{ person_id, name, headshot_path }` |
| `ff_shows` | JSON array | user's shows list |
| `ff_directors` | JSON array | user's directors list |
| `ff_horror` | JSON array | user's horror films |
| `ff_seasonal` | JSON array | user's seasonal picks |
| `ff_comedies` | JSON array | user's comedies |
| `ff_animated` | JSON array | user's animated films |
| `ff_not_interested` | JSON array | tmdb_ids dismissed from recommendations |
| `ff_user` | JSON object | `{ username, avatar (base64), createdAt }` |

**Migration:** `loadMyList()` reads `ff_top100` first, falls back to legacy `ff_top10` and migrates it.

### Context API

**Generic list operations** (use these for any list):
- `addToList(listName, item)` — respects `LIST_MAX` limits
- `removeFromList(listName, id)` — id is `tmdb_id` for films, `person_id` for people
- `reorderList(listName, newOrder)` — full array replacement after drag

**Legacy wrappers** (backwards compat for older components):
- `addToTop10(movie)` — calls `addToList('myList')` with max 10 enforcement
- `removeFromTop10(tmdbId)` — calls `removeFromList('myList', tmdbId)`
- `reorderTop10(newOrder)` — calls `reorderList('myList', newOrder)`

**Computed:**
- `myTop10` = `useMemo(() => myList.slice(0, 10), [myList])` — always the first 10 of myList

**LIST_MAX limits:**
```js
{ myList: 100, actorsList: 50, showsList: 25, directorsList: 25,
  horrorList: 50, seasonalList: 25, comediesList: 50, animatedList: 50 }
```

### Account setup
No auto-popup — account creation/editing lives entirely on the `/account` page (see Pages & Routes above), reached via the hamburger menu.

---

## Key Components

### `FilmCard` + `FilmModal`
Unified card used across Explore, My List grid, and genre list grids. Props: `movie, isFeatured, rankBadge, showAddToList, actorMatches, directorMatches`. Click opens `FilmModal` (fullscreen backdrop, 2-col layout, Seen It toggle, + My List button, overview, cast). Both are defined in `FilmCard.jsx`.

### `StarSignal`
Props: `actors, directors, compact`. `compact=true` → small gold ★ badge (tooltip on hover). `compact=false` → gold bar "★ Directed by X · Features Y". Returns null if both empty.

### `HamburgerMenu`
Slide-out drawer from right. Overflow links: Actors, Directors, Shows, Animated, Horror, Comedies, Seasonal, Seen Films, Watchlist, Universe, Friends, Statistics, About — plus "Account" prepended when a user is set. Header shows profile avatar/username linking to `/profile/:username` if user set, otherwise a "Create Account" CTA linking to `/account`. Locks body scroll, closes on Escape key.

### `UniverseSection`
Horizontal scroll strip with CSS snap. Shows rank badge + title + year per card. Used in Universe and Profile pages.

---

## Development

```bash
npm run dev      # → http://localhost:5173
npm run build    # production build
npm run preview  # preview production build locally
```

The `.env` file with `VITE_TMDB_READ_TOKEN` must exist locally for TMDB enrichment. Without it the app still renders with placeholder posters.

---

## Deployment

Live on Vercel. Auto-deploys on every push to `main`.

To update: `git push origin main` — Vercel picks it up automatically.

`VITE_TMDB_READ_TOKEN` is set as an environment variable in Vercel project settings (not in the repo).

---

## Constraints (always apply)

1. **Never commit `.env`** — the Bearer token must stay out of git history.
2. **`movies.json` is sacred** — never auto-generate or overwrite it. Gabe replaces it manually.
3. **No backend** — all persistence via `localStorage`. Phase 3 plans Supabase auth.
4. **TMDB enrichment is live** — poster URLs are not baked into JSON. Always fetch and cache.
5. **Recommendation queue** — maintain the full sorted queue beyond 20. "Not Interested" pops from the queue, never re-fetches.
6. **Mobile first** — poster grid must look good on phones (2 cols minimum).
7. **Fallback** — if TMDB is unreachable, render from seed data with placeholder poster SVG.
8. **`myTop10` is computed** — never store it separately; it is always `myList.slice(0, 10)`.
9. **Generic list operations** — use `addToList`/`removeFromList`/`reorderList` for all list mutations; do not write direct `setState` calls for list state.

---

## Phase 3 (out of scope now)

- Supabase auth — user accounts, cloud-persisted seen list / ranked list / all user lists
- Extended social: compare lists with friends, shared recommendations, real friend profiles replacing demo profiles
- User reviews and film notes per movie
- Gabe's personal story / About page copy (currently placeholder)
- Compound recommendation algorithm feeding on actors, directors, eras, and genres together
- Fill out the remaining entries in the Top 50 Songs list
