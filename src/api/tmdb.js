const READ_TOKEN = import.meta.env.VITE_TMDB_READ_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';
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

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
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

export async function getMovieRecommendations(tmdbId) {
  const key = `ff_tmdb_r_${tmdbId}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB(`/movie/${tmdbId}/recommendations`);
  if (data) setCache(key, data);
  return data;
}

export async function searchMovies(query) {
  if (!query.trim()) return [];
  const data = await fetchTMDB('/search/movie', { query: query.trim(), page: 1 });
  return data?.results ?? [];
}

export async function searchPerson(query) {
  if (!query.trim()) return [];
  const data = await fetchTMDB('/search/person', { query: query.trim(), page: 1 });
  return data?.results ?? [];
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

export async function searchMoviesByGenre(query, genreId) {
  if (!query.trim()) return [];
  const data = await fetchTMDB('/search/movie', {
    query: query.trim(),
    page: 1,
    with_genres: genreId,
  });
  return data?.results ?? [];
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

export async function enrichMovie(baseMovie) {
  const [details, credits] = await Promise.all([
    getMovieDetails(baseMovie.tmdb_id),
    getMovieCredits(baseMovie.tmdb_id),
  ]);

  // Poster mismatch validation — use PLACEHOLDER_POSTER if titles don't match
  let posterMismatch = false;
  if (details && baseMovie.title) {
    const norm = (s) => s.toLowerCase().replace(/(?:^|\s)(?:the|a|an)\s+/g, ' ').replace(/[^a-z0-9]/g, '');
    const expected = norm(baseMovie.title);
    const received = norm(details.title ?? '');
    if (expected.length > 4 && received.length > 4) {
      const match = received.includes(expected.slice(0, 8)) || expected.includes(received.slice(0, 8));
      if (!match) {
        console.warn(`[FilmFolio] Poster mismatch: expected "${baseMovie.title}" got "${details.title}" for tmdb_id ${baseMovie.tmdb_id}`);
        posterMismatch = true;
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
    poster_path: posterMismatch ? null : (details?.poster_path ?? null),
    backdrop_path: details?.backdrop_path ?? null,
    overview: details?.overview ?? '',
    vote_average: details?.vote_average ?? null,
    runtime: details?.runtime ?? null,
    director,
    directorId,
    cast,
    castIds,
    posterUrl: posterMismatch ? PLACEHOLDER_POSTER : getPosterUrl(details?.poster_path),
    backdropUrl: getBackdropUrl(details?.backdrop_path),
    enriched: !!details,
  };
}

export async function buildRecommendations(top10, top100) {
  const top100Ids = new Set(top100.map((m) => m.tmdb_id));
  const top10Ids = new Set(top10.map((m) => m.tmdb_id));

  const allResults = await Promise.all(
    top10.map((m) => getMovieRecommendations(m.tmdb_id))
  );

  const scoreMap = new Map();
  allResults.forEach((res) => {
    res?.results?.forEach((movie) => {
      if (top10Ids.has(movie.id) || top100Ids.has(movie.id)) return;
      if (!scoreMap.has(movie.id)) {
        scoreMap.set(movie.id, {
          tmdb_id: movie.id,
          title: movie.title,
          year: movie.release_date?.slice(0, 4) ?? '',
          overview: movie.overview,
          vote_average: movie.vote_average,
          posterUrl: getPosterUrl(movie.poster_path),
          score: 0,
          bonusActors: [],
          bonusDirectors: [],
        });
      }
      scoreMap.get(movie.id).score += 1;
    });
  });

  return [...scoreMap.values()].sort((a, b) => b.score - a.score);
}

export async function buildRecommendationsEnhanced(userList, top100, actorPersonIds = [], directorPersonIds = []) {
  const actorIdSet = new Set(actorPersonIds);
  const directorIdSet = new Set(directorPersonIds);
  const top100Ids = new Set(top100.map((m) => m.tmdb_id));
  const userListIds = new Set(userList.map((m) => m.tmdb_id));

  const seedList = userList.slice(0, 10);
  const allResults = await Promise.all(
    seedList.map((m) => getMovieRecommendations(m.tmdb_id))
  );

  const scoreMap = new Map();
  allResults.forEach((res) => {
    res?.results?.forEach((movie) => {
      if (userListIds.has(movie.id) || top100Ids.has(movie.id)) return;
      if (!scoreMap.has(movie.id)) {
        scoreMap.set(movie.id, {
          tmdb_id: movie.id,
          title: movie.title,
          year: movie.release_date?.slice(0, 4) ?? '',
          overview: movie.overview,
          vote_average: movie.vote_average,
          posterUrl: getPosterUrl(movie.poster_path),
          score: 0,
          bonusActors: [],
          bonusDirectors: [],
        });
      }
      scoreMap.get(movie.id).score += 1;
    });
  });

  if (actorIdSet.size > 0 || directorIdSet.size > 0) {
    await Promise.all(
      [...scoreMap.values()].map(async (m) => {
        const credits = await getMovieCredits(m.tmdb_id);
        if (!credits) return;
        credits.cast?.slice(0, 15).forEach((p) => {
          if (actorIdSet.has(p.id)) {
            m.score += 2;
            if (!m.bonusActors.includes(p.name)) m.bonusActors.push(p.name);
          }
        });
        credits.crew?.filter((p) => p.job === 'Director').forEach((p) => {
          if (directorIdSet.has(p.id)) {
            m.score += 2;
            if (!m.bonusDirectors.includes(p.name)) m.bonusDirectors.push(p.name);
          }
        });
      })
    );
  }

  return [...scoreMap.values()].sort((a, b) => b.score - a.score);
}
