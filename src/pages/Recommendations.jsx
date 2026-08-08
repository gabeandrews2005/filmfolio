import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { buildThemeRecommendations, getMovieExternalIds, safeSetItem } from '../api/tmdb'
import { getOmdbRatings } from '../api/omdb'
import RatingDisplay from '../components/RatingDisplay'
import styles from './Recommendations.module.css'
import filmCardStyles from '../components/FilmCard.module.css'

const RESULTS_CAP = 60
const LS_REC_FILTERS = 'ff_rec_filters'

function loadRecFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_REC_FILTERS) || '{}')
    return { actors: !!saved.actors, directors: !!saved.directors, genre: saved.genre ?? null, quickList: !!saved.quickList }
  } catch {
    return { actors: false, directors: false, genre: null, quickList: false }
  }
}

function RecModal({ movie, onClose, onNotInterested, onSeen, onWatchlist }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  const hasPersonMatch = movie.bonusActors?.length > 0 || movie.bonusDirectors?.length > 0
  const hasWhy = movie.matchedThemes?.length > 0 || movie.sourceMovies?.length > 0 || hasPersonMatch

  return (
    <div className={filmCardStyles.modalBackdrop} onClick={handleBackdrop}>
      <div className={filmCardStyles.modal}>
        <button className={filmCardStyles.modalClose} onClick={onClose} aria-label="Close">×</button>

        <div className={filmCardStyles.modalContent}>
          <div className={filmCardStyles.modalPosterCol}>
            <img src={movie.posterUrl} alt={movie.title} className={filmCardStyles.modalPoster} />
          </div>

          <div className={filmCardStyles.modalInfoCol}>
            <h2 className={filmCardStyles.modalTitle}>{movie.title}</h2>

            <div className={filmCardStyles.modalMeta}>
              {movie.year && <span>{movie.year}</span>}
              {movie.vote_average > 0 && (
                <span className={filmCardStyles.modalRating}>★ {movie.vote_average.toFixed(1)}</span>
              )}
            </div>

            {movie.overview && (
              <p className={filmCardStyles.modalOverview}>{movie.overview}</p>
            )}

            {hasWhy && (
              <div className={styles.whySection}>
                <h3 className={styles.whyTitle}>Why we picked this</h3>
                {movie.matchedThemes?.length > 0 && (
                  <div className={styles.themeChips}>
                    {movie.matchedThemes.map((theme) => (
                      <span key={theme} className={styles.themeChip}>{theme}</span>
                    ))}
                  </div>
                )}
                {movie.sourceMovies?.length > 0 && (
                  <p className={styles.whySources}>
                    Sparked by <strong>{movie.sourceMovies.join(', ')}</strong> on your list.
                  </p>
                )}
                {movie.bonusActors?.length > 0 && (
                  <p className={styles.whySources}>
                    ★ Stars <strong>{movie.bonusActors.join(', ')}</strong> from your Actors list.
                  </p>
                )}
                {movie.bonusDirectors?.length > 0 && (
                  <p className={styles.whySources}>
                    ★ Directed by <strong>{movie.bonusDirectors.join(', ')}</strong>, on your Directors list.
                  </p>
                )}
              </div>
            )}

            <div className={filmCardStyles.modalActions}>
              <button
                className={filmCardStyles.seenBtn}
                onClick={(e) => { e.stopPropagation(); onSeen(movie.tmdb_id); onClose() }}
              >
                Seen It
              </button>
              <button
                className={filmCardStyles.watchlistBtn}
                onClick={(e) => { e.stopPropagation(); onWatchlist(movie); onClose() }}
              >
                + Watchlist
              </button>
              <button
                className={filmCardStyles.separateListBtn}
                onClick={(e) => { e.stopPropagation(); onNotInterested(movie.tmdb_id); onClose() }}
              >
                Not Interested
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecCard({ movie, onNotInterested, onSeen, onWatchlist, showStarBadge }) {
  const [ratings, setRatings] = useState(null)
  const [loadingRatings, setLoadingRatings] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const extIds = await getMovieExternalIds(movie.tmdb_id)
      if (cancelled || !extIds?.imdb_id) {
        setLoadingRatings(false)
        return
      }
      const r = await getOmdbRatings(extIds.imdb_id)
      if (!cancelled) {
        setRatings(r)
        setLoadingRatings(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [movie.tmdb_id])

  return (
    <>
      <div
        className={styles.card}
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setModalOpen(true) }}
        aria-label={`${movie.title} — click for details`}
      >
        <div className={styles.cardPosterWrap}>
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className={styles.cardPoster}
            loading="lazy"
          />
          {showStarBadge && (movie.bonusActors?.length > 0 || movie.bonusDirectors?.length > 0) && (
            <div className={styles.starBadge}>★</div>
          )}
        </div>
        <div className={styles.cardBody}>
          <h3 className={styles.cardTitle}>{movie.title}</h3>
          <p className={styles.cardYear}>{movie.year}</p>
          {!loadingRatings && (
            <RatingDisplay
              rtScore={ratings?.rtScore}
              imdbRating={ratings?.imdbRating}
              tmdbScore={movie.vote_average}
            />
          )}
          {(movie.bonusActors?.length > 0 || movie.bonusDirectors?.length > 0) && (
            <p className={styles.bonusText}>
              ★ {[...movie.bonusActors, ...movie.bonusDirectors].filter(Boolean).slice(0,2).join(', ')}
            </p>
          )}
          <div className={styles.cardActions}>
            <button className={styles.seenBtn} onClick={(e) => { e.stopPropagation(); onSeen(movie.tmdb_id) }}>
              Seen It
            </button>
            <button className={styles.watchlistBtn} onClick={(e) => { e.stopPropagation(); onWatchlist(movie) }}>
              + Watchlist
            </button>
            <button className={styles.notBtn} onClick={(e) => { e.stopPropagation(); onNotInterested(movie.tmdb_id) }}>
              Not Interested
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <RecModal
          movie={movie}
          onClose={() => setModalOpen(false)}
          onNotInterested={onNotInterested}
          onSeen={onSeen}
          onWatchlist={onWatchlist}
        />
      )}
    </>
  )
}

