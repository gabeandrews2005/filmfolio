import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useFilm } from '../context/FilmContext'
import { searchMovies, getPosterUrl, PLACEHOLDER_POSTER } from '../api/tmdb'
import FilmCard from '../components/FilmCard'
import styles from './MyList.module.css'

// ── Poster grid view (shown when list is complete) ────────────────────────
function ListGridView({ list, onEdit }) {
  const { removeFromList, reorderList } = useFilm()

  function handleDragEnd(result) {
    if (!result.destination) return
    const items = [...list]
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    reorderList('myList', items)
  }

  return (
    <div>
      <div className={styles.gridHeader}>
        <p className={styles.gridHint}>Drag to reorder · Click a poster for details</p>
        <button className={styles.editBtn} onClick={onEdit}>Edit List</button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="grid" direction="horizontal">
          {(provided) => (
            <div
              className={styles.posterGrid}
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {list.map((movie, index) => (
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
    </div>
  )
}

// ── List builder (search + drag to rank) ─────────────────────────────────
function ListBuilder({ list, maxSlots, onDone }) {
  const { movies, addToTop10, addToList, removeFromList, reorderList } = useFilm()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)

  const listIds = new Set(list.map((m) => m.tmdb_id))
  const gabePoolMovies = movies.filter((m) => !listIds.has(m.tmdb_id))

  function handleSearch(value) {
    setQuery(value)
    clearTimeout(debounceTimer)
    if (!value.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const results = await searchMovies(value)
      setSearchResults(results.slice(0, 8))
      setSearching(false)
    }, 350)
    setDebounceTimer(timer)
  }

  function handleDragEnd(result) {
    if (!result.destination) return
    const items = [...list]
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    reorderList('myList', items)
  }

  function addSearchResult(r) {
    const movie = {
      tmdb_id: r.id,
      title: r.title,
      year: r.release_date?.slice(0, 4) ?? '',
      posterUrl: getPosterUrl(r.poster_path),
      overview: r.overview,
      vote_average: r.vote_average,
      director: '',
    }
    // Use addToTop10 for slots 1-10, addToList for 11-100
    if (list.length < 10) addToTop10(movie)
    else addToList('myList', movie)
  }

  function addFromPool(movie) {
    if (list.length < 10) addToTop10(movie)
    else addToList('myList', movie)
  }

  const isFull = list.length >= maxSlots

  return (
    <div className={styles.builder}>
      {/* Left: search + pool */}
      <div className={styles.left}>
        <div className={styles.searchBox}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search any film…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searching && <span className={styles.spinner}>⟳</span>}
        </div>

        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            <p className={styles.sectionLabel}>Search results</p>
            {searchResults.map((r) => {
              const inList = listIds.has(r.id)
              return (
                <div key={r.id} className={styles.resultRow}>
                  <img src={getPosterUrl(r.poster_path)} alt={r.title} className={styles.thumb} />
                  <div className={styles.resultInfo}>
                    <span className={styles.resultTitle}>{r.title}</span>
                    <span className={styles.resultYear}>{r.release_date?.slice(0, 4)}</span>
                  </div>
                  <button
                    className={`${styles.addBtn} ${inList ? styles.added : ''} ${!inList && isFull ? styles.full : ''}`}
                    onClick={() => !inList && !isFull && addSearchResult(r)}
                    disabled={inList || isFull}
                  >
                    {inList ? '✓' : isFull ? '—' : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className={styles.pool}>
          <p className={styles.sectionLabel}>From Gabe's Top 100 — click to add</p>
          <div className={styles.poolScroll}>
            {gabePoolMovies.map((movie) => (
              <div
                key={movie.rank}
                className={`${styles.poolRow} ${isFull ? styles.poolFull : ''}`}
                onClick={() => !isFull && addFromPool(movie)}
              >
                <span className={styles.poolRank}>#{movie.rank}</span>
                <img src={movie.posterUrl || PLACEHOLDER_POSTER} alt={movie.title} className={styles.thumb} />
                <div className={styles.resultInfo}>
                  <span className={styles.resultTitle}>{movie.title}</span>
                  <span className={styles.resultYear}>{movie.year}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: ranked list */}
      <div className={styles.right}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>
            My List
          </h2>
          <span className={styles.listCount}>{list.length} / {maxSlots}</span>
        </div>

        {list.length === 0 ? (
          <div className={styles.emptyList}>
            <p>Add films from the left to build your list</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="mylist">
              {(provided) => (
                <ul className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                  {list.map((movie, index) => (
                    <Draggable
                      key={String(movie.tmdb_id)}
                      draggableId={String(movie.tmdb_id)}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${styles.listItem} ${snapshot.isDragging ? styles.dragging : ''} ${index >= 10 ? styles.extended : ''}`}
                        >
                          <span className={styles.dragHandle} {...provided.dragHandleProps}>⠿</span>
                          <span className={`${styles.listRank} ${index < 10 ? styles.top10Rank : ''}`}>
                            {index + 1}
                          </span>
                          <img src={movie.posterUrl || PLACEHOLDER_POSTER} alt={movie.title} className={styles.thumb} />
                          <div className={styles.listInfo}>
                            <span className={styles.listTitle2}>{movie.title}</span>
                            <span className={styles.listYear}>{movie.year}</span>
                          </div>
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeFromList('myList', movie.tmdb_id)}
                          >×</button>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {list.length > 0 && (
          <p className={styles.hint}>Drag to reorder · Click × to remove</p>
        )}

        {onDone && list.length >= 10 && (
          <button className={styles.doneBtn} onClick={onDone}>
            View My List →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function MyList() {
  const { myList } = useFilm()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState(() => myList.length >= 10 ? 'grid' : 'builder')
  const [maxSlots, setMaxSlots] = useState(10)
  const [showExpanded, setShowExpanded] = useState(myList.length > 10)

  const top10 = myList.slice(0, 10)
  const hasTop10 = top10.length >= 10

  function handleExpandTo100() {
    setMaxSlots(100)
    setShowExpanded(true)
    setViewMode('builder')
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              {showExpanded ? 'My Top 100' : 'Build Your Top 10'}
            </h1>
            <p className={styles.subtitle}>
              {showExpanded
                ? 'Rank your all-time favorites, one film at a time.'
                : 'Pick any 10 films, rank them your way, and get personalized recommendations.'}
            </p>
          </div>
          {top10.length >= 3 && (
            <button
              className={styles.recommendBtn}
              onClick={() => navigate('/recommendations')}
            >
              Picks For You →
            </button>
          )}
        </div>

        {viewMode === 'grid' && hasTop10 ? (
          <>
            <ListGridView list={myList} onEdit={() => setViewMode('builder')} />

            {/* Expand to Top 100 */}
            {!showExpanded && (
              <div className={styles.expandSection}>
                <div className={styles.expandContent}>
                  <h3 className={styles.expandTitle}>Go further</h3>
                  <p className={styles.expandDesc}>
                    Expand your list to 100 films. More picks means better recommendations and a richer profile.
                  </p>
                  <button className={styles.expandBtn} onClick={handleExpandTo100}>
                    Expand to Top 100
                  </button>
                </div>
              </div>
            )}

            {/* Recommendations footer */}
            {top10.length >= 3 && (
              <div className={styles.footer}>
                <button className={styles.recommendBtnLg} onClick={() => navigate('/recommendations')}>
                  Get My Recommendations →
                </button>
                <p className={styles.footerHint}>
                  Based on your {myList.length} selected film{myList.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </>
        ) : (
          <ListBuilder
            list={myList}
            maxSlots={maxSlots}
            onDone={hasTop10 ? () => setViewMode('grid') : null}
          />
        )}
      </div>
    </div>
  )
}
