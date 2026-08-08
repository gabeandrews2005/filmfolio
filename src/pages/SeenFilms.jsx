import { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER, getMovieDetails, getPosterUrl, searchMovies, TMDB_GENRE_MAP } from '../api/tmdb'
import useOmdbRatings from '../hooks/useOmdbRatings'
import RatingDisplay from '../components/RatingDisplay'
import styles from './SeenFilms.module.css'
import searchStyles from './MyList.module.css'

async function fetchSeenFilmDataWithRetry(tmdbId, attempt = 0) {
  const details = await getMovieDetails(tmdbId)
  if (details) {
    return {
      tmdb_id: tmdbId,
      title: details.title,
      year: details.release_date?.slice(0, 4) ?? '',
      posterUrl: getPosterUrl(details.poster_path),
      overview: details.overview,
      vote_average: details.vote_average,
      genres: details.genres?.map((g) => g.name) ?? [],
    }
  }
  if (attempt >= 2) return null
  await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  return fetchSeenFilmDataWithRetry(tmdbId, attempt + 1)
}

function getFilmListBadges(tmdbId, ctx) {
  const badges = []
  if (ctx.myList.findIndex((m) => m.tmdb_id === tmdbId) !== -1) {
    const rank = ctx.myList.findIndex((m) => m.tmdb_id === tmdbId) + 1
    badges.push(`My List #${rank}`)
  }
  ;['horrorList', 'comediesList', 'animatedList', 'seasonalList'].forEach((key) => {
    const list = ctx[key] ?? []
    const idx = list.findIndex((m) => m.tmdb_id === tmdbId)
    if (idx !== -1) {
      const label = key.replace('List', '').replace('comedies', 'Comedy').replace('horror', 'Horror')
        .replace('animated', 'Animated').replace('seasonal', 'Seasonal')
      badges.push(`${label} #${idx + 1}`)
    }
  })
  return badges
}

