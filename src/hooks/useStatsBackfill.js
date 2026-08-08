import { useState, useEffect } from 'react'
import { getMovieDetails, getMovieCredits, getMovieExternalIds } from '../api/tmdb'
import { getOmdbRatingsWithRetry } from '../api/omdb'

// Lazy, Statistics-page-only backfill — NOT wired into FilmContext as
// always-on. Each film needs 3-4 chained requests (details, credits,
// external ids, then OMDb) just to power stats a user may never look at;
// keeping this off the global provider avoids taxing every session's
// TMDB/OMDb quota for a feature that might go unused, and avoids
// contending with useOmdbRatings' shared queue during ordinary browsing.
const CONCURRENCY = 3
const BATCH_SIZE = 10
const CAST_LIMIT = 15

async function fetchStatsFieldsWithRetry(tmdbId, attempt = 0) {
  const [details, credits, extIds] = await Promise.all([
    getMovieDetails(tmdbId),
    getMovieCredits(tmdbId),
    getMovieExternalIds(tmdbId),
  ])
  if (!details || !credits) {
    if (attempt >= 2) return null // give up this pass, retry next
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    return fetchStatsFieldsWithRetry(tmdbId, attempt + 1)
  }

  const imdbId = extIds?.imdb_id ?? null
  const omdb = imdbId ? await getOmdbRatingsWithRetry(imdbId) : null
  const directorCrew = credits.crew?.find((p) => p.job === 'Director')

  return {
    runtime: details.runtime || null,
    budget: details.budget || null,
    revenue: details.revenue || null,
    productionCompanies: details.production_companies?.map((c) => c.name) ?? [],
    productionCountries: details.production_countries?.map((c) => c.name) ?? [],
    originalLanguage: details.original_language ?? null,
    collection: details.belongs_to_collection
      ? { id: details.belongs_to_collection.id, name: details.belongs_to_collection.name }
      : null,
    cast: credits.cast?.slice(0, CAST_LIMIT).map((p) => ({ id: p.id, name: p.name })) ?? [],
    director: directorCrew?.name ?? '',
    directorId: directorCrew?.id ?? null,
    imdbId,
    imdbRating: omdb?.imdbRating ?? null,
    rtScore: omdb?.rtScore ?? null,
    awards: omdb?.awards ?? null,
    boxOffice: omdb?.boxOffice ?? null,
    statsBackfilled: true,
  }
}

// Backfills the extra fields Statistics needs onto myList items, throttled
// and retry-safe (mirrors FilmContext's useGenreKeywordBackfill — never
// marks a film done on a transient failure, only on success or a confirmed-
// empty result, so nothing gets permanently stuck missing data).
//
// Writes via patchListItems, NOT reorderList — this backfill runs
// concurrently with the always-on genres/keywords backfill in FilmContext,
// both patching the same myList. reorderList replaces the whole array from
// a closure-captured snapshot; if both backfills did that, whichever
// finished last would silently wipe out the other's fields (this was a
// real, confirmed bug: the stats backfill's stale snapshot overwrote and
// erased genres the other backfill had just written). patchListItems merges
// via React's functional setState form against whatever the state actually
// is when applied, so concurrent patches from both backfills compose
// instead of clobbering each other.
//
// Flushes every BATCH_SIZE completions rather than one write at the very
// end, so navigating away mid-backfill keeps whatever finished and the
// caller can show live progress.
export default function useStatsBackfill(myList, patchListItems) {
  const [backfilling, setBackfilling] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  useEffect(() => {
    const missing = myList.filter((m) => !m.statsBackfilled && m.tmdb_id)
    if (missing.length === 0) {
      setBackfilling(false)
      return
    }
    let cancelled = false
    setBackfilling(true)
    setProgress({ done: 0, total: missing.length })

    async function run() {
      let doneCount = 0
      let pendingPatches = new Map()
      let index = 0

      function flush() {
        if (pendingPatches.size === 0) return
        patchListItems('myList', pendingPatches)
        pendingPatches = new Map()
      }

      async function worker() {
        while (index < missing.length) {
          const current = index++
          const film = missing[current]
          const patch = await fetchStatsFieldsWithRetry(film.tmdb_id)
          if (cancelled) return
          if (patch) pendingPatches.set(film.tmdb_id, patch)
          doneCount++
          setProgress({ done: doneCount, total: missing.length })
          if (pendingPatches.size >= BATCH_SIZE) flush()
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, worker))
      if (!cancelled) {
        flush()
        setBackfilling(false)
      }
    }

    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myList])

  return { backfilling, progress }
}
