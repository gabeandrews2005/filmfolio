import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import seedMovies from '../data/movies.json'
import { enrichMovie, getMovieDetails, getMovieKeywords, safeSetItem } from '../api/tmdb'
import { supabase, getUserData, upsertUserData } from '../api/supabase'
import { useAuth } from './AuthContext'
import ConfirmModal from '../components/ConfirmModal'

const FilmContext = createContext(null)

const LS_SEEN        = 'ff_seen'
const LS_SEEN_DATA    = 'ff_seen_data'
const LS_WATCHLIST   = 'ff_watchlist'
const LS_RECOMMENDATION_PICKS = 'ff_recommendation_picks'
const LS_NOT_INT     = 'ff_not_interested'
const LS_LAST_SYNCED = 'ff_last_synced_at'
const LS_MYLIST      = 'ff_top100'
const LS_QUICKLIST   = 'ff_quicklist'
const LS_SAVED_QUICKLISTS = 'ff_saved_quicklists'
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
  quickList:    10,
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
  quickList:    LS_QUICKLIST,
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

// Backfills genres + TMDB keywords together on items missing either — films
// added via a list's own search bar (rather than Explore's "+") historically
// didn't carry genre data, which silently broke the Horror/Comedies/
// Animated/Seasonal pages' "auto-derive matches from Top 100" feature;
// keywords are the "themes" Picks For You weights by rank. Shared by myList
// and quickList, called once per list from independent effects — each list
// gets its own effect (they can't cancel each other the way two effects on
// the *same* list once did: whichever finished first would trigger a state
// change that cancelled the other mid-flight and restarted it, sometimes
// for several rounds, stalling a freshly-added film's backfill long enough
// that it silently never showed up on its genre page). A failed lookup (bad
// network, momentary rate limit) is retried a couple times before giving up
// for this pass — and even then left without that field rather than
// poisoned with an empty one, so it's picked up again next pass instead of
// stuck forever.
async function fetchGenresWithRetry(tmdbId, attempt = 0) {
  const details = await getMovieDetails(tmdbId)
  if (details) return details.genres?.map((g) => g.name) ?? []
  if (attempt >= 2) return null // failed — leave ungenred, retry next pass
  await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  return fetchGenresWithRetry(tmdbId, attempt + 1)
}

async function fetchKeywordsWithRetry(tmdbId, attempt = 0) {
  const keywords = await getMovieKeywords(tmdbId)
  if (keywords && keywords.length > 0) return keywords
  if (attempt >= 2) return keywords ?? null // genuinely no keywords vs. failed fetch
  await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  return fetchKeywordsWithRetry(tmdbId, attempt + 1)
}

// Resolves genres+keywords (only the ones actually missing) for a batch of
// films, throttled to 4 concurrent lookups. Returns two id->value maps the
// caller merges back into whatever shape its own state is in.
async function resolveGenresAndKeywords(missing, isCancelled) {
  const genresResults = new Map()
  const keywordsResults = new Map()
  let index = 0
  async function run() {
    while (index < missing.length) {
      const m = missing[index++]
      const [genres, keywords] = await Promise.all([
        m.genres ? Promise.resolve(undefined) : fetchGenresWithRetry(m.tmdb_id),
        m.keywords ? Promise.resolve(undefined) : fetchKeywordsWithRetry(m.tmdb_id),
      ])
      if (genres !== undefined) genresResults.set(m.tmdb_id, genres)
      if (keywords !== undefined) keywordsResults.set(m.tmdb_id, keywords)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, missing.length) }, run))
  return isCancelled() ? null : { genresResults, keywordsResults }
}

function patchGenresAndKeywords(movie, genresResults, keywordsResults) {
  let patched = movie
  if (genresResults.has(movie.tmdb_id) && genresResults.get(movie.tmdb_id) !== null) {
    patched = { ...patched, genres: genresResults.get(movie.tmdb_id) }
  }
  if (keywordsResults.has(movie.tmdb_id) && keywordsResults.get(movie.tmdb_id) !== null) {
    patched = { ...patched, keywords: keywordsResults.get(movie.tmdb_id) }
  }
  return patched
}

