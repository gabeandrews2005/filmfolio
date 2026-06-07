import { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useFilm } from '../../context/FilmContext'
import { searchTV, getPosterUrl, PLACEHOLDER_POSTER } from '../../api/tmdb'
import styles from '../lists/GenreList.module.css'

const MAX_SHOWS = 25

export default function ShowsList() {
  const { showsList, addToList, removeFromList, reorderList } = useFilm()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)

  const listIds = useMemo(() => new Set(showsList.map((s) => s.tmdb_id)), [showsList])

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
    addToList('showsList', {
      tmdb_id: r.id,
      title: r.name,
      year: r.first_air_date?.slice(0, 4) ?? '',
      posterUrl: getPosterUrl(r.poster_path),
      overview: r.overview ?? '',
    })
  }

  function handleDragEnd(result) {
    if (!result.destination) return
    const items = [...showsList]
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    reorderList('showsList', items)
  }

  const isFull = showsList.length >= MAX_SHOWS

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My Shows</h1>
            <p className={styles.subtitle}>{showsList.length} / {MAX_SHOWS} ranked</p>
          </div>
        </div>

        <div className={styles.builder}>
          <div className={styles.left}>
            <div className={styles.searchBox}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search TV shows…"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searching && <span className={styles.spinner}>⟳</span>}
            </div>

            {searchResults.length > 0 && (
              <div className={styles.results}>
                {searchResults.map((r) => {
                  const inList = listIds.has(r.id)
                  return (
                    <div key={r.id} className={styles.resultRow}>
                      <img src={getPosterUrl(r.poster_path)} alt={r.name} className={styles.thumb} />
                      <div className={styles.resultInfo}>
                        <span className={styles.resultTitle}>{r.name}</span>
                        <span className={styles.resultYear}>{r.first_air_date?.slice(0, 4)}</span>
                      </div>
                      <button
                        className={`${styles.addBtn} ${inList ? styles.added : ''} ${!inList && isFull ? styles.full : ''}`}
                        onClick={() => !inList && !isFull && addShow(r)}
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
              <p className={styles.searchHint}>Search for TV shows to build your ranked list.</p>
            )}
          </div>

          <div className={styles.right}>
            <div className={styles.listHeaderRow}>
              <h2 className={styles.listTitle}>My Shows</h2>
              <span className={styles.listCount}>{showsList.length} / {MAX_SHOWS}</span>
            </div>

            {showsList.length === 0 ? (
              <div className={styles.emptyList}>
                <p>Search for shows to start your list.</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="shows-list">
                  {(provided) => (
                    <ul className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                      {showsList.map((show, i) => (
                        <Draggable
                          key={String(show.tmdb_id)}
                          draggableId={String(show.tmdb_id)}
                          index={i}
                        >
                          {(provided, snapshot) => (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`${styles.listItem} ${snapshot.isDragging ? styles.dragging : ''}`}
                            >
                              <span className={styles.dragHandle} {...provided.dragHandleProps}>⠿</span>
                              <span className={styles.rank}>{i + 1}</span>
                              <img src={show.posterUrl || PLACEHOLDER_POSTER} alt={show.title} className={styles.thumb} />
                              <div className={styles.resultInfo}>
                                <span className={styles.resultTitle}>{show.title}</span>
                                <span className={styles.resultYear}>{show.year}</span>
                              </div>
                              <button
                                className={styles.removeBtn}
                                onClick={() => removeFromList('showsList', show.tmdb_id)}
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
          </div>
        </div>
      </div>
    </div>
  )
}
