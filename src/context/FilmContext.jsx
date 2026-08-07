import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import seedMovies from '../data/movies.json'
import { enrichMovie, getMovieDetails, safeSetItem } from '../api/tmdb'

const FilmContext = createContext(null)

const LS_SEEN        = 'ff_seen'
const LS_WATCHLIST   = 'ff_watchlist'
const LS_NOT_INT     = 'ff_not_interested'
const LS_USER        = 'ff_user'
const LS_MYLIST      = 'ff_top100'
const LS_ACTORS      = 'ff_actors'
const LS_SHOWS       = 'ff_shows'
const LS_DIRECTORS   = 'ff_directors'
const LS_HORROR      = 'ff_horror'
const LS_SEASONAL    = 'ff_seasonal'
const LS_COMEDIES    = 'ff_comedies'
const LS_ANIMATED    = 'ff_animated'

// Backwards compat: legacy key from v1
const LS_TOP10_LEGACY = 'ff_top10'

const LIST_MAX = {
  myList:       100,
  actorsList:   50,
  showsList:    50,
  directorsList:25,
  horrorList:   50,
  seasonalList: 25,
  comediesList: 50,
  animatedList: 50,
}

const LIST_LS_KEYS = {
  myList:       LS_MYLIST,
  actorsList:   LS_ACTORS,
  showsList:    LS_SHOWS,
  directorsList:LS_DIRECTORS,
  horrorList:   LS_HORROR,
  seasonalList: LS_SEASONAL,
  comediesList: LS_COMEDIES,
  animatedList: LS_ANIMATED,
}

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveLS(key, value) {
  safeSetItem(key, JSON.stringify(value))
}

function loadMyList() {
  // Migrate from v1 ff_top10 if ff_top100 is empty
  const v2 = loadLS(LS_MYLIST, null)
  if (v2 !== null) return v2
  const v1 = loadLS(LS_TOP10_LEGACY, [])
  if (v1.length > 0) {
    saveLS(LS_MYLIST, v1)
  }
  return v1
}

