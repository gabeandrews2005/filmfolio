import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  searchProfiles, sendFriendRequest, respondToFriendRequest,
  withdrawFriendRequest, unfriend, listMyFriendships,
} from '../api/supabase'
import styles from './Friends.module.css'

function ProfileRow({ profile, action }) {
  return (
    <div className={styles.profileCard}>
      <div className={styles.cardAvatar}>
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt={profile.username} />
          : <span>{profile.username[0].toUpperCase()}</span>
        }
      </div>
      <div className={styles.cardInfo}>
        <Link to={`/profile/${profile.username}`} className={styles.cardName}>{profile.username}</Link>
      </div>
      <div className={styles.rowActions}>{action}</div>
    </div>
  )
}

export default function Friends() {
  const { session } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [friendships, setFriendships] = useState({ accepted: [], incoming: [], outgoing: [] })
  const [loadingFriendships, setLoadingFriendships] = useState(true)
  const debounceRef = useRef(null)

  async function refreshFriendships() {
    if (!session) return
    setLoadingFriendships(true)
    setFriendships(await listMyFriendships(session.user.id))
    setLoadingFriendships(false)
  }

  useEffect(() => { refreshFriendships() }, [session?.user?.id])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setResults(await searchProfiles(query, session?.user?.id))
      setSearching(false)
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, session])

  const allRelations = [...friendships.accepted, ...friendships.outgoing, ...friendships.incoming]
  function relationFor(userId) {
    if (friendships.accepted.some((f) => f.profile?.id === userId)) return 'accepted'
    if (friendships.outgoing.some((f) => f.profile?.id === userId)) return 'outgoing'
    if (friendships.incoming.some((f) => f.profile?.id === userId)) return 'incoming'
    return null
  }
  function friendshipIdFor(userId) {
    return allRelations.find((f) => f.profile?.id === userId)?.friendshipId
  }

  async function handleAdd(targetId) { await sendFriendRequest(session.user.id, targetId); refreshFriendships() }
  async function handleWithdraw(id) { await withdrawFriendRequest(id); refreshFriendships() }
  async function handleAccept(id) { await respondToFriendRequest(id, true); refreshFriendships() }
  async function handleDecline(id) { await respondToFriendRequest(id, false); refreshFriendships() }
  async function handleUnfriend(id) { await unfriend(id); refreshFriendships() }

  if (!session) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.header}>
            <h1 className={styles.title}>Friends</h1>
            <p className={styles.subtitle}>Sign in to find friends and see their ranked lists.</p>
          </div>
          <Link to="/account" className={styles.backBtn}>Sign In / Sign Up →</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Friends</h1>
          <p className={styles.subtitle}>Find film lovers and see their ranked lists.</p>
        </div>

        <div className={styles.searchWrap}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by username…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {query.trim() && (
          <div className={styles.section}>
            <div className={styles.grid}>
              {searching && <p className={styles.noResults}>Searching…</p>}
              {!searching && results.length === 0 && (
                <p className={styles.noResults}>No users found for "{query}"</p>
              )}
              {results.map((r) => {
                const relation = relationFor(r.id)
                return (
                  <ProfileRow
                    key={r.id}
                    profile={r}
                    action={
                      relation === 'accepted' ? <span className={styles.statusTag}>✓ Friends</span>
                      : relation === 'outgoing' ? (
                        <button className={styles.secondaryBtn} onClick={() => handleWithdraw(friendshipIdFor(r.id))}>
                          Requested — Cancel
                        </button>
                      )
                      : relation === 'incoming' ? <span className={styles.statusTag}>See requests below</span>
                      : <button className={styles.primaryBtn} onClick={() => handleAdd(r.id)}>+ Add Friend</button>
                    }
                  />
                )
              })}
            </div>
          </div>
        )}

        {friendships.incoming.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Friend Requests</h2>
            <div className={styles.grid}>
              {friendships.incoming.map((f) => f.profile && (
                <ProfileRow
                  key={f.friendshipId}
                  profile={f.profile}
                  action={
                    <div className={styles.requestActions}>
                      <button className={styles.primaryBtn} onClick={() => handleAccept(f.friendshipId)}>Accept</button>
                      <button className={styles.secondaryBtn} onClick={() => handleDecline(f.friendshipId)}>Decline</button>
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            My Friends{friendships.accepted.length > 0 ? ` (${friendships.accepted.length})` : ''}
          </h2>
          {loadingFriendships ? (
            <p className={styles.noResults}>Loading…</p>
          ) : friendships.accepted.length === 0 ? (
            <p className={styles.noResults}>No friends yet — search above to find some.</p>
          ) : (
            <div className={styles.grid}>
              {friendships.accepted.map((f) => f.profile && (
                <ProfileRow
                  key={f.friendshipId}
                  profile={f.profile}
                  action={<button className={styles.secondaryBtn} onClick={() => handleUnfriend(f.friendshipId)}>Unfriend</button>}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
