import { Link, Navigate } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import UniverseSection from '../components/UniverseSection'
import styles from './Profile.module.css'

export default function Profile() {
  const { user, myList, actorsList, directorsList, horrorList, comediesList, animatedList, showsList, seasonalList, seenList } = useFilm()

  if (!user) {
    return <Navigate to="/account" replace />
  }

  const sections = [
    { label: 'Top Films',     items: myList,        path: '/my-list' },
    { label: 'Actors',        items: actorsList,     path: '/lists/actors' },
    { label: 'Directors',     items: directorsList,  path: '/lists/directors' },
    { label: 'Horror',        items: horrorList,     path: '/lists/horror' },
    { label: 'Comedies',      items: comediesList,   path: '/lists/comedies' },
    { label: 'Animated',      items: animatedList,   path: '/lists/animated' },
    { label: 'Shows',         items: showsList,      path: '/lists/shows' },
    { label: 'Seasonal',      items: seasonalList,   path: '/lists/seasonal' },
  ].filter((s) => s.items.length > 0)

  return (
    <div className={styles.page}>
      <div className={styles.heroSection}>
        <div className="container">
          <div className={styles.profileHeader}>
            <div className={styles.avatar}>
              {user.avatar
                ? <img src={user.avatar} alt={user.username} />
                : <span>{user.username[0].toUpperCase()}</span>
              }
            </div>
            <div className={styles.profileInfo}>
              <h1 className={styles.username}>{user.username}</h1>
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
          {sections.map(({ label, items, path }) => (
            <UniverseSection
              key={label}
              title={label}
              items={items}
              editPath={path}
            />
          ))}
        </div>
      ) : (
        <div className="container">
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              You haven't built any lists yet.
            </p>
            <Link to="/my-list" className={styles.emptyLink}>Start with your Top 10 →</Link>
          </div>
        </div>
      )}
    </div>
  )
}
