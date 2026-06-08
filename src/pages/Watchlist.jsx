import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER } from '../api/tmdb'
import styles from './Watchlist.module.css'

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
            {watchlist.map((movie) => {
              const seen = seenList.has(movie.tmdb_id)
              return (
                <div key={movie.tmdb_id} className={`${styles.card} ${seen ? styles.seen : ''}`}>
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
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={`${styles.seenBtn} ${seen ? styles.seenBtnActive : ''}`}
                      onClick={() => toggleSeen(movie.tmdb_id)}
                    >
                      {seen ? '✓ Seen' : 'Mark Seen'}
                    </button>
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeFromWatchlist(movie.tmdb_id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
