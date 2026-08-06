import { useState, useMemo, useEffect } from 'react'
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useFilm } from '../../context/FilmContext'
import { searchPerson, getProfileUrl, getProfileUrlLarge, getPersonDetails, getPersonMovieCredits } from '../../api/tmdb'
import RECOMMENDED_ACTORS from '../../data/recommendedActors.json'
import RECOMMENDED_DIRECTORS from '../../data/recommendedDirectors.json'
import RankPickerModal from '../../components/RankPickerModal'
import styles from './PersonList.module.css'

const PLACEHOLDER_PERSON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750' viewBox='0 0 500 750'%3E%3Crect width='500' height='750' fill='%23141414'/%3E%3Ccircle cx='250' cy='260' r='110' fill='%232a2520'/%3E%3Cellipse cx='250' cy='540' rx='160' ry='110' fill='%232a2520'/%3E%3C/svg%3E`

const RECOMMENDED_LISTS = {
  actors: RECOMMENDED_ACTORS,
  directors: RECOMMENDED_DIRECTORS,
}

// Firing 100 concurrent TMDB lookups at once triggers rate-limiting (and
// browsers cap concurrent connections per host anyway), so requests are
// throttled and empty responses retried with backoff.
async function resolvePersonWithRetry(name, attempt = 0) {
  const results = await searchPerson(name)
  if (results.length > 0 || attempt >= 2) return results
  await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  return resolvePersonWithRetry(name, attempt + 1)
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

function SortablePersonCard({ person, index, onSelect, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(person.person_id),
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const imgUrl = person.headshot_path
    ? getProfileUrlLarge(person.headshot_path)
    : PLACEHOLDER_PERSON

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${styles.gridItem} ${styles.sortableItem} ${isDragging ? styles.dragging : ''}`}
    >
      <div className={styles.card} onClick={() => onSelect(person)}>
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
          <span className={styles.rankBadge}>#{index + 1}</span>
          <button
            className={styles.removeBtn}
            onClick={(e) => {
              e.stopPropagation()
              onRemove(person.person_id)
            }}
            aria-label={`Remove ${person.name}`}
          >×</button>
        </div>
        <div className={styles.cardInfo}>
          <span className={styles.cardName}>{person.name}</span>
        </div>
      </div>
    </div>
  )
}

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
  const { myList, addToList, insertAtRank, removeFromList, reorderList } = useFilm()
  const listKey = `${listType}List`
  const userList = useFilm()[listKey] ?? []

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [rankPickerPerson, setRankPickerPerson] = useState(null)

  const [poolPeople, setPoolPeople] = useState([])
  const [poolLoading, setPoolLoading] = useState(true)

  const isActors = listType === 'actors'
  const recommendedNames = RECOMMENDED_LISTS[listType]

  // Curtain-rise entrance, Actors only — the "show" opens on every visit
  const [showCurtain, setShowCurtain] = useState(isActors)

  useEffect(() => {
    if (!isActors) return
    setShowCurtain(true)
    const t = setTimeout(() => setShowCurtain(false), 2700)
    return () => clearTimeout(t)
  }, [isActors])

  const listIds = useMemo(() => new Set(userList.map((p) => p.person_id)), [userList])

  // Resolve the curated recommended-people list to TMDB people, in order
  useEffect(() => {
    if (!recommendedNames) { setPoolLoading(false); return }
    setPoolLoading(true)
    let cancelled = false
    mapWithConcurrency(recommendedNames, 6, (name) => resolvePersonWithRetry(name))
      .then((responses) => {
        if (cancelled) return
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
    return () => { cancelled = true }
  }, [recommendedNames])

  const poolToShow = useMemo(
    () => poolPeople.filter((p) => !listIds.has(p.id)),
    [poolPeople, listIds]
  )

  function buildPersonItem(raw) {
    return {
      person_id: raw.id,
      name: raw.name,
      headshot_path: raw.profile_path ?? null,
    }
  }

  // Adds directly if there's room; once the list is full, opens the rank
  // picker instead of silently doing nothing. Returns false only when the
  // person is already on the list (nothing to clear the search box for).
  function addOrPromptRank(item) {
    if (listIds.has(item.person_id)) return false
    if (userList.length >= maxItems) {
      setRankPickerPerson(item)
      return true
    }
    addToList(listKey, item)
    return true
  }

  function addFromPool(p) {
    addOrPromptRank(buildPersonItem(p))
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
    const handled = addOrPromptRank(buildPersonItem(result))
    if (handled) {
      setQuery('')
      setSearchResults([])
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = userList.findIndex((p) => String(p.person_id) === active.id)
    const newIndex = userList.findIndex((p) => String(p.person_id) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorderList(listKey, arrayMove(userList, oldIndex, newIndex))
  }

  const isFull = userList.length >= maxItems

  return (
    <div className={`${styles.page} ${isActors ? styles.themeActors : ''}`}>
      {isActors && showCurtain && (
        <div className={styles.curtainWrap} aria-hidden="true">
          <div className={`${styles.curtainPanel} ${styles.curtainLeft}`} />
          <div className={`${styles.curtainPanel} ${styles.curtainRight}`} />
        </div>
      )}

      {selectedPerson && (
        <PersonModal
          person={selectedPerson}
          myList={myList}
          onClose={() => setSelectedPerson(null)}
        />
      )}

      {rankPickerPerson && (
        <RankPickerModal
          itemName={rankPickerPerson.name}
          maxRank={maxItems}
          onSubmit={(rank) => {
            insertAtRank(listKey, rankPickerPerson, rank)
            setRankPickerPerson(null)
          }}
          onCancel={() => setRankPickerPerson(null)}
        />
      )}

      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
            {isActors && <p className={styles.theatricalSubtitle}>Dramatis Personae</p>}
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
                      onClick={() => addPerson(r)}
                      title={isFull ? `Your list is full (${maxItems}/${maxItems}) — choose a rank to slot them in` : undefined}
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
            {recommendedNames && <h2 className={styles.sectionTitle}>Your {title}</h2>}
            <p className={styles.gridHint}>Drag to reorder · Click for details</p>
          </>
        )}

        {/* Poster grid */}
        {userList.length === 0 ? (
          !recommendedNames && (
            <div className={styles.emptyGrid}>
              <p>Search for {isActors ? 'actors' : 'directors'} to build your list.</p>
            </div>
          )
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={userList.map((p) => String(p.person_id))} strategy={rectSortingStrategy}>
              <div className={styles.grid}>
                {userList.map((person, i) => (
                  <SortablePersonCard
                    key={person.person_id}
                    person={person}
                    index={i}
                    onSelect={setSelectedPerson}
                    onRemove={(id) => removeFromList(listKey, id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Recommended pool */}
        {recommendedNames && (
          <div className={styles.poolSection}>
            <div className={styles.poolHeader}>
              <h2 className={styles.sectionTitle}>Recommended {title}</h2>
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
                              title={isFull ? `Your list is full (${maxItems}/${maxItems}) — choose a rank to slot them in` : undefined}
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
