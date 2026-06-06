import MovieCard from './MovieCard'
import styles from './MovieGrid.module.css'

export default function MovieGrid({ movies, showAddToTop10 = false }) {
  if (movies.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No films match your filters.</p>
      </div>
    )
  }

  return (
    <div className={styles.grid}>
      {movies.map((movie) => (
        <MovieCard key={movie.rank} movie={movie} showAddToTop10={showAddToTop10} />
      ))}
    </div>
  )
}
