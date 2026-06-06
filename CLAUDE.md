# FilmFolio — Claude Code Project Specification

## Project Overview

**FilmFolio** is a personal movie curator web app built as a passion project. The site showcases a curated top 100 film list, lets visitors mark what they've seen, build their own top 10, and receive personalized movie recommendations powered by The Movie Database (TMDB) API.

**Phase 1 target:** Working local prototype with stubbed movie data (no real auth, no persistent backend database). All state lives in `localStorage` for the prototype.

**Division of labor:** Engineering via Claude Code. Creative direction by Gabe (site owner). The movie list (`movies.json`) is a placeholder seed file — Gabe will replace it with his personal top 100 later.

---

## Design Direction

### Aesthetic: "Criterion meets Letterboxd"

The site should feel like a personal film journal from someone with genuine taste — not a corporate streaming platform. Think darkened theater, warm light, and the tactile feel of a Criterion booklet.

**Color palette (CSS variables):**
```css
--bg-primary:     #0d0d0d;   /* near-black */
--bg-secondary:   #141414;   /* card backgrounds */
--bg-tertiary:    #1e1e1e;   /* elevated surfaces */
--accent-gold:    #c9a84c;   /* primary accent — warm amber/gold */
--accent-red:     #8b1a1a;   /* secondary accent — cinematic red */
--text-primary:   #f0ece4;   /* warm off-white */
--text-secondary: #a09a8e;   /* muted warm gray */
--text-muted:     #5a5550;
--border:         #2a2520;
```

**Typography:**
- **Display / headings:** `Playfair Display` (Google Fonts) — editorial, classic, authoritative
- **UI / body:** `DM Sans` (Google Fonts) — clean, modern, readable
- **Accent / labels:** `DM Mono` for ratings, counts, codes

**Visual details:**
- Subtle film grain overlay on the hero section (CSS noise texture or SVG filter)
- Vignette effect on hero background
- Movie poster cards with a 2:3 aspect ratio, slight box shadow, hover lift + reveal overlay
- Transitions: 200–300ms ease, nothing jarring
- Grid: responsive, poster-forward — roughly 5–6 columns on desktop, 2–3 on mobile

**Overall feel:** Sophisticated but warm. Personal, not corporate. A movie lover's space.

---

## Tech Stack (Claude Code to decide specifics, guidance below)

- **Frontend:** React (Vite) — component-based, fast dev iteration
- **Styling:** Tailwind CSS OR CSS Modules with the custom design tokens above (prefer whichever gives cleaner component code)
- **State:** React Context + `localStorage` for prototype persistence (watched list, user top 10)
- **API:** TMDB API (v3) — used to enrich the seed movie list with live metadata
- **No backend for Phase 1** — all logic is client-side
- **Routing:** React Router v6

---

## TMDB API Integration

### Setup
- API key stored in `.env` as `VITE_TMDB_API_KEY`
- Base URL: `https://api.themoviedb.org/3`
- Image base: `https://image.tmdb.org/t/p/w500` (posters), `w1280` (backdrops)

### What TMDB provides for the top 100
On app load (or build time), for each movie in `movies.json`, fetch:
- `GET /movie/{tmdb_id}` → title, overview, release date, runtime, genres, vote average
- `GET /movie/{tmdb_id}/credits` → top cast (first 5), director
- Poster path + backdrop path for imagery

Cache all enriched data in `localStorage` with a TTL of 24 hours to avoid hammering the API on every load.

