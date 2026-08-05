import { useState, useEffect, useMemo, useRef } from 'react'
import { useFilm } from '../context/FilmContext'
import {
  getDiscoverMovies,
  getPosterUrl,
} from '../api/tmdb'
import FilmCard from '../components/FilmCard'
import styles from './Explore.module.css'

const DISCOVER_PARAMS = {
  sort_by: 'vote_average.desc',
  'vote_count.gte': 1000,
  'vote_average.gte': 7.0,
}
const INITIAL_PAGES = 25

function SkeletonCard() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonPoster} />
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLineShort} />
    </div>
  )
}

function normalizePoolMovie(tmdbMovie) {
  return {
    tmdb_id: tmdbMovie.id,
    title: tmdbMovie.title,
    year: tmdbMovie.release_date?.slice(0, 4) ?? '',
    overview: tmdbMovie.overview ?? '',
    vote_average: tmdbMovie.vote_average ?? null,
    posterUrl: getPosterUrl(tmdbMovie.poster_path),
    poster_path: tmdbMovie.poster_path,
    director: null,
    cast: [],
    runtime: null,
    isFeatured: false,
  }
}

const DEFAULT_FILTERS = {
  genre: '',
  decade: '',
  seen: 'all',
  featured: false,
}

export default function Explore() {
  const { movies: gabeMovies, myList, addToList, removeFromList, seenList, actorsList, directorsList, notInterested, addNotInterested } = useFilm()
  const [poolMovies, setPoolMovies] = useState([])
  const [poolLoading, setPoolLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGES)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const actorIdSet = useMemo(() => new Set(actorsList.map((a) => a.person_id)), [actorsList])
  const directorIdSet = useMemo(() => new Set(directorsList.map((d) => d.person_id)), [directorsList])
  const gabeIds = useMemo(() => new Set(gabeMovies.map((m) => m.tmdb_id)), [gabeMovies])
  const notInterestedIds = useMemo(() => new Set(notInterested), [notInterested])
  const myListIds = useMemo(() => new Set(myList.map((m) => m.tmdb_id)), [myList])
  const myListFull = myList.length >= 100

  // Pre-fetch 25 pages of Discover to give ~500 unique films up front
  useEffect(() => {
    setPoolLoading(true)
    const pages = Array.from({ length: INITIAL_PAGES }, (_, i) => i + 1)
    Promise.all(pages.map((p) => getDiscoverMovies(DISCOVER_PARAMS, p)))
      .then((responses) => {
        const seen = new Set()
        const movies = []
        for (const res of responses) {
          for (const m of (res?.results ?? [])) {
            if (gabeIds.has(m.id) || seen.has(m.id)) continue
            seen.add(m.id)
            movies.push(normalizePoolMovie(m))
          }
        }
        setPoolMovies(movies)
        setPoolLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gabeIds])

  function handleLoadMore() {
    const nextPage = currentPage + 1
    setLoadingMore(true)
    getDiscoverMovies(DISCOVER_PARAMS, nextPage)
      .then((res) => {
        const results = res?.results ?? []
        if (results.length === 0) {
          setHasMore(false)
          return
        }
        setPoolMovies((prev) => {
          const existingIds = new Set(prev.map((m) => m.tmdb_id))
          const fresh = results
            .filter((m) => !gabeIds.has(m.id) && !existingIds.has(m.id))
            .map(normalizePoolMovie)
          if (fresh.length === 0) setHasMore(false)
          return [...prev, ...fresh]
        })
        setCurrentPage(nextPage)
      })
      .finally(() => setLoadingMore(false))
  }

  // Stable per-film random order — assigned once per tmdb_id so cards don't
  // reshuffle on every re-render or when "Load More" appends new films.
  const shuffleKeysRef = useRef(new Map())

  const allMovies = useMemo(() => {
    const featured = gabeMovies
      .filter((m) => m.tmdb_id)
      .map((m) => ({ ...m, isFeatured: true }))
    const combined = [...featured, ...poolMovies]
    for (const m of combined) {
      if (!shuffleKeysRef.current.has(m.tmdb_id)) {
        shuffleKeysRef.current.set(m.tmdb_id, Math.random())
      }
    }
    return combined
  }, [gabeMovies, poolMovies])

  const genres = useMemo(() => {
    const set = new Set()
    gabeMovies.forEach((m) => m.genres?.forEach((g) => set.add(g)))
    return [...set].sort()
  }, [gabeMovies])

  const decades = useMemo(() => {
    const set = new Set()
    allMovies.forEach((m) => {
      const y = parseInt(m.year)
      if (y) set.add(Math.floor(y / 10) * 10)
    })
    return [...set].sort((a, b) => b - a)
  }, [allMovies])

  const filtered = useMemo(() => {
    let list = allMovies.filter((m) => !notInterestedIds.has(m.tmdb_id))
    if (filters.featured) list = list.filter((m) => m.isFeatured)
    if (filters.genre)    list = list.filter((m) => m.genres?.includes(filters.genre))
    if (filters.decade) {
      const d = Number(filters.decade)
      list = list.filter((m) => {
        const y = parseInt(m.year)
        return y && Math.floor(y / 10) * 10 === d
      })
    }
    if (filters.seen === 'seen')   list = list.filter((m) => seenList.has(m.tmdb_id))
    if (filters.seen === 'unseen') list = list.filter((m) => !seenList.has(m.tmdb_id))

    // Featured-only view keeps Gabe's curated ranking; otherwise the whole
    // pool is shuffled together so featured and discovered films mix freely.
    if (filters.featured) {
      list = [...list].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    } else {
      list = [...list].sort((a, b) =>
        shuffleKeysRef.current.get(a.tmdb_id) - shuffleKeysRef.current.get(b.tmdb_id)
      )
    }
    return list
  }, [allMovies, filters, seenList, notInterestedIds])

  function getSignals(movie) {
    if (actorIdSet.size === 0 && directorIdSet.size === 0) return { actors: [], directors: [] }
    const actors = (movie.cast ?? []).filter((_, i) => {
      const id = movie.castIds?.[i]
      return id && actorIdSet.has(id)
    })
    const directors = movie.directorId && directorIdSet.has(movie.directorId)
      ? [movie.director]
      : []
    return { actors, directors }
  }

  // Checkbox adds/removes the film from My List directly from the card
  function handleCheckbox(movie, e) {
    e.stopPropagation()
    const inList = myListIds.has(movie.tmdb_id)
    if (inList) removeFromList('myList', movie.tmdb_id)
    else if (!myListFull) addToList('myList', movie)
  }

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Explore Films</h1>
            <p className={styles.subtitle}>
              Top rated, award-winning films — curated and community-ranked.
            </p>
          </div>
          <span className={styles.count}>{filtered.length} films</span>
        </div>

        {/* Filter bar */}
        <div className={styles.filterBar}>
          <button
            className={`${styles.featuredToggle} ${filters.featured ? styles.featuredActive : ''}`}
            onClick={() => setFilter('featured', !filters.featured)}
          >
            ★ Featured
          </button>

          <select
            className={styles.select}
            value={filters.genre}
            onChange={(e) => setFilter('genre', e.target.value)}
          >
            <option value="">All Genres</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          <select
            className={styles.select}
            value={filters.decade}
            onChange={(e) => setFilter('decade', e.target.value)}
          >
            <option value="">All Decades</option>
            {decades.map((d) => <option key={d} value={d}>{d}s</option>)}
          </select>

          <select
            className={styles.select}
            value={filters.seen}
            onChange={(e) => setFilter('seen', e.target.value)}
          >
            <option value="all">All Films</option>
            <option value="seen">Seen</option>
            <option value="unseen">Unseen</option>
          </select>

          {(filters.featured || filters.genre || filters.decade || filters.seen !== 'all') && (
            <button className={styles.clearBtn} onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>

        {/* Grid */}
        <div className={styles.grid}>
          {filtered.map((movie) => {
            const signals = getSignals(movie)
            const inMyList = myListIds.has(movie.tmdb_id)
            return (
              <div key={movie.tmdb_id} className={styles.cardWrap}>
                <button
                  className={`${styles.checkbox} ${inMyList ? styles.checkboxChecked : ''}`}
                  onClick={(e) => handleCheckbox(movie, e)}
                  disabled={!inMyList && myListFull}
                  title={!inMyList && myListFull ? 'Your list is full (100/100) — remove a film to add more' : undefined}
                  aria-label={inMyList ? 'Remove from My List' : 'Add to My List'}
                >
                  {inMyList ? '✓' : ''}
                </button>
                <button
                  className={styles.notInterestedBtn}
                  onClick={() => addNotInterested(movie.tmdb_id)}
                  title="Not interested"
                  aria-label="Not interested"
                >
                  ✕
                </button>
                <FilmCard
                  movie={movie}
                  isFeatured={movie.isFeatured}
                  actorMatches={signals.actors}
                  directorMatches={signals.directors}
                  showAddToList
                  showNotInterested
                  onNotInterested={() => addNotInterested(movie.tmdb_id)}
                />
              </div>
            )
          })}

          {poolLoading && Array.from({ length: 20 }).map((_, i) => (
            <SkeletonCard key={`sk-${i}`} />
          ))}
        </div>

        {!filters.featured && !poolLoading && (
          <div className={styles.loadMoreWrap}>
            {hasMore ? (
              <button
                className={styles.loadMoreBtn}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load More Films'}
              </button>
            ) : (
              <p className={styles.noMoreText}>No more films to load</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
