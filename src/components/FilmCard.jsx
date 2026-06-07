import { useState, useEffect } from 'react'
import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER } from '../api/tmdb'
import StarSignal from './StarSignal'
import styles from './FilmCard.module.css'

function FilmModal({ movie, isFeatured, actorMatches, directorMatches, onClose, showAddToList }) {
  const { seenList, toggleSeen, myTop10, addToTop10, removeFromTop10 } = useFilm()
  const isSeen = seenList.has(movie.tmdb_id)
  const inTop10 = myTop10.some((m) => m.tmdb_id === movie.tmdb_id)
  const top10Full = myTop10.length >= 10

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleTop10(e) {
    e.stopPropagation()
    if (inTop10) removeFromTop10(movie.tmdb_id)
    else if (!top10Full) addToTop10(movie)
  }

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdrop}>
      <div className={styles.modal}>
        <button className={styles.modalClose} onClick={onClose} aria-label="Close">×</button>

        <div className={styles.modalContent}>
          <div className={styles.modalPosterCol}>
            <img
              src={movie.posterUrl || PLACEHOLDER_POSTER}
              alt={movie.title}
              className={styles.modalPoster}
            />
          </div>

          <div className={styles.modalInfoCol}>
            <div className={styles.modalBadges}>
              {isFeatured && (
                <span className={styles.featuredBadgeLg}>★ Gabe's Pick</span>
              )}
              {isSeen && (
                <span className={styles.seenBadgeLg}>✓ Seen</span>
              )}
            </div>

            <h2 className={styles.modalTitle}>{movie.title}</h2>

            <div className={styles.modalMeta}>
              {movie.year && <span>{movie.year}</span>}
              {movie.director && <span>Dir. {movie.director}</span>}
              {movie.runtime && <span>{movie.runtime}m</span>}
              {movie.vote_average && (
                <span className={styles.modalRating}>★ {movie.vote_average.toFixed(1)}</span>
              )}
            </div>

            <StarSignal actors={actorMatches} directors={directorMatches} />

            {movie.overview && (
              <p className={styles.modalOverview}>{movie.overview}</p>
            )}

            {movie.cast && movie.cast.length > 0 && (
              <p className={styles.modalCast}>
                <span className={styles.castLabel}>Cast: </span>
                {movie.cast.join(', ')}
              </p>
            )}

            <div className={styles.modalActions}>
              <button
                className={`${styles.seenBtn} ${isSeen ? styles.seenActive : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleSeen(movie.tmdb_id) }}
              >
                {isSeen ? '✓ Seen It' : '○ Mark as Seen'}
              </button>

              {showAddToList && (
                <button
                  className={`${styles.top10Btn} ${inTop10 ? styles.inTop10 : ''} ${!inTop10 && top10Full ? styles.btnDisabled : ''}`}
                  onClick={handleTop10}
                  disabled={!inTop10 && top10Full}
                >
                  {inTop10 ? '✓ In My Top 10' : top10Full ? 'List Full' : '+ My Top 10'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FilmCard({
  movie,
  isFeatured = false,
  rankBadge = null,
  showAddToList = true,
  actorMatches = [],
  directorMatches = [],
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const { seenList } = useFilm()
  const isSeen = seenList.has(movie.tmdb_id)
  const hasSignal = actorMatches.length > 0 || directorMatches.length > 0

  return (
    <>
      <div
        className={`${styles.card} ${isSeen ? styles.cardSeen : ''}`}
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setModalOpen(true) }}
        aria-label={`${movie.title} — click for details`}
      >
        <div className={styles.posterWrap}>
          <img
            src={movie.posterUrl || PLACEHOLDER_POSTER}
            alt={movie.title}
            className={styles.poster}
            loading="lazy"
          />

          {/* Hover overlay */}
          <div className={styles.overlay}>
            <div className={styles.overlayContent}>
              {movie.vote_average && (
                <span className={styles.overlayRating}>★ {movie.vote_average.toFixed(1)}</span>
              )}
              {movie.director && (
                <span className={styles.overlayDirector}>{movie.director}</span>
              )}
              {movie.overview && (
                <p className={styles.overlayOverview}>
                  {movie.overview.slice(0, 120)}{movie.overview.length > 120 ? '…' : ''}
                </p>
              )}
              <span className={styles.overlayTap}>Tap for details</span>
            </div>
          </div>

          {/* Badges */}
          {isFeatured && (
            <span className={styles.featuredBadge}>★</span>
          )}
          {rankBadge !== null && (
            <span className={styles.rankBadge}>#{rankBadge}</span>
          )}
          {isSeen && (
            <span className={styles.seenBadge}>✓</span>
          )}
          {hasSignal && (
            <StarSignal actors={actorMatches} directors={directorMatches} compact />
          )}
        </div>

        <div className={styles.info}>
          <h3 className={styles.title}>{movie.title}</h3>
          <span className={styles.year}>{movie.year}</span>
        </div>
      </div>

      {modalOpen && (
        <FilmModal
          movie={movie}
          isFeatured={isFeatured}
          actorMatches={actorMatches}
          directorMatches={directorMatches}
          onClose={() => setModalOpen(false)}
          showAddToList={showAddToList}
        />
      )}
    </>
  )
}
