import { useFilm } from '../context/FilmContext'
import styles from './ProgressTracker.module.css'

export default function ProgressTracker() {
  const { seenList, movies } = useFilm()
  const total = movies.length
  const seen = seenList.size
  const pct = total > 0 ? (seen / total) * 100 : 0

  return (
    <div className={styles.tracker}>
      <div className={styles.text}>
        <span className={styles.count}>
          <span className={styles.seen}>{seen}</span>
          <span className={styles.divider}> of </span>
          <span className={styles.total}>{total}</span>
        </span>
        <span className={styles.label}> films seen</span>
      </div>
      <div className={styles.barWrap}>
        <div className={styles.bar} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.pct}>{Math.round(pct)}%</span>
    </div>
  )
}
