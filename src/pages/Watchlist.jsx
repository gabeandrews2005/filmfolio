import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { searchMovies, getPosterUrl, TMDB_GENRE_MAP } from '../api/tmdb'
import FilmCard from '../components/FilmCard'
import styles from './Watchlist.module.css'
import searchStyles from './MyList.module.css'

export default function Watchlist() {
  const { watchlist, addToWatchlist } = useFilm()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const debounceRef = useRef(null)
  const searchWrapRef = useRef(null)

  const watchlistIds = new Set(watchlist.map((m) => m.tmdb_id))

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
    if (watchlistIds.has(r.id)) return
    addToWatchlist({
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

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Watchlist</h1>
          <span className={styles.count}>{watchlist.length} films</span>
        </div>

        {/* Inline search bar */}
        <div className={searchStyles.searchWrap} ref={searchWrapRef}>
          <div className={searchStyles.searchBox}>
            <input
              type="text"
              className={searchStyles.searchInput}
              placeholder="Search to add a film…"
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
                const inList = watchlistIds.has(r.id)
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

        {watchlist.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Save films to your watchlist and they'll appear here.
            </p>
            <Link to="/explore" className={styles.exploreLink}>Explore Films →</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {watchlist.map((movie) => (
              <FilmCard key={movie.tmdb_id} movie={movie} showAddToList />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
