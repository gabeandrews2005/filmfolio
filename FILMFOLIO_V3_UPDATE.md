# FilmFolio — v3 Update Spec
## For Claude Code — iterate on existing codebase

This document captures Gabe's 10-page "FilmFolio Updates 2" handwritten notes.
Build on top of the v2 codebase. Do not start over.

---

## New API: OMDB

Add OMDB integration alongside the existing TMDB calls.

- **OMDB API key** stored in `.env` as `VITE_OMDB_API_KEY`
- Get a free key at: https://www.omdbapi.com/apikey.aspx
- Base URL: `https://www.omdbapi.com/`
- Fetch by IMDB ID: `GET /?i={imdb_id}&apikey={key}` — returns `imdbRating` and `Ratings` array which includes Rotten Tomatoes
- IMDB ID for each movie comes from TMDB: `GET /movie/{tmdb_id}/external_ids` → `imdb_id` field
- Cache OMDB responses in localStorage with 24-hour TTL alongside TMDB cache
- If OMDB returns no RT score for a film, fall back to displaying TMDB vote average labeled "TMDB Score"

**Rating display standard (used everywhere scores appear):**
```
🍅 94%   IMDb 8.9
```
If RT unavailable: `★ 8.4 TMDB   IMDb 8.9`

---

## 1. Homepage Updates

### Tagline
Replace "A Movie Lovers Corner" → **"The FilmFolio Experience"**

### Description copy
Replace the current Gabe-authored intro paragraph with this updated copy that reflects what the site actually is now:

> *FilmFolio is your personal film universe. Rank your favorite movies, build lists across every genre, discover films tailored to your taste, and track everything you've seen. Your lists. Your rankings. Your cinema.*

### 4 Stats Bar
Replace existing stats with:
1. **Movies Ranked** — count of films in user's top films list
2. **Years Spanning** — (max year − min year) across all films on their personal list
3. **Films Seen** — count of films in Seen Movies (keep as-is)
4. **Your #1 Film** — poster thumbnail + title of the user's current rank-1 film

If user has no list yet, show zeros and a placeholder for #1.

### "From the Collection" section
Replace with a **full site directory** — a clean grid or list of every page the site offers with icon + label + brief description. Serves as a navigation hub for new users. Include: Explore, My List, Picks for You, Actors, Directors, Shows, Animated, Horror, Comedies, Seasonal, Universe, Seen Films, Watchlist, Friends, Statistics, About.

### Remove "Gabe" name
Remove the name "Gabe" from all copy across the entire site. About page should have a placeholder: *"[Personal statement coming soon]"*. No other page should reference Gabe by name.

---

## 2. Explore Page Updates

### Movie Pool
Replace the current pool logic. The Explore page should pull from a **curated mix** via multiple TMDB endpoints, deduplicated:
- `GET /movie/top_rated` — highly rated films
- `GET /movie/popular` — broad popularity
- `GET /discover/movie?with_awards=true&sort_by=vote_average.desc` — Oscar-caliber (approximate via high vote average + vote count threshold)
- `GET /discover/movie?sort_by=revenue.desc` — high-grossing
- Gabe's `movies.json` entries remain in the pool and receive a subtle **"Featured" gold bookmark badge** (no rank number)

Combine, deduplicate by tmdb_id, shuffle the combined result so it feels organic. Paginate with "Load More" (not infinite scroll — easier to implement reliably).

### Card UI changes
- **Remove** the gold star from the top-left corner of cards
- **Add** a clear **checkbox** in the top-left corner of each poster card
  - Unchecked: subtle transparent outline checkbox
  - Checked: filled gold checkmark — automatically adds film to user's My List (top films list)
  - If the list already has 10 films, prompt: *"Your top 10 is full. Add to your extended list?"* with confirm/cancel
- On the card or hover state, also show a **"Not Interested"** button (X icon) — clicking removes the film from Explore for this user (store in `ff_not_interested` localStorage key)

### Film detail modal updates
When clicking a film card to open the detail modal:
- Replace TMDB rating with **RT score + IMDB rating** (from OMDB) displayed as described above
- Remove the circle/dot UI element next to "Mark as Seen" — just show the checkmark once clicked, nothing before
- Checkmark persists once clicked (seen state)
- Add **"Not Interested"** button — removes film from Explore
- Keep **"+ My List"** button

