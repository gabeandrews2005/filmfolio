import styles from './StarSignal.module.css'

export default function StarSignal({ actors = [], directors = [], compact = false }) {
  if (actors.length === 0 && directors.length === 0) return null

  const label = [
    ...directors.map((d) => `Directed by ${d}`),
    ...actors.map((a) => `Features ${a}`),
  ].join(' · ')

  if (compact) {
    return (
      <span className={styles.compact} title={label}>
        ★
      </span>
    )
  }

  return (
    <div className={styles.signal}>
      <span className={styles.star}>★</span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
