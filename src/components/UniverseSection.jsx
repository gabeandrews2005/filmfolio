import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { PLACEHOLDER_POSTER, getProfileUrl } from '../api/tmdb'
import styles from './UniverseSection.module.css'

export default function UniverseSection({ title, items, editPath, type = 'movie' }) {
  const stripRef = useRef(null)

  if (!items || items.length === 0) return null

  // Lets a plain vertical mouse wheel scroll the horizontal strip — without
  // this, hovering a row and scrolling just scrolls the page past it. Only
  // hijacks the wheel event while the strip still has room to move in that
  // direction, so scrolling past either end falls through to the page.
  function handleWheel(e) {
    const el = stripRef.current
    if (!el || e.deltaY === 0) return
    const atStart = el.scrollLeft <= 0
    const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1
    if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return
    el.scrollLeft += e.deltaY
    e.preventDefault()
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {editPath && (
          <Link to={editPath} className={styles.editLink}>
            Edit →
          </Link>
        )}
      </div>

      <div className={styles.strip} ref={stripRef} onWheel={handleWheel}>
        {items.map((item, i) => {
          const id = item.tmdb_id ?? item.person_id ?? i
          const imgUrl = item.posterUrl
            ?? (item.headshot_path ? getProfileUrl(item.headshot_path) : null)
            ?? PLACEHOLDER_POSTER
          const label = item.title ?? item.name ?? ''
          const year = item.year ?? ''

          return (
            <div key={id} className={styles.card}>
              <div className={styles.posterWrap}>
                <img
                  src={imgUrl}
                  alt={label}
                  className={styles.poster}
                  loading="lazy"
                  onError={(e) => { e.target.src = PLACEHOLDER_POSTER }}
                />
                <span className={styles.rank}>#{i + 1}</span>
              </div>
              <div className={styles.info}>
                <span className={styles.cardTitle}>{label}</span>
                {year && <span className={styles.cardYear}>{year}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
