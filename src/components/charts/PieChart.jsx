import styles from './PieChart.module.css'

// Steps through lightness of the single accent-gold hue rather than a
// rainbow categorical palette — keeps multi-segment charts inside the same
// monochrome-gold-on-dark system as the rest of the app instead of
// introducing unrelated hues.
function goldShade(i, total) {
  const lightness = 68 - (i / Math.max(total - 1, 1)) * 42
  return `hsl(42, 48%, ${lightness}%)`
}

// CSS conic-gradient — no arc-path trig, no SVG, just cumulative
// percentages. This app has no charting library and every other visual
// flourish is hand-rolled to match; conic-gradient gets a pie chart with a
// couple lines of math instead of hand-computed SVG arc paths.
export default function PieChart({ data }) {
  if (!data || data.length === 0) return null
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null

  let cumulative = 0
  const segments = data.map((d, i) => {
    const pct = (d.value / total) * 100
    const start = cumulative
    cumulative += pct
    return { ...d, pct, start, end: cumulative, color: d.color ?? goldShade(i, data.length) }
  })

  const gradient = segments.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(', ')

  return (
    <div className={styles.wrap}>
      <div className={styles.pie} style={{ background: `conic-gradient(${gradient})` }} />
      <div className={styles.legend}>
        {segments.map((s) => (
          <div key={s.label} className={styles.legendRow}>
            <span className={styles.swatch} style={{ background: s.color }} />
            <span className={styles.legendLabel}>{s.label}</span>
            <span className={styles.legendCount}>{s.value} ({Math.round(s.pct)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
