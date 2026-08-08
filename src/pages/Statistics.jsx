import { useEffect, useState, useMemo } from 'react'
import { useFilm } from '../context/FilmContext'
import useStatsBackfill from '../hooks/useStatsBackfill'
import { BOOK_ADAPTATION_KEYWORD_TERMS, REMAKE_KEYWORD_TERMS, MAJOR_STUDIOS } from '../api/tmdb'
import Histogram from '../components/charts/Histogram'
import PieChart from '../components/charts/PieChart'
import ScatterPlot from '../components/charts/ScatterPlot'
import styles from './Statistics.module.css'

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'to', 'is', 'on'])
const CURRENCY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

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

function tokenizeTitle(title) {
  return (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
}

function pearsonCorrelation(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX, dy = ys[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  return den === 0 ? null : num / den
}

function formatRuntime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Returns { name, description } — the description cites the actual numbers
// that produced the classification (top genre's count, director count,
// etc.) rather than a generic blurb per personality, so it reads as "here's
// why," not just a label.
function derivePersonality(genreFreq, directorFreq, totalFilms) {
  const topGenre = genreFreq[0]
  const topGenreName = topGenre?.[0] ?? ''
  const topGenreCount = topGenre?.[1] ?? 0
  const filmWord = (n) => `${n} film${n !== 1 ? 's' : ''}`
  const uniqueDirectors = directorFreq.length

  if (uniqueDirectors >= 8) {
    return {
      name: 'The Auteur Chaser',
      description: `${uniqueDirectors} different directors show up across your list — you follow filmmakers, not just films.`,
    }
  }
  if (topGenreName === 'Drama') {
    return {
      name: 'The Cinephile',
      description: `Drama leads your list with ${filmWord(topGenreCount)} — you're drawn to stories that hit hard.`,
    }
  }
  if (topGenreName === 'Horror' || topGenreName === 'Thriller') {
    return {
      name: 'The Genre Diehard',
      description: `${topGenreName} tops your list with ${filmWord(topGenreCount)} — you keep coming back for the tension.`,
    }
  }
  if (topGenreName === 'Comedy') {
    return {
      name: 'The Crowd Pleaser',
      description: `Comedy leads with ${filmWord(topGenreCount)} — you rank what makes you laugh.`,
    }
  }
  if (topGenreName === 'Animation') {
    return {
      name: 'The Animation Devotee',
      description: `Animation tops your list with ${filmWord(topGenreCount)} — the medium matters as much as the story.`,
    }
  }
  if (topGenreName === 'Action' || topGenreName === 'Adventure') {
    return {
      name: 'The Blockbuster Hunter',
      description: `${topGenreName} leads your list with ${filmWord(topGenreCount)} — you rank the big swings.`,
    }
  }
  if (topGenreName === 'Romance') {
    return {
      name: 'The Romantic',
      description: `Romance tops your list with ${filmWord(topGenreCount)} — you rank the ones that make you feel something.`,
    }
  }
  return {
    name: 'The Film Explorer',
    description: topGenreName
      ? `Your ${filmWord(totalFilms)} spread across too many genres to pin down one favorite — that's the point.`
      : 'Start ranking films to find out what your taste says about you.',
  }
}

export default function Statistics() {
  const { myList, seenList, watchlist, patchListItems } = useFilm()
  const { backfilling, progress } = useStatsBackfill(myList, patchListItems)

  const stats = useMemo(() => {
    if (myList.length === 0) return null

    // ── Time & era ──────────────────────────────────────────────────────
    const years = myList.map((m) => parseInt(m.year)).filter(Boolean)
    const currentYear = new Date().getFullYear()
    const avgYear = years.length ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : null
    const oldestYear = years.length ? Math.min(...years) : null
    const newestYear = years.length ? Math.max(...years) : null
    const oldestFilm = oldestYear != null ? myList.find((m) => parseInt(m.year) === oldestYear) : null
    const newestFilm = newestYear != null ? myList.find((m) => parseInt(m.year) === newestYear) : null

    const decadeMap = new Map()
    years.forEach((y) => {
      const d = Math.floor(y / 10) * 10
      decadeMap.set(d, (decadeMap.get(d) ?? 0) + 1)
    })
    const decadeData = [...decadeMap.entries()].sort((a, b) => a[0] - b[0]).map(([d, c]) => ({ label: `${d}s`, value: c }))

    const yearCountMap = new Map()
    years.forEach((y) => yearCountMap.set(y, (yearCountMap.get(y) ?? 0) + 1))
    const yearClusters = [...yearCountMap.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1])
    const yearWithMost = [...yearCountMap.entries()].sort((a, b) => b[1] - a[1])[0]

    const ratingYearScatter = myList
      .filter((m) => m.year && m.vote_average != null)
      .map((m) => ({ x: parseInt(m.year), y: m.vote_average, label: m.title }))

    // ── Genre ───────────────────────────────────────────────────────────
    const genreMap = new Map()
    myList.forEach((m) => m.genres?.forEach((g) => genreMap.set(g, (genreMap.get(g) ?? 0) + 1)))
    const genreFreq = [...genreMap.entries()].sort((a, b) => b[1] - a[1])
    const rarestGenre = genreFreq.length ? genreFreq.reduce((min, e) => (e[1] < min[1] ? e : min)) : null

    const comboMap = new Map()
    myList.forEach((m) => {
      const genres = m.genres ?? []
      for (let i = 0; i < genres.length; i++) {
        for (let j = i + 1; j < genres.length; j++) {
          const pair = [genres[i], genres[j]].sort().join(' / ')
          comboMap.set(pair, (comboMap.get(pair) ?? 0) + 1)
        }
      }
    })
    const topCombo = [...comboMap.entries()].sort((a, b) => b[1] - a[1]).filter(([, c]) => c > 1)[0]

    const runtimeByGenreMap = new Map()
    myList.forEach((m) => {
      if (!m.runtime) return
      m.genres?.forEach((g) => {
        const e = runtimeByGenreMap.get(g) ?? { sum: 0, count: 0 }
        e.sum += m.runtime
        e.count += 1
        runtimeByGenreMap.set(g, e)
      })
    })
    const avgRuntimeByGenre = [...runtimeByGenreMap.entries()]
      .map(([g, e]) => ({ label: g, value: Math.round(e.sum / e.count) }))
      .sort((a, b) => b.value - a.value)

    // ── People ──────────────────────────────────────────────────────────
    const directorMap = new Map()
    myList.forEach((m) => { if (m.director) directorMap.set(m.director, (directorMap.get(m.director) ?? 0) + 1) })
    const directorFreq = [...directorMap.entries()].sort((a, b) => b[1] - a[1])
    const directorsWithMultiple = directorFreq.filter(([, c]) => c >= 2)

    const actorMap = new Map()
    myList.forEach((m) => m.cast?.forEach((a) => actorMap.set(a.name, (actorMap.get(a.name) ?? 0) + 1)))
    const actorFreq = [...actorMap.entries()].sort((a, b) => b[1] - a[1])

    const actorGenresMap = new Map()
    myList.forEach((m) => {
      m.cast?.forEach((a) => {
        const set = actorGenresMap.get(a.name) ?? new Set()
        m.genres?.forEach((g) => set.add(g))
        actorGenresMap.set(a.name, set)
      })
    })
    const actorAcrossGenres = [...actorGenresMap.entries()]
      .map(([name, set]) => [name, set.size])
      .sort((a, b) => b[1] - a[1])[0]

    const pairMap = new Map()
    myList.forEach((m) => {
      if (!m.director) return
      m.cast?.forEach((a) => {
        const key = `${m.director} + ${a.name}`
        pairMap.set(key, (pairMap.get(key) ?? 0) + 1)
      })
    })
    const topPair = [...pairMap.entries()].sort((a, b) => b[1] - a[1]).filter(([, c]) => c > 1)[0]

    // ── Runtime ─────────────────────────────────────────────────────────
    const filmsWithRuntime = myList.filter((m) => m.runtime)
    const runtimes = filmsWithRuntime.map((m) => m.runtime)
    const avgRuntime = runtimes.length ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length) : null
    const shortestFilm = filmsWithRuntime.length ? filmsWithRuntime.reduce((min, m) => (m.runtime < min.runtime ? m : min)) : null
    const longestFilm = filmsWithRuntime.length ? filmsWithRuntime.reduce((max, m) => (m.runtime > max.runtime ? m : max)) : null
    const totalRuntimeMinutes = runtimes.reduce((a, b) => a + b, 0)

    const runtimeBucket = 20
    const runtimeBuckets = new Map()
    runtimes.forEach((r) => {
      const b = Math.floor(r / runtimeBucket) * runtimeBucket
      runtimeBuckets.set(b, (runtimeBuckets.get(b) ?? 0) + 1)
    })
    const runtimeHistogramData = [...runtimeBuckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([b, c]) => ({ label: `${b}-${b + runtimeBucket}m`, value: c }))

    // ── Ratings & reception ────────────────────────────────────────────
    const filmsWithTmdbRating = myList.filter((m) => m.vote_average != null)
    const tmdbRatings = filmsWithTmdbRating.map((m) => m.vote_average)
    const avgTmdbRating = tmdbRatings.length ? tmdbRatings.reduce((a, b) => a + b, 0) / tmdbRatings.length : null
    const imdbRatings = myList.map((m) => (m.imdbRating ? parseFloat(m.imdbRating) : null)).filter((v) => v != null && !Number.isNaN(v))
    const avgImdbRating = imdbRatings.length ? imdbRatings.reduce((a, b) => a + b, 0) / imdbRatings.length : null
    const highestRated = filmsWithTmdbRating.length ? filmsWithTmdbRating.reduce((max, m) => (m.vote_average > max.vote_average ? m : max)) : null
    const lowestRated = filmsWithTmdbRating.length ? filmsWithTmdbRating.reduce((min, m) => (m.vote_average < min.vote_average ? m : min)) : null

    const ratingBuckets = new Map()
    tmdbRatings.forEach((r) => {
      const b = Math.floor(r * 2) / 2
      ratingBuckets.set(b, (ratingBuckets.get(b) ?? 0) + 1)
    })
    const ratingDistData = [...ratingBuckets.entries()].sort((a, b) => a[0] - b[0]).map(([b, c]) => ({ label: b.toFixed(1), value: c }))

    const rankRatingScatter = myList.map((m, i) => ({ x: i + 1, y: m.vote_average, label: m.title })).filter((d) => d.y != null)
    const rankRatingCorrelation = pearsonCorrelation(rankRatingScatter.map((d) => d.x), rankRatingScatter.map((d) => d.y))

    // ── Country & language ─────────────────────────────────────────────
    const countryMap = new Map()
    myList.forEach((m) => m.productionCountries?.forEach((c) => countryMap.set(c, (countryMap.get(c) ?? 0) + 1)))
    const countryFreq = [...countryMap.entries()].sort((a, b) => b[1] - a[1])
    const nonEnglishCount = myList.filter((m) => m.originalLanguage && m.originalLanguage !== 'en').length
    const topNonUSCountry = countryFreq.filter(([c]) => c !== 'United States of America')[0]

    // ── Studio / production ────────────────────────────────────────────
    const companyMap = new Map()
    myList.forEach((m) => m.productionCompanies?.forEach((c) => companyMap.set(c, (companyMap.get(c) ?? 0) + 1)))
    const companyFreq = [...companyMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    const withCompanies = myList.filter((m) => m.productionCompanies?.length > 0)
    const majorCount = withCompanies.filter((m) => m.productionCompanies.some((c) => MAJOR_STUDIOS.has(c))).length
    const indieCount = withCompanies.length - majorCount

    // ── Box office / budget ─────────────────────────────────────────────
    const withRevenue = myList.filter((m) => m.revenue)
    const totalBoxOffice = withRevenue.reduce((sum, m) => sum + m.revenue, 0)
    const highestGrossing = withRevenue.length ? withRevenue.reduce((max, m) => (m.revenue > max.revenue ? m : max)) : null
    const lowestGrossing = withRevenue.length ? withRevenue.reduce((min, m) => (m.revenue < min.revenue ? m : min)) : null
    const withBoth = myList.filter((m) => m.budget && m.revenue)
    const avgBudgetToGross = withBoth.length
      ? withBoth.reduce((sum, m) => sum + m.revenue / m.budget, 0) / withBoth.length
      : null

    // ── Awards ──────────────────────────────────────────────────────────
    const oscarWinningCount = myList.filter((m) => m.awards?.oscarWins > 0).length
    const oscarNominatedCount = myList.filter((m) => m.awards?.oscarNominations > 0 || m.awards?.oscarWins > 0).length
    const totalOscarWins = myList.reduce((sum, m) => sum + (m.awards?.oscarWins ?? 0), 0)

    // ── Fun / novelty ───────────────────────────────────────────────────
    const wordMap = new Map()
    myList.forEach((m) => tokenizeTitle(m.title).forEach((w) => wordMap.set(w, (wordMap.get(w) ?? 0) + 1)))
    const topWord = [...wordMap.entries()].sort((a, b) => b[1] - a[1])[0]

    const filmsWithCollectionData = myList.filter((m) => m.statsBackfilled)
    const franchiseCount = myList.filter((m) => m.collection).length
    const franchisePct = filmsWithCollectionData.length ? Math.round((franchiseCount / filmsWithCollectionData.length) * 100) : 0

    const bookAdaptationCount = myList.filter((m) =>
      m.keywords?.some((kw) => BOOK_ADAPTATION_KEYWORD_TERMS.some((t) => kw.name?.toLowerCase().includes(t)))
    ).length
    const remakeCount = myList.filter((m) =>
      m.keywords?.some((kw) => REMAKE_KEYWORD_TERMS.some((t) => kw.name?.toLowerCase().includes(t)))
    ).length
    const withKeywords = myList.filter((m) => m.keywords)
    const bookPct = withKeywords.length ? Math.round((bookAdaptationCount / withKeywords.length) * 100) : 0
    const remakePct = withKeywords.length ? Math.round((remakeCount / withKeywords.length) * 100) : 0

    const actorFilms = new Map()
    const filmActors = new Map()
    const actorNames = new Map()
    myList.forEach((m) => {
      const ids = new Set()
      m.cast?.forEach((a) => {
        ids.add(a.id)
        actorNames.set(a.id, a.name)
        const set = actorFilms.get(a.id) ?? new Set()
        set.add(m.tmdb_id)
        actorFilms.set(a.id, set)
      })
      filmActors.set(m.tmdb_id, ids)
    })
    let sixDegreesHub = null
    let maxCoStars = -1
    actorFilms.forEach((films, actorId) => {
      const coStars = new Set()
      films.forEach((filmId) => {
        filmActors.get(filmId)?.forEach((otherId) => { if (otherId !== actorId) coStars.add(otherId) })
      })
      if (coStars.size > maxCoStars) {
        maxCoStars = coStars.size
        sixDegreesHub = {
          name: actorNames.get(actorId),
          count: coStars.size,
          coStars: [...coStars].slice(0, 10).map((id) => actorNames.get(id)),
        }
      }
    })
    if (sixDegreesHub && sixDegreesHub.count === 0) sixDegreesHub = null

    const personality = derivePersonality(genreFreq, directorFreq, myList.length)

    return {
      totalRanked: myList.length,
      seenCount: seenList.size,
      watchlistCount: watchlist.length,
      personality,
      // time & era
      avgYear, avgAge: avgYear ? currentYear - avgYear : null,
      oldestFilm, newestFilm, decadeData, yearClusters, yearWithMost, ratingYearScatter,
      // genre
      genreFreq, rarestGenre, topCombo, avgRuntimeByGenre,
      // people
      directorFreq, directorsWithMultiple, actorFreq, actorAcrossGenres, topPair,
      // runtime
      avgRuntime, shortestFilm, longestFilm, totalRuntimeMinutes, runtimeHistogramData,
      // ratings
      avgTmdbRating, avgImdbRating, highestRated, lowestRated, ratingDistData, rankRatingScatter, rankRatingCorrelation,
      // country/language
      countryFreq, nonEnglishCount, topNonUSCountry,
      // studio
      companyFreq, majorCount, indieCount, withCompaniesCount: withCompanies.length,
      // box office
      totalBoxOffice, highestGrossing, lowestGrossing, avgBudgetToGross,
      withRevenueCount: withRevenue.length, withBothCount: withBoth.length,
      // awards
      oscarWinningCount, oscarNominatedCount, totalOscarWins,
      // fun
      topWord, franchisePct, franchiseCount, bookPct, bookAdaptationCount, remakePct, remakeCount, sixDegreesHub,
      statsBackfilledCount: filmsWithCollectionData.length,
    }
  }, [myList, seenList, watchlist])

  const topFilm = myList[0]
  const hasData = myList.length > 0

  return (
    <div className={styles.page}>
      <div className="container">
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
            <h1 className={styles.auraPersonality}>{stats ? stats.personality.name : 'Film Explorer'}</h1>
            {stats && (
              <p className={styles.auraDescription}>{stats.personality.description}</p>
            )}
            {topFilm && (
              <p className={styles.auraTop}>
                #1 Film: <strong>{topFilm.title}</strong> ({topFilm.year})
              </p>
            )}
          </div>
        </div>

        {!hasData && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Start building your film list to unlock your Statistics.
            </p>
          </div>
        )}

        {hasData && backfilling && (
          <p className={styles.progressNote}>
            Crunching deeper stats… {progress.done}/{progress.total} films analyzed
          </p>
        )}

        {hasData && stats && (
          <>
            <div className={styles.statGrid}>
              <div className={styles.statCard}>
                <span className={styles.statNum}><AnimatedNumber value={stats.totalRanked} /></span>
                <span className={styles.statLabel}>Films Ranked</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNum}><AnimatedNumber value={stats.seenCount} /></span>
                <span className={styles.statLabel}>Films Seen</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNum}><AnimatedNumber value={stats.watchlistCount} /></span>
                <span className={styles.statLabel}>On Watchlist</span>
              </div>
              {stats.avgRuntime && (
                <div className={styles.statCard}>
                  <span className={styles.statNum}><AnimatedNumber value={stats.avgRuntime} />m</span>
                  <span className={styles.statLabel}>Avg Runtime</span>
                </div>
              )}
            </div>

            {/* ── Time & Era ──────────────────────────────────────────── */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Time & Era</h2>
              <div className={styles.statGrid}>
                {stats.avgYear && (
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{stats.avgYear}</span>
                    <span className={styles.statLabel}>Average Release Year ({stats.avgAge}yrs old)</span>
                  </div>
                )}
                {stats.oldestFilm && (
                  <div className={styles.statCard}>
                    <span className={styles.statNumSmall}>{stats.oldestFilm.title}</span>
                    <span className={styles.statLabel}>Oldest ({stats.oldestFilm.year})</span>
                  </div>
                )}
                {stats.newestFilm && (
                  <div className={styles.statCard}>
                    <span className={styles.statNumSmall}>{stats.newestFilm.title}</span>
                    <span className={styles.statLabel}>Newest ({stats.newestFilm.year})</span>
                  </div>
                )}
                {stats.yearWithMost && (
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{stats.yearWithMost[0]}</span>
                    <span className={styles.statLabel}>{stats.yearWithMost[1]} films that year</span>
                  </div>
                )}
              </div>

              {stats.decadeData.length > 0 && (
                <>
                  <h3 className={styles.subTitle}>By Decade</h3>
                  <Histogram data={stats.decadeData} />
                </>
              )}

              {stats.yearClusters.length > 0 && (
                <>
                  <h3 className={styles.subTitle}>Years With Multiple Films</h3>
                  <div className={styles.personList}>
                    {stats.yearClusters.slice(0, 6).map(([year, count]) => (
                      <div key={year} className={styles.personRow}>
                        <span className={styles.personName}>{year}</span>
                        <span className={styles.personCount}>{count} films</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {stats.ratingYearScatter.length >= 2 && (
                <>
                  <h3 className={styles.subTitle}>Rating vs. Release Year</h3>
                  <ScatterPlot data={stats.ratingYearScatter} xLabel="Year" yLabel="Rating" />
                </>
              )}
            </div>

            {/* ── Genre ───────────────────────────────────────────────── */}
            {stats.genreFreq.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Genre</h2>
                <PieChart data={stats.genreFreq.map(([label, value]) => ({ label, value }))} />
                <div className={styles.scalarGrid}>
                  {stats.rarestGenre && (
                    <p className={styles.scalarRow}><strong>Rarest genre:</strong> {stats.rarestGenre[0]} ({stats.rarestGenre[1]} film{stats.rarestGenre[1] !== 1 ? 's' : ''})</p>
                  )}
                  {stats.topCombo && (
                    <p className={styles.scalarRow}><strong>Most common combo:</strong> {stats.topCombo[0]} ({stats.topCombo[1]} films)</p>
                  )}
                </div>
                {stats.avgRuntimeByGenre.length > 0 && (
                  <>
                    <h3 className={styles.subTitle}>Average Runtime by Genre</h3>
                    <Histogram data={stats.avgRuntimeByGenre} formatValue={(v) => `${v}m`} />
                  </>
                )}
              </div>
            )}

            {/* ── People ──────────────────────────────────────────────── */}
            {(stats.directorFreq.length > 0 || stats.actorFreq.length > 0) && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>People</h2>
                {stats.directorFreq.length > 0 && (
                  <>
                    <h3 className={styles.subTitle}>Favorite Directors</h3>
                    <div className={styles.personList}>
                      {stats.directorFreq.slice(0, 5).map(([name, count], i) => (
                        <div key={name} className={styles.personRow}>
                          <span className={styles.personRank}>{i + 1}</span>
                          <span className={styles.personName}>{name}</span>
                          <span className={styles.personCount}>{count} film{count !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {stats.actorFreq.length > 0 && (
                  <>
                    <h3 className={styles.subTitle}>Frequent Actors</h3>
                    <div className={styles.personList}>
                      {stats.actorFreq.slice(0, 5).map(([name, count], i) => (
                        <div key={name} className={styles.personRow}>
                          <span className={styles.personRank}>{i + 1}</span>
                          <span className={styles.personName}>{name}</span>
                          <span className={styles.personCount}>{count} film{count !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className={styles.scalarGrid}>
                  <p className={styles.scalarRow}><strong>Directors with 2+ films:</strong> {stats.directorsWithMultiple.length}</p>
                  {stats.actorAcrossGenres && (
                    <p className={styles.scalarRow}><strong>Most genre-spanning actor:</strong> {stats.actorAcrossGenres[0]} ({stats.actorAcrossGenres[1]} genres)</p>
                  )}
                  {stats.topPair && (
                    <p className={styles.scalarRow}><strong>Top director–actor pair:</strong> {stats.topPair[0]} ({stats.topPair[1]} films)</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Runtime ─────────────────────────────────────────────── */}
            {stats.avgRuntime && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Runtime</h2>
                <div className={styles.statGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{stats.avgRuntime}m</span>
                    <span className={styles.statLabel}>Average</span>
                  </div>
                  {stats.shortestFilm && (
                    <div className={styles.statCard}>
                      <span className={styles.statNumSmall}>{stats.shortestFilm.title}</span>
                      <span className={styles.statLabel}>Shortest ({stats.shortestFilm.runtime}m)</span>
                    </div>
                  )}
                  {stats.longestFilm && (
                    <div className={styles.statCard}>
                      <span className={styles.statNumSmall}>{stats.longestFilm.title}</span>
                      <span className={styles.statLabel}>Longest ({stats.longestFilm.runtime}m)</span>
                    </div>
                  )}
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{formatRuntime(stats.totalRuntimeMinutes)}</span>
                    <span className={styles.statLabel}>Back to Back</span>
                  </div>
                </div>
                {stats.runtimeHistogramData.length > 0 && <Histogram data={stats.runtimeHistogramData} />}
              </div>
            )}

            {/* ── Ratings & Reception ─────────────────────────────────── */}
            {stats.avgTmdbRating != null && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Ratings & Reception</h2>
                <div className={styles.statGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{stats.avgTmdbRating.toFixed(1)}</span>
                    <span className={styles.statLabel}>Avg TMDB Score</span>
                  </div>
                  {stats.avgImdbRating != null && (
                    <div className={styles.statCard}>
                      <span className={styles.statNum}>{stats.avgImdbRating.toFixed(1)}</span>
                      <span className={styles.statLabel}>Avg IMDb Rating</span>
                    </div>
                  )}
                  {stats.highestRated && (
                    <div className={styles.statCard}>
                      <span className={styles.statNumSmall}>{stats.highestRated.title}</span>
                      <span className={styles.statLabel}>Highest Rated ({stats.highestRated.vote_average.toFixed(1)})</span>
                    </div>
                  )}
                  {stats.lowestRated && (
                    <div className={styles.statCard}>
                      <span className={styles.statNumSmall}>{stats.lowestRated.title}</span>
                      <span className={styles.statLabel}>Lowest Rated ({stats.lowestRated.vote_average.toFixed(1)})</span>
                    </div>
                  )}
                </div>
                {stats.ratingDistData.length > 0 && (
                  <>
                    <h3 className={styles.subTitle}>Rating Distribution</h3>
                    <Histogram data={stats.ratingDistData} />
                  </>
                )}
                {stats.rankRatingScatter.length >= 2 && (
                  <>
                    <h3 className={styles.subTitle}>
                      Rank vs. Public Rating
                      {stats.rankRatingCorrelation != null && (
                        <span className={styles.correlationBadge}>
                          {stats.rankRatingCorrelation >= 0 ? '+' : ''}{stats.rankRatingCorrelation.toFixed(2)} correlation
                        </span>
                      )}
                    </h3>
                    <ScatterPlot data={stats.rankRatingScatter} xLabel="Rank" yLabel="Rating" />
                  </>
                )}
              </div>
            )}

            {/* ── Country & Language ──────────────────────────────────── */}
            {stats.countryFreq.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Country & Language</h2>
                <div className={styles.personList}>
                  {stats.countryFreq.slice(0, 6).map(([name, count], i) => (
                    <div key={name} className={styles.personRow}>
                      <span className={styles.personRank}>{i + 1}</span>
                      <span className={styles.personName}>{name}</span>
                      <span className={styles.personCount}>{count} film{count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.scalarGrid}>
                  <p className={styles.scalarRow}><strong>Non-English films:</strong> {stats.nonEnglishCount}</p>
                  {stats.topNonUSCountry && (
                    <p className={styles.scalarRow}><strong>Top country outside the US:</strong> {stats.topNonUSCountry[0]} ({stats.topNonUSCountry[1]})</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Studio / Production ─────────────────────────────────── */}
            {stats.companyFreq.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Studio & Production</h2>
                <div className={styles.personList}>
                  {stats.companyFreq.map(([name, count], i) => (
                    <div key={name} className={styles.personRow}>
                      <span className={styles.personRank}>{i + 1}</span>
                      <span className={styles.personName}>{name}</span>
                      <span className={styles.personCount}>{count} film{count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
                <h3 className={styles.subTitle}>Major Studio vs. Indie</h3>
                <Histogram
                  data={[{ label: 'Major', value: stats.majorCount }, { label: 'Indie', value: stats.indieCount }]}
                />
                <p className={styles.caveat}>Based on a fixed list of major studio names — a fun approximation, not authoritative.</p>
              </div>
            )}

            {/* ── Box Office / Budget ─────────────────────────────────── */}
            {stats.withRevenueCount > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Box Office & Budget</h2>
                <div className={styles.statGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{CURRENCY.format(stats.totalBoxOffice)}</span>
                    <span className={styles.statLabel}>Total Combined Box Office</span>
                  </div>
                  {stats.highestGrossing && (
                    <div className={styles.statCard}>
                      <span className={styles.statNumSmall}>{stats.highestGrossing.title}</span>
                      <span className={styles.statLabel}>Highest Grossing ({CURRENCY.format(stats.highestGrossing.revenue)})</span>
                    </div>
                  )}
                  {stats.lowestGrossing && (
                    <div className={styles.statCard}>
                      <span className={styles.statNumSmall}>{stats.lowestGrossing.title}</span>
                      <span className={styles.statLabel}>Lowest Grossing ({CURRENCY.format(stats.lowestGrossing.revenue)})</span>
                    </div>
                  )}
                  {stats.avgBudgetToGross != null && (
                    <div className={styles.statCard}>
                      <span className={styles.statNum}>{stats.avgBudgetToGross.toFixed(1)}×</span>
                      <span className={styles.statLabel}>Avg Budget-to-Gross</span>
                    </div>
                  )}
                </div>
                <p className={styles.caveat}>
                  Based on available data ({stats.withRevenueCount} of {stats.totalRanked} films) — TMDB's box office
                  data is incomplete for many titles, so films with no reported revenue are excluded from these numbers.
                </p>
              </div>
            )}

            {/* ── Awards ──────────────────────────────────────────────── */}
            {(stats.oscarWinningCount > 0 || stats.oscarNominatedCount > 0) && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Awards</h2>
                <div className={styles.statGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}><AnimatedNumber value={stats.oscarWinningCount} /></span>
                    <span className={styles.statLabel}>Oscar-Winning Films</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}><AnimatedNumber value={stats.oscarNominatedCount} /></span>
                    <span className={styles.statLabel}>Oscar-Nominated Films</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}><AnimatedNumber value={stats.totalOscarWins} /></span>
                    <span className={styles.statLabel}>Total Oscar Wins</span>
                  </div>
                </div>
                <p className={styles.caveat}>Parsed from OMDb's free-text awards summaries — best effort, not guaranteed exact for every film.</p>
              </div>
            )}

            {/* ── Fun / Novelty ───────────────────────────────────────── */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Fun & Novelty</h2>
              <div className={styles.scalarGrid}>
                {stats.topWord && (
                  <p className={styles.scalarRow}><strong>Most common title word:</strong> "{stats.topWord[0]}" ({stats.topWord[1]} films)</p>
                )}
                {stats.statsBackfilledCount > 0 && (
                  <p className={styles.scalarRow}><strong>Part of a franchise:</strong> {stats.franchisePct}% ({stats.franchiseCount} films)</p>
                )}
                {stats.bookAdaptationCount > 0 && (
                  <p className={styles.scalarRow}><strong>Based on a book:</strong> {stats.bookPct}% ({stats.bookAdaptationCount} films)</p>
                )}
                {stats.remakeCount > 0 && (
                  <p className={styles.scalarRow}><strong>Remakes:</strong> {stats.remakePct}% ({stats.remakeCount} films)</p>
                )}
              </div>
              {stats.sixDegreesHub && (
                <>
                  <h3 className={styles.subTitle}>Six Degrees — Most Connected Actor</h3>
                  <p className={styles.scalarRow}>
                    <strong>{stats.sixDegreesHub.name}</strong> has co-starred with {stats.sixDegreesHub.count} other
                    actor{stats.sixDegreesHub.count !== 1 ? 's' : ''} from your list
                  </p>
                  {stats.sixDegreesHub.coStars.length > 0 && (
                    <p className={styles.caveat}>
                      Including {stats.sixDegreesHub.coStars.join(', ')}
                      {stats.sixDegreesHub.count > stats.sixDegreesHub.coStars.length ? ', and more' : ''}.
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
