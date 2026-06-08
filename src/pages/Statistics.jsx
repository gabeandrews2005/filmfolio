import { useEffect, useState, useMemo } from 'react'
import { useFilm } from '../context/FilmContext'
import { getMovieDetails, getMovieCredits, PLACEHOLDER_POSTER } from '../api/tmdb'
import styles from './Statistics.module.css'

function AnimatedNumber({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!value) return
    let start = 0
    const step = value / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= value) {
        setDisplay(value)
        clearInterval(timer)
      } else {
        setDisplay(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [value, duration])

  return <>{display}</>
}

function GenreBar({ genre, count, max }) {
  const pct = Math.round((count / max) * 100)
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{genre}</span>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.barCount}>{count}</span>
    </div>
  )
}

function derivePersonality(genreFreq, directorFreq) {
  const topGenre = genreFreq[0]?.[0] ?? ''
  const uniqueDirectors = directorFreq.length

  if (uniqueDirectors >= 8) return 'The Auteur Chaser'
  if (topGenre === 'Drama') return 'The Cinephile'
  if (topGenre === 'Horror' || topGenre === 'Thriller') return 'The Genre Diehard'
  if (topGenre === 'Comedy') return 'The Crowd Pleaser'
  if (topGenre === 'Animation') return 'The Animation Devotee'
  if (topGenre === 'Action' || topGenre === 'Adventure') return 'The Blockbuster Hunter'
  if (topGenre === 'Romance') return 'The Romantic'
  return 'The Film Explorer'
}

