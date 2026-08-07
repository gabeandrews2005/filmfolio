import { useMemo } from 'react'
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

  // Randomized once per mount so stars don't jitter to new positions on re-render.
  const stars = useMemo(() => Array.from({ length: 140 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 1 + Math.random() * 2.2,
    duration: 2 + Math.random() * 4,
    delay: -(Math.random() * 6),
  })), [])

  // A denser, brighter cluster of stars scattered within the galaxy's disc,
  // on top of the ambient field, to sell the "star-dense spiral arms" look.
  const galaxyClusterStars = useMemo(() => Array.from({ length: 45 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * 46
    return {
      id: i,
      left: 78 + Math.cos(angle) * radius * 0.9,
      top: 22 + Math.sin(angle) * radius * 0.45,
      size: 1 + Math.random() * 2,
      duration: 2 + Math.random() * 4,
      delay: -(Math.random() * 6),
    }
  }), [])

  // Shooting stars — long total cycle, only visibly streaking across a
  // short window of it, staggered so they don't all fire in sync.
  const shootingStars = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    id: i,
    top: Math.random() * 55,
    left: Math.random() * 55,
    angle: 18 + Math.random() * 24,
    duration: 5 + Math.random() * 6,
    delay: -(Math.random() * 16),
  })), [])

  return (
    <div className={styles.page}>
      <div className={styles.galaxyScene} aria-hidden="true">
        <div className={styles.nebula1} />
        <div className={styles.nebula2} />
        <div className={styles.nebula3} />

        <div className={styles.galaxy}>
          <div className={styles.galaxyArms} />
          <div className={styles.galaxyCore} />
        </div>

        {stars.map((s) => (
          <span
            key={s.id}
            className={styles.star}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}

        {galaxyClusterStars.map((s) => (
          <span
            key={`cluster-${s.id}`}
            className={styles.star}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}

        {shootingStars.map((s) => (
          <span
            key={`shoot-${s.id}`}
            className={styles.shootingStar}
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              '--angle': `${s.angle}deg`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>

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
