import { useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useFilm } from '../context/FilmContext'
import { searchMovies, getPosterUrl, PLACEHOLDER_POSTER } from '../api/tmdb'
import styles from './TopTenBuilder.module.css'

export default function TopTenBuilder() {
  const { movies, myTop10, addToTop10, removeFromTop10, reorderTop10 } = useFilm()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)

  const top100Ids = new Set(movies.map((m) => m.tmdb_id))

  const handleSearch = useCallback((value) => {
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
  }, [debounceTimer])

  function handleDragEnd(result) {
    if (!result.destination) return
    const items = [...myTop10]
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    reorderTop10(items)
  }

  function addSearchResult(result) {
    const movie = {
      tmdb_id: result.id,
      title: result.title,
      year: result.release_date?.slice(0, 4) ?? '',
      posterUrl: getPosterUrl(result.poster_path),
      overview: result.overview,
      vote_average: result.vote_average,
      director: '',
    }
    addToTop10(movie)
  }

  // Source pool: movies from top 100 that aren't already in top 10
  const poolMovies = movies.filter((m) => !myTop10.some((t) => t.tmdb_id === m.tmdb_id))

  return (
    <div className={styles.builder}>
      {/* Left panel */}
      <div className={styles.left}>
        <div className={styles.searchBox}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search any film..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searching && <span className={styles.spinner}>⟳</span>}
        </div>

        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            <p className={styles.sectionLabel}>Search results</p>
            {searchResults.map((r) => {
              const inList = myTop10.some((m) => m.tmdb_id === r.id)
              const full = myTop10.length >= 10
              return (
                <div key={r.id} className={styles.resultRow}>
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
                    className={`${styles.addBtn} ${inList ? styles.added : ''} ${!inList && full ? styles.full : ''}`}
                    onClick={() => !inList && !full && addSearchResult(r)}
                    disabled={inList || full}
                  >
                    {inList ? '✓' : full ? '—' : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className={styles.pool}>
          <p className={styles.sectionLabel}>From Top 100 — click to add</p>
          <div className={styles.poolScroll}>
            {poolMovies.map((movie) => {
              const full = myTop10.length >= 10
              return (
                <div
                  key={movie.rank}
                  className={`${styles.poolRow} ${full ? styles.poolFull : ''}`}
                  onClick={() => !full && addToTop10(movie)}
                >
                  <span className={styles.poolRank}>#{movie.rank}</span>
                  <img
                    src={movie.posterUrl || PLACEHOLDER_POSTER}
                    alt={movie.title}
                    className={styles.thumb}
                  />
                  <div className={styles.resultInfo}>
                    <span className={styles.resultTitle}>{movie.title}</span>
                    <span className={styles.resultYear}>{movie.year}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right panel — top 10 */}
      <div className={styles.right}>
        <div className={styles.top10Header}>
          <h2 className={styles.top10Title}>My Top 10</h2>
          <span className={styles.top10Count}>{myTop10.length} / 10</span>
        </div>

        {myTop10.length === 0 ? (
          <div className={styles.emptyList}>
            <p>Add films from the left to build your list</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="top10">
              {(provided) => (
                <ul className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                  {myTop10.map((movie, index) => (
                    <Draggable
                      key={String(movie.tmdb_id)}
                      draggableId={String(movie.tmdb_id)}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${styles.listItem} ${snapshot.isDragging ? styles.dragging : ''}`}
                        >
                          <span className={styles.dragHandle} {...provided.dragHandleProps}>
                            ⠿
                          </span>
                          <span className={styles.listRank}>{index + 1}</span>
                          <img
                            src={movie.posterUrl || PLACEHOLDER_POSTER}
                            alt={movie.title}
                            className={styles.thumb}
                          />
                          <div className={styles.listInfo}>
                            <span className={styles.listTitle}>{movie.title}</span>
                            <span className={styles.listYear}>{movie.year}</span>
                          </div>
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeFromTop10(movie.tmdb_id)}
                          >
                            ×
                          </button>
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

        {myTop10.length > 0 && (
          <p className={styles.hint}>Drag to reorder · Click × to remove</p>
        )}
      </div>
    </div>
  )
}
