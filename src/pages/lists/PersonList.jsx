import { useState, useMemo, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useFilm } from '../../context/FilmContext'
import { searchPerson, getProfileUrl, getProfileUrlLarge, getPersonDetails, getPersonMovieCredits } from '../../api/tmdb'
import RECOMMENDED_ACTORS from '../../data/recommendedActors.json'
import styles from './PersonList.module.css'

const PLACEHOLDER_PERSON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750' viewBox='0 0 500 750'%3E%3Crect width='500' height='750' fill='%23141414'/%3E%3Ccircle cx='250' cy='260' r='110' fill='%232a2520'/%3E%3Cellipse cx='250' cy='540' rx='160' ry='110' fill='%232a2520'/%3E%3C/svg%3E`

function PersonModal({ person, myList, onClose }) {
  const [bio, setBio] = useState(null)
  const [topFilms, setTopFilms] = useState([])
  const [loading, setLoading] = useState(true)

  const myListIds = useMemo(() => new Set(myList.map((m) => m.tmdb_id)), [myList])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

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
          .slice(0, 5)
        setTopFilms(films)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [person.person_id])

  const inMyList = topFilms.filter((f) => myListIds.has(f.id))
  const imgUrl = person.headshot_path ? getProfileUrlLarge(person.headshot_path) : PLACEHOLDER_PERSON

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdrop}>
      <div className={styles.modal}>
        <button className={styles.modalClose} onClick={onClose} aria-label="Close">×</button>
        <div className={styles.modalContent}>
          <div className={styles.modalImageCol}>
            <img src={imgUrl} alt={person.name} className={styles.modalImage} />
          </div>
          <div className={styles.modalInfoCol}>
            <h2 className={styles.modalName}>{person.name}</h2>
            {loading ? (
              <p className={styles.modalLoading}>Loading…</p>
            ) : (
              <>
                {bio && (
                  <p className={styles.modalBio}>
                    {bio.slice(0, 320)}{bio.length > 320 ? '…' : ''}
                  </p>
                )}
                {topFilms.length > 0 && (
                  <div className={styles.modalFilms}>
                    <p className={styles.modalFilmsLabel}>Notable films</p>
                    {topFilms.map((f) => (
                      <div key={f.id} className={styles.modalFilmRow}>
                        <span className={styles.modalFilmTitle}>{f.title}</span>
                        <span className={styles.modalFilmYear}>{f.release_date?.slice(0, 4)}</span>
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

  const [poolPeople, setPoolPeople] = useState([])
  const [poolLoading, setPoolLoading] = useState(true)

  const isActors = listType === 'actors'

  const listIds = useMemo(() => new Set(userList.map((p) => p.person_id)), [userList])

  // Resolve the curated recommended-actors list to TMDB people, in order
  useEffect(() => {
    if (!isActors) { setPoolLoading(false); return }
    setPoolLoading(true)
    Promise.all(RECOMMENDED_ACTORS.map((name) => searchPerson(name)))
      .then((responses) => {
        const seen = new Set()
        const people = []
        for (const results of responses) {
          const match = results?.[0]
          if (!match || seen.has(match.id)) continue
          seen.add(match.id)
          people.push(match)
        }
        setPoolPeople(people)
        setPoolLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActors])

  const poolToShow = useMemo(
    () => poolPeople.filter((p) => !listIds.has(p.id)),
    [poolPeople, listIds]
  )

  function addFromPool(p) {
    if (listIds.has(p.id) || userList.length >= maxItems) return
    addToList(listKey, {
      person_id: p.id,
      name: p.name,
      headshot_path: p.profile_path ?? null,
    })
  }

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
    <div className={styles.page}>
      {selectedPerson && (
        <PersonModal
          person={selectedPerson}
          myList={myList}
          onClose={() => setSelectedPerson(null)}
        />
      )}

      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
          </div>
          {userList.length > 0 && (
            <span className={styles.countBadge}>{userList.length} / {maxItems}</span>
          )}
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
              const imgUrl = r.profile_path ? getProfileUrl(r.profile_path) : null
              return (
                <div key={r.id} className={styles.resultRow}>
                  {imgUrl
                    ? <img src={imgUrl} alt={r.name} className={styles.resultThumb} />
                    : <div className={styles.resultThumbPlaceholder} />
                  }
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
        {userList.length > 0 && (
          <>
            {isActors && <h2 className={styles.sectionTitle}>Your Actors</h2>}
            <p className={styles.gridHint}>Drag to reorder · Click for details</p>
          </>
        )}

        {/* Poster grid */}
        {userList.length === 0 ? (
          !isActors && (
            <div className={styles.emptyGrid}>
              <p>Search for directors to build your list.</p>
            </div>
          )
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="person-grid" direction="horizontal">
              {(provided) => (
                <div
                  className={styles.grid}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {userList.map((person, i) => {
                    const imgUrl = person.headshot_path
                      ? getProfileUrlLarge(person.headshot_path)
                      : PLACEHOLDER_PERSON
                    return (
                      <Draggable
                        key={String(person.person_id)}
                        draggableId={String(person.person_id)}
                        index={i}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`${styles.gridItem} ${snapshot.isDragging ? styles.dragging : ''}`}
                          >
                            <div
                              className={styles.card}
                              onClick={() => setSelectedPerson(person)}
                            >
                              <div className={styles.posterWrap}>
                                <img
                                  src={imgUrl}
                                  alt={person.name}
                                  className={styles.poster}
                                  loading="lazy"
                                  onError={(e) => { e.target.src = PLACEHOLDER_PERSON }}
                                />
                                <div className={styles.overlay}>
                                  <div className={styles.overlayContent}>
                                    <span className={styles.overlayTap}>Tap for details</span>
                                  </div>
                                </div>
                                <span className={styles.rankBadge}>#{i + 1}</span>
                                <button
                                  className={styles.removeBtn}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeFromList(listKey, person.person_id)
                                  }}
                                  aria-label={`Remove ${person.name}`}
                                >×</button>
                              </div>
                              <div className={styles.cardInfo}>
                                <span className={styles.cardName}>{person.name}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    )
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {/* Recommended pool */}
        {isActors && (
          <div className={styles.poolSection}>
            <div className={styles.poolHeader}>
              <h2 className={styles.sectionTitle}>Recommended Actors</h2>
              {!poolLoading && <span className={styles.poolCount}>{poolToShow.length} to choose from</span>}
            </div>

            <div className={styles.grid}>
              {poolLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <div key={`pool-sk-${i}`} className={styles.poolSkeleton}>
                      <div className={styles.poolSkeletonImg} />
                    </div>
                  ))
                : poolToShow.map((p) => {
                    const imgUrl = p.profile_path ? getProfileUrlLarge(p.profile_path) : PLACEHOLDER_PERSON
                    return (
                      <div key={p.id} className={styles.gridItem}>
                        <div
                          className={styles.card}
                          onClick={() => setSelectedPerson({ person_id: p.id, name: p.name, headshot_path: p.profile_path ?? null })}
                        >
                          <div className={styles.posterWrap}>
                            <img
                              src={imgUrl}
                              alt={p.name}
                              className={styles.poster}
                              loading="lazy"
                              onError={(e) => { e.target.src = PLACEHOLDER_PERSON }}
                            />
                            <div className={styles.overlay}>
                              <div className={styles.overlayContent}>
                                <span className={styles.overlayTap}>Tap for details</span>
                              </div>
                            </div>
                            <button
                              className={styles.poolAddBtn}
                              onClick={(e) => { e.stopPropagation(); addFromPool(p) }}
                              disabled={isFull}
                              title={isFull ? `Your list is full (${maxItems}/${maxItems}) — remove someone to add more` : undefined}
                              aria-label={`Add ${p.name}`}
                            >+</button>
                          </div>
                          <div className={styles.cardInfo}>
                            <span className={styles.cardName}>{p.name}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
