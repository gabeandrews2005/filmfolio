import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER } from '../api/tmdb'
import styles from './MovieCard.module.css'

export default function MovieCard({ movie, showAddToTop10 = false }) {
  const { seenList, toggleSeen, myTop10, addToTop10, removeFromTop10 } = useFilm()
  const isSeen = seenList.has(movie.tmdb_id)
  const inTop10 = myTop10.some((m) => m.tmdb_id === movie.tmdb_id)
  const top10Full = myTop10.length >= 10

  function handleTop10Click(e) {
    e.stopPropagation()
    if (inTop10) removeFromTop10(movie.tmdb_id)
    else if (!top10Full) addToTop10(movie)
  }

  function handleSeenClick(e) {
    e.stopPropagation()
    toggleSeen(movie.tmdb_id)
  }

  return (
    <div className={`${styles.card} ${isSeen ? styles.seen : ''}`}>
      <div className={styles.posterWrap}>
        <img
          src={movie.posterUrl || PLACEHOLDER_POSTER}
          alt={movie.title}
          className={styles.poster}
          loading="lazy"
        />
        <div className={styles.overlay}>
          <div className={styles.overlayContent}>
            {movie.vote_average && (
              <span className={styles.rating}>
                ★ {movie.vote_average.toFixed(1)}
              </span>
            )}
            {movie.overview && (
              <p className={styles.overview}>{movie.overview}</p>
            )}
            <div className={styles.meta}>
              <span className={styles.director}>{movie.director}</span>
              {movie.runtime && (
                <span className={styles.runtime}>{movie.runtime}m</span>
              )}
            </div>
            <div className={styles.actions}>
              <label className={styles.seenLabel} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSeen}
                  onChange={handleSeenClick}
                  className={styles.seenCheck}
                />
                Seen it
              </label>
              {showAddToTop10 && (
                <button
                  className={`${styles.top10Btn} ${inTop10 ? styles.inTop10 : ''} ${!inTop10 && top10Full ? styles.disabled : ''}`}
                  onClick={handleTop10Click}
                  disabled={!inTop10 && top10Full}
                >
                  {inTop10 ? '✓ In My Top 10' : top10Full ? 'List Full' : '+ Top 10'}
                </button>
              )}
            </div>
          </div>
        </div>
        <span className={styles.rank}>#{movie.rank}</span>
        {isSeen && <span className={styles.seenBadge}>✓</span>}
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{movie.title}</h3>
        <span className={styles.year}>{movie.year}</span>
      </div>
    </div>
  )
}