---

## 3. My List Page (renamed from "My Top 10")

### Naming — rename everywhere in the codebase:
- "My Top 10" → **"My List"**
- "Build Your Top 10" → **"Build Your Film List"**
- Nav label: **"My List"**

### Film source
Films to choose from in the builder should come from the **Explore pool** (TMDB-powered), not from `movies.json`. The search bar searches TMDB directly.

### Flow change
- Once the user ranks their top 10 films, **do not show "View My List" as a button** — automatically navigate to the ranked list view
- Replace "Edit List" button with **"Expand List"** — which opens slots 11–100

### Nav bar
- Remove the gold number badge/count from the nav bar hot bar items — the nav should always look visually consistent regardless of list state

### Remove
- Remove the "Picks For You" button/link from the My List page — it's already in the main nav

---

## 4. Picks for You — Major Update

### Page structure
- Remove the "Based on your top 10, here's how this works" explanation text entirely
- Page starts immediately with the title **"Picks for You"** then straight into the recommendation cards

### Rating display
- Replace match score display with **RT score + IMDB score** from OMDB
- **Match Strength** displayed as a **percentage** (e.g. "87% Match")

### 3-Tier recommendation system
Group all recommendations into three labeled sections displayed in order:

| Tier | Label | Match % Threshold |
|------|-------|------------------|
| 1 | 🔥 Must Watch | 80% and above |
| 2 | ⭐ Great Match | 65%–79% |
| 3 | 👍 Worth the Watch | 50%–64% |

Films below 50% match are not shown.

