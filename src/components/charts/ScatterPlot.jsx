import styles from './ScatterPlot.module.css'

const VIEW_W = 400
const VIEW_H = 240
const PAD = 36

// Plain inline SVG — normalizes each point against the data's own min/max
// (with a little padding so nothing sits exactly on the edge), no charting
// library. A native <title> per point gives a free hover tooltip. Generic
// over x/y — reused for both "rating vs release year" and "rank vs rating"
// by the caller, this component has no idea which is which.
export default function ScatterPlot({ data, xLabel, yLabel, xFormat, yFormat }) {
  if (!data || data.length === 0) return null

  const xs = data.map((d) => d.x)
  const ys = data.map((d) => d.y)
  let xMin = Math.min(...xs)
  let xMax = Math.max(...xs)
  let yMin = Math.min(...ys)
  let yMax = Math.max(...ys)

  // Guard a zero-range axis (every point shares one x or y value)
  if (xMin === xMax) { xMin -= 1; xMax += 1 }
  if (yMin === yMax) { yMin -= 1; yMax += 1 }
  const xPad = (xMax - xMin) * 0.05
  const yPad = (yMax - yMin) * 0.05
  xMin -= xPad; xMax += xPad
  yMin -= yPad; yMax += yPad

  const plotW = VIEW_W - PAD * 2
  const plotH = VIEW_H - PAD * 2
  const toX = (x) => PAD + ((x - xMin) / (xMax - xMin)) * plotW
  const toY = (y) => VIEW_H - PAD - ((y - yMin) / (yMax - yMin)) * plotH

  const fmtX = xFormat ?? ((v) => Math.round(v))
  const fmtY = yFormat ?? ((v) => Math.round(v * 10) / 10)

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.svg} preserveAspectRatio="xMidYMid meet">
        <line x1={PAD} y1={VIEW_H - PAD} x2={VIEW_W - PAD} y2={VIEW_H - PAD} className={styles.axisLine} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={VIEW_H - PAD} className={styles.axisLine} />

        <text x={PAD} y={VIEW_H - PAD + 16} className={styles.axisLabel}>{fmtX(xMin + xPad)}</text>
        <text x={VIEW_W - PAD} y={VIEW_H - PAD + 16} textAnchor="end" className={styles.axisLabel}>{fmtX(xMax - xPad)}</text>
        <text x={PAD - 6} y={VIEW_H - PAD} textAnchor="end" className={styles.axisLabel}>{fmtY(yMin + yPad)}</text>
        <text x={PAD - 6} y={PAD + 4} textAnchor="end" className={styles.axisLabel}>{fmtY(yMax - yPad)}</text>

        {data.map((d, i) => (
          <circle key={i} cx={toX(d.x)} cy={toY(d.y)} r={4} className={styles.point}>
            <title>{d.label ? `${d.label} — ` : ''}{xLabel}: {fmtX(d.x)}, {yLabel}: {fmtY(d.y)}</title>
          </circle>
        ))}
      </svg>
      <div className={styles.axisNames}>
        <span>{xLabel} →</span>
        <span>↑ {yLabel}</span>
      </div>
    </div>
  )
}
