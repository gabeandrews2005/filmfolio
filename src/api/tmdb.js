const READ_TOKEN = import.meta.env.VITE_TMDB_READ_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';
const PROFILE_BASE_LG = 'https://image.tmdb.org/t/p/h632';
const CACHE_TTL = 24 * 60 * 60 * 1000;

export const PLACEHOLDER_POSTER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750' viewBox='0 0 500 750'%3E%3Crect width='500' height='750' fill='%23141414'/%3E%3Ctext x='250' y='375' font-family='serif' font-size='48' fill='%232a2520' text-anchor='middle' dominant-baseline='middle'%3E%E2%96%88%3C/text%3E%3C/svg%3E`;

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// Writes to localStorage without ever throwing — a full quota otherwise
// surfaces as an uncaught QuotaExceededError at the call site (this app has
// hit that in the wild: enough cached TMDB responses accumulate to fill a
// browser's quota, which crashed an unrelated feature that happened to write
// to localStorage next). On quota failure, clears the disposable TMDB/OMDB
// response cache — all of it is safely re-fetchable — and retries once
// before giving up quietly. Real user data (lists, seen, etc.) always
// writes through this, so it's the thing worth freeing space for.
export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('ff_tmdb_') || k.startsWith('ff_omdb_'))
        .forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

function setCache(key, data) {
  safeSetItem(key, JSON.stringify({ data, ts: Date.now() }));
}

