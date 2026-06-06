import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER } from '../api/tmdb'
import styles from './RecommendationCard.module.css'

export default function RecommendationCard({ movie, onNotInterested }) {
  const { watchlist, addToWatchlist, removeFromWatchlist } = useFilm()
  const inWatchlist = watchlist.some((m) => m.tmdb_id === movie.tmdb_id)

  function handleWatchlist() {
    if (inWatchlist) removeFromWatchlist(movie.tmdb_id)
    else addToWatchlist(movie)
  }

  const maxScore = 10
  const barWidth = Math.min((movie.score / maxScore) * 100, 100)

  return (
    <div className={styles.card}>
      <img
        src={movie.posterUrl || PLACEHOLDER_POSTER}
        alt={movie.title}
        className={styles.poster}
        loading="lazy"
      />
      <div className={styles.body}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>{movie.title}</h3>
            <span className={styles.year}>{movie.year}</span>
          </div>
          {movie.vote_average && (
            <span className={styles.rating}>★ {movie.vote_average.toFixed(1)}</span>
          )}
        </div>

        {movie.overview && (
          <p className={styles.overview}>{movie.overview}</p>
        )}

        <div className={styles.score}>
          <span className={styles.scoreLabel}>Match strength</span>
          <div className={styles.scoreBar}>
            <div className={styles.scoreFill} style={{ width: `${barWidth}%` }} />
          </div>
          <span className={styles.scoreNum}>{movie.score}×</span>
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.watchlistBtn} ${inWatchlist ? styles.inList : ''}`}
            onClick={handleWatchlist}
          >
            {inWatchlist ? '✓ Watchlisted' : '+ Watchlist'}
          </button>
          <button className={styles.notInterestedBtn} onClick={() => onNotInterested(movie.tmdb_id)}>
            Not Interested
          </button>
        </div>
      </div>
    </div>
  )
}