export default function Statistics() {
  const {
    myList, movies, seenList, watchlist,
    actorsList, directorsList,
    horrorList, comediesList, animatedList, seasonalList,
  } = useFilm()

  const [creditsData, setCreditsData] = useState([])
  const [detailsData, setDetailsData] = useState([])
  const [loading, setLoading] = useState(false)
  const [computed, setComputed] = useState(false)

  const allFilmLists = useMemo(() => [
    ...myList, ...horrorList, ...comediesList, ...animatedList, ...seasonalList,
  ], [myList, horrorList, comediesList, animatedList, seasonalList])

  const uniqueFilms = useMemo(() => {
    const seen = new Set()
    return allFilmLists.filter((m) => {
      if (seen.has(m.tmdb_id)) return false
      seen.add(m.tmdb_id)
      return true
    })
  }, [allFilmLists])

  // Fetch TMDB details + credits for top films (up to 30)
  useEffect(() => {
    if (uniqueFilms.length === 0) return
    let cancelled = false
    setLoading(true)
    const sample = uniqueFilms.slice(0, 30)
    Promise.all([
      Promise.all(sample.map((m) => getMovieDetails(m.tmdb_id))),
      Promise.all(sample.map((m) => getMovieCredits(m.tmdb_id))),
    ]).then(([details, credits]) => {
      if (!cancelled) {
        setDetailsData(details.filter(Boolean))
        setCreditsData(credits.filter(Boolean))
        setLoading(false)
        setComputed(true)
      }
    })
    return () => { cancelled = true }
  }, [uniqueFilms])

  // Compute stats from collected data
  const stats = useMemo(() => {
    const totalRanked = uniqueFilms.length
    const years = uniqueFilms.map((m) => parseInt(m.year)).filter(Boolean)
    const yearRange = years.length >= 2
      ? `${Math.min(...years)} – ${Math.max(...years)}`
      : years[0]?.toString() ?? '—'
    const favoriteDecadeMap = new Map()
    years.forEach((y) => {
      const d = Math.floor(y / 10) * 10
      favoriteDecadeMap.set(d, (favoriteDecadeMap.get(d) ?? 0) + 1)
    })
    const favoriteDecade = [...favoriteDecadeMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

    // Average runtime
    const runtimes = detailsData.map((d) => d.runtime).filter(Boolean)
    const avgRuntime = runtimes.length > 0 ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length) : null

    // Genre frequency
    const genreMap = new Map()
    detailsData.forEach((d) => {
      d.genres?.forEach((g) => genreMap.set(g.name, (genreMap.get(g.name) ?? 0) + 1))
    })
    // Also count from seed data genres
    uniqueFilms.forEach((m) => {
      m.genres?.forEach((g) => genreMap.set(g, (genreMap.get(g) ?? 0) + 1))
    })
    const topGenres = [...genreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

    // Actor frequency
    const actorMap = new Map()
    creditsData.forEach((c) => {
      c.cast?.slice(0, 5).forEach((p) => {
        actorMap.set(p.name, (actorMap.get(p.name) ?? 0) + 1)
      })
    })
    const topActors = [...actorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

    // Director frequency
    const directorMap = new Map()
    creditsData.forEach((c) => {
      const dir = c.crew?.find((p) => p.job === 'Director')
      if (dir) directorMap.set(dir.name, (directorMap.get(dir.name) ?? 0) + 1)
    })
    const topDirectors = [...directorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

    // Production companies
    const companyMap = new Map()
    detailsData.forEach((d) => {
      d.production_companies?.slice(0, 2).forEach((c) => {
        companyMap.set(c.name, (companyMap.get(c.name) ?? 0) + 1)
      })
    })
    const topCompanies = [...companyMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

    const personality = derivePersonality(topGenres, topDirectors)

    return {
      totalRanked,
      yearRange,
      favoriteDecade,
      avgRuntime,
      topGenres,
      topActors,
      topDirectors,
      topCompanies,
      personality,
      seenCount: seenList.size,
      watchlistCount: watchlist.length,
    }
  }, [uniqueFilms, detailsData, creditsData, seenList, watchlist])

  const topFilm = myList[0]
  const hasData = uniqueFilms.length > 0

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Film Aura header */}
        <div
          className={styles.aura}
          style={{
            backgroundImage: topFilm?.backdropUrl
              ? `url(${topFilm.backdropUrl})`
              : topFilm?.posterUrl
                ? `url(${topFilm.posterUrl})`
                : undefined,
          }}
        >
          <div className={styles.auraOverlay} />
          <div className={styles.auraContent}>
            <p className={styles.auraEyebrow}>Your Film Aura</p>
            <h1 className={styles.auraPersonality}>{computed ? stats.personality : 'Film Explorer'}</h1>
            {topFilm && (
              <p className={styles.auraTop}>
                #1 Film: <strong>{topFilm.title}</strong> ({topFilm.year})
              </p>
            )}
          </div>
        </div>

        {!hasData && !loading && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Start building your film lists to unlock your Statistics.
            </p>
          </div>
        )}

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Computing your film identity…</p>
          </div>
        )}

        {hasData && (
          <div className={styles.statGrid}>
            {/* Quick numbers */}
            <div className={styles.statCard}>
              <span className={styles.statNum}>
                <AnimatedNumber value={stats.totalRanked} />
              </span>
              <span className={styles.statLabel}>Films Ranked</span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statNum}>
                <AnimatedNumber value={stats.seenCount} />
              </span>
              <span className={styles.statLabel}>Films Seen</span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statNum}>
                <AnimatedNumber value={stats.watchlistCount} />
              </span>
              <span className={styles.statLabel}>On Watchlist</span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statNum}>{stats.yearRange || '—'}</span>
              <span className={styles.statLabel}>Years Spanning</span>
            </div>

            {stats.favoriteDecade && (
              <div className={styles.statCard}>
                <span className={styles.statNum}>{stats.favoriteDecade}s</span>
                <span className={styles.statLabel}>Favorite Decade</span>
              </div>
            )}

            {stats.avgRuntime && (
              <div className={styles.statCard}>
                <span className={styles.statNum}>
                  <AnimatedNumber value={stats.avgRuntime} />m
                </span>
                <span className={styles.statLabel}>Avg Runtime</span>
              </div>
            )}
          </div>
        )}

        {computed && stats.topGenres.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Top Genres</h2>
            <div className={styles.bars}>
              {stats.topGenres.map(([genre, count]) => (
                <GenreBar key={genre} genre={genre} count={count} max={stats.topGenres[0][1]} />
              ))}
            </div>
          </div>
        )}

        {computed && stats.topDirectors.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Favorite Directors</h2>
            <div className={styles.personList}>
              {stats.topDirectors.map(([name, count], i) => (
                <div key={name} className={styles.personRow}>
                  <span className={styles.personRank}>{i + 1}</span>
                  <span className={styles.personName}>{name}</span>
                  <span className={styles.personCount}>{count} film{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {computed && stats.topActors.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Frequent Actors</h2>
            <div className={styles.personList}>
              {stats.topActors.map(([name, count], i) => (
                <div key={name} className={styles.personRow}>
                  <span className={styles.personRank}>{i + 1}</span>
                  <span className={styles.personName}>{name}</span>
                  <span className={styles.personCount}>{count} film{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {computed && stats.topCompanies.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Top Production Companies</h2>
            <div className={styles.personList}>
              {stats.topCompanies.map(([name, count], i) => (
                <div key={name} className={styles.personRow}>
                  <span className={styles.personRank}>{i + 1}</span>
                  <span className={styles.personName}>{name}</span>
                  <span className={styles.personCount}>{count} film{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
