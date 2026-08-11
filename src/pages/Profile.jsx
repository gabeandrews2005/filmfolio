import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '../context/AuthContext'
import { useFilm } from '../context/FilmContext'
import { getProfileByUsername, getUserData } from '../api/supabase'
import UniverseSection from '../components/UniverseSection'
import styles from './Profile.module.css'

const SECTIONS = [
  { key: 'myList',        label: 'Top Films', editPath: '/my-list',         type: 'movie' },
  { key: 'actorsList',    label: 'Actors',     editPath: '/lists/actors',    type: 'person' },
  { key: 'directorsList', label: 'Directors',  editPath: '/lists/directors', type: 'person' },
  { key: 'horrorList',    label: 'Horror',     editPath: '/lists/horror',    type: 'movie' },
  { key: 'comediesList',  label: 'Comedies',   editPath: '/lists/comedies',  type: 'movie' },
  { key: 'animatedList',  label: 'Animated',   editPath: '/lists/animated',  type: 'movie' },
  { key: 'showsList',     label: 'Shows',      editPath: '/lists/shows',     type: 'show' },
  { key: 'seasonalList',  label: 'Seasonal',   editPath: '/lists/seasonal',  type: 'movie' },
]

// Everything except "Top Films" (myList) can be dragged into any order the
// user wants — myList always renders first, outside this sortable group.
function SortableSection({ id, section }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style}>
      <UniverseSection
        title={section.label}
        items={section.items}
        editPath={section.editPath}
        type={section.type}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  )
}

