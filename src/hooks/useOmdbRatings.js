import { useState, useEffect } from 'react'
import { getMovieExternalIds, getTVExternalIds } from '../api/tmdb'
import { getOmdbRatingsWithRetry } from '../api/omdb'

// One shared queue for every card anywhere in the app, not per-component —
// a 60-card recs page and a 100-card grid used to each fire every card's
// external-id + OMDb lookup pipeline the instant it mounted, with nothing
// coordinating how many ran at once. Capping it here means it stays capped
// no matter how many places on the site render movies at once.
const CONCURRENCY = 6
let active = 0
const queue = []

function schedule(task) {
  return new Promise((resolve) => {
    queue.push({ task, resolve })
    pump()
  })
}

function pump() {
  while (active < CONCURRENCY && queue.length > 0) {
    const { task, resolve } = queue.shift()
    active++
    task().then(resolve).finally(() => {
      active--
      pump()
    })
  }
}

// Fetches Rotten Tomatoes + IMDb ratings for a TMDB movie (or, with
// type: 'tv', show) id — resolves the IMDb id via TMDB's external_ids, then
// looks it up on OMDb, throttled and retried. Returns { ratings, loading }
// where ratings is null while loading or if nothing could be found
// (RatingDisplay handles that gracefully).
export default function useOmdbRatings(tmdbId, type = 'movie') {
  const [ratings, setRatings] = useState(null)
  const [loading, setLoading] = useState(!!tmdbId)

  useEffect(() => {
    if (!tmdbId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setRatings(null)
    schedule(async () => {
      const extIds = type === 'tv' ? await getTVExternalIds(tmdbId) : await getMovieExternalIds(tmdbId)
      if (cancelled || !extIds?.imdb_id) return null
      return getOmdbRatingsWithRetry(extIds.imdb_id)
    }).then((result) => {
      if (!cancelled) {
        setRatings(result)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [tmdbId, type])

  return { ratings, loading }
}
