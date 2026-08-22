import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { searchMovies, getPosterUrl, TMDB_GENRE_MAP } from '../api/tmdb'
import FilmCard from '../components/FilmCard'
import styles from './Watchlist.module.css'
import searchStyles from './MyList.module.css'

const DEFAULT_FILTERS = { genre: '', decade: '' }

export default function Watchlist() {
  const { watchlist, addToWatchlist } = useFilm()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const debounceRef = useRef(null)
  const searchWrapRef = useRef(null)

  const watchlistIds = new Set(watchlist.map((m) => m.tmdb_id))

  const genres = useMemo(() => {
    const set = new Set()
    watchlist.forEach((m) => m.genres?.forEach((g) => set.add(g)))
    return [...set].sort()
  }, [watchlist])

  const decades = useMemo(() => {
    const set = new Set()
    watchlist.forEach((m) => {
      const y = parseInt(m.year)
      if (y) set.add(Math.floor(y / 10) * 10)
    })
    return [...set].sort((a, b) => b - a)
  }, [watchlist])

  const filtered = useMemo(() => {
    let list = watchlist
    if (filters.genre) list = list.filter((m) => m.genres?.includes(filters.genre))
    if (filters.decade) {
      const d = Number(filters.decade)
      list = list.filter((m) => {
        const y = parseInt(m.year)
        return y && Math.floor(y / 10) * 10 === d
      })
    }
    return list
  }, [watchlist, filters])

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

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
          <span className={styles.count}>{filtered.length} films</span>
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
          <>
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

            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyText}>No films match these filters.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {filtered.map((movie) => (
                  <FilmCard key={movie.tmdb_id} movie={movie} showAddToList />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
