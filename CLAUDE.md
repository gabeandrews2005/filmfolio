# FilmFolio — Project Reference

## What This Is

**FilmFolio** is Gabe's personal movie curator web app. It showcases his curated Top 100 film list, lets visitors mark what they've seen, build their own Top 10, and receive TMDB-powered recommendations. There is also a full "Universe" section covering his other ranked lists (shows, actors, directors, animation, comedies, horror, seasonal, nostalgic picks, and favorite songs).

**Status:** Phase 1 complete. Fully built, deployed, and live on Vercel. GitHub repo: `jmandrews1975/filmfolio`.

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
| Drag-to-rank | `@hello-pangea/dnd` |
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
- `GET /movie/{tmdb_id}/credits` — director, top 5 cast
- `GET /movie/{tmdb_id}/recommendations` — powers the recommendation algorithm
- `GET /search/movie` — Top 10 Builder search

### Caching
24-hour TTL in `localStorage`. Cache keys prefixed `ff_tmdb_d_` (details), `ff_tmdb_c_` (credits), `ff_tmdb_r_` (recommendations).

### Fallback
If `VITE_TMDB_READ_TOKEN` is unset or the API is unreachable, the grid still renders from `movies.json` seed data with a placeholder SVG poster. No hard failure.

### Recommendation algorithm
1. For each movie in the user's Top 10, call `/movie/{tmdb_id}/recommendations`
2. Collect all results, deduplicate by `tmdb_id`
3. Exclude movies already in the user's Top 10 or in Gabe's Top 100
4. Score by **frequency of appearance** across all calls
5. Sort descending by score; surface top 20 with a full queue behind them
6. "Not Interested" pops the next item from the queue without re-fetching

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
Fields added from Gabe's spreadsheet: `rt_score` (integer %), `overall_rating` (out of 10), `avg_score` (composite out of 10). `genres` is used by the FilterBar.

### Supplementary lists (read-only reference data)
| File | Contents |
|---|---|
| `shows.json` | Top 15 TV shows with best season + best episode |
| `actors.json` | Top 50 actors with Oscar stats, RT metrics, films in top 100 |
| `directors.json` | Top 26 directors with same stats |
| `animated.json` | Top 25 animated films not on the main Top 100 |
| `comedies.json` | Top 17 pure comedies not on the main Top 100 |
| `horror.json` | Top 10 horror films not on the main Top 100 |
| `seasonal.json` | Top 10 seasonal films (Christmas/Halloween) |
| `nostalgic.json` | Top 10 nostalgic films with nostalgia rating |
| `songs.json` | Top 21 original film songs (list is 21 entries; rest were blank) |

All supplementary data is displayed on the `/universe` page.

---

## File Structure

```
filmfolio/
├── src/
│   ├── api/
│   │   └── tmdb.js                 # all TMDB fetches, cache, enrichment, recommendations
│   ├── context/
│   │   └── FilmContext.jsx         # global state: movies, seenList, myTop10, watchlist
│   ├── data/
│   │   ├── movies.json             # Gabe's Top 100 — SACRED
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
│   │   ├── Nav.jsx + Nav.module.css
│   │   ├── MovieCard.jsx + MovieCard.module.css
│   │   ├── MovieGrid.jsx + MovieGrid.module.css
│   │   ├── FilterBar.jsx + FilterBar.module.css
│   │   ├── ProgressTracker.jsx + ProgressTracker.module.css
│   │   ├── TopTenBuilder.jsx + TopTenBuilder.module.css
│   │   └── RecommendationCard.jsx + RecommendationCard.module.css
│   ├── pages/
│   │   ├── Home.jsx + Home.module.css
│   │   ├── Movies.jsx + Movies.module.css
│   │   ├── MyList.jsx + MyList.module.css
│   │   ├── Recommendations.jsx + Recommendations.module.css
│   │   ├── Universe.jsx + Universe.module.css
│   │   └── About.jsx + About.module.css
│   ├── App.jsx                     # BrowserRouter, Routes, FilmProvider
│   ├── index.css                   # global tokens, reset, scrollbar
│   └── main.jsx                    # ReactDOM entry point
├── index.html                      # Google Fonts link tags
├── vite.config.js
├── package.json
├── .env                            # VITE_TMDB_READ_TOKEN — gitignored, never commit
├── .env.example
└── .gitignore
```

---

## Pages

### `/` — Home
Hero with crossfading TMDB backdrops (6s interval, 1.2s fade), SVG film grain overlay via CSS `feTurbulence`, vignette, site title, tagline, two CTAs. Stats strip (100 films, year range, seen count). Horizontal scrolling Featured Films strip showing 10 random top-100 posters.

### `/movies` — Explore Top 100
ProgressTracker (sticky "X of 100 seen" gold bar) + FilterBar + MovieGrid. Client-side filtering/sorting via `useMemo`. FilterBar: Genre, Director, Decade, Seen/Unseen dropdowns; Rank/Year/Rating/Title sort. Cards have hover overlay with synopsis, director, rating, seen checkbox, and "+ Top 10" button.

### `/my-list` — My Top 10
TopTenBuilder: left panel has TMDB search (debounced 350ms) + top-100 pool; right panel is drag-to-rank list via `@hello-pangea/dnd`. Max 10 slots. "Get Recommendations" enabled after 3 picks; navigates to `/recommendations`.

### `/recommendations` — Picks For You
Calls `buildRecommendations(top10, top100)` from `tmdb.js`. Displays queue of 20. "Not Interested" removes an entry and surfaces the next from the full sorted queue. Empty state if no Top 10 saved.

### `/universe` — Gabe's Universe
Tab-based browser for all supplementary lists. Nine tabs: Top 15 Shows, Top 50 Actors, Top 26 Directors, Top 25 Animated, Pure Comedies, Horror, Seasonal, Nostalgic, Top Songs. Gold-accented rating bar component. Tables are horizontally scrollable on mobile.

### `/about` — About
Placeholder for Gabe's personal story, photo, and contact info.

---

## State & Persistence

All state lives in `localStorage` (no backend). Managed via `FilmContext.jsx`.

| Key | Type | Contents |
|---|---|---|
| `ff_seen` | JSON array | tmdb_ids of seen films |
| `ff_top10` | JSON array | user's Top 10 (full movie objects) |
| `ff_watchlist` | JSON array | watchlisted recommendations |

`FilmContext` progressive-enriches `movies` on mount: seed data renders immediately, TMDB data fills in batches of 10.

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
3. **No backend** — all persistence via `localStorage`. Phase 2 plans Supabase auth.
4. **TMDB enrichment is live** — poster URLs are not baked into JSON. Always fetch and cache.
5. **Recommendation queue** — maintain the full sorted queue beyond 20. "Not Interested" pops from the queue, never re-fetches.
6. **Mobile first** — poster grid must look good on phones (2 cols minimum).
7. **Fallback** — if TMDB is unreachable, render from seed data with placeholder poster SVG.

---

## Phase 2 (out of scope now)

- Supabase auth — user accounts, cloud-persisted seen list / Top 10 / watchlist
- Extended preference dimensions: favorite actors, directors, eras feeding compound recommendation algorithm
- Social features: compare lists with friends, shared recommendations
- User reviews and film notes
- Gabe's personal story / About page copy (currently placeholder)
- Fill out the remaining ~29 entries in the Top 50 Songs list
