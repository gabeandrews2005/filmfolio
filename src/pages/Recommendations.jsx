import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { buildRecommendationsEnhanced } from '../api/tmdb'
import RecommendationCard from '../components/RecommendationCard'
import StarSignal from '../components/StarSignal'
import styles from './Recommendations.module.css'

export default function Recommendations() {
  const { myList, movies, actorsList, directorsList } = useFilm()
  const [queue, setQueue] = useState([])
  const [displayed, setDisplayed] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const DISPLAY_COUNT = 20

  // Build actor/director person ID arrays for enhanced algorithm
  const actorPersonIds = actorsList.map((a) => a.person_id)
  const directorPersonIds = directorsList.map((d) => d.person_id)
  const hasSignals = actorPersonIds.length > 0 || directorPersonIds.length > 0

  useEffect(() => {
    if (myList.length === 0) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const recs = await buildRecommendationsEnhanced(
          myList,
          movies,
          actorPersonIds,
          directorPersonIds
        )
        if (!cancelled) {
          setQueue(recs)
          setDisplayed(recs.slice(0, DISPLAY_COUNT))
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
  }, [myList, movies])

  function handleNotInterested(tmdbId) {
    setDisplayed((prev) => {
      const nextDisplayed = prev.filter((m) => m.tmdb_id !== tmdbId)
      const shownIds = new Set(nextDisplayed.map((m) => m.tmdb_id))
      const next = queue.find((m) => m.tmdb_id !== tmdbId && !shownIds.has(m.tmdb_id))
      return next ? [...nextDisplayed, next] : nextDisplayed
    })
  }

  if (myList.length === 0) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>No list yet</h2>
            <p className={styles.emptyText}>
              Build your Top 10 first and we'll find films you'll love.
            </p>
            <Link to="/my-list" className={styles.buildBtn}>Build My Top 10</Link>
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
          <p className={styles.subtitle}>
            Based on your top {Math.min(myList.length, 10)} films, scored by how often they appear across all recommendation sets.
            {hasSignals && (
              <> Films featuring your favorite actors or directors receive a <span className={styles.goldText}>★ bonus</span>.</>
            )}
          </p>
        </div>

        {/* Top films summary */}
        <div className={styles.top10Summary}>
          <p className={styles.summaryLabel}>Based on</p>
          <div className={styles.summaryList}>
            {myList.slice(0, 10).map((m, i) => (
              <span key={m.tmdb_id} className={styles.summaryItem}>
                <span className={styles.summaryRank}>{i + 1}.</span> {m.title}
              </span>
            ))}
          </div>
          <Link to="/my-list" className={styles.editLink}>Edit list</Link>
        </div>

        {hasSignals && (
          <div className={styles.signalNote}>
            <span className={styles.signalStar}>★</span>
            <span className={styles.signalText}>
              Gold star = bonus match with your{actorPersonIds.length > 0 ? ' actors' : ''}{actorPersonIds.length > 0 && directorPersonIds.length > 0 ? ' or' : ''}{directorPersonIds.length > 0 ? ' directors' : ''} list
            </span>
          </div>
        )}

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Fetching recommendations from {Math.min(myList.length, 10)} films…</p>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {!loading && displayed.length === 0 && !error && (
          <p className={styles.noResults}>
            No recommendations found. This can happen if your API key isn't set or the films don't have related results.
          </p>
        )}

        {displayed.length > 0 && (
          <>
            <p className={styles.resultsCount}>{displayed.length} recommendations</p>
            <div className={styles.grid}>
              {displayed.map((movie) => (
                <div key={movie.tmdb_id} className={styles.recWrap}>
                  {(movie.bonusActors?.length > 0 || movie.bonusDirectors?.length > 0) && (
                    <div className={styles.bonusSignal}>
                      <StarSignal actors={movie.bonusActors ?? []} directors={movie.bonusDirectors ?? []} />
                    </div>
                  )}
                  <RecommendationCard
                    movie={movie}
                    onNotInterested={handleNotInterested}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