function SeenFilmCard({ movie, badges }) {
  const { ratings } = useOmdbRatings(movie.tmdb_id)

  return (
    <div className={styles.card}>
      <div className={styles.posterWrap}>
        <img
          src={movie.posterUrl || PLACEHOLDER_POSTER}
          alt={movie.title}
          className={styles.poster}
          loading="lazy"
        />
        <div className={styles.seenMark}>✓</div>
      </div>
      <div className={styles.info}>
        <span className={styles.filmTitle}>{movie.title}</span>
        <span className={styles.filmYear}>{movie.year}</span>
        <RatingDisplay
          compact
          rtScore={ratings?.rtScore}
          imdbRating={ratings?.imdbRating}
          tmdbScore={movie.vote_average}
        />
        {badges.length > 0 && (
          <div className={styles.badges}>
            {badges.map((b) => (
              <span key={b} className={styles.badge}>{b}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SeenFilms() {
  const ctx = useFilm()
  const {
    seenList, seenFilmsData, recordSeenData, movies, myList, quickList, watchlist,
    horrorList, comediesList, animatedList, seasonalList, toggleSeen,
  } = ctx

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const debounceRef = useRef(null)
  const searchWrapRef = useRef(null)

  function handleSearch(value) {
    setQuery(value)
    clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setSearchResults([])
      setDropdownOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const results = await searchMovies(value)
      setSearchResults(results.slice(0, 8))
      setDropdownOpen(true)
      setSearching(false)
    }, 300)
  }

  function handleAdd(r) {
    if (seenList.has(r.id)) return
    toggleSeen({
      tmdb_id: r.id,
      title: r.title,
      year: r.release_date?.slice(0, 4) ?? '',
      posterUrl: getPosterUrl(r.poster_path),
      overview: r.overview,
      vote_average: r.vote_average,
      director: '',
      genres: (r.genre_ids ?? []).map((id) => TMDB_GENRE_MAP[id]).filter(Boolean),
    })
    handleClear()
  }

  function handleClear() {
    setQuery('')
    setSearchResults([])
    setDropdownOpen(false)
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    function onEscape(e) {
      if (e.key === 'Escape') handleClear()
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [])

  // Build a map of all known films from all sources
  const filmMap = useMemo(() => {
    const map = new Map()
    const addFilms = (list) => {
      list.forEach((m) => {
        if (m.tmdb_id && !map.has(m.tmdb_id)) map.set(m.tmdb_id, m)
      })
    }
    addFilms(movies)
    addFilms(myList)
    addFilms(quickList)
    addFilms(watchlist)
    addFilms(horrorList)
    addFilms(comediesList)
    addFilms(animatedList)
    addFilms(seasonalList)
    return map
  }, [movies, myList, quickList, watchlist, horrorList, comediesList, animatedList, seasonalList])

  // A film marked seen from somewhere that doesn't keep its own copy (Picks
  // For You, Explore's TMDB pool, a bare "Mark as Seen" click) wouldn't be
  // in any of the lists above at all — seenFilmsData is the denormalized
  // fallback that remembers it regardless of whether it's on a list.
  const seenFilms = useMemo(() => {
    return [...seenList]
      .map((id) => filmMap.get(id) ?? seenFilmsData[id])
      .filter(Boolean)
  }, [seenList, filmMap, seenFilmsData])

  // One-time recovery for ids marked seen before seenFilmsData existed —
  // there's no display data for these anywhere in the app, but the id
  // itself is enough to fetch it fresh from TMDB and cache it going
  // forward, so they stop disappearing from this page.
  useEffect(() => {
    const missing = [...seenList].filter((id) => !filmMap.has(id) && !seenFilmsData[id])
    if (missing.length === 0) return
    let cancelled = false
    async function backfill() {
      let index = 0
      async function run() {
        while (index < missing.length) {
          const id = missing[index++]
          const data = await fetchSeenFilmDataWithRetry(id)
          if (cancelled) return
          if (data) recordSeenData(data)
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, missing.length) }, run))
    }
    backfill()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seenList, filmMap])

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Seen Films</h1>
          <span className={styles.count}>{seenFilms.length} films</span>
        </div>

        {/* Inline search bar */}
        <div className={searchStyles.searchWrap} ref={searchWrapRef}>
          <div className={searchStyles.searchBox}>
            <input
              type="text"
              className={searchStyles.searchInput}
              placeholder="Search to mark a film seen…"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {searching && <span className={searchStyles.spinner}>⟳</span>}
            {query && !searching && (
              <button className={searchStyles.clearBtn} onClick={handleClear} aria-label="Clear search">×</button>
            )}
          </div>

          {dropdownOpen && searchResults.length > 0 && (
            <div className={searchStyles.dropdown}>
              {searchResults.map((r) => {
                const inList = seenList.has(r.id)
                return (
                  <div key={r.id} className={searchStyles.dropdownRow}>
                    <img
                      src={getPosterUrl(r.poster_path)}
                      alt={r.title}
                      className={searchStyles.thumb}
                    />
                    <div className={searchStyles.resultInfo}>
                      <span className={searchStyles.resultTitle}>{r.title}</span>
                      <span className={searchStyles.resultYear}>{r.release_date?.slice(0, 4)}</span>
                    </div>
                    <button
                      className={`${searchStyles.addBtn} ${inList ? searchStyles.added : ''}`}
                      onClick={() => !inList && handleAdd(r)}
                      disabled={inList}
                    >
                      {inList ? '✓' : '+'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {seenFilms.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Films you mark as seen will appear here automatically.
            </p>
            <Link to="/explore" className={styles.exploreLink}>Explore Films →</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {seenFilms.map((movie) => (
              <SeenFilmCard
                key={movie.tmdb_id}
                movie={movie}
                badges={getFilmListBadges(movie.tmdb_id, ctx)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
