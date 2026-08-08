import { useState, useEffect } from 'react'
import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER } from '../api/tmdb'
import useOmdbRatings from '../hooks/useOmdbRatings'
import StarSignal from './StarSignal'
import RatingDisplay from './RatingDisplay'
import RankPickerModal from './RankPickerModal'
import styles from './FilmCard.module.css'

const SEPARATE_LISTS = [
  { key: 'horrorList',   label: 'Horror',   max: 50 },
  { key: 'comediesList', label: 'Comedies', max: 50 },
  { key: 'animatedList', label: 'Animated', max: 50 },
  { key: 'seasonalList', label: 'Seasonal', max: 25 },
]

function FilmModal({ movie, actorMatches, directorMatches, onClose, showAddToList, ratings, filmFolioPick }) {
  const {
    seenList, toggleSeen, myList, quickList, addToList, removeFromList, insertAtRank,
    watchlist, addToWatchlist, removeFromWatchlist,
    horrorList, comediesList, animatedList, seasonalList,
  } = useFilm()
  const isSeen = seenList.has(movie.tmdb_id)
  const inList = myList.some((m) => m.tmdb_id === movie.tmdb_id)
  const listFull = myList.length >= 100
  const inQuickList = quickList.some((m) => m.tmdb_id === movie.tmdb_id)
  const quickListFull = quickList.length >= 10
  const inWatchlist = watchlist.some((m) => m.tmdb_id === movie.tmdb_id)
  const [showSeparateBar, setShowSeparateBar] = useState(false)
  // Full lists never block adding outright — once full, the "+" buttons
  // below open this instead, letting the user pick a rank to slot the film
  // into (bumping everything at and below that rank down a spot).
  const [rankPicker, setRankPicker] = useState(null) // { listKey, max, label }

  const separateListData = { horrorList, comediesList, animatedList, seasonalList }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleMyList(e) {
    e.stopPropagation()
    if (inList) { removeFromList('myList', movie.tmdb_id); return }
    if (listFull) { setRankPicker({ listKey: 'myList', max: 100, label: 'My List' }); return }
    addToList('myList', movie)
  }

  function handleWatchlist(e) {
    e.stopPropagation()
    if (inWatchlist) removeFromWatchlist(movie.tmdb_id)
    else addToWatchlist(movie)
  }

  function handleQuickList(e) {
    e.stopPropagation()
    if (inQuickList) { removeFromList('quickList', movie.tmdb_id); return }
    if (quickListFull) { setRankPicker({ listKey: 'quickList', max: 10, label: 'Quick List' }); return }
    addToList('quickList', movie)
  }

  function handleSeparateListToggle(e, key, max, label) {
    e.stopPropagation()
    const list = separateListData[key]
    const inThatList = list.some((m) => m.tmdb_id === movie.tmdb_id)
    if (inThatList) { removeFromList(key, movie.tmdb_id); return }
    if (list.length >= max) { setRankPicker({ listKey: key, max, label }); return }
    addToList(key, movie)
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
            {(isSeen || filmFolioPick) && (
              <div className={styles.modalBadges}>
                {isSeen && <span className={styles.seenBadgeLg}>✓ Seen</span>}
                {filmFolioPick && <span className={styles.pickBadgeLg}>★ FilmFolio Pick!</span>}
              </div>
            )}

            <h2 className={styles.modalTitle}>{movie.title}</h2>

            <div className={styles.modalMeta}>
              {movie.year && <span>{movie.year}</span>}
              {movie.director && <span>Dir. {movie.director}</span>}
              {movie.runtime && <span>{movie.runtime}m</span>}
            </div>

            <RatingDisplay
              rtScore={ratings?.rtScore}
              imdbRating={ratings?.imdbRating}
              tmdbScore={movie.vote_average}
            />

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
                onClick={(e) => { e.stopPropagation(); toggleSeen(movie) }}
              >
                {isSeen ? '✓ Seen It' : '○ Mark as Seen'}
              </button>

              {showAddToList && (
                <button
                  className={`${styles.top10Btn} ${inList ? styles.inTop10 : ''}`}
                  onClick={handleMyList}
                  title={!inList && listFull ? 'Your list is full (100/100) — choose a rank to slot it in' : undefined}
                >
                  {inList ? '✓ In My List' : '+ My List'}
                </button>
              )}

              <button
                className={`${styles.watchlistBtn} ${inWatchlist ? styles.inWatchlist : ''}`}
                onClick={handleWatchlist}
              >
                {inWatchlist ? '✓ In Watchlist' : '+ Watchlist'}
              </button>

              <button
                className={`${styles.separateListBtn} ${showSeparateBar ? styles.separateListBtnOpen : ''}`}
                onClick={(e) => { e.stopPropagation(); setShowSeparateBar((v) => !v) }}
              >
                + Separate List
              </button>

              <button
                className={`${styles.quickListBtn} ${inQuickList ? styles.inQuickList : ''}`}
                onClick={handleQuickList}
                title={!inQuickList && quickListFull ? 'Quick List is full (10/10) — choose a rank to slot it in' : undefined}
              >
                {inQuickList ? '✓ Quick List' : '+ Quick List'}
              </button>
            </div>

            {showSeparateBar && (
              <div className={styles.separateListBar}>
                {SEPARATE_LISTS.map(({ key, label, max }) => {
                  const list = separateListData[key]
                  const inThatList = list.some((m) => m.tmdb_id === movie.tmdb_id)
                  const full = list.length >= max
                  return (
                    <button
                      key={key}
                      className={`${styles.separateListOption} ${inThatList ? styles.inSeparateList : ''}`}
                      onClick={(e) => handleSeparateListToggle(e, key, max, label)}
                      title={!inThatList && full ? `${label} list is full (${max}/${max}) — choose a rank to slot it in` : undefined}
                    >
                      {inThatList ? `✓ ${label}` : `+ ${label}`}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {rankPicker && (
        <RankPickerModal
          itemName={movie.title}
          maxRank={rankPicker.max}
          description={
            <>Your {rankPicker.label ?? 'list'} is full. Pick a rank for <strong>{movie.title}</strong> — whatever's
            there (and everything below it) shifts down a spot, and the last one drops off the list.</>
          }
          onSubmit={(rank) => {
            insertAtRank(rankPicker.listKey, movie, rank)
            setRankPicker(null)
          }}
          onCancel={() => setRankPicker(null)}
        />
      )}
    </div>
  )
}

export default function FilmCard({
  movie,
  rankBadge = null,
  showAddToList = true,
  actorMatches = [],
  directorMatches = [],
  filmFolioPick = false,
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const { seenList } = useFilm()
  const isSeen = seenList.has(movie.tmdb_id)
  const hasSignal = actorMatches.length > 0 || directorMatches.length > 0
  const { ratings } = useOmdbRatings(movie.tmdb_id)

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
              <RatingDisplay
                compact
                rtScore={ratings?.rtScore}
                imdbRating={ratings?.imdbRating}
                tmdbScore={movie.vote_average}
              />
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
          {rankBadge !== null && (
            <span className={styles.rankBadge}>#{rankBadge}</span>
          )}
          {isSeen && (
            <span className={styles.seenBadge}>✓</span>
          )}
          {hasSignal && (
            <StarSignal actors={actorMatches} directors={directorMatches} compact />
          )}
          {!hasSignal && filmFolioPick && (
            <span className={styles.pickBadge} title="FilmFolio Pick! — recommended by the algorithm, now on one of your lists">★</span>
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
          actorMatches={actorMatches}
          directorMatches={directorMatches}
          onClose={() => setModalOpen(false)}
          showAddToList={showAddToList}
          ratings={ratings}
          filmFolioPick={filmFolioPick}
        />
      )}
    </>
  )
}
