import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
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

function SelfProfile() {
  const { profile } = useAuth()
  const {
    myList, actorsList, directorsList, horrorList,
    comediesList, animatedList, showsList, seasonalList, seenList,
  } = useFilm()
  const lists = { myList, actorsList, directorsList, horrorList, comediesList, animatedList, showsList, seasonalList }

  const sections = SECTIONS
    .map((s) => ({ ...s, items: lists[s.key] }))
    .filter((s) => s.items.length > 0)

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
              <Link to="/universe" className={styles.universeLink}>
                View Universe →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {sections.length > 0 ? (
        <div className={styles.sections}>
          {sections.map(({ key, label, items, editPath, type }) => (
            <UniverseSection key={key} title={label} items={items} editPath={editPath} type={type} />
          ))}
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

      {sections.length > 0 ? (
        <div className={styles.sections}>
          {sections.map(({ key, label, items, type }) => (
            <UniverseSection key={key} title={label} items={items} type={type} />
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
