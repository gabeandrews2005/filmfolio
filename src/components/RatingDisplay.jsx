import styles from './RatingDisplay.module.css'

export default function RatingDisplay({ rtScore, imdbRating, tmdbScore, compact = false }) {
  if (!rtScore && !imdbRating && !tmdbScore) return null;

  if (compact) {
    return (
      <span className={styles.compact}>
        {rtScore != null ? (
          <span className={styles.rt}>🍅 {rtScore}%</span>
        ) : tmdbScore != null ? (
          <span className={styles.tmdb}>★ {Number(tmdbScore).toFixed(1)}</span>
        ) : null}
        {imdbRating && <span className={styles.imdb}>IMDb {imdbRating}</span>}
      </span>
    )
  }

  return (
    <div className={styles.ratings}>
      {rtScore != null ? (
        <span className={styles.rt}>🍅 {rtScore}%</span>
      ) : tmdbScore != null ? (
        <span className={styles.tmdb}>★ {Number(tmdbScore).toFixed(1)} TMDB</span>
      ) : null}
      {imdbRating && <span className={styles.imdb}>IMDb {imdbRating}</span>}
    </div>
  )
}
