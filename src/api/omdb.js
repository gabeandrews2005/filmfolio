import { safeSetItem } from './tmdb';

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
  safeSetItem(key, JSON.stringify({ data, ts: Date.now() }));
}

// OMDb's Awards field is unstructured free text (e.g. "Won 2 Oscars. 145
// wins & 216 nominations." or "Nominated for 3 Oscars. 12 wins & 45
// nominations." or just "1 win." or "N/A") — this is best-effort regex
// scraping, not a structured API, and won't be 100% reliable for every
// phrasing OMDb uses. The four clauses are matched independently (not one
// combined pattern) since each is optional and can appear without the
// others. totalWins/totalNominations already include the Oscar-specific
// subset per OMDb's own phrasing — callers should not add oscarWins to
// totalWins, that would double-count.
function parseAwards(text) {
  if (!text || text === 'N/A') return null;
  const oscarWinMatch = text.match(/Won (\d+) Oscars?/i);
  const oscarNomMatch = text.match(/Nominated for (\d+) Oscars?/i);
  const totalWinMatch = text.match(/(\d+) wins?/i);
  const totalNomMatch = text.match(/(\d+) nominations?/i);
  return {
    oscarWins: oscarWinMatch ? parseInt(oscarWinMatch[1], 10) : 0,
    oscarNominations: oscarNomMatch ? parseInt(oscarNomMatch[1], 10) : 0,
    totalWins: totalWinMatch ? parseInt(totalWinMatch[1], 10) : 0,
    totalNominations: totalNomMatch ? parseInt(totalNomMatch[1], 10) : 0,
  };
}

// "$28,341,469" -> 28341469; "N/A" or missing -> null.
function parseBoxOffice(text) {
  if (!text || text === 'N/A') return null;
  const n = parseInt(text.replace(/[$,]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

// Returns null on any failure that's worth retrying (network error, non-OK
// response — e.g. rate limited) so the caller can tell that apart from a
// genuine "OMDb has nothing for this id," which is cached below instead of
// re-fetched forever.
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
    if (data.Response === 'False') {
      const empty = { imdbRating: null, rtScore: null, boxOffice: null, awards: null };
      setCache(cacheKey, empty);
      return empty;
    }

    const rtRating = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes');
    const result = {
      imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : null,
      rtScore: rtRating ? parseInt(rtRating.Value) : null,
      boxOffice: parseBoxOffice(data.BoxOffice),
      awards: parseAwards(data.Awards),
    };
    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// A burst of cards (a 60-film recs page, a 100-film grid) mounting at once
// used to fire every card's OMDb call simultaneously with no retry — the
// exact pattern already known to trip TMDB's rate limit elsewhere in this
// app (see PersonList's throttled pool resolution). Retries a transient
// failure a couple times with backoff before giving up for this card.
export async function getOmdbRatingsWithRetry(imdbId, attempt = 0) {
  if (!OMDB_KEY) return null; // not configured — retrying can't help
  const result = await getOmdbRatings(imdbId);
  if (result) return result;
  if (attempt >= 2) return null;
  await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  return getOmdbRatingsWithRetry(imdbId, attempt + 1);
}
