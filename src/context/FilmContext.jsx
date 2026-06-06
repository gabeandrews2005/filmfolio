import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import seedMovies from '../data/movies.json'
import { enrichMovie } from '../api/tmdb'

const FilmContext = createContext(null)

const LS_SEEN     = 'ff_seen'
const LS_TOP10    = 'ff_top10'
const LS_WATCHLIST = 'ff_watchlist'

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function FilmProvider({ children }) {
  const [movies, setMovies]     = useState(seedMovies)
  const [loading, setLoading]   = useState(true)
  const [seenList, setSeenList] = useState(() => new Set(loadLS(LS_SEEN, [])))
  const [myTop10, setMyTop10]   = useState(() => loadLS(LS_TOP10, []))
  const [watchlist, setWatchlist] = useState(() => loadLS(LS_WATCHLIST, []))

  // Enrich movies progressively — show seed data instantly, update as TMDB responds
  useEffect(() => {
    let cancelled = false

    async function enrich() {
      // Batch into groups of 10 to avoid flooding the API
      const batches = []
      for (let i = 0; i < seedMovies.length; i += 10) {
        batches.push(seedMovies.slice(i, i + 10))
      }

      const enriched = [...seedMovies]

      for (const batch of batches) {
        if (cancelled) break
        const results = await Promise.all(batch.map((m) => enrichMovie(m)))
        results.forEach((enrichedMovie) => {
          const idx = enriched.findIndex((m) => m.rank === enrichedMovie.rank)
          if (idx !== -1) enriched[idx] = enrichedMovie
        })
        if (!cancelled) setMovies([...enriched])
      }

      if (!cancelled) setLoading(false)
    }

    enrich()
    return () => { cancelled = true }
  }, [])

  const toggleSeen = useCallback((tmdbId) => {
    setSeenList((prev) => {
      const next = new Set(prev)
      if (next.has(tmdbId)) next.delete(tmdbId)
      else next.add(tmdbId)
      saveLS(LS_SEEN, [...next])
      return next
    })
  }, [])

  const addToTop10 = useCallback((movie) => {
    setMyTop10((prev) => {
      if (prev.length >= 10) return prev
      if (prev.some((m) => m.tmdb_id === movie.tmdb_id)) return prev
      const next = [...prev, movie]
      saveLS(LS_TOP10, next)
      return next
    })
  }, [])

  const removeFromTop10 = useCallback((tmdbId) => {
    setMyTop10((prev) => {
      const next = prev.filter((m) => m.tmdb_id !== tmdbId)
      saveLS(LS_TOP10, next)
      return next
    })
  }, [])

  const reorderTop10 = useCallback((newOrder) => {
    setMyTop10(newOrder)
    saveLS(LS_TOP10, newOrder)
  }, [])

  const addToWatchlist = useCallback((movie) => {
    setWatchlist((prev) => {
      if (prev.some((m) => m.tmdb_id === movie.tmdb_id)) return prev
      const next = [...prev, movie]
      saveLS(LS_WATCHLIST, next)
      return next
    })
  }, [])

  const removeFromWatchlist = useCallback((tmdbId) => {
    setWatchlist((prev) => {
      const next = prev.filter((m) => m.tmdb_id !== tmdbId)
      saveLS(LS_WATCHLIST, next)
      return next
    })
  }, [])

  return (
    <FilmContext.Provider value={{
      movies,
      loading,
      seenList,
      myTop10,
      watchlist,
      toggleSeen,
      addToTop10,
      removeFromTop10,
      reorderTop10,
      addToWatchlist,
      removeFromWatchlist,
    }}>
      {children}
    </FilmContext.Provider>
  )
}

export function useFilm() {
  const ctx = useContext(FilmContext)
  if (!ctx) throw new Error('useFilm must be used within FilmProvider')
  return ctx
}