async function fetchTMDB(path, params = {}) {
  if (!READ_TOKEN) return null;
  try {
    const url = new URL(`${BASE_URL}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${READ_TOKEN}`,
        accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getMovieDetails(tmdbId) {
  const key = `ff_tmdb_d_${tmdbId}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB(`/movie/${tmdbId}`);
  if (data) setCache(key, data);
  return data;
}

export async function getMovieCredits(tmdbId) {
  const key = `ff_tmdb_c_${tmdbId}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB(`/movie/${tmdbId}/credits`);
  if (data) setCache(key, data);
  return data;
}

export async function searchMovies(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const key = `ff_tmdb_smovie_${trimmed.toLowerCase()}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB('/search/movie', { query: trimmed, page: 1 });
  const results = data?.results ?? [];
  if (results.length) setCache(key, results);
  return results;
}

export async function searchPerson(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const key = `ff_tmdb_sperson_${trimmed.toLowerCase()}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB('/search/person', { query: trimmed, page: 1 });
  const results = data?.results ?? [];
  if (results.length) setCache(key, results);
  return results;
}

export async function searchTV(query) {
  if (!query.trim()) return [];
  const data = await fetchTMDB('/search/tv', { query: query.trim(), page: 1 });
  return data?.results ?? [];
}

export async function getPopularMovies(page = 1) {
  const key = `ff_tmdb_pop_${page}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB('/movie/popular', { page });
  if (data) setCache(key, data);
  return data;
}

export async function getTopRatedMovies(page = 1) {
  const key = `ff_tmdb_top_${page}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB('/movie/top_rated', { page });
  if (data) setCache(key, data);
  return data;
}

export async function getDiscoverMovies(params = {}, page = 1) {
  const cacheKey = `ff_tmdb_disc_${JSON.stringify(params)}_${page}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchTMDB('/discover/movie', { ...params, page });
  if (data) setCache(cacheKey, data);
  return data;
}

export async function getMovieExternalIds(tmdbId) {
  const key = `ff_tmdb_ext_${tmdbId}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB(`/movie/${tmdbId}/external_ids`);
  if (data) setCache(key, data);
  return data;
}

export async function getPersonDetails(personId) {
  const key = `ff_tmdb_person_${personId}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB(`/person/${personId}`);
  if (data) setCache(key, data);
  return data;
}

export async function getPersonMovieCredits(personId) {
  const key = `ff_tmdb_pmcred_${personId}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB(`/person/${personId}/movie_credits`);
  if (data) setCache(key, data);
  return data;
}

// TMDB's /search/movie endpoint has no genre filter — it silently ignores a
// with_genres param entirely, so this used to just be a plain text search
// wearing a genre-filtered name. Search results do carry genre_ids though,
// so the filtering has to happen client-side after the fact.
export async function searchMoviesByGenre(query, genreId) {
  if (!query.trim()) return [];
  const data = await fetchTMDB('/search/movie', { query: query.trim(), page: 1 });
  const results = data?.results ?? [];
  return genreId ? results.filter((r) => r.genre_ids?.includes(genreId)) : results;
}

// Returns null (not cached) on a failed fetch, distinct from a genuinely
// empty keyword list — same convention as getMovieDetails/getMovieCredits —
// so callers doing their own retry logic (the myList keywords backfill)
// can tell "TMDB says this film really has no keywords" apart from "the
// request failed, try again," instead of a failure getting silently cached
// as a confirmed-empty result for 24h.
export async function getMovieKeywords(tmdbId) {
  const key = `ff_tmdb_kw_${tmdbId}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB(`/movie/${tmdbId}/keywords`);
  if (!data) return null;
  const keywords = data.keywords ?? [];
  setCache(key, keywords);
  return keywords;
}

// TMDB has no "holiday" genre, so "Seasonal" search instead runs a plain
// title search and keeps only results whose keywords actually mark them as
// holiday movies. Keyword lookups are capped and run in parallel to keep a
// live search box responsive.
const HOLIDAY_KEYWORD_TERMS = [
  'christmas', 'santa', 'xmas', 'holiday', "new year's eve", 'new year',
  'hanukkah', 'thanksgiving', 'yuletide', 'advent calendar',
];
const HOLIDAY_SEARCH_CANDIDATE_CAP = 15;

export async function searchHolidayMovies(query) {
  if (!query.trim()) return [];
  const data = await fetchTMDB('/search/movie', { query: query.trim(), page: 1 });
  const results = (data?.results ?? []).slice(0, HOLIDAY_SEARCH_CANDIDATE_CAP);
  const keywordLists = await Promise.all(results.map((r) => getMovieKeywords(r.id)));
  return results.filter((_, i) =>
    (keywordLists[i] ?? []).some((kw) => HOLIDAY_KEYWORD_TERMS.some((term) => kw.name?.toLowerCase().includes(term)))
  );
}

export function getPosterUrl(path) {
  if (!path) return PLACEHOLDER_POSTER;
  return `${POSTER_BASE}${path}`;
}

export function getBackdropUrl(path) {
  if (!path) return null;
  return `${BACKDROP_BASE}${path}`;
}

export function getProfileUrl(path) {
  if (!path) return null;
  return `${PROFILE_BASE}${path}`;
}

export function getProfileUrlLarge(path) {
  if (!path) return null;
  return `${PROFILE_BASE_LG}${path}`;
}

export async function enrichMovie(baseMovie) {
  const [details, credits] = await Promise.all([
    getMovieDetails(baseMovie.tmdb_id),
    getMovieCredits(baseMovie.tmdb_id),
  ]);

  // Drift detection — log if TMDB title doesn't match what we expect (IDs verified 2026-08-06)
  if (details && baseMovie.title) {
    const norm = (s) => s.toLowerCase().replace(/(?:^|\s)(?:the|a|an)\s+/g, ' ').replace(/[^a-z0-9]/g, '');
    const expected = norm(baseMovie.title);
    const received = norm(details.title ?? '');
    if (expected && received) {
      // Short titles (e.g. "RRR") need an exact match — substring matching lets
      // a wrong ID slip through since a short fragment matches almost anything.
      const match = expected.length <= 4 || received.length <= 4
        ? expected === received
        : received.includes(expected.slice(0, 8)) || expected.includes(received.slice(0, 8));
      if (!match) {
        console.warn(`[FilmFolio] tmdb_id drift detected: expected "${baseMovie.title}" but tmdb_id ${baseMovie.tmdb_id} returns "${details.title}" — run verify-tmdb-ids.mjs`);
      }
    }
  }

  const director =
    credits?.crew?.find((p) => p.job === 'Director')?.name ?? baseMovie.director;
  const cast = credits?.cast?.slice(0, 5).map((p) => p.name) ?? [];
  const castIds = credits?.cast?.slice(0, 15).map((p) => p.id) ?? [];
  const directorId = credits?.crew?.find((p) => p.job === 'Director')?.id ?? null;

  return {
    ...baseMovie,
    poster_path: details?.poster_path ?? null,
    backdrop_path: details?.backdrop_path ?? null,
    overview: details?.overview ?? '',
    vote_average: details?.vote_average ?? null,
    runtime: details?.runtime ?? null,
    director,
    directorId,
    cast,
    castIds,
    posterUrl: getPosterUrl(details?.poster_path),
    backdropUrl: getBackdropUrl(details?.backdrop_path),
    enriched: !!details,
  };
}

const THEME_TOP_KEYWORD_COUNT = 8;
const THEME_DISCOVER_PAGES_PER_KEYWORD = 2;
const THEME_CANDIDATE_CAP = 200;
const THEME_CANDIDATE_CONCURRENCY = 6;

// TMDB tags nearly every franchise film with the same handful of
// production/marketing keywords ("superhero," "based on comic," "sequel,"
// "marvel cinematic universe"...). Those describe what a film IS, not what
// it's ABOUT, so a user with even a handful of franchise films gets that
// franchise's keywords stacking weight from every one of them and drowning
// out everything more specific and personal. Excluded from scoring entirely.
const GENERIC_KEYWORD_STOPLIST = new Set([
  'aftercreditsstinger', 'duringcreditsstinger', 'post-credits scene', 'mid-credits scene',
  'based on comic', 'based on comic book', 'based on graphic novel',
  'superhero', 'superhero team', 'supervillain', 'shared universe', 'origin story',
  'sequel', 'prequel', 'spin off', 'reboot', 'remake', 'live action remake',
  'based on video game', 'video game', 'based on toy', 'franchise',
  'marvel cinematic universe', 'dc extended universe', 'dc comics', 'marvel comics',
  'imax', '3d', 'cgi', 'blockbuster',
]);

// A repeat occurrence of the same keyword across the Top 100 is still a real
// signal (it should score higher than a one-off), but each additional hit
// counts for less. Without this, a small cluster of similar films (e.g. 6
// superhero movies) linearly piles their rank-weight onto a few shared
// keywords and mathematically dominates the whole taste profile, no matter
// how small a slice of the user's actual taste that cluster represents.
const REPEAT_OCCURRENCE_MULTIPLIERS = [1, 0.6, 0.4, 0.25, 0.15];
function repeatMultiplier(occurrenceIndex) {
  return REPEAT_OCCURRENCE_MULTIPLIERS[occurrenceIndex] ?? 0.1;
}

// Bypasses getDiscoverMovies' cache wrapper deliberately — its cache key is
// the full params object, and the keyword set here changes every time the
// user's Top 100 changes, so caching it would just accumulate unbounded,
// never-reused localStorage entries (the exact class of bug that caused a
// QuotaExceededError crash elsewhere in this app). Each theme is queried on
// its own (not OR'd together) so a single dominant keyword can't flood out
// every other theme's candidates, and results are sorted by rating rather
// than popularity so this surfaces well-regarded films the user hasn't
// necessarily heard of, not just whatever's currently a big blockbuster.
async function discoverByKeyword(keywordId, page) {
  const data = await fetchTMDB('/discover/movie', {
    with_keywords: String(keywordId),
    'vote_count.gte': 100,
    'vote_average.gte': 6.5,
    sort_by: 'vote_average.desc',
    page,
  });
  return data?.results ?? [];
}

const PERSON_TOP_COUNT = 8;
const PERSON_CREDIT_MIN_VOTES = 5;

// A person's list position becomes their weight the same way film rank
// does for themes: #1 is worth the list's own max slots, #2 one less, etc.
// (actorsList tops out at 50, directorsList at 25 — see LIST_MAX in
// FilmContext.jsx) — so the two scales stay proportional to how much room
// each list actually has.
function buildPersonScores(list, max) {
  const scores = new Map(); // person_id -> { name, weight }
  list.forEach((person, i) => {
    if (!person.person_id || i >= max) return;
    scores.set(person.person_id, { name: person.name, weight: max - i });
  });
  return scores;
}

async function getCreditsWithRetry(tmdbId, attempt = 0) {
  const credits = await getMovieCredits(tmdbId);
  if (credits) return credits;
  if (attempt >= 2) return null;
  await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  return getCreditsWithRetry(tmdbId, attempt + 1);
}

// Builds a per-keyword "taste profile" from the user's ranked Top 100 —
// rank 1 contributes 100 points to each of its TMDB keywords, rank 2
// contributes 99, ... rank 100 contributes 1 — then discovers and ranks new
// films by how much they overlap with that weighted profile.
//
// `personFilters` is the opt-in actor/director layer. When enabled it
// doesn't just add a bonus on top of the usual keyword-discovered pool —
// it replaces candidate sourcing entirely with the actual filmographies of
// the user's top-ranked actors/directors (every credit, not a popularity-
// filtered slice), so nearly every result really does star or was made by
// someone on the list. The same theme-scoring pass then runs over that
// pool to pick the best-fitting films from within it, plus a rank-weighted
// person bonus (stacking when a film matches more than one favorite
// person) so a film that's both well-cast *and* on-theme rises to the top.
export async function buildThemeRecommendations(userList, excludeIds, personFilters = {}) {
  const {
    actorsList = [], directorsList = [],
    includeActors = false, includeDirectors = false,
  } = personFilters;
  const themeScores = new Map(); // keywordId -> { name, score, occurrences, sources }
  userList.forEach((movie, i) => {
    const weight = 101 - (i + 1);
    (movie.keywords ?? []).forEach((kw) => {
      const name = kw.name?.toLowerCase();
      if (!name || GENERIC_KEYWORD_STOPLIST.has(name)) return;
      const entry = themeScores.get(kw.id) ?? { name: kw.name, score: 0, occurrences: 0, sources: [] };
      const contribution = weight * repeatMultiplier(entry.occurrences);
      entry.score += contribution;
      entry.occurrences += 1;
      entry.sources.push({ title: movie.title, contribution });
      themeScores.set(kw.id, entry);
    });
  });

  const actorScores = includeActors ? buildPersonScores(actorsList, 50) : new Map();
  const directorScores = includeDirectors ? buildPersonScores(directorsList, 25) : new Map();
  const hasPersonSignal = actorScores.size > 0 || directorScores.size > 0;

  if (themeScores.size === 0 && !hasPersonSignal) return [];

  const topKeywordIds = [...themeScores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, THEME_TOP_KEYWORD_COUNT)
    .map(([id]) => id);
  const topActorIds = [...actorScores.keys()].slice(0, PERSON_TOP_COUNT);
  const topDirectorIds = [...directorScores.keys()].slice(0, PERSON_TOP_COUNT);

  let rawResults;
  if (hasPersonSignal) {
    const filmographies = await Promise.all([
      ...topActorIds.map((id) => getPersonMovieCredits(id).then((c) => c?.cast ?? [])),
      ...topDirectorIds.map((id) =>
        getPersonMovieCredits(id).then((c) => (c?.crew ?? []).filter((cr) => cr.job === 'Director'))
      ),
    ]);
    // Best-regarded credits first — with a full filmography easily running
    // past the candidate cap for a prolific person, this decides which
    // credits are worth spending the per-candidate keyword/credits fetch on.
    rawResults = filmographies
      .flat()
      .filter((m) => m.release_date && (m.vote_count ?? 0) >= PERSON_CREDIT_MIN_VOTES)
      .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
  } else {
    const pageSets = await Promise.all(
      topKeywordIds.flatMap((id) =>
        Array.from({ length: THEME_DISCOVER_PAGES_PER_KEYWORD }, (_, i) => discoverByKeyword(id, i + 1))
      )
    );
    rawResults = pageSets.flat();
  }

  const candidates = new Map();
  rawResults.forEach((movie) => {
    if (excludeIds.has(movie.id) || candidates.has(movie.id)) return;
    candidates.set(movie.id, {
      tmdb_id: movie.id,
      title: movie.title,
      year: movie.release_date?.slice(0, 4) ?? '',
      overview: movie.overview,
      vote_average: movie.vote_average,
      posterUrl: getPosterUrl(movie.poster_path),
      score: 0,
      matchedThemes: [],
      sourceMovies: [],
      bonusActors: [],
      bonusDirectors: [],
    });
  });

  const candidateList = [...candidates.values()].slice(0, THEME_CANDIDATE_CAP);
  let index = 0;
  async function run() {
    while (index < candidateList.length) {
      const current = index++;
      const movie = candidateList[current];
      const keywords = await getMovieKeywords(movie.tmdb_id);
      const matched = [];
      (keywords ?? []).forEach((kw) => {
        const entry = themeScores.get(kw.id);
        if (!entry) return;
        movie.score += entry.score;
        matched.push(entry);
      });
      matched.sort((a, b) => b.score - a.score);
      movie.matchedThemes = matched.slice(0, 5).map((entry) => entry.name);
      // Pull the strongest contributing Top 100 films from each matched
      // theme (already sorted highest-contribution-first within a theme),
      // deduped, so the modal can say what specifically sparked the pick.
      const sourceMovies = [];
      matched.slice(0, 3).forEach((entry) => {
        [...entry.sources]
          .sort((a, b) => b.contribution - a.contribution)
          .slice(0, 2)
          .forEach(({ title }) => {
            if (!sourceMovies.includes(title)) sourceMovies.push(title);
          });
      });
      movie.sourceMovies = sourceMovies.slice(0, 4);

      if (hasPersonSignal) {
        // A film only reaches this loop because it's already confirmed to be
        // in a favorite person's own filmography — a bare, unretried credits
        // fetch here can transiently fail (network hiccup, rate limit) and
        // silently drop that attribution while the film's own theme score
        // still keeps it in the results, unbadged and unexplained. Retry
        // before accepting a miss, and the final strict filter below still
        // drops it rather than show it unattributed if all retries fail.
        const credits = await getCreditsWithRetry(movie.tmdb_id);
        if (includeActors) {
          (credits?.cast ?? []).forEach((c) => {
            const entry = actorScores.get(c.id);
            if (!entry) return;
            movie.score += entry.weight;
            movie.bonusActors.push(entry.name);
          });
        }
        if (includeDirectors) {
          (credits?.crew ?? [])
            .filter((c) => c.job === 'Director')
            .forEach((c) => {
              const entry = directorScores.get(c.id);
              if (!entry) return;
              movie.score += entry.weight;
              movie.bonusDirectors.push(entry.name);
            });
        }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(THEME_CANDIDATE_CONCURRENCY, candidateList.length) }, run)
  );

  return candidateList
    .filter((m) => m.score > 0)
    // With a person filter on, this is a hard requirement, not a
    // preference — a film that slipped in via theme score alone, with no
    // confirmed actor/director attribution (transient fetch failure, data
    // mismatch, whatever), gets dropped rather than shown unexplained.
    .filter((m) => !hasPersonSignal || m.bonusActors.length > 0 || m.bonusDirectors.length > 0)
    .sort((a, b) => b.score - a.score);
}
