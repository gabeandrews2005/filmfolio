import { useState, useEffect, useMemo } from 'react'
import { useFilm } from '../context/FilmContext'
import { getPopularMovies, getTopRatedMovies, getPosterUrl } from '../api/tmdb'
import FilmCard from '../components/FilmCard'
import styles from './Explore.module.css'

// Skeleton card for loading state
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
  const { movies: gabeMovies, seenList, actorsList, directorsList } = useFilm()
  const [poolMovies, setPoolMovies] = useState([])
  const [poolLoading, setPoolLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  // Build actor/director ID sets for star signal detection
  const actorIdSet = useMemo(
    () => new Set(actorsList.map((a) => a.person_id)),
    [actorsList]
  )
  const directorIdSet = useMemo(
    () => new Set(directorsList.map((d) => d.person_id)),
    [directorsList]
  )

  const gabeIds = useMemo(() => new Set(gabeMovies.map((m) => m.tmdb_id)), [gabeMovies])

  // Fetch TMDB popular + top_rated pages
  async function fetchPage(page) {
    const [pop, top] = await Promise.all([
      getPopularMovies(page),
      getTopRatedMovies(page),
    ])
    const combined = [
      ...(pop?.results ?? []),
      ...(top?.results ?? []),
    ]
    // Deduplicate by id and filter out Gabe's picks (they're already in the pool as Featured)
    const seen = new Set()
    return combined.filter((m) => {
      if (gabeIds.has(m.id)) return false
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    }).map(normalizePoolMovie)
  }

  // Initial load
  useEffect(() => {
    setPoolLoading(true)
    fetchPage(1).then((movies) => {
      setPoolMovies(movies)
      setPoolLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gabeIds])

  function handleLoadMore() {
    const nextPage = currentPage + 1
    setLoadingMore(true)
    fetchPage(nextPage).then((movies) => {
      setPoolMovies((prev) => {
        const existingIds = new Set(prev.map((m) => m.tmdb_id))
        const fresh = movies.filter((m) => !existingIds.has(m.tmdb_id))
        return [...prev, ...fresh]
      })
      setCurrentPage(nextPage)
      if (movies.length === 0) setHasMore(false)
      setLoadingMore(false)
    })
  }

  // Merge Gabe's picks (Featured) with TMDB pool
  const allMovies = useMemo(() => {
    const featured = gabeMovies
      .filter((m) => m.tmdb_id)
      .map((m) => ({ ...m, isFeatured: true }))
    return [...featured, ...poolMovies]
  }, [gabeMovies, poolMovies])

  // Collect genres and decades for filter dropdowns
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

  // Apply filters
  const filtered = useMemo(() => {
    let list = [...allMovies]

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

    return list
  }, [allMovies, filters, seenList])

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
              Gabe's picks, TMDB's best — discover your next favorite.
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
            ★ Gabe's Picks
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
          {/* Gabe's picks always rendered immediately */}
          {filtered
            .filter((m) => m.isFeatured)
            .map((movie) => {
              const signals = getSignals(movie)
              return (
                <FilmCard
                  key={`f-${movie.tmdb_id}`}
                  movie={movie}
                  isFeatured
                  actorMatches={signals.actors}
                  directorMatches={signals.directors}
                  showAddToList
                />
              )
            })}

          {/* Pool movies */}
          {!filters.featured && filtered
            .filter((m) => !m.isFeatured)
            .map((movie) => {
              const signals = getSignals(movie)
              return (
                <FilmCard
                  key={`p-${movie.tmdb_id}`}
                  movie={movie}
                  actorMatches={signals.actors}
                  directorMatches={signals.directors}
                  showAddToList
                />
              )
            })}

          {/* Loading skeletons */}
          {poolLoading && Array.from({ length: 20 }).map((_, i) => (
            <SkeletonCard key={`sk-${i}`} />
          ))}
        </div>

        {/* Load More */}
        {!filters.featured && !poolLoading && hasMore && (
          <div className={styles.loadMoreWrap}>
            <button
              className={styles.loadMoreBtn}
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load More Films'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
