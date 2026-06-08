import { useState, useMemo, useEffect, useRef } from 'react'
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

// TMDB genre IDs for filtered search
const GENRE_TMDB_IDS = {
  horror:   27,
  comedies: 35,
  animated: 16,
  seasonal: null, // keyword search instead
}

// Themed entrance animations + styles per list type
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

  const [viewMode, setViewMode] = useState('builder')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)
  const [showEntrance, setShowEntrance] = useState(false)
  const [entranceDone, setEntranceDone] = useState(false)

  const theme = THEMES[listType] ?? {}
  const genreId = GENRE_TMDB_IDS[listType]

  // Themed entrance
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

  const listIds = useMemo(() => new Set(userList.map((m) => m.tmdb_id)), [userList])

  const autoPopulated = useMemo(() => {
    const genres = GENRE_MAP[listType]
    if (!genres) return []
    return myList.filter(
      (m) => m.genres?.some((g) => genres.includes(g)) && !listIds.has(m.tmdb_id)
    )
  }, [myList, listType, listIds])

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
    if (listIds.has(movie.tmdb_id)) return
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
    // Clear search after adding
    setQuery('')
    setSearchResults([])
  }

  function handleDragEnd(result) {
    if (!result.destination) return
    const items = [...userList]
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    reorderList(listKey, items)
  }

  const isFull = userList.length >= maxItems

  const themeClass = theme.className ? styles[theme.className] ?? '' : ''

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
            {userList.length > 0 && (
              <button
                className={styles.toggleViewBtn}
                onClick={() => setViewMode(viewMode === 'grid' ? 'builder' : 'grid')}
              >
                {viewMode === 'grid' ? 'Edit List' : 'View Grid'}
              </button>
            )}
          </div>
        </div>

        {/* Search bar always visible */}
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

        {/* Auto-populate suggestion */}
        {autoPopulated.length > 0 && viewMode === 'builder' && !query && (
          <div className={styles.autoSection}>
            <div className={styles.autoHeader}>
              <span className={styles.autoLabel}>★ From your Top Films</span>
              <span className={styles.autoHint}>These match this genre</span>
            </div>
            <div className={styles.autoGrid}>
              {autoPopulated.map((m) => (
                <div
                  key={m.tmdb_id}
                  className={`${styles.autoCard} ${isFull ? styles.autoFull : ''}`}
                  onClick={() => !isFull && addMovie(m)}
                >
                  <div className={styles.autoPosterWrap}>
                    <img src={m.posterUrl || PLACEHOLDER_POSTER} alt={m.title} className={styles.autoPoster} />
                    {!isFull && <span className={styles.autoAdd}>+</span>}
                  </div>
                  <span className={styles.autoTitle}>{m.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your Picks label */}
        {userList.length > 0 && (
          <div className={styles.picksHeader}>
            <span className={styles.picksLabel}>Your Picks</span>
            <span className={styles.picksCount}>{userList.length} / {maxItems}</span>
          </div>
        )}

        {viewMode === 'grid' && userList.length > 0 ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="genre-grid" direction="horizontal">
              {(provided) => (
                <div
                  className={styles.posterGrid}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {userList.map((movie, i) => (
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
                          <FilmCard movie={movie} rankBadge={i + 1} showAddToList={false} />
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
        ) : userList.length > 0 ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="genre-list">
              {(provided) => (
                <ul className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                  {userList.map((movie, i) => (
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
                          <span className={styles.rank}>{i + 1}</span>
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
        ) : (
          <div className={styles.emptyList}>
            <p>Search for films above to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
