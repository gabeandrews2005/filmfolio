import { useState, useEffect, useMemo } from 'react'
import { useFilm } from '../context/FilmContext'
import {
  getPopularMovies, getTopRatedMovies, getDiscoverMovies,
  getPosterUrl, getMovieExternalIds,
} from '../api/tmdb'
import { getOmdbRatings } from '../api/omdb'
import FilmCard from '../components/FilmCard'
import styles from './Explore.module.css'

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

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const DEFAULT_FILTERS = {
  genre: '',
  decade: '',
  seen: 'all',
  featured: false,
}

export default function Explore() {
  const { movies: gabeMovies, seenList, actorsList, directorsList, myList, addToList, addToTop10, notInterested, addNotInterested } = useFilm()
  const [poolMovies, setPoolMovies] = useState([])
  const [poolLoading, setPoolLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [confirmFilm, setConfirmFilm] = useState(null)

  const actorIdSet = useMemo(() => new Set(actorsList.map((a) => a.person_id)), [actorsList])
  const directorIdSet = useMemo(() => new Set(directorsList.map((d) => d.person_id)), [directorsList])
  const gabeIds = useMemo(() => new Set(gabeMovies.map((m) => m.tmdb_id)), [gabeMovies])
  const myListIds = useMemo(() => new Set(myList.map((m) => m.tmdb_id)), [myList])
  const notInterestedIds = useMemo(() => new Set(notInterested), [notInterested])

  async function fetchPage(page) {
    const [pop, top, awards, revenue] = await Promise.all([
      getPopularMovies(page),
      getTopRatedMovies(page),
      getDiscoverMovies({ sort_by: 'vote_average.desc', 'vote_count.gte': 1000 }, page),
      getDiscoverMovies({ sort_by: 'revenue.desc' }, page),
    ])
    const combined = [
      ...(pop?.results ?? []),
      ...(top?.results ?? []),
      ...(awards?.results ?? []),
      ...(revenue?.results ?? []),
    ]
    const seen = new Set()
    const filtered = combined.filter((m) => {
      if (gabeIds.has(m.id)) return false
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    }).map(normalizePoolMovie)
    return shuffle(filtered)
  }

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

  const allMovies = useMemo(() => {
    const featured = gabeMovies
      .filter((m) => m.tmdb_id)
      .map((m) => ({ ...m, isFeatured: true }))
    return [...featured, ...poolMovies]
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

  function handleCheckbox(movie, e) {
    e.stopPropagation()
    if (myListIds.has(movie.tmdb_id)) return
    if (myList.length >= 10) {
      setConfirmFilm(movie)
      return
    }
    if (myList.length < 10) addToTop10(movie)
    else addToList('myList', movie)
  }

  function handleConfirmExtend(movie) {
    addToList('myList', movie)
    setConfirmFilm(null)
  }

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className={styles.page}>
      {/* Confirm dialog for extending list */}
      {confirmFilm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <p className={styles.confirmText}>
              Your top 10 is full. Add <strong>{confirmFilm.title}</strong> to your extended list?
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmYes} onClick={() => handleConfirmExtend(confirmFilm)}>
                Add to Extended List
              </button>
              <button className={styles.confirmNo} onClick={() => setConfirmFilm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Explore Films</h1>
            <p className={styles.subtitle}>
              Top rated, popular, award-winning, and blockbuster films — all in one place.
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
          {filtered
            .filter((m) => m.isFeatured)
            .map((movie) => {
              const signals = getSignals(movie)
              const inList = myListIds.has(movie.tmdb_id)
              return (
                <div key={`f-${movie.tmdb_id}`} className={styles.cardWrap}>
                  <button
                    className={`${styles.checkbox} ${inList ? styles.checkboxChecked : ''}`}
                    onClick={(e) => handleCheckbox(movie, e)}
                    aria-label={inList ? 'In your list' : 'Add to My List'}
                  >
                    {inList ? '✓' : ''}
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
                    isFeatured
                    actorMatches={signals.actors}
                    directorMatches={signals.directors}
                    showAddToList
                    showNotInterested
                    onNotInterested={() => addNotInterested(movie.tmdb_id)}
                  />
                </div>
              )
            })}

          {!filters.featured && filtered
            .filter((m) => !m.isFeatured)
            .map((movie) => {
              const signals = getSignals(movie)
              const inList = myListIds.has(movie.tmdb_id)
              return (
                <div key={`p-${movie.tmdb_id}`} className={styles.cardWrap}>
                  <button
                    className={`${styles.checkbox} ${inList ? styles.checkboxChecked : ''}`}
                    onClick={(e) => handleCheckbox(movie, e)}
                    aria-label={inList ? 'In your list' : 'Add to My List'}
                  >
                    {inList ? '✓' : ''}
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
