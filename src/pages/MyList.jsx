import { useState, useEffect, useRef } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useFilm } from '../context/FilmContext'
import { searchMovies, getPosterUrl, PLACEHOLDER_POSTER } from '../api/tmdb'
import FilmCard from '../components/FilmCard'
import styles from './MyList.module.css'

export default function MyList() {
  const { myList, addToList, reorderList } = useFilm()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const debounceRef = useRef(null)
  const searchWrapRef = useRef(null)

  const myListIds = new Set(myList.map((m) => m.tmdb_id))
  const isFull = myList.length >= 100

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
    if (myListIds.has(r.id) || isFull) return
    addToList('myList', {
      tmdb_id: r.id,
      title: r.title,
      year: r.release_date?.slice(0, 4) ?? '',
      posterUrl: getPosterUrl(r.poster_path),
      overview: r.overview,
      vote_average: r.vote_average,
      director: '',
    })
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

  function handleDragEnd(result) {
    if (!result.destination) return
    const items = [...myList]
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    reorderList('myList', items)
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My Film List</h1>
            <p className={styles.subtitle}>Rank your all-time favorites, one film at a time.</p>
          </div>
          <span className={styles.countBadge}>{myList.length} / 100</span>
        </div>

        {/* Inline search bar */}
        <div className={styles.searchWrap} ref={searchWrapRef}>
          <div className={styles.searchBox}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search to add a film…"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {searching && <span className={styles.spinner}>⟳</span>}
            {query && !searching && (
              <button className={styles.clearBtn} onClick={handleClear} aria-label="Clear search">×</button>
            )}
          </div>

          {dropdownOpen && searchResults.length > 0 && (
            <div className={styles.dropdown}>
              {searchResults.map((r) => {
                const inList = myListIds.has(r.id)
                return (
                  <div key={r.id} className={styles.dropdownRow}>
                    <img
                      src={getPosterUrl(r.poster_path)}
                      alt={r.title}
                      className={styles.thumb}
                    />
                    <div className={styles.resultInfo}>
                      <span className={styles.resultTitle}>{r.title}</span>
                      <span className={styles.resultYear}>{r.release_date?.slice(0, 4)}</span>
                    </div>
                    <button
                      className={`${styles.addBtn} ${inList ? styles.added : ''} ${!inList && isFull ? styles.full : ''}`}
                      onClick={() => !inList && !isFull && handleAdd(r)}
                      disabled={inList || isFull}
                      title={!inList && isFull ? 'Your list is full (100/100) — remove a film to add more' : undefined}
                    >
                      {inList ? '✓' : isFull ? '—' : '+'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Grid header */}
        {myList.length > 0 && (
          <div className={styles.gridHeader}>
            <p className={styles.gridHint}>Drag to reorder · Click a poster for details</p>
          </div>
        )}

        {/* Poster grid — always shown */}
        {myList.length === 0 ? (
          <div className={styles.emptyGrid}>
            <p>Search for a film above to start building your list</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="grid" direction="horizontal">
              {(provided) => (
                <div
                  className={styles.posterGrid}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {myList.map((movie, index) => (
                    <Draggable
                      key={String(movie.tmdb_id)}
                      draggableId={String(movie.tmdb_id)}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`${styles.gridItem} ${snapshot.isDragging ? styles.gridDragging : ''}`}
                        >
                          <FilmCard
                            movie={movie}
                            rankBadge={index + 1}
                            showAddToList={false}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  )
}
