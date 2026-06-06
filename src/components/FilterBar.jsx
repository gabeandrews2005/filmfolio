import { useMemo } from 'react'
import styles from './FilterBar.module.css'

const SORT_OPTIONS = [
  { value: 'rank',    label: 'Rank' },
  { value: 'year',    label: 'Year' },
  { value: 'rating',  label: 'Rating' },
  { value: 'title',   label: 'Title' },
]

const SEEN_OPTIONS = [
  { value: 'all',    label: 'All Films' },
  { value: 'seen',   label: 'Seen' },
  { value: 'unseen', label: 'Unseen' },
]

export default function FilterBar({ movies, seenList, filters, setFilters }) {
  const allGenres = useMemo(() => {
    const s = new Set()
    movies.forEach((m) => m.genres?.forEach((g) => s.add(g)))
    return [...s].sort()
  }, [movies])

  const allDirectors = useMemo(() => {
    const s = new Set()
    movies.forEach((m) => m.director && s.add(m.director))
    return [...s].sort()
  }, [movies])

  const allDecades = useMemo(() => {
    const s = new Set()
    movies.forEach((m) => s.add(Math.floor(m.year / 10) * 10))
    return [...s].sort()
  }, [movies])

  function update(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className={styles.bar}>
      <div className={styles.filters}>
        <select
          className={styles.select}
          value={filters.genre}
          onChange={(e) => update('genre', e.target.value)}
        >
          <option value="">All Genres</option>
          {allGenres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <select
          className={styles.select}
          value={filters.director}
          onChange={(e) => update('director', e.target.value)}
        >
          <option value="">All Directors</option>
          {allDirectors.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          className={styles.select}
          value={filters.decade}
          onChange={(e) => update('decade', e.target.value)}
        >
          <option value="">All Decades</option>
          {allDecades.map((d) => (
            <option key={d} value={d}>{d}s</option>
          ))}
        </select>

        <select
          className={styles.select}
          value={filters.seen}
          onChange={(e) => update('seen', e.target.value)}
        >
          {SEEN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.sort}>
        <span className={styles.sortLabel}>Sort:</span>
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            className={`${styles.sortBtn} ${filters.sort === o.value ? styles.active : ''}`}
            onClick={() => update('sort', o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
