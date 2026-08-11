import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useFilm } from '../context/FilmContext'
import { searchMovies, getPosterUrl, PLACEHOLDER_POSTER, TMDB_GENRE_MAP } from '../api/tmdb'
import FilmCard from '../components/FilmCard'
import RankPickerModal from '../components/RankPickerModal'
import styles from './MyList.module.css'
import qlStyles from './QuickList.module.css'

function SortablePoster({ movie, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(movie.tmdb_id),
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${styles.gridItem} ${isDragging ? styles.gridDragging : ''}`}
    >
      <FilmCard movie={movie} rankBadge={index + 1} showAddToList={false} />
      <button
        className={styles.removeOverlay}
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        aria-label={`Remove ${movie.title} from My List`}
      >×</button>
    </div>
  )
}

export default function MyList() {
  const { myList, addToList, removeFromList, reorderList, insertAtRank } = useFilm()
  const location = useLocation()
  const pickingProfilePicture = !!location.state?.pickingProfilePicture
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [rankPickerMovie, setRankPickerMovie] = useState(null)
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

  function buildMovieItem(r) {
    return {
      tmdb_id: r.id,
      title: r.title,
      year: r.release_date?.slice(0, 4) ?? '',
      posterUrl: getPosterUrl(r.poster_path),
      overview: r.overview,
      vote_average: r.vote_average,
      director: '',
      genres: (r.genre_ids ?? []).map((id) => TMDB_GENRE_MAP[id]).filter(Boolean),
    }
  }

  // A full list no longer blocks adding — it opens the rank picker instead
  // so the film can be slotted in at a chosen position.
  function handleAdd(r) {
    if (myListIds.has(r.id)) return
    const item = buildMovieItem(r)
    if (isFull) { setRankPickerMovie(item); return }
    addToList('myList', item)
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

  const sensors = useSensors(
    // Distance-based activation fires a drag on the very first few px of
    // movement — indistinguishable from the start of a scroll swipe on
    // touch, so scrolling this grid on a phone kept getting hijacked into
    // reordering films instead. A delay (press-and-hold) + small tolerance
    // is dnd-kit's documented fix: quick swipes stay scrolls, only a
    // deliberate hold-then-drag starts a reorder.
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = myList.findIndex((m) => String(m.tmdb_id) === active.id)
    const newIndex = myList.findIndex((m) => String(m.tmdb_id) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorderList('myList', arrayMove(myList, oldIndex, newIndex))
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
            handleClear()
          }}
          onCancel={() => setRankPickerMovie(null)}
        />
      )}

      <div className="container">
        {pickingProfilePicture && (
          <div className={qlStyles.editingBanner}>
            Click a film below, then tap <strong>Make Profile Picture</strong> in its details.
            <Link to="/account" className={qlStyles.editingBannerLink}>Done</Link>
          </div>
        )}

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
                      className={`${styles.addBtn} ${inList ? styles.added : ''}`}
                      onClick={() => !inList && handleAdd(r)}
                      disabled={inList}
                      title={!inList && isFull ? 'Your list is full (100/100) — choose a rank to slot it in' : undefined}
                    >
                      {inList ? '✓' : '+'}
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={myList.map((m) => String(m.tmdb_id))} strategy={rectSortingStrategy}>
              <div className={styles.posterGrid}>
                {myList.map((movie, index) => (
                  <SortablePoster
                    key={movie.tmdb_id}
                    movie={movie}
                    index={index}
                    onRemove={() => removeFromList('myList', movie.tmdb_id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}