export default function Recommendations() {
  const {
    myList, quickList, movies, seenList, watchlist, notInterested, toggleSeen, addNotInterested,
    actorsList, directorsList, addToWatchlist,
  } = useFilm()
  const [allRecs, setAllRecs] = useState([])
  const [dismissed, setDismissed] = useState(new Set())
  const [batchOffset, setBatchOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [includeActors, setIncludeActors] = useState(() => loadRecFilters().actors)
  const [includeDirectors, setIncludeDirectors] = useState(() => loadRecFilters().directors)
  const [selectedGenre, setSelectedGenre] = useState(() => loadRecFilters().genre)
  const [useQuickList, setUseQuickList] = useState(() => loadRecFilters().quickList)

  useEffect(() => {
    safeSetItem(LS_REC_FILTERS, JSON.stringify({
      actors: includeActors, directors: includeDirectors, genre: selectedGenre, quickList: useQuickList,
    }))
  }, [includeActors, includeDirectors, selectedGenre, useQuickList])

  // Picks For You can build its taste profile from the full ranked Top 100
  // or, if toggled on, the smaller Quick List instead — same algorithm,
  // smaller/faster-to-build input.
  const themeSourceList = useQuickList ? quickList : myList

  // Genres actually present on whichever list is currently feeding the
  // algorithm — no point offering a tab for a genre nothing on that list has.
  const availableGenres = useMemo(() => {
    const set = new Set()
    themeSourceList.forEach((m) => (m.genres ?? []).forEach((g) => set.add(g)))
    return [...set].sort()
  }, [themeSourceList])

  // A genre the user had selected can disappear from the Top 100 (film
  // removed/reordered out) — fall back to "All" rather than silently
  // keep filtering by a genre no longer available.
  useEffect(() => {
    if (selectedGenre && availableGenres.length > 0 && !availableGenres.includes(selectedGenre)) {
      setSelectedGenre(null)
    }
  }, [selectedGenre, availableGenres])

  useEffect(() => {
    if (themeSourceList.length === 0) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Never worth recommending: already ranked, already on Gabe's
        // curated Top 100, already on the Quick List, already seen/
        // watchlisted, or dismissed before.
        const excludeIds = new Set([
          ...myList.map((m) => m.tmdb_id),
          ...quickList.map((m) => m.tmdb_id),
          ...movies.map((m) => m.tmdb_id),
          ...seenList,
          ...watchlist.map((m) => m.tmdb_id),
          ...notInterested,
        ])
        const recs = await buildThemeRecommendations(themeSourceList, excludeIds, {
          actorsList, directorsList, includeActors, includeDirectors,
        }, selectedGenre)
        if (!cancelled) {
          setAllRecs(recs)
          setBatchOffset(0)
        }
      } catch {
        if (!cancelled) setError('Could not load recommendations. Check your API key.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeSourceList, movies, includeActors, includeDirectors, selectedGenre])

  const remainingRecs = allRecs.filter((m) => !dismissed.has(m.tmdb_id))
  const visibleRecs = remainingRecs.slice(batchOffset, batchOffset + RESULTS_CAP)
  const hasMoreBatches = remainingRecs.length > RESULTS_CAP

  // Steps forward into the next unseen slice of the already-scored pool
  // (there's usually well over 60 candidates scored, just not all shown at
  // once) rather than re-running the algorithm — which is deterministic
  // and would hand back the exact same top 60. Wraps back to the start
  // once the pool runs out.
  function handleRefresh() {
    setBatchOffset((prev) => {
      const next = prev + RESULTS_CAP
      return next >= remainingRecs.length ? 0 : next
    })
  }

  function handleNotInterested(tmdbId) {
    setDismissed((prev) => new Set([...prev, tmdbId]))
    addNotInterested(tmdbId)
  }

  function handleSeen(tmdbId) {
    setDismissed((prev) => new Set([...prev, tmdbId]))
    toggleSeen(tmdbId)
  }

  function handleWatchlist(movie) {
    setDismissed((prev) => new Set([...prev, movie.tmdb_id]))
    addToWatchlist(movie)
  }

  if (myList.length === 0 && quickList.length === 0) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>No list yet</h2>
            <p className={styles.emptyText}>
              Build your film list first and we'll find films you'll love — or throw together
              a Quick List of 10 if you don't want to commit to a full ranking yet.
            </p>
            <div className={styles.emptyActions}>
              <Link to="/my-list" className={styles.buildBtn}>Build My List</Link>
              <Link to="/quick-list" className={styles.buildBtn}>Build Quick List</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Picks For You</h1>
          <div className={styles.filterBar}>
            <div className={styles.filterRow}>
              <button
                className={`${styles.filterBtn} ${filtersOpen ? styles.filterBtnOpen : ''}`}
                onClick={() => setFiltersOpen((v) => !v)}
              >
                Filters
                {(includeActors || includeDirectors) &&
                  ` (${[includeActors, includeDirectors].filter(Boolean).length})`}
              </button>
              <button
                className={styles.refreshBtn}
                onClick={handleRefresh}
                disabled={loading || !hasMoreBatches}
                title={hasMoreBatches ? 'Load a new batch of recommendations' : 'No more recommendations to cycle through right now'}
              >
                ↻ Refresh
              </button>
              <button
                className={`${styles.refreshBtn} ${useQuickList ? styles.filterOptionActive : ''}`}
                onClick={() => setUseQuickList((v) => !v)}
                disabled={quickList.length === 0}
                title={quickList.length === 0
                  ? 'Build a Quick List first'
                  : useQuickList
                    ? 'Switch back to your full Top 100'
                    : 'Pull the taste profile from your Quick List instead of your Top 100'}
              >
                {useQuickList ? '✓ Use Quick List' : 'Use Quick List'}
              </button>
            </div>
            {filtersOpen && (
              <div className={styles.filterPanel}>
                <button
                  className={`${styles.filterOption} ${includeActors ? styles.filterOptionActive : ''}`}
                  onClick={() => setIncludeActors((v) => !v)}
                  disabled={actorsList.length === 0}
                  title={actorsList.length === 0
                    ? 'Add actors to your list first'
                    : 'Boost films starring your favorite actors'}
                >
                  {includeActors ? '✓ Actors' : '+ Actors'}
                </button>
                <button
                  className={`${styles.filterOption} ${includeDirectors ? styles.filterOptionActive : ''}`}
                  onClick={() => setIncludeDirectors((v) => !v)}
                  disabled={directorsList.length === 0}
                  title={directorsList.length === 0
                    ? 'Add directors to your list first'
                    : 'Boost films from your favorite directors'}
                >
                  {includeDirectors ? '✓ Directors' : '+ Directors'}
                </button>
              </div>
            )}
          </div>
        </div>

        {availableGenres.length > 0 && (
          <div className={styles.genreTabs}>
            <button
              className={`${styles.genreTab} ${!selectedGenre ? styles.genreTabActive : ''}`}
              onClick={() => setSelectedGenre(null)}
            >
              All
            </button>
            {availableGenres.map((genre) => (
              <button
                key={genre}
                className={`${styles.genreTab} ${selectedGenre === genre ? styles.genreTabActive : ''}`}
                onClick={() => setSelectedGenre(genre)}
              >
                {genre}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>
              Analyzing your taste from {themeSourceList.length} film{themeSourceList.length === 1 ? '' : 's'}
              {useQuickList ? ' (Quick List)' : ''}
              {selectedGenre ? ` (${selectedGenre} only)` : ''}…
            </p>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {!loading && visibleRecs.length === 0 && !error && (
          <p className={styles.noResults}>
            No recommendations found. Try adding more films to your list.
          </p>
        )}

        {!loading && visibleRecs.length > 0 && (
          <div className={styles.grid}>
            {visibleRecs.map((movie) => (
              <RecCard
                key={movie.tmdb_id}
                movie={movie}
                onNotInterested={handleNotInterested}
                onSeen={handleSeen}
                onWatchlist={handleWatchlist}
                showStarBadge={!includeActors && !includeDirectors}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