function useGenreKeywordBackfill(list, setList, saveKey) {
  useEffect(() => {
    const missing = list.filter((m) => (!m.genres || !m.keywords) && m.tmdb_id)
    if (missing.length === 0) return
    let cancelled = false
    resolveGenresAndKeywords(missing, () => cancelled).then((result) => {
      if (!result) return
      const { genresResults, keywordsResults } = result
      setList((prev) => {
        const next = prev.map((m) => patchGenresAndKeywords(m, genresResults, keywordsResults))
        saveLS(saveKey, next)
        return next
      })
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list])
}

// Saved Quick Lists are frozen snapshots, not a live list any other effect
// watches — a film saved before its own genres/keywords backfill finished
// would otherwise be stuck without them forever, silently making that saved
// list a dead end for Picks For You (no themes to build a taste profile
// from). Same retry-safe resolver as above, just flattened across every
// saved list's films and merged back per-list.
function useSavedQuickListsBackfill(savedQuickLists, setSavedQuickLists) {
  useEffect(() => {
    const missing = savedQuickLists.flatMap((l) => l.films.filter((m) => (!m.genres || !m.keywords) && m.tmdb_id))
    if (missing.length === 0) return
    let cancelled = false
    resolveGenresAndKeywords(missing, () => cancelled).then((result) => {
      if (!result) return
      const { genresResults, keywordsResults } = result
      setSavedQuickLists((prev) => {
        const next = prev.map((l) => ({
          ...l,
          films: l.films.map((m) => patchGenresAndKeywords(m, genresResults, keywordsResults)),
        }))
        saveLS(LS_SAVED_QUICKLISTS, next)
        return next
      })
    })
    return () => { cancelled = true }
  }, [savedQuickLists, setSavedQuickLists])
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
  // seenList is just ids — a film marked seen from somewhere that doesn't
  // keep its own copy (Picks For You, Explore's TMDB pool, a "Mark as
  // Seen" click with nothing else recording that film's data) would
  // otherwise vanish from the Seen Films page the moment nothing else on
  // the site happens to reference it. This is a denormalized id -> movie
  // cache, populated wherever a real movie object is available, so Seen
  // Films can always show what was actually marked seen, not just
  // whatever happens to also live on another list right now.
  const [seenFilmsData, setSeenFilmsData] = useState(() => loadLS(LS_SEEN_DATA, {}))
  const [watchlist, setWatchlist] = useState(() => loadLS(LS_WATCHLIST, []))
  // Permanent record of tmdb_ids ever watchlisted from Picks For You —
  // survives the watchlist entry itself being removed (e.g. once the film
  // graduates onto a real list), so the "FilmFolio Pick!" badge can still
  // be computed from a film's current list membership at any point later.
  const [recommendationPicks, setRecommendationPicks] = useState(() => new Set(loadLS(LS_RECOMMENDATION_PICKS, [])))

  // A film leaving "want to watch" the moment it's actually watched or
  // ranked — called from toggleSeen and from every movie-list add path
  // below, not just the explicit Remove button. Declared up here (ahead of
  // toggleSeen/addToList/insertAtRank) because useCallback's dependency
  // array is evaluated immediately during render, not deferred like the
  // callback body — referencing a `const` declared later in the component
  // throws (confirmed: "Cannot access before initialization" when this was
  // declared below its callers instead).
  const removeFromWatchlistIfPresent = useCallback((tmdbId) => {
    setWatchlist((prev) => {
      if (!prev.some((m) => m.tmdb_id === tmdbId)) return prev
      const next = prev.filter((m) => m.tmdb_id !== tmdbId)
      saveLS(LS_WATCHLIST, next)
      return next
    })
  }, [])

  const markRecommendationPick = useCallback((tmdbId) => {
    setRecommendationPicks((prev) => {
      if (prev.has(tmdbId)) return prev
      const next = new Set(prev)
      next.add(tmdbId)
      saveLS(LS_RECOMMENDATION_PICKS, [...next])
      return next
    })
  }, [])

  const [notInterested, setNotInterested] = useState(() => loadLS(LS_NOT_INT, []))

  // All ranked lists
  const [myList,       setMyList]       = useState(() => loadMyList())
  // Quick List — a scratch list of up to 10 films, separate from the Top
  // 100, that Picks For You can optionally pull its taste profile from
  // instead (same rank-weighted theme algorithm, just a smaller/faster-to-
  // build input than committing to a full ranked Top 100).
  const [quickList,    setQuickList]    = useState(() => loadLS(LS_QUICKLIST, []))
  // Named snapshots of the Quick List, saved off to their own archive page.
  const [savedQuickLists, setSavedQuickLists] = useState(() => loadLS(LS_SAVED_QUICKLISTS, []))
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
    quickList:    [quickList,     setQuickList,     LS_QUICKLIST],
    actorsList:   [actorsList,    setActorsList,    LS_ACTORS],
    showsList:    [showsList,     setShowsList,     LS_SHOWS],
    directorsList:[directorsList, setDirectorsList, LS_DIRECTORS],
    horrorList:   [horrorList,    setHorrorList,    LS_HORROR],
    seasonalList: [seasonalList,  setSeasonalList,  LS_SEASONAL],
    comediesList: [comediesList,  setComediesList,  LS_COMEDIES],
    animatedList: [animatedList,  setAnimatedList,  LS_ANIMATED],
  }), [myList, quickList, actorsList, showsList, directorsList, horrorList, seasonalList, comediesList, animatedList])

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

  useGenreKeywordBackfill(myList, setMyList, LS_MYLIST)
  useGenreKeywordBackfill(quickList, setQuickList, LS_QUICKLIST)
  useSavedQuickListsBackfill(savedQuickLists, setSavedQuickLists)

  // ── Seen list ──────────────────────────────────────────────────────────────
  const recordSeenData = useCallback((item) => {
    if (!item?.tmdb_id) return
    setSeenFilmsData((prev) => {
      const next = { ...prev, [item.tmdb_id]: item }
      saveLS(LS_SEEN_DATA, next)
      return next
    })
  }, [])

  // Accepts either a full movie object (preferred — lets Seen Films recover
  // its data later) or a bare tmdb_id (back-compat for any caller that
  // doesn't have the object handy).
  const toggleSeen = useCallback((movieOrId) => {
    const tmdbId = typeof movieOrId === 'object' ? movieOrId.tmdb_id : movieOrId
    const willBeSeen = !seenList.has(tmdbId)
    setSeenList((prev) => {
      const next = new Set(prev)
      if (next.has(tmdbId)) next.delete(tmdbId)
      else next.add(tmdbId)
      saveLS(LS_SEEN, [...next])
      return next
    })
    if (typeof movieOrId === 'object') recordSeenData(movieOrId)
    // A film marked seen (not un-marked) no longer needs to be on the
    // "want to watch" list.
    if (willBeSeen) removeFromWatchlistIfPresent(tmdbId)
  }, [recordSeenData, seenList, removeFromWatchlistIfPresent])

  // ── Generic list operations ────────────────────────────────────────────────
  const getItemId = (item) => item.tmdb_id ?? item.person_id ?? null

  // Movie list names that auto-add to seen on add
  const MOVIE_LISTS = new Set(['myList', 'quickList', 'horrorList', 'comediesList', 'animatedList', 'seasonalList'])

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
      recordSeenData(item)
      removeFromWatchlistIfPresent(item.tmdb_id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LIST_SETTERS, recordSeenData, removeFromWatchlistIfPresent])

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
      recordSeenData(item)
      removeFromWatchlistIfPresent(item.tmdb_id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LIST_SETTERS, recordSeenData, removeFromWatchlistIfPresent])

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

  // Merges per-id field patches into a list via React's functional setState
  // form — unlike reorderList (a deliberate whole-array replacement, correct
  // for user-driven drag-to-reorder), this is for background backfills that
  // may run concurrently with OTHER backfills touching the same list (e.g.
  // Statistics' stats backfill alongside the always-on genres/keywords
  // backfill). A plain `setter(closureSnapshot)` from either one would race:
  // whichever finishes last overwrites the whole array from its own stale
  // snapshot, silently discarding whatever fields the other one had just
  // written. The functional form applies against whatever the state
  // actually is when React processes it, not a stale closure, so concurrent
  // patches merge instead of clobbering each other.
  const patchListItems = useCallback((listName, patchesById) => {
    const config = LIST_SETTERS[listName]
    if (!config) return
    const [, setter, lsKey] = config
    setter((prev) => {
      const next = prev.map((item) => {
        const patch = patchesById.get(getItemId(item))
        return patch ? { ...item, ...patch } : item
      })
      saveLS(lsKey, next)
      return next
    })
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

  // ── Quick List save/clear ─────────────────────────────────────────────────
  const clearQuickList = useCallback(() => {
    setQuickList([])
    saveLS(LS_QUICKLIST, [])
  }, [])

  // Snapshots the current Quick List under a name — doesn't clear the
  // working list, so saving and clearing stay two separate, deliberate
  // actions instead of save always wiping what you just built.
  const saveQuickList = useCallback((name) => {
    setSavedQuickLists((prev) => {
      const entry = { id: `${Date.now()}`, name, createdAt: new Date().toISOString(), films: quickList }
      const next = [...prev, entry]
      saveLS(LS_SAVED_QUICKLISTS, next)
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickList])

  const deleteSavedQuickList = useCallback((id) => {
    setSavedQuickLists((prev) => {
      const next = prev.filter((l) => l.id !== id)
      saveLS(LS_SAVED_QUICKLISTS, next)
      return next
    })
  }, [])

  // Edits a saved snapshot in place (name and/or films) — distinct from
  // saveQuickList, which always creates a new entry.
  const updateSavedQuickList = useCallback((id, patch) => {
    setSavedQuickLists((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
      saveLS(LS_SAVED_QUICKLISTS, next)
      return next
    })
  }, [])

  // Replaces the *working* Quick List wholesale — used when a saved list is
  // opened for editing, so the existing Quick List page's full toolkit
  // (search-add, drag-reorder, remove) can be reused instead of building a
  // second, separate editor.
  const loadQuickList = useCallback((films) => {
    const capped = films.slice(0, LIST_MAX.quickList)
    setQuickList(capped)
    saveLS(LS_QUICKLIST, capped)
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

  // ── Cloud sync (Supabase) ────────────────────────────────────────────────
  // Every list-mutation function above is untouched — it still just writes
  // to useState + localStorage exactly as it did before accounts existed.
  // This section is a purely additive layer on top: once a session is
  // active, hydrate all of the above from the cloud, then keep pushing
  // changes back up. Guest mode (no session) never calls Supabase at all.
  const { session } = useAuth()
  const [hydrated, setHydrated] = useState(false)
  const [migrationPrompt, setMigrationPrompt] = useState(false)
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  // Whether local state has changed since the last successful push FROM
  // THIS DEVICE — without this, an unconditional "cloud wins on hydrate"
  // can silently discard a real edit that made it into localStorage but
  // never made it to the cloud before the tab closed.
  const dirtyRef = useRef(false)
  const lastSyncedAtRef = useRef(loadLS(LS_LAST_SYNCED, null))

  function assembleUserDataBlob() {
    return {
      myList, quickList, savedQuickLists, actorsList, showsList, directorsList,
      horrorList, seasonalList, comediesList, animatedList,
      watchlist, seenList: [...seenList], seenFilmsData,
      recommendationPicks: [...recommendationPicks], notInterested,
    }
  }

  function applyUserDataBlob(blob) {
    if (blob.myList !== undefined) { setMyList(blob.myList); saveLS(LS_MYLIST, blob.myList) }
    if (blob.quickList !== undefined) { setQuickList(blob.quickList); saveLS(LS_QUICKLIST, blob.quickList) }
    if (blob.savedQuickLists !== undefined) { setSavedQuickLists(blob.savedQuickLists); saveLS(LS_SAVED_QUICKLISTS, blob.savedQuickLists) }
    if (blob.actorsList !== undefined) { setActorsList(blob.actorsList); saveLS(LS_ACTORS, blob.actorsList) }
    if (blob.showsList !== undefined) { setShowsList(blob.showsList); saveLS(LS_SHOWS, blob.showsList) }
    if (blob.directorsList !== undefined) { setDirectorsList(blob.directorsList); saveLS(LS_DIRECTORS, blob.directorsList) }
    if (blob.horrorList !== undefined) { setHorrorList(blob.horrorList); saveLS(LS_HORROR, blob.horrorList) }
    if (blob.seasonalList !== undefined) { setSeasonalList(blob.seasonalList); saveLS(LS_SEASONAL, blob.seasonalList) }
    if (blob.comediesList !== undefined) { setComediesList(blob.comediesList); saveLS(LS_COMEDIES, blob.comediesList) }
    if (blob.animatedList !== undefined) { setAnimatedList(blob.animatedList); saveLS(LS_ANIMATED, blob.animatedList) }
    if (blob.watchlist !== undefined) { setWatchlist(blob.watchlist); saveLS(LS_WATCHLIST, blob.watchlist) }
    if (blob.seenList !== undefined) { setSeenList(new Set(blob.seenList)); saveLS(LS_SEEN, blob.seenList) }
    if (blob.seenFilmsData !== undefined) { setSeenFilmsData(blob.seenFilmsData); saveLS(LS_SEEN_DATA, blob.seenFilmsData) }
    if (blob.recommendationPicks !== undefined) { setRecommendationPicks(new Set(blob.recommendationPicks)); saveLS(LS_RECOMMENDATION_PICKS, blob.recommendationPicks) }
    if (blob.notInterested !== undefined) { setNotInterested(blob.notInterested); saveLS(LS_NOT_INT, blob.notInterested) }
  }

  function isLocalStateNonEmpty() {
    return myList.length > 0 || quickList.length > 0 || savedQuickLists.length > 0 ||
      actorsList.length > 0 || showsList.length > 0 || directorsList.length > 0 ||
      horrorList.length > 0 || seasonalList.length > 0 || comediesList.length > 0 ||
      animatedList.length > 0 || watchlist.length > 0 || seenList.size > 0 ||
      notInterested.length > 0
  }

  // In-memory only — deliberately never touches localStorage, so a "start
  // fresh" choice at signup still leaves the original local data on disk as
  // a backup; it just stops being what gets used/synced going forward.
  function resetAllListsToEmpty() {
    setMyList([]); setQuickList([]); setSavedQuickLists([])
    setActorsList([]); setShowsList([]); setDirectorsList([])
    setHorrorList([]); setSeasonalList([]); setComediesList([]); setAnimatedList([])
    setWatchlist([]); setSeenList(new Set()); setSeenFilmsData({})
    setRecommendationPicks(new Set()); setNotInterested([])
  }

  // Hydrate from the cloud whenever the session changes. Cloud only wins
  // outright if it's genuinely newer than what this device last pushed (or
  // this device has never synced this account before) — otherwise an
  // unsynced local edit from just before a tab closed would get silently
  // overwritten by a stale cloud row.
  useEffect(() => {
    if (!session) { setHydrated(false); return }
    let cancelled = false
    setHydrated(false)
    async function run() {
      const row = await getUserData(session.user.id)
      if (cancelled) return
      if (row) {
        const cloudIsNewer = !lastSyncedAtRef.current || new Date(row.updated_at) > new Date(lastSyncedAtRef.current)
        if (cloudIsNewer) {
          applyUserDataBlob(row.data)
          lastSyncedAtRef.current = row.updated_at
          saveLS(LS_LAST_SYNCED, row.updated_at)
          dirtyRef.current = false
        }
        // else: this device already has the latest (or newer, unsynced)
        // state — leave it alone, the push effect below syncs it up.
      } else if (isLocalStateNonEmpty()) {
        // Brand new account, this device has real data — ask before doing
        // anything with it instead of silently uploading or discarding.
        setMigrationPrompt(true)
        return // hydrated stays false until the prompt is resolved
      }
      setHydrated(true)
    }
    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  function resolveMigration(action) {
    if (action === 'discard') resetAllListsToEmpty()
    setMigrationPrompt(false)
    setHydrated(true) // the push effect below takes it from here
  }

  // Debounced push — gated on `hydrated` so this can never fire against a
  // stale pre-hydration snapshot and clobber real cloud data. Also flushes
  // immediately (non-debounced, keepalive) when the tab is about to be
  // hidden/closed, shrinking the window in which an edit could be lost from
  // "up to 800ms" down to "only if the OS kills the process outright."
  useEffect(() => {
    if (!session || !hydrated || !supabase) return
    dirtyRef.current = true

    async function push() {
      setSyncStatus('saving')
      const blob = assembleUserDataBlob()
      const updatedAt = await upsertUserData(session.user.id, blob)
      if (updatedAt) {
        lastSyncedAtRef.current = updatedAt
        saveLS(LS_LAST_SYNCED, updatedAt)
        dirtyRef.current = false
        setSyncStatus('saved')
      } else {
        setSyncStatus('error')
      }
    }

    const timer = setTimeout(push, 800)

    function handleVisibility() {
      if (document.visibilityState !== 'hidden') return
      const blob = assembleUserDataBlob()
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_data?on_conflict=user_id`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ user_id: session.user.id, data: blob }),
      }).catch(() => {})
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session, myList, quickList, savedQuickLists, actorsList, showsList,
      directorsList, horrorList, seasonalList, comediesList, animatedList,
      watchlist, seenList, seenFilmsData, recommendationPicks, notInterested])

  return (
    <FilmContext.Provider value={{
      // Gabe's curated list (seed, enriched progressively)
      movies,
      loading,
      // Seen state
      seenList,
      seenFilmsData,
      recordSeenData,
      toggleSeen,
      // Cloud sync status (see hydrate/sync effects below)
      syncStatus,
      migrationPrompt,
      resolveMigration,
      // User's ranked lists
      myList,
      myTop10,     // computed slice of myList[0..9]
      quickList,
      clearQuickList,
      loadQuickList,
      savedQuickLists,
      saveQuickList,
      updateSavedQuickList,
      deleteSavedQuickList,
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
      patchListItems,
      // Backwards-compat top-10 operations (used by TopTenBuilder)
      addToTop10,
      removeFromTop10,
      reorderTop10,
      // Watchlist
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      recommendationPicks,
      markRecommendationPick,
      // Not interested
      notInterested,
      addNotInterested,
    }}>
      {children}
      {migrationPrompt && (
        <ConfirmModal
          title="Import your existing lists?"
          message="We found films already saved on this device. Bring them into your new account, or start this account fresh — either way, nothing on this device gets deleted."
          confirmLabel="Import My Lists"
          cancelLabel="Start Fresh"
          onConfirm={() => resolveMigration('upload')}
          onCancel={() => resolveMigration('discard')}
        />
      )}
    </FilmContext.Provider>
  )
}

export function useFilm() {
  const ctx = useContext(FilmContext)
  if (!ctx) throw new Error('useFilm must be used within FilmProvider')
  return ctx
}
