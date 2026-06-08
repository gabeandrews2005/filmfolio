import { useState, useMemo, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useFilm } from '../../context/FilmContext'
import { searchPerson, getProfileUrl, getPersonDetails, getPersonMovieCredits } from '../../api/tmdb'
import styles from './PersonList.module.css'

const PLACEHOLDER_PERSON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='185' height='278' viewBox='0 0 185 278'%3E%3Crect width='185' height='278' fill='%23141414'/%3E%3Ccircle cx='92' cy='95' r='40' fill='%232a2520'/%3E%3Cellipse cx='92' cy='200' rx='60' ry='40' fill='%232a2520'/%3E%3C/svg%3E`

function PersonModal({ person, myList, onClose }) {
  const [bio, setBio] = useState(null)
  const [topFilms, setTopFilms] = useState([])
  const [loading, setLoading] = useState(true)

  const myListIds = useMemo(() => new Set(myList.map((m) => m.tmdb_id)), [myList])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [details, credits] = await Promise.all([
        getPersonDetails(person.person_id),
        getPersonMovieCredits(person.person_id),
      ])
      if (!cancelled) {
        setBio(details?.biography ?? null)
        const films = (credits?.cast ?? [])
          .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
          .slice(0, 3)
        setTopFilms(films)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [person.person_id])

  const inMyList = topFilms.filter((f) => myListIds.has(f.id))

  const headshotUrl = person.headshot_path
    ? getProfileUrl(person.headshot_path)
    : PLACEHOLDER_PERSON

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>×</button>
        <div className={styles.modalContent}>
          <img src={headshotUrl} alt={person.name} className={styles.modalHeadshot} />
          <div className={styles.modalInfo}>
            <h2 className={styles.modalName}>{person.name}</h2>
            {loading ? (
              <p className={styles.modalLoading}>Loading…</p>
            ) : (
              <>
                {bio && (
                  <p className={styles.modalBio}>
                    {bio.slice(0, 280)}{bio.length > 280 ? '…' : ''}
                  </p>
                )}
                {topFilms.length > 0 && (
                  <div className={styles.modalFilms}>
                    <p className={styles.modalFilmsLabel}>Notable films</p>
                    {topFilms.map((f) => (
                      <div key={f.id} className={styles.modalFilmRow}>
                        <span className={styles.modalFilmTitle}>{f.title}</span>
                        <span className={styles.modalFilmYear}>{f.release_date?.slice(0,4)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {inMyList.length > 0 && (
                  <p className={styles.modalMatchNote}>
                    ★ {inMyList.length} film{inMyList.length !== 1 ? 's' : ''} on your list
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PersonList({ listType, title, maxItems = 50 }) {
  const { myList, addToList, removeFromList, reorderList } = useFilm()
  const listKey = `${listType}List`
  const userList = useFilm()[listKey] ?? []

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)
  const [selectedPerson, setSelectedPerson] = useState(null)

  const isActors = listType === 'actors'
  const themeClass = isActors ? styles.themeShakespeare : styles.themeCinema

  const listIds = useMemo(() => new Set(userList.map((p) => p.person_id)), [userList])

  function handleSearch(value) {
    setQuery(value)
    clearTimeout(debounceTimer)
    if (!value.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const results = await searchPerson(value)
      const filtered = isActors
        ? results
        : results.filter((r) => r.known_for_department === 'Directing')
      setSearchResults(filtered.slice(0, 8))
      setSearching(false)
    }, 350)
    setDebounceTimer(timer)
  }

  function addPerson(result) {
    if (listIds.has(result.id)) return
    if (userList.length >= maxItems) return
    addToList(listKey, {
      person_id: result.id,
      name: result.name,
      headshot_path: result.profile_path ?? null,
    })
    // Auto-clear search on add
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

  return (
    <div className={`${styles.page} ${themeClass}`}>
      {selectedPerson && (
        <PersonModal
          person={selectedPerson}
          myList={myList}
          onClose={() => setSelectedPerson(null)}
        />
      )}

      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
        </div>

        {/* Search bar */}
        <div className={styles.searchBox}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={`Search for ${isActors ? 'an actor' : 'a director'}…`}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searching && <span className={styles.spinner}>⟳</span>}
        </div>

        {searchResults.length > 0 && (
          <div className={styles.results}>
            {searchResults.map((r) => {
              const inList = listIds.has(r.id)
              const imgUrl = r.profile_path
                ? getProfileUrl(r.profile_path)
                : PLACEHOLDER_PERSON
              return (
                <div key={r.id} className={styles.resultRow}>
                  <img src={imgUrl} alt={r.name} className={styles.headshot} />
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{r.name}</span>
                    {r.known_for_department && (
                      <span className={styles.resultDept}>{r.known_for_department}</span>
                    )}
                  </div>
                  {!inList ? (
                    <button
                      className={styles.addBtn}
                      onClick={() => !isFull && addPerson(r)}
                      disabled={isFull}
                    >
                      +
                    </button>
                  ) : (
                    <span className={styles.addedMark}>✓</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Your Picks label */}
        {userList.length > 0 && (
          <div className={styles.picksHeader}>
            <span className={styles.picksLabel}>Your Picks</span>
            <span className={styles.picksCount}>{userList.length} / {maxItems}</span>
          </div>
        )}

        {/* Ranked drag list */}
        {userList.length === 0 ? (
          <div className={styles.emptyList}>
            <p>Search for {isActors ? 'actors' : 'directors'} to build your list.</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="person-list">
              {(provided) => (
                <ul className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                  {userList.map((person, i) => (
                    <Draggable
                      key={String(person.person_id)}
                      draggableId={String(person.person_id)}
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
                          <img
                            src={person.headshot_path ? getProfileUrl(person.headshot_path) : PLACEHOLDER_PERSON}
                            alt={person.name}
                            className={styles.headshot}
                            onClick={() => setSelectedPerson(person)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span
                            className={styles.personName}
                            onClick={() => setSelectedPerson(person)}
                            style={{ cursor: 'pointer' }}
                          >
                            {person.name}
                          </span>
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeFromList(listKey, person.person_id)}
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
  )
}
