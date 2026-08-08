import styles from './Histogram.module.css'

// Generalizes Statistics.jsx's original GenreBar (a <div> whose width is set
// as an inline % — no SVG/canvas, matches this app's zero-charting-library
// convention) into a reusable bar chart for any {label, value} series.
export default function Histogram({ data, formatValue }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className={styles.bars}>
      {data.map(({ label, value }) => (
        <div key={label} className={styles.barRow}>
          <span className={styles.barLabel}>{label}</span>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${Math.round((value / max) * 100)}%` }} />
          </div>
          <span className={styles.barCount}>{formatValue ? formatValue(value) : value}</span>
        </div>
      ))}
    </div>
  )
}
