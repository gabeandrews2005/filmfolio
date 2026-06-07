import { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useFilm } from '../../context/FilmContext'
import { searchPerson, getProfileUrl } from '../../api/tmdb'
import PersonCard from '../../components/PersonCard'
import styles from './PersonList.module.css'

const PLACEHOLDER_PERSON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='185' height='278' viewBox='0 0 185 278'%3E%3Crect width='185' height='278' fill='%23141414'/%3E%3Ccircle cx='92' cy='95' r='40' fill='%232a2520'/%3E%3Cellipse cx='92' cy='200' rx='60' ry='40' fill='%232a2520'/%3E%3C/svg%3E`

export default function PersonList({ listType, title, maxItems = 50 }) {
  const { addToList, removeFromList, reorderList } = useFilm()
  const listKey = `${listType}List`
  const userList = useFilm()[listKey] ?? []

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)

  const listIds = useMemo(() => new Set(userList.map((p) => p.person_id)), [userList])

  function handleSearch(value) {
    setQuery(value)
    clearTimeout(debounceTimer)
    if (!value.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const results = await searchPerson(value)
      setSearchResults(results.slice(0, 8))
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
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>
              {userList.length} / {maxItems} ranked
            </p>
          </div>
        </div>

        <div className={styles.builder}>
          {/* Left: search */}
          <div className={styles.left}>
            <div className={styles.searchBox}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder={`Search for ${listType === 'actors' ? 'an actor' : 'a director'}…`}
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
                      <button
                        className={`${styles.addBtn} ${inList ? styles.added : ''} ${!inList && isFull ? styles.full : ''}`}
                        onClick={() => !inList && !isFull && addPerson(r)}
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
                Search by name to find and add {listType === 'actors' ? 'actors' : 'directors'} to your list.
              </p>
            )}
          </div>

          {/* Right: ranked list */}
          <div className={styles.right}>
            <div className={styles.listHeaderRow}>
              <h2 className={styles.listTitle}>{title}</h2>
              <span className={styles.listCount}>{userList.length} / {maxItems}</span>
            </div>

            {userList.length === 0 ? (
              <div className={styles.emptyList}>
                <p>Search for {listType === 'actors' ? 'actors' : 'directors'} to build your list.</p>
              </div>
            ) : (
              <>
                {/* Compact list for drag ordering */}
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
                                />
                                <span className={styles.personName}>{person.name}</span>
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

                {/* Grid preview below the list */}
                <h3 className={styles.gridPreviewLabel}>Your Picks</h3>
                <div className={styles.personGrid}>
                  {userList.map((person, i) => (
                    <PersonCard
                      key={person.person_id}
                      person={person}
                      rank={i + 1}
                      onRemove={(id) => removeFromList(listKey, id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
