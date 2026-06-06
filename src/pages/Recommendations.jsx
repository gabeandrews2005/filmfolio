import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { buildRecommendations } from '../api/tmdb'
import RecommendationCard from '../components/RecommendationCard'
import styles from './Recommendations.module.css'

export default function Recommendations() {
  const { myTop10, movies } = useFilm()
  const [queue, setQueue] = useState([])
  const [displayed, setDisplayed] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const DISPLAY_COUNT = 20

  useEffect(() => {
    if (myTop10.length === 0) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const recs = await buildRecommendations(myTop10, movies)
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
  }, [myTop10, movies])

  function handleNotInterested(tmdbId) {
    setDisplayed((prev) => {
      const nextDisplayed = prev.filter((m) => m.tmdb_id !== tmdbId)
      // Pull the next one from the queue that isn't already displayed or removed
      const shownIds = new Set(nextDisplayed.map((m) => m.tmdb_id))
      const next = queue.find((m) => m.tmdb_id !== tmdbId && !shownIds.has(m.tmdb_id))
      return next ? [...nextDisplayed, next] : nextDisplayed
    })
  }

  if (myTop10.length === 0) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>No top 10 yet</h2>
            <p className={styles.emptyText}>
              Build your top 10 first and we'll find films you'll love.
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
            Based on your top {myTop10.length} films, we asked TMDB what's most related.
            Films recommended by more of your picks score higher.
          </p>
        </div>

        {/* Top 10 summary */}
        <div className={styles.top10Summary}>
          <p className={styles.summaryLabel}>Your Top 10</p>
          <div className={styles.summaryList}>
            {myTop10.map((m, i) => (
              <span key={m.tmdb_id} className={styles.summaryItem}>
                <span className={styles.summaryRank}>{i + 1}.</span> {m.title}
              </span>
            ))}
          </div>
          <Link to="/my-list" className={styles.editLink}>Edit list</Link>
        </div>

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Fetching recommendations from {myTop10.length} films…</p>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {!loading && displayed.length === 0 && !error && (
          <p className={styles.noResults}>
            No recommendations found. This can happen if your TMDB API key isn't set or the films don't have related results.
          </p>
        )}

        {displayed.length > 0 && (
          <>
            <p className={styles.resultsCount}>{displayed.length} recommendations</p>
            <div className={styles.grid}>
              {displayed.map((movie) => (
                <RecommendationCard
                  key={movie.tmdb_id}
                  movie={movie}
                  onNotInterested={handleNotInterested}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
