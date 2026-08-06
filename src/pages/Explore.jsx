import { useState, useEffect, useMemo, useRef } from 'react'
import { useFilm } from '../context/FilmContext'
import {
  getDiscoverMovies,
  getPosterUrl,
} from '../api/tmdb'
import FilmCard from '../components/FilmCard'
import RankPickerModal from '../components/RankPickerModal'
import styles from './Explore.module.css'

const DISCOVER_PARAMS = {
  sort_by: 'vote_average.desc',
  'vote_count.gte': 1000,
  'vote_average.gte': 7.0,
}
const INITIAL_PAGES = 25

// TMDB's discover/popular endpoints return numeric genre_ids, not names —
// this is TMDB's stable, documented movie genre list (matches the naming
// already used in movies.json, e.g. "Science Fiction" not "Sci-Fi").
const TMDB_GENRE_MAP = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War',
  37: 'Western',
}

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
    genres: (tmdbMovie.genre_ids ?? []).map((id) => TMDB_GENRE_MAP[id]).filter(Boolean),
    director: null,
    cast: [],
    runtime: null,
  }
}

const DEFAULT_FILTERS = {
  genre: '',
  decade: '',
}

export default function Explore() {
  const { movies: gabeMovies, myList, addToList, insertAtRank, seenList, watchlist, actorsList, directorsList, notInterested, addNotInterested } = useFilm()
  const [poolMovies, setPoolMovies] = useState([])
  const [poolLoading, setPoolLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGES)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [rankPickerMovie, setRankPickerMovie] = useState(null)

  const actorIdSet = useMemo(() => new Set(actorsList.map((a) => a.person_id)), [actorsList])
  const directorIdSet = useMemo(() => new Set(directorsList.map((d) => d.person_id)), [directorsList])
  const gabeIds = useMemo(() => new Set(gabeMovies.map((m) => m.tmdb_id)), [gabeMovies])
  const notInterestedIds = useMemo(() => new Set(notInterested), [notInterested])
  const myListIds = useMemo(() => new Set(myList.map((m) => m.tmdb_id)), [myList])
  const watchlistIds = useMemo(() => new Set(watchlist.map((m) => m.tmdb_id)), [watchlist])
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
    const gabeFilms = gabeMovies.filter((m) => m.tmdb_id)
    const combined = [...gabeFilms, ...poolMovies]
    for (const m of combined) {
      if (!shuffleKeysRef.current.has(m.tmdb_id)) {
        shuffleKeysRef.current.set(m.tmdb_id, Math.random())
      }
    }
    return combined
  }, [gabeMovies, poolMovies])

  const genres = useMemo(() => {
    const set = new Set()
    allMovies.forEach((m) => m.genres?.forEach((g) => set.add(g)))
    return [...set].sort()
  }, [allMovies])

  const decades = useMemo(() => {
    const set = new Set()
    allMovies.forEach((m) => {
      const y = parseInt(m.year)
      if (y) set.add(Math.floor(y / 10) * 10)
    })
    return [...set].sort((a, b) => b - a)
  }, [allMovies])

  const filtered = useMemo(() => {
    // Films you've engaged with (seen, ranked, or queued to watch) fall out
    // of Explore automatically, same as "Not Interested" dismissals.
    let list = allMovies.filter((m) =>
      !notInterestedIds.has(m.tmdb_id) &&
      !seenList.has(m.tmdb_id) &&
      !myListIds.has(m.tmdb_id) &&
      !watchlistIds.has(m.tmdb_id)
    )
    if (filters.genre)    list = list.filter((m) => m.genres?.includes(filters.genre))
    if (filters.decade) {
      const d = Number(filters.decade)
      list = list.filter((m) => {
        const y = parseInt(m.year)
        return y && Math.floor(y / 10) * 10 === d
      })
    }

    // Whole pool is shuffled together so films mix freely on every load.
    return [...list].sort((a, b) =>
      shuffleKeysRef.current.get(a.tmdb_id) - shuffleKeysRef.current.get(b.tmdb_id)
    )
  }, [allMovies, filters, seenList, myListIds, watchlistIds, notInterestedIds])

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

  // Checkbox adds the film to My List; the card then disappears from Explore
  // (filtered out along with Seen and Watchlist films — see `filtered` above).
  // Once the list is full, it opens a rank picker instead of doing nothing.
  function handleCheckbox(movie, e) {
    e.stopPropagation()
    if (myListFull) {
      setRankPickerMovie(movie)
    } else {
      addToList('myList', movie)
    }
  }

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className={styles.page}>
      {rankPickerMovie && (
        <RankPickerModal
          itemName={rankPickerMovie.title}
          maxRank={100}
          onSubmit={(rank) => {
            insertAtRank('myList', rankPickerMovie, rank)
            setRankPickerMovie(null)
          }}
          onCancel={() => setRankPickerMovie(null)}
        />
      )}

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

          {(filters.genre || filters.decade) && (
            <button className={styles.clearBtn} onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>

        {/* Grid */}
        <div className={styles.grid}>
          {filtered.map((movie) => {
            const signals = getSignals(movie)
            return (
              <div key={movie.tmdb_id} className={styles.cardWrap}>
                <button
                  className={styles.checkbox}
                  onClick={(e) => handleCheckbox(movie, e)}
                  title={myListFull ? 'Your list is full (100/100) — choose a rank to slot it in' : undefined}
                  aria-label="Add to My List"
                >
                  +
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

        {!poolLoading && (
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
