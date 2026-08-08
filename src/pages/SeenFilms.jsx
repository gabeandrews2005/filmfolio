import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER } from '../api/tmdb'
import useOmdbRatings from '../hooks/useOmdbRatings'
import RatingDisplay from '../components/RatingDisplay'
import styles from './SeenFilms.module.css'

function getFilmListBadges(tmdbId, ctx) {
  const badges = []
  if (ctx.myList.findIndex((m) => m.tmdb_id === tmdbId) !== -1) {
    const rank = ctx.myList.findIndex((m) => m.tmdb_id === tmdbId) + 1
    badges.push(`My List #${rank}`)
  }
  ;['horrorList', 'comediesList', 'animatedList', 'seasonalList'].forEach((key) => {
    const list = ctx[key] ?? []
    const idx = list.findIndex((m) => m.tmdb_id === tmdbId)
    if (idx !== -1) {
      const label = key.replace('List', '').replace('comedies', 'Comedy').replace('horror', 'Horror')
        .replace('animated', 'Animated').replace('seasonal', 'Seasonal')
      badges.push(`${label} #${idx + 1}`)
    }
  })
  return badges
}

function SeenFilmCard({ movie, badges }) {
  const { ratings } = useOmdbRatings(movie.tmdb_id)

  return (
    <div className={styles.card}>
      <div className={styles.posterWrap}>
        <img
          src={movie.posterUrl || PLACEHOLDER_POSTER}
          alt={movie.title}
          className={styles.poster}
          loading="lazy"
        />
        <div className={styles.seenMark}>✓</div>
      </div>
      <div className={styles.info}>
        <span className={styles.filmTitle}>{movie.title}</span>
        <span className={styles.filmYear}>{movie.year}</span>
        <RatingDisplay
          compact
          rtScore={ratings?.rtScore}
          imdbRating={ratings?.imdbRating}
          tmdbScore={movie.vote_average}
        />
        {badges.length > 0 && (
          <div className={styles.badges}>
            {badges.map((b) => (
              <span key={b} className={styles.badge}>{b}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SeenFilms() {
  const ctx = useFilm()
  const { seenList, movies, myList, horrorList, comediesList, animatedList, seasonalList } = ctx

  // Build a map of all known films from all sources
  const filmMap = useMemo(() => {
    const map = new Map()
    const addFilms = (list) => {
      list.forEach((m) => {
        if (m.tmdb_id && !map.has(m.tmdb_id)) map.set(m.tmdb_id, m)
      })
    }
    addFilms(movies)
    addFilms(myList)
    addFilms(horrorList)
    addFilms(comediesList)
    addFilms(animatedList)
    addFilms(seasonalList)
    return map
  }, [movies, myList, horrorList, comediesList, animatedList, seasonalList])

  const seenFilms = useMemo(() => {
    return [...seenList]
      .map((id) => filmMap.get(id))
      .filter(Boolean)
  }, [seenList, filmMap])

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Seen Films</h1>
          <span className={styles.count}>{seenFilms.length} films</span>
        </div>

        {seenFilms.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Films you mark as seen will appear here automatically.
            </p>
            <Link to="/explore" className={styles.exploreLink}>Explore Films →</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {seenFilms.map((movie) => (
              <SeenFilmCard
                key={movie.tmdb_id}
                movie={movie}
                badges={getFilmListBadges(movie.tmdb_id, ctx)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