export function FilmProvider({ children }) {
  const [movies, setMovies]       = useState(seedMovies)
  const [loading, setLoading]     = useState(true)
  const [seenList, setSeenList]   = useState(() => new Set(loadLS(LS_SEEN, [])))
  const [watchlist, setWatchlist] = useState(() => loadLS(LS_WATCHLIST, []))
  const [notInterested, setNotInterested] = useState(() => loadLS(LS_NOT_INT, []))
  const [user, setUserState]      = useState(() => loadLS(LS_USER, null))

  // All ranked lists
  const [myList,       setMyList]       = useState(() => loadMyList())
  const [actorsList,   setActorsList]   = useState(() => loadLS(LS_ACTORS, []))
  const [showsList,    setShowsList]    = useState(() => loadLS(LS_SHOWS, []))
  const [directorsList,setDirectorsList]= useState(() => loadLS(LS_DIRECTORS, []))
  const [horrorList,   setHorrorList]   = useState(() => loadLS(LS_HORROR, []))
  const [seasonalList, setSeasonalList] = useState(() => loadLS(LS_SEASONAL, []))
  const [comediesList, setComediesList] = useState(() => loadLS(LS_COMEDIES, []))
  const [animatedList, setAnimatedList] = useState(() => loadLS(LS_ANIMATED, []))

  // myTop10 is a computed view of the first 10 items of myList (backwards compat)
  const myTop10 = useMemo(() => myList.slice(0, 10), [myList])

  const LIST_SETTERS = useMemo(() => ({
    myList:       [myList,        setMyList,        LS_MYLIST],
    actorsList:   [actorsList,    setActorsList,    LS_ACTORS],
    showsList:    [showsList,     setShowsList,     LS_SHOWS],
    directorsList:[directorsList, setDirectorsList, LS_DIRECTORS],
    horrorList:   [horrorList,    setHorrorList,    LS_HORROR],
    seasonalList: [seasonalList,  setSeasonalList,  LS_SEASONAL],
    comediesList: [comediesList,  setComediesList,  LS_COMEDIES],
    animatedList: [animatedList,  setAnimatedList,  LS_ANIMATED],
  }), [myList, actorsList, showsList, directorsList, horrorList, seasonalList, comediesList, animatedList])

  // Progressive TMDB enrichment on mount
  useEffect(() => {
    let cancelled = false
    async function enrich() {
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

  // Backfill genres on myList items that don't have them — films added via
  // My List's own search bar (rather than Explore's "+") historically didn't
  // carry genre data, which silently broke the Horror/Comedies/Animated/
  // Seasonal pages' "auto-derive matches from Top 100" feature for them.
  // Runs whenever myList changes; converges once every item has a genres
  // array. A failed lookup (bad network, momentary rate limit) is retried a
  // couple times before giving up for this pass — and even then it's left
  // without a genres field rather than poisoned with an empty one, so it
  // gets picked up again on the next list change or page load instead of
  // being silently stuck forever.
  useEffect(() => {
    const missing = myList.filter((m) => !m.genres && m.tmdb_id)
    if (missing.length === 0) return
    let cancelled = false
    async function fetchGenresWithRetry(tmdbId, attempt = 0) {
      const details = await getMovieDetails(tmdbId)
      if (details) return details.genres?.map((g) => g.name) ?? []
      if (attempt >= 2) return null // failed — leave ungenred, retry next pass
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
      return fetchGenresWithRetry(tmdbId, attempt + 1)
    }
    async function backfill() {
      const results = new Array(missing.length)
      let index = 0
      async function run() {
        while (index < missing.length) {
          const current = index++
          results[current] = await fetchGenresWithRetry(missing[current].tmdb_id)
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, missing.length) }, run))
      if (cancelled) return
      setMyList((prev) => {
        const next = prev.map((m) => {
          const idx = missing.findIndex((mm) => mm.tmdb_id === m.tmdb_id)
          if (idx === -1 || results[idx] === null) return m
          return { ...m, genres: results[idx] }
        })
        saveLS(LS_MYLIST, next)
        return next
      })
    }
    backfill()
    return () => { cancelled = true }
  }, [myList])

  // ── Seen list ──────────────────────────────────────────────────────────────
  const toggleSeen = useCallback((tmdbId) => {
    setSeenList((prev) => {
      const next = new Set(prev)
      if (next.has(tmdbId)) next.delete(tmdbId)
      else next.add(tmdbId)
      saveLS(LS_SEEN, [...next])
      return next
    })
  }, [])

  // ── User profile ───────────────────────────────────────────────────────────
  const setUser = useCallback((userData) => {
    setUserState(userData)
    saveLS(LS_USER, userData)
  }, [])

  // ── Generic list operations ────────────────────────────────────────────────
  const getItemId = (item) => item.tmdb_id ?? item.person_id ?? null

  // Movie list names that auto-add to seen on add
  const MOVIE_LISTS = new Set(['myList', 'horrorList', 'comediesList', 'animatedList', 'seasonalList'])

  const addToList = useCallback((listName, item) => {
    const config = LIST_SETTERS[listName]
    if (!config) return
    const [currentList, setter, lsKey] = config
    const maxItems = LIST_MAX[listName] ?? 50
    const id = getItemId(item)
    if (currentList.some((i) => getItemId(i) === id)) return
    if (currentList.length >= maxItems) return
    const next = [...currentList, item]
    setter(next)
    saveLS(lsKey, next)
    // Auto-add to seen for movie lists
    if (MOVIE_LISTS.has(listName) && item.tmdb_id) {
      setSeenList((prev) => {
        if (prev.has(item.tmdb_id)) return prev
        const next = new Set(prev)
        next.add(item.tmdb_id)
        saveLS(LS_SEEN, [...next])
        return next
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LIST_SETTERS])

  // Inserts an item at a specific 1-based rank, shifting everything at and
  // below that rank down — including off the end if the list is already at
  // its cap (e.g. slotting a film in at #7 of a full Top 100 drops #100).
  const insertAtRank = useCallback((listName, item, rank) => {
    const config = LIST_SETTERS[listName]
    if (!config) return
    const [currentList, setter, lsKey] = config
    const maxItems = LIST_MAX[listName] ?? 50
    const id = getItemId(item)
    if (currentList.some((i) => getItemId(i) === id)) return
    const index = Math.min(Math.max(rank - 1, 0), currentList.length)
    const next = [...currentList]
    next.splice(index, 0, item)
    next.length = Math.min(next.length, maxItems)
    setter(next)
    saveLS(lsKey, next)
    if (MOVIE_LISTS.has(listName) && item.tmdb_id) {
      setSeenList((prev) => {
        if (prev.has(item.tmdb_id)) return prev
        const next2 = new Set(prev)
        next2.add(item.tmdb_id)
        saveLS(LS_SEEN, [...next2])
        return next2
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LIST_SETTERS])

  const removeFromList = useCallback((listName, id) => {
    const config = LIST_SETTERS[listName]
    if (!config) return
    const [currentList, setter, lsKey] = config
    const next = currentList.filter((i) => getItemId(i) !== id)
    setter(next)
    saveLS(lsKey, next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LIST_SETTERS])

  const reorderList = useCallback((listName, newOrder) => {
    const config = LIST_SETTERS[listName]
    if (!config) return
    const [, setter, lsKey] = config
    setter(newOrder)
    saveLS(lsKey, newOrder)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LIST_SETTERS])

  // ── Backwards-compat wrappers (myTop10 / myList) ─────────────────────────
  const addToTop10 = useCallback((movie) => {
    // Enforces max 10 for the "top 10 only" builder mode
    setMyList((prev) => {
      if (prev.some((m) => m.tmdb_id === movie.tmdb_id)) return prev
      if (prev.length >= 10) return prev
      const next = [...prev, movie]
      saveLS(LS_MYLIST, next)
      return next
    })
    // Auto-add to seen
    if (movie.tmdb_id) {
      setSeenList((prev) => {
        if (prev.has(movie.tmdb_id)) return prev
        const next = new Set(prev)
        next.add(movie.tmdb_id)
        saveLS(LS_SEEN, [...next])
        return next
      })
    }
  }, [])

  const removeFromTop10 = useCallback((tmdbId) => {
    setMyList((prev) => {
      const next = prev.filter((m) => m.tmdb_id !== tmdbId)
      saveLS(LS_MYLIST, next)
      return next
    })
  }, [])

  const reorderTop10 = useCallback((newOrder) => {
    setMyList(newOrder)
    saveLS(LS_MYLIST, newOrder)
  }, [])

  // ── Watchlist ──────────────────────────────────────────────────────────────
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

  // ── Not Interested ─────────────────────────────────────────────────────────
  const addNotInterested = useCallback((tmdbId) => {
    setNotInterested((prev) => {
      if (prev.includes(tmdbId)) return prev
      const next = [...prev, tmdbId]
      saveLS(LS_NOT_INT, next)
      return next
    })
  }, [])

  return (
    <FilmContext.Provider value={{
      // Gabe's curated list (seed, enriched progressively)
      movies,
      loading,
      // Seen state
      seenList,
      toggleSeen,
      // User profile
      user,
      setUser,
      // User's ranked lists
      myList,
      myTop10,     // computed slice of myList[0..9]
      actorsList,
      showsList,
      directorsList,
      horrorList,
      seasonalList,
      comediesList,
      animatedList,
      // Generic list operations
      addToList,
      insertAtRank,
      removeFromList,
      reorderList,
      // Backwards-compat top-10 operations (used by TopTenBuilder)
      addToTop10,
      removeFromTop10,
      reorderTop10,
      // Watchlist
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      // Not interested
      notInterested,
      addNotInterested,
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
