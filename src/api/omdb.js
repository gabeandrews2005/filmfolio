const OMDB_KEY = import.meta.env.VITE_OMDB_API_KEY;
const OMDB_BASE = 'https://www.omdbapi.com/';
const CACHE_TTL = 24 * 60 * 60 * 1000;

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

export async function getOmdbRatings(imdbId) {
  if (!OMDB_KEY || !imdbId) return null;
  const cacheKey = `ff_omdb_${imdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${OMDB_BASE}?i=${imdbId}&apikey=${OMDB_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response === 'False') return null;

    const rtRating = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes');
    const result = {
      imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : null,
      rtScore: rtRating ? parseInt(rtRating.Value) : null,
    };
    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}
