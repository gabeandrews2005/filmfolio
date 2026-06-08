import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import UniverseSection from '../components/UniverseSection'
import styles from './Universe.module.css'

const SECTION_CONFIG = [
  { listKey: 'myList',       label: 'My Top Films',    editPath: '/my-list',           type: 'movie' },
  { listKey: 'actorsList',   label: 'My Actors',       editPath: '/lists/actors',       type: 'person' },
  { listKey: 'directorsList',label: 'My Directors',    editPath: '/lists/directors',    type: 'person' },
  { listKey: 'horrorList',   label: 'My Horror List',  editPath: '/lists/horror',       type: 'movie' },
  { listKey: 'comediesList', label: 'My Comedies',     editPath: '/lists/comedies',     type: 'movie' },
  { listKey: 'animatedList', label: 'My Animated',     editPath: '/lists/animated',     type: 'movie' },
  { listKey: 'showsList',    label: 'My Shows',        editPath: '/lists/shows',        type: 'show' },
  { listKey: 'seasonalList', label: 'My Seasonal Picks', editPath: '/lists/seasonal',   type: 'movie' },
]

export default function Universe() {
  const ctx = useFilm()

  const filledSections = SECTION_CONFIG.filter(({ listKey }) => {
    const list = ctx[listKey]
    return list && list.length > 0
  })

  const hasAnything = filledSections.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.heroSection}>
        <div className="container">
          <h1 className={styles.heroTitle}>My Universe</h1>
          <p className={styles.heroSubtitle}>
            Every list, every ranking — your complete film identity.
          </p>
        </div>
      </div>

      {hasAnything ? (
        <div className={styles.sections}>
          {filledSections.map(({ listKey, label, editPath, type }) => (
            <UniverseSection
              key={listKey}
              title={label}
              items={ctx[listKey]}
              editPath={editPath}
              type={type}
            />
          ))}
        </div>
      ) : (
        <div className="container">
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◎</div>
            <h2 className={styles.emptyTitle}>Your universe is waiting</h2>
            <p className={styles.emptyDesc}>
              Start building your lists and they'll appear here — one big picture of your taste.
            </p>
            <div className={styles.emptyLinks}>
              <Link to="/my-list" className={styles.emptyLink}>Build My List →</Link>
              <Link to="/explore" className={styles.emptyLink}>Explore Films →</Link>
              <Link to="/lists/actors" className={styles.emptyLink}>Add Actors →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
