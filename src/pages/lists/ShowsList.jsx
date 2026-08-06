import { useState, useMemo, useEffect } from 'react'
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useFilm } from '../../context/FilmContext'
import { searchTV, getPosterUrl, PLACEHOLDER_POSTER } from '../../api/tmdb'
import RECOMMENDED_SHOWS from '../../data/recommendedShows.json'
import styles from './ShowsList.module.css'

const MAX_SHOWS = 50

// Firing every lookup at once triggers rate-limiting (and browsers cap
// concurrent connections per host anyway), so requests are throttled and
// empty responses retried with backoff.
async function resolveShowWithRetry(name, attempt = 0) {
  const results = await searchTV(name)
  if (results.length > 0 || attempt >= 2) return results
  await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  return resolveShowWithRetry(name, attempt + 1)
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let index = 0
  async function run() {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

function normalizeShow(r) {
  return {
    tmdb_id: r.id,
    title: r.name,
    year: r.first_air_date?.slice(0, 4) ?? '',
    posterUrl: getPosterUrl(r.poster_path),
    overview: r.overview ?? '',
  }
}

function SortableShowCard({ show, index, onSelect, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(show.tmdb_id),
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
      className={`${styles.gridItem} ${styles.sortableItem} ${isDragging ? styles.dragging : ''}`}
    >
      <div className={styles.card} onClick={() => onSelect(show)}>
        <div className={styles.posterWrap}>
          <img
            src={show.posterUrl || PLACEHOLDER_POSTER}
            alt={show.title}
            className={styles.poster}
            loading="lazy"
            onError={(e) => { e.target.src = PLACEHOLDER_POSTER }}
          />
          <div className={styles.overlay}>
            <div className={styles.overlayContent}>
              <span className={styles.overlayTap}>Tap for details</span>
            </div>
          </div>
          <span className={styles.rankBadge}>#{index + 1}</span>
          <button
            className={styles.removeBtn}
            onClick={(e) => {
              e.stopPropagation()
              onRemove(show.tmdb_id)
            }}
            aria-label={`Remove ${show.title}`}
          >×</button>
        </div>
        <div className={styles.cardInfo}>
          <span className={styles.cardName}>{show.title}</span>
        </div>
      </div>
    </div>
  )
}

function ShowModal({ show, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdrop}>
      <div className={styles.modal}>
        <button className={styles.modalClose} onClick={onClose} aria-label="Close">×</button>
        <div className={styles.modalContent}>
          <div className={styles.modalImageCol}>
            <img
              src={show.posterUrl || PLACEHOLDER_POSTER}
              alt={show.title}
              className={styles.modalImage}
            />
          </div>
          <div className={styles.modalInfoCol}>
            <h2 className={styles.modalName}>{show.title}</h2>
            {show.year && <p className={styles.modalYear}>{show.year}</p>}
            {show.overview && <p className={styles.modalBio}>{show.overview}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ShowsList() {
  const { showsList, addToList, removeFromList, reorderList } = useFilm()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)
  const [selectedShow, setSelectedShow] = useState(null)

  const [poolShows, setPoolShows] = useState([])
  const [poolLoading, setPoolLoading] = useState(true)

  const listIds = useMemo(() => new Set(showsList.map((s) => s.tmdb_id)), [showsList])

  // Resolve the curated recommended-shows list to TMDB shows, in order
  useEffect(() => {
    setPoolLoading(true)
    let cancelled = false
    mapWithConcurrency(RECOMMENDED_SHOWS, 6, (name) => resolveShowWithRetry(name))
      .then((responses) => {
        if (cancelled) return
        const seen = new Set()
        const shows = []
        for (const results of responses) {
          const match = results?.[0]
          if (!match || seen.has(match.id)) continue
          seen.add(match.id)
          shows.push(normalizeShow(match))
        }
        setPoolShows(shows)
        setPoolLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const poolToShow = useMemo(
    () => poolShows.filter((s) => !listIds.has(s.tmdb_id)),
    [poolShows, listIds]
  )

  function addFromPool(s) {
    if (listIds.has(s.tmdb_id) || showsList.length >= MAX_SHOWS) return
    addToList('showsList', s)
  }

  function handleSearch(value) {
    setQuery(value)
    clearTimeout(debounceTimer)
    if (!value.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const results = await searchTV(value)
      setSearchResults(results.slice(0, 8))
      setSearching(false)
    }, 350)
    setDebounceTimer(timer)
  }

  function addShow(r) {
    if (listIds.has(r.id)) return
    if (showsList.length >= MAX_SHOWS) return
    addToList('showsList', normalizeShow(r))
    setQuery('')
    setSearchResults([])
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = showsList.findIndex((s) => String(s.tmdb_id) === active.id)
    const newIndex = showsList.findIndex((s) => String(s.tmdb_id) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorderList('showsList', arrayMove(showsList, oldIndex, newIndex))
  }

  const isFull = showsList.length >= MAX_SHOWS

  return (
    <div className={`${styles.page} ${styles.themeShows}`}>
      {selectedShow && (
        <ShowModal show={selectedShow} onClose={() => setSelectedShow(null)} />
      )}

      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Shows</h1>
          </div>
          {showsList.length > 0 && (
            <span className={styles.countBadge}>{showsList.length} / {MAX_SHOWS}</span>
          )}
        </div>

        {/* Search bar */}
        <div className={styles.searchBox}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search for a show…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searching && <span className={styles.spinner}>⟳</span>}
        </div>

        {searchResults.length > 0 && (
          <div className={styles.results}>
            {searchResults.map((r) => {
              const inList = listIds.has(r.id)
              const imgUrl = r.poster_path ? getPosterUrl(r.poster_path) : null
              return (
                <div key={r.id} className={styles.resultRow}>
                  {imgUrl
                    ? <img src={imgUrl} alt={r.name} className={styles.resultThumb} />
                    : <div className={styles.resultThumbPlaceholder} />
                  }
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{r.name}</span>
                    {r.first_air_date && (
                      <span className={styles.resultYear}>{r.first_air_date.slice(0, 4)}</span>
                    )}
                  </div>
                  {!inList ? (
                    <button
                      className={styles.addBtn}
                      onClick={() => !isFull && addShow(r)}
                      disabled={isFull}
                    >+</button>
                  ) : (
                    <span className={styles.addedMark}>✓</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Grid hint */}
        {showsList.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Your Shows</h2>
            <p className={styles.gridHint}>Drag to reorder · Click for details</p>
          </>
        )}

        {/* Poster grid */}
        {showsList.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={showsList.map((s) => String(s.tmdb_id))} strategy={rectSortingStrategy}>
              <div className={styles.grid}>
                {showsList.map((show, i) => (
                  <SortableShowCard
                    key={show.tmdb_id}
                    show={show}
                    index={i}
                    onSelect={setSelectedShow}
                    onRemove={(id) => removeFromList('showsList', id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Recommended pool */}
        <div className={styles.poolSection}>
          <div className={styles.poolHeader}>
            <h2 className={styles.sectionTitle}>Recommended Shows</h2>
            {!poolLoading && <span className={styles.poolCount}>{poolToShow.length} to choose from</span>}
          </div>

          <div className={styles.grid}>
            {poolLoading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div key={`pool-sk-${i}`} className={styles.poolSkeleton}>
                    <div className={styles.poolSkeletonImg} />
                  </div>
                ))
              : poolToShow.map((s) => (
                  <div key={s.tmdb_id} className={styles.gridItem}>
                    <div className={styles.card} onClick={() => setSelectedShow(s)}>
                      <div className={styles.posterWrap}>
                        <img
                          src={s.posterUrl || PLACEHOLDER_POSTER}
                          alt={s.title}
                          className={styles.poster}
                          loading="lazy"
                          onError={(e) => { e.target.src = PLACEHOLDER_POSTER }}
                        />
                        <div className={styles.overlay}>
                          <div className={styles.overlayContent}>
                            <span className={styles.overlayTap}>Tap for details</span>
                          </div>
                        </div>
                        <button
                          className={styles.poolAddBtn}
                          onClick={(e) => { e.stopPropagation(); addFromPool(s) }}
                          disabled={isFull}
                          title={isFull ? `Your list is full (${MAX_SHOWS}/${MAX_SHOWS}) — remove a show to add more` : undefined}
                          aria-label={`Add ${s.title}`}
                        >+</button>
                      </div>
                      <div className={styles.cardInfo}>
                        <span className={styles.cardName}>{s.title}</span>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  )
}
