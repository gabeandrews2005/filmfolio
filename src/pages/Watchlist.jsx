import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER } from '../api/tmdb'
import useOmdbRatings from '../hooks/useOmdbRatings'
import RatingDisplay from '../components/RatingDisplay'
import styles from './Watchlist.module.css'

function WatchlistCard({ movie, seen, onToggleSeen, onRemove }) {
  const { ratings } = useOmdbRatings(movie.tmdb_id)

  return (
    <div className={`${styles.card} ${seen ? styles.seen : ''}`}>
      <div className={styles.posterWrap}>
        <img
          src={movie.posterUrl || PLACEHOLDER_POSTER}
          alt={movie.title}
          className={styles.poster}
          loading="lazy"
        />
        {seen && <div className={styles.seenOverlay}>✓ Seen</div>}
      </div>
      <div className={styles.info}>
        <span className={styles.filmTitle}>{movie.title}</span>
        <span className={styles.filmYear}>{movie.year}</span>
        <RatingDisplay
          compact
          rtScore={ratings?.rtScore}
          imdbRating={ratings?.imdbRating}
          tmdbScore={movie.vote_average}
        />
      </div>
      <div className={styles.actions}>
        <button
          className={`${styles.seenBtn} ${seen ? styles.seenBtnActive : ''}`}
          onClick={onToggleSeen}
        >
          {seen ? '✓ Seen' : 'Mark Seen'}
        </button>
        <button
          className={styles.removeBtn}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

export default function Watchlist() {
  const { watchlist, removeFromWatchlist, toggleSeen, seenList } = useFilm()

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
              <WatchlistCard
                key={movie.tmdb_id}
                movie={movie}
                seen={seenList.has(movie.tmdb_id)}
                onToggleSeen={() => toggleSeen(movie.tmdb_id)}
                onRemove={() => removeFromWatchlist(movie.tmdb_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