**Match % calculation:** normalize the frequency score (how many of the user's top 10 films recommended this film via TMDB `/recommendations`) into a 0–100% scale. Max possible score = 10 (recommended by all 10 films) = 100%. Apply actor/director bonus from v2 spec on top, capped at 100%.

### Infinite recommendations
- Remove the 20-film cap entirely
- Maintain a full queue — fetch TMDB recommendations for all top 10 films on load, collect all results, score and sort
- Display all films that score 50%+ match, paginated in tiers
- "Not Interested" removes from queue, "Seen It" also removes from queue and adds to Seen Movies

### Card display
Each recommendation card shows:
- Poster
- Title + year
- 🍅 RT% and IMDb score
- Match % badge (colored by tier: gold for Must Watch, silver for Great Match, bronze for Worth the Watch)
- "Seen It" button
- "Not Interested" button
- "+ Watchlist" button

---

## 5. Actors Page — Updates

### Layout cleanup
- Remove "D/50 ranked" or any ranked count label
- Remove "My Actors" subtitle after the page title
- Page structure: **Page title → Search bar → "Your Picks" label → ranked list**

### Search UX fix
- When user selects an actor from search results by clicking the + button:
  - The + button disappears immediately
  - Actor is added to the list
  - Search bar clears automatically (no need to manually delete the name)

### Reorder
- Press and hold (touch) / drag handle (desktop) to reorder actors up and down — **this must also be implemented on every other list in the app**

### Actor detail on click
When user clicks an actor's photo/card on their list, show a modal with:
- Actor headshot + name
- Brief bio (from TMDB `/person/{id}`)
- Their **top 3 most notable films** (from TMDB `/person/{id}/movie_credits`, sorted by popularity)
- **How many films they appear in on the user's top films list** (cross-reference)

### Themed page aesthetic
- Actors page should have a **Shakespeare / theatre-themed** visual treatment
- Think: quill, stage curtains, parchment texture accents, serif typography flourishes
- Subtle — doesn't overwhelm the content

---

## 6. Directors Page — Updates

- Same look, mechanics, and UX as the Actors page
- Use TMDB `/search/person` for search (filter by `known_for_department: Directing`)
- Director detail modal: same structure as actor modal but show their top 3 directed films + how many of their films are on the user's top list
- **Themed aesthetic:** cameras, film reels, clapperboards — cinematic behind-the-scenes feel

---

## 7. My Shows Page — Updates

- Same mechanics as top films list: **poster, rank number, name**
- After the search bar, go directly into the ranked list — remove any "My Shows" section label, just show the rankings
- Search uses TMDB `/search/tv`
- No themed aesthetic for Shows (Gabe's notes exempt it)
- Press and hold to reorder (universal across all lists)

---

## 8. Animated Page — Updates

- Display: same poster grid as top films list
- Search: only returns animated films — filter TMDB search by genre ID 16 (Animation)
- Press and hold to reorder
- **Themed aesthetic:** playful, well-animated feel — bouncy UI elements, bright accent colors used sparingly against the dark base theme, maybe a subtle animated background element

---

## 9. Horror Page — Updates

- Display: same as top films list
- Search: only returns horror films — filter TMDB search by genre ID 27 (Horror)
- Press and hold to reorder
- **Themed aesthetic:** on page open, brief gory/atmospheric entrance — dark red accent takeover, dripping or splatter CSS animation for 1–2 seconds that settles, knife/blade iconography in decorative elements

---

## 10. Comedies Page — Updates

- Same as Horror and Animated
- Search: filter by genre ID 35 (Comedy)
- Press and hold to reorder
- **Themed aesthetic:** light, fun — slight warm yellow accents, playful typography treatment

---

## 11. Seasonal Page — Updates

- Same as Horror and Animated
- Search: filter by genre ID — use a combination (Holiday films; use TMDB keyword search for "christmas" + "holiday" + "thanksgiving" etc.)
- Press and hold to reorder
- **Themed aesthetic:** On page open, **snow falls for 1–2 seconds** (CSS snowflake animation), then settles. Jolly Christmas vibe — warm red/green accents, subtle twinkle effect on the page header

---

## 12. Universe Page — Updates

- **Remove the stats section at the top** — go straight into the lists
- Everything else about this page is good per Gabe's notes — keep horizontal scroll strips per list, only show sections for lists user has started

---

## 13. Friends Page
- Gabe says "this is good" — no changes needed

---

## 14. Seen Movies Page (new addition to sidebar)

- Add **Seen Movies** to the sidebar/hamburger menu
- Display: same poster grid as top films list, **no search bar**
- Shows all films the user has marked as seen (from `ff_seen`)
- Each card shows: poster, title, year
- **Also show which list(s) the film appears on and its rank** — e.g. a badge: "My List #3" or "Horror #7"
- Films are added to Seen Movies automatically whenever they are added to ANY list
- Press and hold to reorder (or sort by: date added, title, year)

---

## 15. Watchlist Page (new addition to sidebar)

- Add **Watchlist** to the sidebar/hamburger menu
- Display: same poster grid, **no search bar**
- Shows all films in `ff_watchlist`
- Same card format as Seen Movies
- No themed aesthetic

---

## 16. Statistics Page (brand new page — "/statistics")

Add to sidebar/hamburger menu as **"Statistics"**.

Gabe's concept: **"Spotify Wrapped for your film taste"** — a rich, visually engaging breakdown of the user's film identity derived entirely from their lists and localStorage data.

### Stats to display (compute from user's stored lists):

**Top section — "Your Film Aura" header card**
- User's #1 film poster as background, name + a generated "film personality" label (e.g. "The Cinephile", "The Genre Diehard", "The Auteur Chaser" — derive from dominant genre/director patterns)

**Stats grid — compute from ff_top100 + all genre lists:**
- **Total films ranked** across all lists
- **Years spanning** — earliest to latest film year on their lists
- **Average runtime** — average TMDB runtime across their top films list
- **Top genres** — top 3 genres by frequency across all ranked films (pie or bar visualization)
- **Top actors** — actors who appear most across the user's top films list (cross-reference TMDB credits)
- **Top directors** — directors who appear most across the user's top films list
- **Top production companies** — from TMDB movie details, which companies appear most
- **Favorite decade** — which decade has the most films across their lists
- **Films seen count** — from ff_seen
- **Watchlist count** — films waiting to be seen

### Visual treatment
- Dark background with gold accent data visualizations
- Animated counters on load (numbers count up)
- Section cards with subtle glow/highlight
- Should feel like a celebration of the user's taste — not a boring data table

### Implementation note
All stats are computed client-side from localStorage data + cached TMDB metadata. No backend needed. Compute on page load, show loading skeleton while computing.

---

## 17. Sidebar / Hamburger Menu — Final Order

The hamburger menu items should appear in this exact order:
1. Actors
2. Directors
3. Shows
4. Animated
5. Horror
6. Comedies
7. Seasonal
8. Seen Films
9. Watchlist
10. Universe
11. Friends
12. Statistics
13. About

---

## 18. Universal UX Rules (apply across all pages)

- **Autosave** — all lists save automatically whenever a film/person is added, removed, or reordered. No manual save button needed.
- **Press and hold to reorder** — available on every ranked list in the app (top films, actors, directors, shows, animated, horror, comedies, seasonal). Use the same drag-handle component everywhere.
- **Adding to any list = added to Seen Movies** — whenever a film is added to any movie list (top films, horror, comedies, animated, seasonal, watchlist), it is automatically added to `ff_seen`.
- **Nav bar always looks the same** — remove any dynamic badges/counts from the main nav bar items.

---

## 19. About Page
- Remove the photo placeholder
- Remove the "get in touch" / contact section
- Replace body with: *"[Personal statement coming soon]"*

---

## 20. New Environment Variables

```
VITE_TMDB_API_KEY=your_tmdb_v3_key
VITE_OMDB_API_KEY=your_omdb_key
```

Add both to Vercel environment variables. Update `.env.example` with both placeholders.

OMDB free key: https://www.omdbapi.com/apikey.aspx (instant, no credit card)

---

## 21. localStorage Schema — Final State

```javascript
ff_user           // { username, avatar, createdAt }
ff_seen           // Array of tmdb_ids (Set-like, deduped)
ff_not_interested // Array of tmdb_ids (excluded from Explore + Picks)
ff_top100         // Array of { tmdb_id, rank } — user's personal ranked film list (10–100)
ff_actors         // Array of { person_id, name, headshot_path, rank }
ff_directors      // Array of { person_id, name, headshot_path, rank }
ff_shows          // Array of { tmdb_id, rank }
ff_animated       // Array of { tmdb_id, rank }
ff_horror         // Array of { tmdb_id, rank }
ff_comedies       // Array of { tmdb_id, rank }
ff_seasonal       // Array of { tmdb_id, rank }
ff_watchlist      // Array of tmdb_ids
ff_tmdb_cache     // { [tmdb_id]: { data, timestamp } } — 24hr TTL
ff_omdb_cache     // { [imdb_id]: { data, timestamp } } — 24hr TTL
```

---

## 22. New / Modified Files Summary

### New pages
- `/statistics` → `Statistics.jsx`
- `/seen` → `SeenFilms.jsx`
- `/watchlist` → `Watchlist.jsx` (if not already a page)

### Modified pages
- `Home.jsx` — new tagline, new stats, new site directory section, remove Gabe name
- `Explore.jsx` — new pool logic, checkbox UX, not interested, OMDB ratings
- `MyList.jsx` — rename, flow change, source change, expand button
- `Recommendations.jsx` — 3-tier system, infinite queue, OMDB ratings, seen/not-interested
- `Actors.jsx` — layout cleanup, search UX fix, actor modal, Shakespeare theme
- `Directors.jsx` — match Actors, cameras/reels theme
- `Shows.jsx` — layout cleanup, poster/rank display
- `Animated.jsx` — genre filter, animated theme
- `Horror.jsx` — genre filter, horror theme + entrance animation
- `Comedies.jsx` — genre filter, comedy theme
- `Seasonal.jsx` — keyword filter, snow entrance animation, Christmas theme
- `Universe.jsx` — remove stats header
- `About.jsx` — remove photo and contact, placeholder copy
- `Nav.jsx` — remove badges, update menu order

### New/modified components
- `RatingDisplay.jsx` — reusable RT + IMDB display component (used everywhere)
- `DragHandle.jsx` — universal press-and-hold/drag reorder (used on all lists)
- `FilmCard.jsx` — add checkbox, not-interested, updated modal with OMDB ratings
- `ActorModal.jsx` — actor/director detail popup
- `StatCard.jsx` — individual stat display for Statistics page
- `SnowAnimation.jsx` — CSS snowfall for Seasonal page entrance
- `HorrorEntrance.jsx` — drip/splatter CSS animation for Horror page entrance
- `api/omdb.js` — OMDB fetch + cache logic

---

## Out of Scope for This Iteration
- Real authentication / Supabase
- Real social graph / live friends data
- Backend database
