import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useFilm } from '../context/FilmContext'
import { searchMovies, getPosterUrl, PLACEHOLDER_POSTER, TMDB_GENRE_MAP } from '../api/tmdb'
import FilmCard from '../components/FilmCard'
import ConfirmModal from '../components/ConfirmModal'
import RankPickerModal from '../components/RankPickerModal'
import styles from './MyList.module.css'
import modalStyles from '../components/ConfirmModal.module.css'
import qlStyles from './QuickList.module.css'

function SaveQuickListModal({ defaultName, onSave, onCancel }) {
  const [name, setName] = useState(defaultName)

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onSave(trimmed)
  }

  return (
    <div className={modalStyles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <form className={modalStyles.box} onSubmit={handleSubmit}>
        <h2 className={modalStyles.title}>Save Quick List</h2>
        <p className={modalStyles.text}>Give this batch of films a name so you can find it later.</p>
        <input
          type="text"
          className={qlStyles.saveNameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rainy Day Picks"
          autoFocus
        />
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button type="submit" className={modalStyles.confirmBtn} disabled={!name.trim()}>Save</button>
        </div>
      </form>
    </div>
  )
}

const QUICK_LIST_MAX = 10

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
        aria-label={`Remove ${movie.title} from Quick List`}
      >×</button>
    </div>
  )
}

export default function QuickList() {
  const { quickList, savedQuickLists, addToList, removeFromList, reorderList, insertAtRank, saveQuickList, clearQuickList } = useFilm()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [rankPickerMovie, setRankPickerMovie] = useState(null)
  const debounceRef = useRef(null)
  const searchWrapRef = useRef(null)

  const quickListIds = new Set(quickList.map((m) => m.tmdb_id))
  const isFull = quickList.length >= QUICK_LIST_MAX

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

  // A full Quick List no longer blocks adding — it opens the rank picker
  // instead so the film can be slotted in at a chosen position.
  function handleAdd(r) {
    if (quickListIds.has(r.id)) return
    const item = buildMovieItem(r)
    if (isFull) { setRankPickerMovie(item); return }
    addToList('quickList', item)
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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = quickList.findIndex((m) => String(m.tmdb_id) === active.id)
    const newIndex = quickList.findIndex((m) => String(m.tmdb_id) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorderList('quickList', arrayMove(quickList, oldIndex, newIndex))
  }

  function handleSaveConfirm(name) {
    saveQuickList(name)
    setShowSaveModal(false)
    navigate('/quick-lists')
  }

  function handleClearConfirm() {
    clearQuickList()
    setShowClearModal(false)
  }

  return (
    <div className={styles.page}>
      {showSaveModal && (
        <SaveQuickListModal
          defaultName={`Quick List ${savedQuickLists.length + 1}`}
          onSave={handleSaveConfirm}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

      {showClearModal && (
        <ConfirmModal
          title="Clear Quick List?"
          message="This empties your current Quick List. If you want to keep it, save it first — clearing does not save a copy."
          confirmLabel="Clear Quick List"
          destructive
          onConfirm={handleClearConfirm}
          onCancel={() => setShowClearModal(false)}
        />
      )}

      {rankPickerMovie && (
        <RankPickerModal
          itemName={rankPickerMovie.title}
          maxRank={QUICK_LIST_MAX}
          onSubmit={(rank) => {
            insertAtRank('quickList', rankPickerMovie, rank)
            setRankPickerMovie(null)
            handleClear()
          }}
          onCancel={() => setRankPickerMovie(null)}
        />
      )}

      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Quick List</h1>
            <p className={styles.subtitle}>
              Throw together 10 films fast — <Link to="/recommendations">Picks For You</Link> can pull
              its taste profile from this instead of your full Top 100.
            </p>
          </div>
          <div className={qlStyles.headerActions}>
            <span className={styles.countBadge}>{quickList.length} / {QUICK_LIST_MAX}</span>
            <div className={qlStyles.headerButtons}>
              <button
                className={qlStyles.saveBtn}
                onClick={() => setShowSaveModal(true)}
                disabled={quickList.length === 0}
                title={quickList.length === 0 ? 'Add films to your Quick List first' : undefined}
              >
                Save Quick List
              </button>
              <button
                className={qlStyles.clearBtn}
                onClick={() => setShowClearModal(true)}
                disabled={quickList.length === 0}
              >
                Clear Quick List
              </button>
            </div>
          </div>
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
                const inList = quickListIds.has(r.id)
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
                      title={!inList && isFull ? `Quick List is full (${QUICK_LIST_MAX}/${QUICK_LIST_MAX}) — choose a rank to slot it in` : undefined}
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
        {quickList.length > 0 && (
          <div className={styles.gridHeader}>
            <p className={styles.gridHint}>Drag to reorder · Click a poster for details</p>
          </div>
        )}

        {/* Poster grid — always shown */}
        {quickList.length === 0 ? (
          <div className={styles.emptyGrid}>
            <p>Search for a film above to start building your Quick List</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={quickList.map((m) => String(m.tmdb_id))} strategy={rectSortingStrategy}>
              <div className={styles.posterGrid}>
                {quickList.map((movie, index) => (
                  <SortablePoster
                    key={movie.tmdb_id}
                    movie={movie}
                    index={index}
                    onRemove={() => removeFromList('quickList', movie.tmdb_id)}
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
