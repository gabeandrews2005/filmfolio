import { useState, useMemo, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useFilm } from '../../context/FilmContext'
import { searchMoviesByGenre, searchMovies, getPosterUrl, PLACEHOLDER_POSTER } from '../../api/tmdb'
import FilmCard from '../../components/FilmCard'
import styles from './GenreList.module.css'

const GENRE_MAP = {
  horror:   ['Horror', 'Thriller'],
  comedies: ['Comedy'],
  animated: ['Animation'],
  seasonal: null,
}

const GENRE_TMDB_IDS = {
  horror:   27,
  comedies: 35,
  animated: 16,
  seasonal: null,
}

const THEMES = {
  horror: {
    className: 'themeHorror',
    entrance: true,
    entranceDuration: 1800,
  },
  seasonal: {
    className: 'themeSeasonal',
    entrance: true,
    entranceDuration: 2000,
  },
  animated: {
    className: 'themeAnimated',
    entrance: false,
  },
  comedies: {
    className: 'themeComedies',
    entrance: false,
  },
}

export default function GenreList({ listType, title, maxItems = 50 }) {
  const { myList, addToList, removeFromList, reorderList } = useFilm()
  const listKey = `${listType}List`
  const userList = useFilm()[listKey] ?? []

  const [viewMode, setViewMode] = useState('grid')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)
  const [showEntrance, setShowEntrance] = useState(false)
  const [entranceDone, setEntranceDone] = useState(false)

  // Per-session exclusions: tmdb_ids the user has removed from the derived section
  const [derivedExclusions, setDerivedExclusions] = useState(() => new Set())

  const theme = THEMES[listType] ?? {}
  const genreId = GENRE_TMDB_IDS[listType]

  useEffect(() => {
    if (theme.entrance && !entranceDone) {
      setShowEntrance(true)
      const t = setTimeout(() => {
        setShowEntrance(false)
        setEntranceDone(true)
      }, theme.entranceDuration)
      return () => clearTimeout(t)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Films from myList that match this genre, ordered by myList rank, excluding user-removed ones
  const myListSourced = useMemo(() => {
    const genres = GENRE_MAP[listType]
    if (!genres) return []
    return myList
      .map((m, idx) => ({ ...m, myListRank: idx + 1 }))
      .filter((m) =>
        m.genres?.some((g) => genres.includes(g)) &&
        !derivedExclusions.has(m.tmdb_id)
      )
  }, [myList, listType, derivedExclusions])

  const myListSourcedIds = useMemo(
    () => new Set(myListSourced.map((m) => m.tmdb_id)),
    [myListSourced]
  )

  // Manually added films: stored userList items not also in the derived section
  const manualItems = useMemo(
    () => userList.filter((m) => !myListSourcedIds.has(m.tmdb_id)),
    [userList, myListSourcedIds]
  )

  const listIds = useMemo(() => new Set(userList.map((m) => m.tmdb_id)), [userList])

  function excludeFromDerived(tmdbId) {
    setDerivedExclusions((prev) => new Set([...prev, tmdbId]))
  }

  function handleSearch(value) {
    setQuery(value)
    clearTimeout(debounceTimer)
    if (!value.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const results = genreId
        ? await searchMoviesByGenre(value, genreId)
        : await searchMovies(value)
      setSearchResults(results.slice(0, 8))
      setSearching(false)
    }, 350)
    setDebounceTimer(timer)
  }

  function addMovie(movie) {
    if (listIds.has(movie.tmdb_id) || myListSourcedIds.has(movie.tmdb_id)) return
    if (userList.length >= maxItems) return
    addToList(listKey, movie)
  }

  function addSearchResult(r) {
    addMovie({
      tmdb_id: r.id,
      title: r.title,
      year: r.release_date?.slice(0, 4) ?? '',
      posterUrl: getPosterUrl(r.poster_path),
      overview: r.overview,
      vote_average: r.vote_average,
      director: '',
    })
    setQuery('')
    setSearchResults([])
  }

  function handleManualDragEnd(result) {
    if (!result.destination) return
    const items = [...manualItems]
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    // Rebuild full userList: reordered manual items + any hidden overlap items at end
    const hiddenItems = userList.filter((m) => myListSourcedIds.has(m.tmdb_id))
    reorderList(listKey, [...items, ...hiddenItems])
  }

  const isFull = userList.length >= maxItems
  const themeClass = theme.className ? styles[theme.className] ?? '' : ''
  const hasAnyContent = myListSourced.length > 0 || manualItems.length > 0

  return (
    <div className={`${styles.page} ${themeClass}`}>
      {/* Horror entrance */}
      {listType === 'horror' && showEntrance && (
        <div className={styles.horrorEntrance}>
          <div className={styles.drip} />
          <div className={styles.drip} />
          <div className={styles.drip} />
          <div className={styles.drip} />
          <div className={styles.drip} />
          <span className={styles.horrorIcon}>🩸</span>
        </div>
      )}
      {/* Seasonal snow entrance */}
      {listType === 'seasonal' && showEntrance && (
        <div className={styles.snowEntrance}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className={styles.snowflake} style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${1 + Math.random() * 2}s`,
              animationDelay: `${Math.random() * 1}s`,
              fontSize: `${8 + Math.random() * 16}px`,
            }}>❄</div>
          ))}
        </div>
      )}

      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
          </div>
          <div className={styles.headerActions}>
            {hasAnyContent && (
              <button
                className={styles.toggleViewBtn}
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? 'List View' : 'Grid View'}
              </button>
            )}
          </div>
        </div>

        {/* Search bar for manual additions */}
        <div className={styles.searchBox}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={`Search ${title} films…`}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searching && <span className={styles.spinner}>⟳</span>}
        </div>

        {searchResults.length > 0 && (
          <div className={styles.results}>
            {searchResults.map((r) => {
              const alreadyShown = listIds.has(r.id) || myListSourcedIds.has(r.id)
              return (
                <div key={r.id} className={styles.resultRow}>
                  <img src={getPosterUrl(r.poster_path)} alt={r.title} className={styles.thumb} />
                  <div className={styles.resultInfo}>
                    <span className={styles.resultTitle}>{r.title}</span>
                    <span className={styles.resultYear}>{r.release_date?.slice(0, 4)}</span>
                  </div>
                  <button
                    className={`${styles.addBtn} ${alreadyShown ? styles.added : ''} ${!alreadyShown && isFull ? styles.full : ''}`}
                    onClick={() => !alreadyShown && !isFull && addSearchResult(r)}
                    disabled={alreadyShown || isFull}
                  >
                    {alreadyShown ? '✓' : isFull ? '—' : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ── From My List (derived) section ────────────────────────────── */}
        {myListSourced.length > 0 && (
          <>
            <div className={styles.sectionDivider}>
              <span className={styles.sectionLabel}>From My List</span>
              <span className={styles.sectionHint}>Ordered by your ranking</span>
            </div>

            {viewMode === 'grid' ? (
              <div className={`${styles.posterGrid} ${styles.derivedGrid}`}>
                {myListSourced.map((movie) => (
                  <div key={movie.tmdb_id} className={styles.gridItem}>
                    <FilmCard movie={movie} rankBadge={movie.myListRank} showAddToList={false} />
                    <button
                      className={styles.removeOverlay}
                      onClick={() => excludeFromDerived(movie.tmdb_id)}
                      title="Remove from this view"
                    >×</button>
                  </div>
                ))}
              </div>
            ) : (
              <ul className={styles.list}>
                {myListSourced.map((movie) => (
                  <li key={movie.tmdb_id} className={`${styles.listItem} ${styles.derivedItem}`}>
                    <span className={styles.rank}>#{movie.myListRank}</span>
                    <img src={movie.posterUrl || PLACEHOLDER_POSTER} alt={movie.title} className={styles.thumb} />
                    <div className={styles.resultInfo}>
                      <span className={styles.resultTitle}>{movie.title}</span>
                      <span className={styles.resultYear}>{movie.year}</span>
                    </div>
                    <button
                      className={styles.removeBtn}
                      onClick={() => excludeFromDerived(movie.tmdb_id)}
                      title="Remove from this view"
                    >×</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* ── Added Here (manual) section ───────────────────────────────── */}
        {manualItems.length > 0 && (
          <>
            {myListSourced.length > 0 && (
              <div className={styles.sectionDivider}>
                <span className={styles.sectionLabel}>Added Here</span>
                <span className={styles.sectionCount}>{manualItems.length} / {maxItems}</span>
              </div>
            )}

            {!myListSourced.length && (
              <div className={styles.picksHeader}>
                <span className={styles.picksLabel}>Your Picks</span>
                <span className={styles.picksCount}>{manualItems.length} / {maxItems}</span>
              </div>
            )}

            {viewMode === 'grid' ? (
              <DragDropContext onDragEnd={handleManualDragEnd}>
                <Droppable droppableId="genre-grid" direction="horizontal">
                  {(provided) => (
                    <div
                      className={styles.posterGrid}
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      {manualItems.map((movie, i) => (
                        <Draggable
                          key={String(movie.tmdb_id)}
                          draggableId={String(movie.tmdb_id)}
                          index={i}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`${styles.gridItem} ${snapshot.isDragging ? styles.gridDragging : ''}`}
                            >
                              <FilmCard movie={movie} showAddToList={false} />
                              <button
                                className={styles.removeOverlay}
                                onClick={() => removeFromList(listKey, movie.tmdb_id)}
                              >×</button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <DragDropContext onDragEnd={handleManualDragEnd}>
                <Droppable droppableId="genre-list">
                  {(provided) => (
                    <ul className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                      {manualItems.map((movie, i) => (
                        <Draggable
                          key={String(movie.tmdb_id)}
                          draggableId={String(movie.tmdb_id)}
                          index={i}
                        >
                          {(provided, snapshot) => (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`${styles.listItem} ${snapshot.isDragging ? styles.dragging : ''}`}
                            >
                              <span className={styles.dragHandle} {...provided.dragHandleProps}>⠿</span>
                              <img src={movie.posterUrl || PLACEHOLDER_POSTER} alt={movie.title} className={styles.thumb} />
                              <div className={styles.resultInfo}>
                                <span className={styles.resultTitle}>{movie.title}</span>
                                <span className={styles.resultYear}>{movie.year}</span>
                              </div>
                              <button
                                className={styles.removeBtn}
                                onClick={() => removeFromList(listKey, movie.tmdb_id)}
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
          </>
        )}

        {/* Empty state */}
        {!hasAnyContent && !query && (
          <div className={styles.emptyList}>
            <p>Search for films above to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
