import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useFilm } from '../context/FilmContext'
import { searchMovies, getPosterUrl, PLACEHOLDER_POSTER } from '../api/tmdb'
import FilmCard from '../components/FilmCard'
import styles from './MyList.module.css'

// ── Poster grid view (shown when list has films) ──────────────────────────
function ListGridView({ list, onExpand }) {
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
        {list.length < 100 && (
          <button className={styles.editBtn} onClick={onExpand}>Expand List</button>
        )}
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
  const { addToTop10, addToList, removeFromList, reorderList } = useFilm()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)

  const listIds = new Set(list.map((m) => m.tmdb_id))

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
    if (listIds.has(r.id)) return
    const movie = {
      tmdb_id: r.id,
      title: r.title,
      year: r.release_date?.slice(0, 4) ?? '',
      posterUrl: getPosterUrl(r.poster_path),
      overview: r.overview,
      vote_average: r.vote_average,
      director: '',
    }
    setQuery('')
    setSearchResults([])
    if (list.length < 10) addToTop10(movie)
    else addToList('myList', movie)
  }

  const isFull = list.length >= maxSlots

  return (
    <div className={styles.builder}>
      {/* Left: search */}
      <div className={styles.left}>
        <div className={styles.searchBox}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search any film…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
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

        {!query && (
          <p className={styles.searchHint}>
            Search for any film to add it to your list.
          </p>
        )}
      </div>

      {/* Right: ranked list */}
      <div className={styles.right}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>My Film List</h2>
          <span className={styles.listCount}>{list.length} / {maxSlots}</span>
        </div>

        {list.length === 0 ? (
          <div className={styles.emptyList}>
            <p>Search for films on the left to build your list</p>
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
  const [viewMode, setViewMode] = useState(() => myList.length >= 10 ? 'grid' : 'builder')
  const [maxSlots, setMaxSlots] = useState(() => myList.length > 10 ? 100 : 10)

  // Auto-navigate to grid once top 10 is complete
  useEffect(() => {
    if (myList.length >= 10 && viewMode === 'builder' && maxSlots === 10) {
      setViewMode('grid')
    }
  }, [myList.length, viewMode, maxSlots])

  function handleExpand() {
    setMaxSlots(100)
    setViewMode('builder')
  }

  const title = myList.length > 10 ? 'My Film List' : myList.length > 0 ? 'Build Your Film List' : 'Build Your Film List'
  const subtitle = maxSlots > 10
    ? 'Rank your all-time favorites, one film at a time.'
    : 'Pick any films, rank them your way, and get personalized recommendations.'

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <ListGridView list={myList} onExpand={handleExpand} />
        ) : (
          <ListBuilder
            list={myList}
            maxSlots={maxSlots}
            onDone={myList.length >= 10 ? () => setViewMode('grid') : null}
          />
        )}
      </div>
    </div>
  )
}
