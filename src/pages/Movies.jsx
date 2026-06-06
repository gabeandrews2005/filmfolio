import { useState, useMemo } from 'react'
import { useFilm } from '../context/FilmContext'
import MovieGrid from '../components/MovieGrid'
import FilterBar from '../components/FilterBar'
import ProgressTracker from '../components/ProgressTracker'
import styles from './Movies.module.css'

const DEFAULT_FILTERS = {
  genre: '',
  director: '',
  decade: '',
  seen: 'all',
  sort: 'rank',
}

export default function Movies() {
  const { movies, seenList, loading } = useFilm()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const filtered = useMemo(() => {
    let list = [...movies]

    if (filters.genre)    list = list.filter((m) => m.genres?.includes(filters.genre))
    if (filters.director) list = list.filter((m) => m.director === filters.director)
    if (filters.decade)   list = list.filter((m) => Math.floor(m.year / 10) * 10 === Number(filters.decade))
    if (filters.seen === 'seen')   list = list.filter((m) => seenList.has(m.tmdb_id))
    if (filters.seen === 'unseen') list = list.filter((m) => !seenList.has(m.tmdb_id))

    switch (filters.sort) {
      case 'year':   list.sort((a, b) => b.year - a.year); break
      case 'rating': list.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0)); break
      case 'title':  list.sort((a, b) => a.title.localeCompare(b.title)); break
      default:       list.sort((a, b) => a.rank - b.rank)
    }

    return list
  }, [movies, filters, seenList])

  return (
    <div className={styles.page}>
      <ProgressTracker />

      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Top 100 Films</h1>
          {loading && <span className={styles.loading}>Fetching posters…</span>}
          <span className={styles.count}>{filtered.length} films</span>
        </div>

        <FilterBar
          movies={movies}
          seenList={seenList}
          filters={filters}
          setFilters={setFilters}
        />

        <MovieGrid movies={filtered} showAddToTop10 />
      </div>
    </div>
  )
}
