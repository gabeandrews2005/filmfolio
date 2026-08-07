import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { buildThemeRecommendations, getMovieExternalIds } from '../api/tmdb'
import { getOmdbRatings } from '../api/omdb'
import RatingDisplay from '../components/RatingDisplay'
import styles from './Recommendations.module.css'

const RESULTS_CAP = 60

function RecCard({ movie, onNotInterested, onSeen }) {
  const [ratings, setRatings] = useState(null)
  const [loadingRatings, setLoadingRatings] = useState(true)

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
    <div className={styles.card}>
      <div className={styles.cardPosterWrap}>
        <img
          src={movie.posterUrl}
          alt={movie.title}
          className={styles.cardPoster}
          loading="lazy"
        />
        {(movie.bonusActors?.length > 0 || movie.bonusDirectors?.length > 0) && (
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
          <button className={styles.seenBtn} onClick={() => onSeen(movie.tmdb_id)}>
            Seen It
          </button>
          <button className={styles.notBtn} onClick={() => onNotInterested(movie.tmdb_id)}>
            Not Interested
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Recommendations() {
  const { myList, movies, seenList, watchlist, notInterested, toggleSeen, addNotInterested } = useFilm()
  const [allRecs, setAllRecs] = useState([])
  const [dismissed, setDismissed] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (myList.length === 0) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Never worth recommending: already ranked, already on Gabe's
        // curated Top 100, already seen/watchlisted, or dismissed before.
        const excludeIds = new Set([
          ...myList.map((m) => m.tmdb_id),
          ...movies.map((m) => m.tmdb_id),
          ...seenList,
          ...watchlist.map((m) => m.tmdb_id),
          ...notInterested,
        ])
        const recs = await buildThemeRecommendations(myList, excludeIds)
        if (!cancelled) setAllRecs(recs)
      } catch {
        if (!cancelled) setError('Could not load recommendations. Check your API key.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myList, movies])

  const visibleRecs = allRecs
    .filter((m) => !dismissed.has(m.tmdb_id))
    .slice(0, RESULTS_CAP)

  function handleNotInterested(tmdbId) {
    setDismissed((prev) => new Set([...prev, tmdbId]))
    addNotInterested(tmdbId)
  }

  function handleSeen(tmdbId) {
    setDismissed((prev) => new Set([...prev, tmdbId]))
    toggleSeen(tmdbId)
  }

  if (myList.length === 0) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>No list yet</h2>
            <p className={styles.emptyText}>
              Build your film list first and we'll find films you'll love.
            </p>
            <Link to="/my-list" className={styles.buildBtn}>Build My List</Link>
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
        </div>

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Analyzing your taste from {myList.length} film{myList.length === 1 ? '' : 's'}…</p>
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
