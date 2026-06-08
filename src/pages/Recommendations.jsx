import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { buildRecommendationsEnhanced, getMovieExternalIds } from '../api/tmdb'
import { getOmdbRatings } from '../api/omdb'
import RatingDisplay from '../components/RatingDisplay'
import styles from './Recommendations.module.css'

const TIER_MUST    = { label: '🔥 Must Watch',       min: 80, color: '#c9a84c' }
const TIER_GREAT   = { label: '⭐ Great Match',       min: 65, color: '#a09a8e' }
const TIER_WORTH   = { label: '👍 Worth the Watch',  min: 50, color: '#8b6a3e' }
const TIERS = [TIER_MUST, TIER_GREAT, TIER_WORTH]

function matchPct(score, maxScore) {
  const base = Math.min(100, Math.round((score / Math.max(maxScore, 1)) * 100))
  return Math.min(100, base)
}

function RecCard({ movie, matchPct: pct, tier, onNotInterested, onSeen }) {
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

  const tierColor = tier.color

  return (
    <div className={styles.card}>
      <div className={styles.cardPosterWrap}>
        <img
          src={movie.posterUrl}
          alt={movie.title}
          className={styles.cardPoster}
          loading="lazy"
        />
        <div className={styles.matchBadge} style={{ background: tierColor, color: '#0d0d0d' }}>
          {pct}% Match
        </div>
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
  const { myList, movies, actorsList, directorsList, toggleSeen, addNotInterested } = useFilm()
  const [allRecs, setAllRecs] = useState([])
  const [dismissed, setDismissed] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const actorPersonIds = actorsList.map((a) => a.person_id)
  const directorPersonIds = directorsList.map((d) => d.person_id)

  useEffect(() => {
    if (myList.length === 0) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const recs = await buildRecommendationsEnhanced(
          myList, movies, actorPersonIds, directorPersonIds
        )
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

  const maxScore = allRecs.length > 0 ? allRecs[0].score : 1

  const visibleRecs = allRecs
    .filter((m) => !dismissed.has(m.tmdb_id))
    .map((m) => ({ ...m, pct: matchPct(m.score, maxScore) }))
    .filter((m) => m.pct >= 50)

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
            <p>Fetching recommendations from {Math.min(myList.length, 10)} films…</p>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {!loading && visibleRecs.length === 0 && !error && (
          <p className={styles.noResults}>
            No recommendations found. Try adding more films to your list.
          </p>
        )}

        {!loading && visibleRecs.length > 0 && TIERS.map((tier) => {
          const tierRecs = visibleRecs.filter((m) => {
            if (tier === TIER_MUST)  return m.pct >= 80
            if (tier === TIER_GREAT) return m.pct >= 65 && m.pct < 80
            return m.pct >= 50 && m.pct < 65
          })
          if (tierRecs.length === 0) return null
          return (
            <section key={tier.label} className={styles.tier}>
              <h2 className={styles.tierTitle}>{tier.label}</h2>
              <div className={styles.grid}>
                {tierRecs.map((movie) => (
                  <RecCard
                    key={movie.tmdb_id}
                    movie={movie}
                    matchPct={movie.pct}
                    tier={tier}
                    onNotInterested={handleNotInterested}
                    onSeen={handleSeen}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