### Recommendation algorithm (Phase 1 — TMDB-powered)
When a user finalizes their top 10:
1. For each movie in the user's top 10, call `GET /movie/{tmdb_id}/recommendations`
2. Collect all results, deduplicate by `tmdb_id`
3. Remove any movies already in the user's top 10 or in Gabe's top 100
4. Score each remaining movie by **frequency of appearance** across the recommendation calls (a movie recommended by 3 of the user's top 10 scores 3x higher than one recommended by 1)
5. Sort descending by score, surface the top 20
6. Display with poster, title, year, TMDB rating, and a brief overview
7. "Not Interested" removes that movie from the list and surfaces the next one in the queue

---

## Data Files

### `/src/data/movies.json`

This is the **stub seed file** — Gabe will replace this with his personal list. It contains 100 films with `tmdb_id` values so the app can enrich them live from TMDB.

The file format:
```json
[
  {
    "rank": 1,
    "title": "2001: A Space Odyssey",
    "year": 1968,
    "tmdb_id": 62,
    "director": "Stanley Kubrick",
    "genres": ["Science Fiction", "Drama"]
  }
]
```

**Full seed list of 100 films** (drawn from AFI Top 100, Sight & Sound Greatest Films, and Letterboxd community favorites — a broad range of eras and styles):

```json
[
  { "rank": 1,  "title": "2001: A Space Odyssey",           "year": 1968, "tmdb_id": 62,     "director": "Stanley Kubrick",        "genres": ["Science Fiction", "Drama"] },
  { "rank": 2,  "title": "The Godfather",                   "year": 1972, "tmdb_id": 238,    "director": "Francis Ford Coppola",   "genres": ["Crime", "Drama"] },
  { "rank": 3,  "title": "Schindler's List",                "year": 1993, "tmdb_id": 424,    "director": "Steven Spielberg",       "genres": ["Drama", "History", "War"] },
  { "rank": 4,  "title": "Apocalypse Now",                  "year": 1979, "tmdb_id": 28,     "director": "Francis Ford Coppola",   "genres": ["Drama", "War"] },
  { "rank": 5,  "title": "Mulholland Drive",                "year": 2001, "tmdb_id": 1018,   "director": "David Lynch",            "genres": ["Drama", "Mystery", "Thriller"] },
  { "rank": 6,  "title": "Vertigo",                         "year": 1958, "tmdb_id": 4154,   "director": "Alfred Hitchcock",       "genres": ["Mystery", "Romance", "Thriller"] },
  { "rank": 7,  "title": "Taxi Driver",                     "year": 1976, "tmdb_id": 703,    "director": "Martin Scorsese",        "genres": ["Crime", "Drama", "Thriller"] },
  { "rank": 8,  "title": "There Will Be Blood",             "year": 2007, "tmdb_id": 7345,   "director": "Paul Thomas Anderson",   "genres": ["Drama", "History"] },
  { "rank": 9,  "title": "Chinatown",                       "year": 1974, "tmdb_id": 1947,   "director": "Roman Polanski",         "genres": ["Crime", "Drama", "Mystery", "Thriller"] },
  { "rank": 10, "title": "Blade Runner",                    "year": 1982, "tmdb_id": 78,     "director": "Ridley Scott",           "genres": ["Science Fiction", "Drama", "Thriller"] },
  { "rank": 11, "title": "The Dark Knight",                 "year": 2008, "tmdb_id": 155,    "director": "Christopher Nolan",      "genres": ["Action", "Crime", "Drama"] },
  { "rank": 12, "title": "Goodfellas",                      "year": 1990, "tmdb_id": 769,    "director": "Martin Scorsese",        "genres": ["Crime", "Drama"] },
  { "rank": 13, "title": "Pulp Fiction",                    "year": 1994, "tmdb_id": 680,    "director": "Quentin Tarantino",      "genres": ["Crime", "Drama", "Thriller"] },
  { "rank": 14, "title": "Rear Window",                     "year": 1954, "tmdb_id": 4108,   "director": "Alfred Hitchcock",       "genres": ["Mystery", "Thriller"] },
  { "rank": 15, "title": "Citizen Kane",                    "year": 1941, "tmdb_id": 15,     "director": "Orson Welles",           "genres": ["Drama", "Mystery"] },
  { "rank": 16, "title": "The Shining",                     "year": 1980, "tmdb_id": 694,    "director": "Stanley Kubrick",        "genres": ["Drama", "Horror"] },
  { "rank": 17, "title": "Spirited Away",                   "year": 2001, "tmdb_id": 129,    "director": "Hayao Miyazaki",         "genres": ["Animation", "Adventure", "Family", "Fantasy"] },
  { "rank": 18, "title": "No Country for Old Men",          "year": 2007, "tmdb_id": 6977,   "director": "Coen Brothers",          "genres": ["Crime", "Drama", "Thriller"] },
  { "rank": 19, "title": "The Silence of the Lambs",        "year": 1991, "tmdb_id": 274,    "director": "Jonathan Demme",         "genres": ["Crime", "Drama", "Thriller"] },
  { "rank": 20, "title": "Parasite",                        "year": 2019, "tmdb_id": 496243, "director": "Bong Joon-ho",           "genres": ["Comedy", "Drama", "Thriller"] },
  { "rank": 21, "title": "Rashomon",                        "year": 1950, "tmdb_id": 548,    "director": "Akira Kurosawa",         "genres": ["Crime", "Drama"] },
  { "rank": 22, "title": "Casablanca",                      "year": 1942, "tmdb_id": 289,    "director": "Michael Curtiz",         "genres": ["Drama", "Romance", "War"] },
  { "rank": 23, "title": "Eternal Sunshine of the Spotless Mind", "year": 2004, "tmdb_id": 38,  "director": "Michel Gondry",     "genres": ["Drama", "Romance", "Science Fiction"] },
  { "rank": 24, "title": "Singin' in the Rain",             "year": 1952, "tmdb_id": 11566,  "director": "Stanley Donen / Gene Kelly", "genres": ["Comedy", "Music", "Romance"] },
  { "rank": 25, "title": "Stalker",                         "year": 1979, "tmdb_id": 10770,  "director": "Andrei Tarkovsky",       "genres": ["Drama", "Science Fiction"] },
  { "rank": 26, "title": "Sunset Boulevard",                "year": 1950, "tmdb_id": 5765,   "director": "Billy Wilder",           "genres": ["Drama", "Film Noir", "Mystery"] },
  { "rank": 27, "title": "City of God",                     "year": 2002, "tmdb_id": 598,    "director": "Fernando Meirelles",     "genres": ["Crime", "Drama"] },
  { "rank": 28, "title": "The 400 Blows",                   "year": 1959, "tmdb_id": 978,    "director": "François Truffaut",      "genres": ["Crime", "Drama"] },
  { "rank": 29, "title": "Full Metal Jacket",               "year": 1987, "tmdb_id": 600,    "director": "Stanley Kubrick",        "genres": ["Drama", "War"] },
  { "rank": 30, "title": "Bicycle Thieves",                 "year": 1948, "tmdb_id": 957,    "director": "Vittorio De Sica",       "genres": ["Drama"] },
  { "rank": 31, "title": "A Clockwork Orange",              "year": 1971, "tmdb_id": 185,    "director": "Stanley Kubrick",        "genres": ["Crime", "Drama", "Science Fiction"] },
  { "rank": 32, "title": "Amadeus",                         "year": 1984, "tmdb_id": 197,    "director": "Miloš Forman",           "genres": ["Drama", "History", "Music"] },
  { "rank": 33, "title": "Heat",                            "year": 1995, "tmdb_id": 949,    "director": "Michael Mann",           "genres": ["Action", "Crime", "Drama", "Thriller"] },
  { "rank": 34, "title": "Aliens",                          "year": 1986, "tmdb_id": 679,    "director": "James Cameron",          "genres": ["Action", "Adventure", "Science Fiction", "Thriller"] },
  { "rank": 35, "title": "The Departed",                    "year": 2006, "tmdb_id": 1422,   "director": "Martin Scorsese",        "genres": ["Crime", "Drama", "Thriller"] },
  { "rank": 36, "title": "Seven Samurai",                   "year": 1954, "tmdb_id": 346,    "director": "Akira Kurosawa",         "genres": ["Action", "Adventure", "Drama"] },
  { "rank": 37, "title": "Once Upon a Time in the West",   "year": 1968, "tmdb_id": 4385,   "director": "Sergio Leone",           "genres": ["Western"] },
  { "rank": 38, "title": "Moonlight",                       "year": 2016, "tmdb_id": 376867, "director": "Barry Jenkins",          "genres": ["Drama"] },
  { "rank": 39, "title": "All About Eve",                   "year": 1950, "tmdb_id": 2132,   "director": "Joseph L. Mankiewicz",   "genres": ["Drama"] },
  { "rank": 40, "title": "Fargo",                           "year": 1996, "tmdb_id": 275,    "director": "Coen Brothers",          "genres": ["Crime", "Drama", "Thriller"] },
  { "rank": 41, "title": "The Good, the Bad and the Ugly", "year": 1966, "tmdb_id": 1552,   "director": "Sergio Leone",           "genres": ["Western"] },
  { "rank": 42, "title": "Lawrence of Arabia",              "year": 1962, "tmdb_id": 3114,   "director": "David Lean",             "genres": ["Adventure", "Drama", "History", "War"] },
  { "rank": 43, "title": "Psycho",                          "year": 1960, "tmdb_id": 539,    "director": "Alfred Hitchcock",       "genres": ["Horror", "Mystery", "Thriller"] },
  { "rank": 44, "title": "Andrei Rublev",                   "year": 1966, "tmdb_id": 11798,  "director": "Andrei Tarkovsky",       "genres": ["Drama", "History", "War"] },
  { "rank": 45, "title": "Magnolia",                        "year": 1999, "tmdb_id": 334,    "director": "Paul Thomas Anderson",   "genres": ["Drama"] },
  { "rank": 46, "title": "12 Angry Men",                    "year": 1957, "tmdb_id": 389,    "director": "Sidney Lumet",           "genres": ["Drama"] },
  { "rank": 47, "title": "Pan's Labyrinth",                 "year": 2006, "tmdb_id": 1minut, "director": "Guillermo del Toro",     "genres": ["Drama", "Fantasy", "War"] },
  { "rank": 47, "title": "Pan's Labyrinth",                 "year": 2006, "tmdb_id": 1378,   "director": "Guillermo del Toro",     "genres": ["Drama", "Fantasy", "War"] },
  { "rank": 48, "title": "The Master",                      "year": 2012, "tmdb_id": 64689,  "director": "Paul Thomas Anderson",   "genres": ["Drama"] },
  { "rank": 49, "title": "Whiplash",                        "year": 2014, "tmdb_id": 244786, "director": "Damien Chazelle",        "genres": ["Drama", "Music"] },
  { "rank": 50, "title": "Inglourious Basterds",            "year": 2009, "tmdb_id": 16869,  "director": "Quentin Tarantino",      "genres": ["Adventure", "Drama", "War"] },
  { "rank": 51, "title": "Dr. Strangelove",                 "year": 1964, "tmdb_id": 935,    "director": "Stanley Kubrick",        "genres": ["Comedy", "War"] },
  { "rank": 52, "title": "The Tree of Life",                "year": 2011, "tmdb_id": 63266,  "director": "Terrence Malick",        "genres": ["Drama", "Fantasy"] },
  { "rank": 53, "title": "Lost in Translation",             "year": 2003, "tmdb_id": 153,    "director": "Sofia Coppola",          "genres": ["Drama", "Romance"] },
  { "rank": 54, "title": "Memento",                         "year": 2000, "tmdb_id": 77,     "director": "Christopher Nolan",      "genres": ["Mystery", "Thriller"] },
  { "rank": 55, "title": "The Godfather Part II",           "year": 1974, "tmdb_id": 240,    "director": "Francis Ford Coppola",   "genres": ["Crime", "Drama"] },
  { "rank": 56, "title": "Ran",                             "year": 1985, "tmdb_id": 11878,  "director": "Akira Kurosawa",         "genres": ["Action", "Drama", "War"] },
  { "rank": 57, "title": "Once Upon a Time in America",    "year": 1984, "tmdb_id": 11426,  "director": "Sergio Leone",           "genres": ["Crime", "Drama"] },
  { "rank": 58, "title": "It's a Wonderful Life",           "year": 1946, "tmdb_id": 1585,   "director": "Frank Capra",            "genres": ["Drama", "Family", "Fantasy"] },
  { "rank": 59, "title": "Toy Story",                       "year": 1995, "tmdb_id": 862,    "director": "John Lasseter",          "genres": ["Animation", "Adventure", "Comedy", "Family", "Fantasy"] },
  { "rank": 60, "title": "Barry Lyndon",                    "year": 1975, "tmdb_id": 8015,   "director": "Stanley Kubrick",        "genres": ["Adventure", "Drama", "History", "War"] },
  { "rank": 61, "title": "In the Mood for Love",            "year": 2000, "tmdb_id": 10530,  "director": "Wong Kar-wai",           "genres": ["Drama", "Romance"] },
  { "rank": 62, "title": "Come and See",                    "year": 1985, "tmdb_id": 11517,  "director": "Elem Klimov",            "genres": ["Drama", "War"] },
  { "rank": 63, "title": "Oldboy",                          "year": 2003, "tmdb_id": 670,    "director": "Park Chan-wook",         "genres": ["Action", "Drama", "Mystery", "Thriller"] },
  { "rank": 64, "title": "Reservoir Dogs",                  "year": 1992, "tmdb_id": 500,    "director": "Quentin Tarantino",      "genres": ["Crime", "Thriller"] },
  { "rank": 65, "title": "The Pianist",                     "year": 2002, "tmdb_id": 423,    "director": "Roman Polanski",         "genres": ["Drama", "War"] },
  { "rank": 66, "title": "Before Sunset",                   "year": 2004, "tmdb_id": 454,    "director": "Richard Linklater",      "genres": ["Drama", "Romance"] },
  { "rank": 67, "title": "Mad Max: Fury Road",              "year": 2015, "tmdb_id": 76341,  "director": "George Miller",          "genres": ["Action", "Adventure", "Science Fiction", "Thriller"] },
  { "rank": 68, "title": "The Truman Show",                 "year": 1998, "tmdb_id": 37165,  "director": "Peter Weir",             "genres": ["Comedy", "Drama"] },
  { "rank": 69, "title": "Brokeback Mountain",              "year": 2005, "tmdb_id": broke,  "director": "Ang Lee",                "genres": ["Drama", "Romance", "Western"] },
  { "rank": 69, "title": "Brokeback Mountain",              "year": 2005, "tmdb_id": 73,     "director": "Ang Lee",                "genres": ["Drama", "Romance", "Western"] },
  { "rank": 70, "title": "Annie Hall",                      "year": 1977, "tmdb_id": 703,    "director": "Woody Allen",            "genres": ["Comedy", "Romance"] },
  { "rank": 71, "title": "The Revenant",                    "year": 2015, "tmdb_id": 281957, "director": "Alejandro González Iñárritu", "genres": ["Adventure", "Drama", "Western"] },
  { "rank": 72, "title": "Children of Men",                 "year": 2006, "tmdb_id": 9693,   "director": "Alfonso Cuarón",         "genres": ["Action", "Drama", "Science Fiction", "Thriller"] },
  { "rank": 73, "title": "Interstellar",                    "year": 2014, "tmdb_id": 157336, "director": "Christopher Nolan",      "genres": ["Adventure", "Drama", "Science Fiction"] },
  { "rank": 74, "title": "The Royal Tenenbaums",            "year": 2001, "tmdb_id": 9428,   "director": "Wes Anderson",           "genres": ["Comedy", "Drama"] },
  { "rank": 75, "title": "Requiem for a Dream",             "year": 2000, "tmdb_id": 641,    "director": "Darren Aronofsky",       "genres": ["Drama"] },
  { "rank": 76, "title": "Paths of Glory",                  "year": 1957, "tmdb_id": 1150,   "director": "Stanley Kubrick",        "genres": ["Drama", "War"] },
  { "rank": 77, "title": "Network",                         "year": 1976, "tmdb_id": 9552,   "director": "Sidney Lumet",           "genres": ["Drama"] },
  { "rank": 78, "title": "The Shawshank Redemption",        "year": 1994, "tmdb_id": 278,    "director": "Frank Darabont",         "genres": ["Crime", "Drama"] },
  { "rank": 79, "title": "Roma",                            "year": 2018, "tmdb_id": 511364, "director": "Alfonso Cuarón",         "genres": ["Drama"] },
  { "rank": 80, "title": "Portrait of a Lady on Fire",      "year": 2019, "tmdb_id": 604720, "director": "Céline Sciamma",         "genres": ["Drama", "Romance"] },
  { "rank": 81, "title": "Grave of the Fireflies",          "year": 1988, "tmdb_id": 12477,  "director": "Isao Takahata",          "genres": ["Animation", "Drama", "War"] },
  { "rank": 82, "title": "The Night of the Hunter",         "year": 1955, "tmdb_id": 6413,   "director": "Charles Laughton",       "genres": ["Drama", "Thriller"] },
  { "rank": 83, "title": "Jaws",                            "year": 1975, "tmdb_id": 578,    "director": "Steven Spielberg",       "genres": ["Horror", "Thriller"] },
  { "rank": 84, "title": "Certified Copy",                  "year": 2010, "tmdb_id": 44879,  "director": "Abbas Kiarostami",       "genres": ["Drama", "Romance"] },
  { "rank": 85, "title": "Her",                             "year": 2013, "tmdb_id": 152601, "director": "Spike Jonze",            "genres": ["Drama", "Romance", "Science Fiction"] },
  { "rank": 86, "title": "Midnight Cowboy",                 "year": 1969, "tmdb_id": 5765,   "director": "John Schlesinger",       "genres": ["Drama"] },
  { "rank": 87, "title": "The Social Network",              "year": 2010, "tmdb_id": 37799,  "director": "David Fincher",          "genres": ["Drama"] },
  { "rank": 88, "title": "Eyes Wide Shut",                  "year": 1999, "tmdb_id": 861,    "director": "Stanley Kubrick",        "genres": ["Drama", "Mystery", "Thriller"] },
  { "rank": 89, "title": "Princess Mononoke",               "year": 1997, "tmdb_id": 128,    "director": "Hayao Miyazaki",         "genres": ["Action", "Adventure", "Animation", "Fantasy"] },
  { "rank": 90, "title": "All Quiet on the Western Front",  "year": 2022, "tmdb_id": 765245, "director": "Edward Berger",          "genres": ["Drama", "War"] },
  { "rank": 91, "title": "Blue Velvet",                     "year": 1986, "tmdb_id": 9647,   "director": "David Lynch",            "genres": ["Crime", "Drama", "Mystery", "Thriller"] },
  { "rank": 92, "title": "The Conversations",               "year": 1974, "tmdb_id": 4538,   "director": "Francis Ford Coppola",   "genres": ["Crime", "Drama", "Mystery", "Thriller"] },
  { "rank": 93, "title": "Boogie Nights",                   "year": 1997, "tmdb_id": 2758,   "director": "Paul Thomas Anderson",   "genres": ["Crime", "Drama"] },
  { "rank": 94, "title": "Do the Right Thing",              "year": 1989, "tmdb_id": 10648,  "director": "Spike Lee",              "genres": ["Drama"] },
  { "rank": 95, "title": "Bonnie and Clyde",                "year": 1967, "tmdb_id": 3060,   "director": "Arthur Penn",            "genres": ["Crime", "Drama", "Thriller"] },
  { "rank": 96, "title": "The Battle of Algiers",           "year": 1966, "tmdb_id": 10529,  "director": "Gillo Pontecorvo",       "genres": ["Drama", "History", "War"] },
  { "rank": 97, "title": "2046",                            "year": 2004, "tmdb_id": 10739,  "director": "Wong Kar-wai",           "genres": ["Drama", "Romance", "Science Fiction"] },
  { "rank": 98, "title": "Boyhood",                         "year": 2014, "tmdb_id": 209112, "director": "Richard Linklater",      "genres": ["Drama"] },
  { "rank": 99, "title": "Shoah",                           "year": 1985, "tmdb_id": 7966,   "director": "Claude Lanzmann",        "genres": ["Documentary", "History", "War"] },
  { "rank": 100,"title": "The Conversation",                "year": 1974, "tmdb_id": 4538,   "director": "Francis Ford Coppola",   "genres": ["Crime", "Drama", "Mystery", "Thriller"] }
]
```

> **Note for Gabe:** When you're ready, replace this file entirely with your personal list. Each entry needs at minimum: `rank`, `title`, `year`, and `tmdb_id`. You can find a movie's TMDB ID by searching at [themoviedb.org](https://www.themoviedb.org) and pulling the number from the URL (e.g., `/movie/238` → `tmdb_id: 238`).

---

## Pages & Components

### 1. Homepage (`/`)

**Hero Section**
- Full-width banner with a rotating backdrop image (pulled from TMDB backdrops of top-ranked films)
- Film grain texture overlay
- Site title: **FilmFolio** in Playfair Display
- Tagline: *"Discover Your Perfect Movie Picks"*
- Two CTA buttons: `Explore My Top 100` → `/movies` | `Build Your Top 10` → `/my-list`

**Intro Section**
- Welcome copy (from Gabe's doc — use as-is)
- Quick stats: e.g., "100 films curated · Spanning 1941–2024 · 12 countries"

**Featured Films strip** — horizontally scrolling row of 10 random top-100 posters as a teaser

---

### 2. Explore Top 100 (`/movies`)

**Movie Grid**
- Responsive poster grid (5–6 cols desktop, 2–3 mobile)
- Each card: poster image, rank badge, title, year
- Hover state: overlay with synopsis excerpt, director, TMDB rating, "Mark as Seen" checkbox

**Filter Bar**
- Filter by: Genre | Director | Decade | Seen/Unseen
- Sort by: Rank | Year | Rating | Title

**Progress Tracker**
- Sticky banner: `You've seen X of 100 films` with a progress bar in gold

---

### 3. My Top 10 (`/my-list`)

**Movie Search**
- Search box hitting TMDB `/search/movie` — users can add *any* movie, not just from the top 100
- Autocomplete suggestions as they type

**Selection Interface**
- Left panel: search results + their "seen" movies from top 100 to drag from
- Right panel: their current top 10 (drag-to-rank, reorderable)
- Max 10 slots, numbered 1–10

**Save & Get Recommendations button**
- Saves list to `localStorage`
- Navigates to `/recommendations`

---

### 4. Recommendations (`/recommendations`)

**Algorithm status**
- Brief explanation: *"Based on your top 10, we asked TMDB what films are most related — here's what came back."*

**Recommendation Grid**
- Cards showing: poster, title, year, TMDB rating, short overview, compatibility score (frequency rank visualized as a star or bar)
- `Not Interested` button on each card — removes it and pulls in the next queued result
- `Add to Watchlist` button (stores in `localStorage`)

---

### 5. About (`/about`)

- Gabe's story from the doc (use his text verbatim)
- Photo placeholder
- Contact info placeholder

---

## File Structure (suggested)

```
filmfolio/
├── public/
│   └── grain.png              # subtle film grain texture
├── src/
│   ├── data/
│   │   └── movies.json        # THE STUB FILE — Gabe replaces this
│   ├── api/
│   │   └── tmdb.js            # all TMDB fetch functions, cache logic
│   ├── context/
│   │   └── FilmContext.jsx    # global state: seenList, myTop10, watchlist
│   ├── components/
│   │   ├── MovieCard.jsx
│   │   ├── MovieGrid.jsx
│   │   ├── FilterBar.jsx
│   │   ├── ProgressTracker.jsx
│   │   ├── TopTenBuilder.jsx
│   │   ├── RecommendationCard.jsx
│   │   └── Nav.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Movies.jsx
│   │   ├── MyList.jsx
│   │   ├── Recommendations.jsx
│   │   └── About.jsx
│   ├── styles/
│   │   └── tokens.css         # CSS custom properties (colors, fonts)
│   ├── App.jsx
│   └── main.jsx
├── .env                       # VITE_TMDB_API_KEY=your_key_here
├── .env.example
├── index.html
└── package.json
```

---

## Environment & Setup Instructions (for Claude Code)

```bash
npm create vite@latest filmfolio -- --template react
cd filmfolio
npm install react-router-dom @hello-pangea/dnd   # dnd for drag-to-rank
npm install
```

Google Fonts to load in `index.html`:
```
Playfair Display:wght@400;600;700;900
DM Sans:wght@300;400;500;600
DM Mono:wght@400;500
```

---

## Key Constraints & Notes for Claude Code

1. **No backend.** All persistence via `localStorage`. Keys: `ff_seen`, `ff_top10`, `ff_watchlist`.
2. **TMDB enrichment is live** — do not bake poster URLs into the JSON. Fetch and cache them.
3. **The `movies.json` file is sacred** — it is Gabe's list. Never auto-generate or overwrite it. It is the single source of truth for the top 100.
4. **Cache TMDB responses** in `localStorage` with a 24-hour TTL to respect API rate limits during development.
5. **API key security** — use `VITE_TMDB_API_KEY` from `.env`. Add `.env` to `.gitignore`. Include `.env.example` with a placeholder.
6. **Recommendation algorithm** — use TMDB `/movie/{id}/recommendations` endpoint, not `/similar`. Score by appearance frequency across all top-10 calls. Surface top 20.
7. **"Not Interested"** — maintain a full sorted queue beyond the displayed 20. Clicking it pops the next item from the queue rather than re-fetching.
8. **Mobile responsive** — design mobile-first. The poster grid should look great on a phone.
9. **Stub data fallback** — if TMDB is unreachable or the API key isn't set, the app should still render the grid using only the data in `movies.json` (title, year, director, genres) with a placeholder poster image.

---

## Phase 2 Notes (out of scope for now — document for future)

- User authentication (Supabase recommended for ease of integration with React)
- Extended preference rankings: Actors, Genres, Directors, Eras
- Compound recommendation algorithm combining all preference dimensions
- Social features: friend list comparison, shared recommendations
- User reviews and comments
- Watchlist persistence to cloud

---

## TMDB API Key

Joel registered an email with TMDB for API access. Retrieve the API key from [themoviedb.org](https://www.themoviedb.org) → Account Settings → API. Place it in `.env` as:

```
VITE_TMDB_API_KEY=your_v3_api_key_here
```

The free TMDB API tier is sufficient for this project.
