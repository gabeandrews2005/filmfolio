const READ_TOKEN = import.meta.env.VITE_TMDB_READ_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
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
  } catch {
    // storage full — silently skip
  }
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

async function getMovieDetails(tmdbId) {
  const key = `ff_tmdb_d_${tmdbId}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchTMDB(`/movie/${tmdbId}`);
  if (data) setCache(key, data);
  return data;
}

async function getMovieCredits(tmdbId) {
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

export function getPosterUrl(path) {
  if (!path) return PLACEHOLDER_POSTER;
  return `${POSTER_BASE}${path}`;
}

export function getBackdropUrl(path) {
  if (!path) return null;
  return `${BACKDROP_BASE}${path}`;
}

export async function enrichMovie(baseMovie) {
  const [details, credits] = await Promise.all([
    getMovieDetails(baseMovie.tmdb_id),
    getMovieCredits(baseMovie.tmdb_id),
  ]);

  const director =
    credits?.crew?.find((p) => p.job === 'Director')?.name ?? baseMovie.director;
  const cast = credits?.cast?.slice(0, 5).map((p) => p.name) ?? [];

  return {
    ...baseMovie,
    poster_path: details?.poster_path ?? null,
    backdrop_path: details?.backdrop_path ?? null,
    overview: details?.overview ?? '',
    vote_average: details?.vote_average ?? null,
    runtime: details?.runtime ?? null,
    director,
    cast,
    posterUrl: getPosterUrl(details?.poster_path),
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
        });
      }
      scoreMap.get(movie.id).score += 1;
    });
  });

  return [...scoreMap.values()].sort((a, b) => b.score - a.score);
}
