import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import FilmCard from '../components/FilmCard'
import styles from './Watchlist.module.css'

export default function Watchlist() {
  const { watchlist } = useFilm()

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Watchlist</h1>
          <span className={styles.count}>{watchlist.length} films</span>
        </div>

        {watchlist.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Save films to your watchlist and they'll appear here.
            </p>
            <Link to="/explore" className={styles.exploreLink}>Explore Films →</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {watchlist.map((movie) => (
              <FilmCard key={movie.tmdb_id} movie={movie} showAddToList />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