function SelfProfile() {
  const { profile, session, updatePhone } = useAuth()
  const {
    myList, actorsList, directorsList, horrorList,
    comediesList, animatedList, showsList, seasonalList, seenList,
    savedQuickLists, profileSectionOrder, reorderProfileSections,
    signOutAndClearLocalData,
  } = useFilm()
  const lists = { myList, actorsList, directorsList, horrorList, comediesList, animatedList, showsList, seasonalList }

  const hasPhone = !!session?.user?.user_metadata?.phone
  const [addingPhone, setAddingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)

  async function handleAddPhone(e) {
    e.preventDefault()
    const trimmed = phoneInput.trim()
    if (!trimmed) return
    setPhoneSaving(true)
    await updatePhone(trimmed)
    setPhoneSaving(false)
    setAddingPhone(false)
    setPhoneInput('')
  }

  function handleSignOut() {
    if (window.confirm('Sign out? Your lists stay saved to your account, but this device will be cleared.')) {
      signOutAndClearLocalData()
    }
  }

  const pinnedSection = SECTIONS.find((s) => s.key === 'myList')
  const pinnedItems = lists[pinnedSection.key]

  const orderableSections = [
    ...SECTIONS
      .filter((s) => s.key !== 'myList')
      .map((s) => ({ id: s.key, label: s.label, editPath: s.editPath, type: s.type, items: lists[s.key] })),
    ...savedQuickLists.map((list) => ({
      id: list.id, label: list.name, editPath: '/quick-lists', type: 'movie', items: list.films,
    })),
  ].filter((s) => s.items.length > 0)

  // Apply the user's stored order; anything not yet positioned (a newly
  // filled list, a freshly saved Quick List) is appended at the end rather
  // than dropped, and a stale id (e.g. a deleted saved list) is just skipped.
  const byId = new Map(orderableSections.map((s) => [s.id, s]))
  const orderedSections = []
  const placed = new Set()
  for (const id of profileSectionOrder) {
    const s = byId.get(id)
    if (s) { orderedSections.push(s); placed.add(id) }
  }
  for (const s of orderableSections) {
    if (!placed.has(s.id)) orderedSections.push(s)
  }

  // See MyList.jsx for why touch gets its own TouchSensor instead of a
  // shared PointerSensor.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedSections.findIndex((s) => s.id === active.id)
    const newIndex = orderedSections.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorderProfileSections(arrayMove(orderedSections, oldIndex, newIndex).map((s) => s.id))
  }

  const hasAnything = pinnedItems.length > 0 || orderedSections.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.heroSection}>
        <div className="container">
          <div className={styles.profileHeader}>
            <div className={styles.avatar}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={profile.username} />
                : <span>{profile.username[0].toUpperCase()}</span>
              }
            </div>
            <div className={styles.profileInfo}>
              <h1 className={styles.username}>{profile.username}</h1>
              <div className={styles.profileStats}>
                <span>{myList.length} films ranked</span>
                <span>·</span>
                <span>{seenList.size} seen</span>
              </div>
            </div>

            <div className={styles.headerActions}>
              {!hasPhone && (
                addingPhone ? (
                  <form className={styles.phoneForm} onSubmit={handleAddPhone}>
                    <input
                      type="tel"
                      className={styles.phoneInput}
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="Phone number"
                      autoFocus
                    />
                    <button type="submit" className={styles.phoneSaveBtn} disabled={phoneSaving}>
                      {phoneSaving ? '…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className={styles.phoneCancelBtn}
                      onClick={() => { setAddingPhone(false); setPhoneInput('') }}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button type="button" className={styles.addPhoneBtn} onClick={() => setAddingPhone(true)}>
                    + Phone Number
                  </button>
                )
              )}
              <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {hasAnything ? (
        <div className={styles.sections}>
          {pinnedItems.length > 0 && (
            <UniverseSection title={pinnedSection.label} items={pinnedItems} editPath={pinnedSection.editPath} type={pinnedSection.type} />
          )}

          {orderedSections.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {orderedSections.map((section) => (
                  <SortableSection key={section.id} id={section.id} section={section} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      ) : (
        <div className="container">
          <div className={styles.empty}>
            <p className={styles.emptyText}>You haven't built any lists yet.</p>
            <Link to="/my-list" className={styles.emptyLink}>Start with your Top 10 →</Link>
          </div>
        </div>
      )}
    </div>
  )
}

function OtherProfile({ username }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'not-found' | 'ready'
  const [targetProfile, setTargetProfile] = useState(null)
  const [data, setData] = useState({})

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    async function run() {
      const p = await getProfileByUsername(username)
      if (cancelled) return
      if (!p) { setStatus('not-found'); return }
      setTargetProfile(p)
      const row = await getUserData(p.id)
      if (cancelled) return
      setData(row?.data ?? {})
      setStatus('ready')
    }
    run()
    return () => { cancelled = true }
  }, [username])

  if (status === 'loading') {
    return <div className={styles.page}><div className="container"><p className={styles.loadingText}>Loading…</p></div></div>
  }

  if (status === 'not-found') {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.empty}>
            <p className={styles.emptyText}>No profile found for "{username}".</p>
            <Link to="/friends" className={styles.emptyLink}>← Back to Friends</Link>
          </div>
        </div>
      </div>
    )
  }

  const sections = SECTIONS
    .map((s) => ({ ...s, items: data[s.key] ?? [] }))
    .filter((s) => s.items.length > 0)
  const savedQuickLists = data.savedQuickLists ?? []
  const hasAnything = sections.length > 0 || savedQuickLists.length > 0
  const myListCount = data.myList?.length ?? 0
  const seenCount = data.seenList?.length ?? 0

  return (
    <div className={styles.page}>
      <div className={styles.heroSection}>
        <div className="container">
          <div className={styles.profileHeader}>
            <div className={styles.avatar}>
              {targetProfile.avatar_url
                ? <img src={targetProfile.avatar_url} alt={targetProfile.username} />
                : <span>{targetProfile.username[0].toUpperCase()}</span>
              }
            </div>
            <div className={styles.profileInfo}>
              <h1 className={styles.username}>{targetProfile.username}</h1>
              <div className={styles.profileStats}>
                <span>{myListCount} films ranked</span>
                <span>·</span>
                <span>{seenCount} seen</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {hasAnything ? (
        <div className={styles.sections}>
          {sections.map(({ key, label, items, type }) => (
            <UniverseSection key={key} title={label} items={items} type={type} />
          ))}
          {savedQuickLists.map((list) => (
            <UniverseSection key={list.id} title={list.name} items={list.films} type="movie" />
          ))}
        </div>
      ) : (
        <div className="container">
          <div className={styles.empty}>
            <p className={styles.emptyText}>{targetProfile.username} hasn't built any lists yet.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Profile() {
  const { username } = useParams()
  const { session, profile, authLoading } = useAuth()

  if (authLoading) return null
  // Viewing any profile — your own or a friend's — requires an account,
  // since user_data is only readable by other signed-in users (see the
  // RLS policy: private data, but not gated behind an accepted friendship).
  if (!session) return <Navigate to="/account" replace />

  if (!username) {
    return profile ? <Navigate to={`/profile/${profile.username}`} replace /> : null
  }

  if (profile && username.toLowerCase() === profile.username.toLowerCase()) {
    return <SelfProfile />
  }
  return <OtherProfile username={username} />
}
