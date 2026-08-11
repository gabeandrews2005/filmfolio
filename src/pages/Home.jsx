import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER, getMovieDetails, getBackdropUrl, searchMovies } from '../api/tmdb'
import EXPLORE_MOVIES from '../data/exploreMovies.json'
import styles from './Home.module.css'

const BACKDROP_POOL_SIZE = 8
const BACKDROP_CANDIDATE_COUNT = 16 // pull extra in case some lack a backdrop image

// Curated-title lookups are throttled — firing them all at once triggers
// TMDB rate-limiting — and empty responses are retried with backoff.
async function resolveMovieWithRetry(title, attempt = 0) {
  const results = await searchMovies(title)
  if (results.length > 0 || attempt >= 2) return results
  await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  return resolveMovieWithRetry(title, attempt + 1)
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let index = 0
  async function run() {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

const SITE_DIRECTORY = [
  { to: '/explore',         icon: '🎬', label: 'Explore',       desc: 'Browse thousands of films across all genres and eras' },
  { to: '/my-list',         icon: '🏆', label: 'My List',       desc: 'Build and rank your personal top films list' },
  { to: '/recommendations', icon: '✨', label: 'Picks For You', desc: 'AI-powered recommendations based on your taste' },
  { to: '/lists/actors',    icon: '🎭', label: 'Actors',        desc: 'Curate your favorite actors and track their films' },
  { to: '/lists/directors', icon: '🎥', label: 'Directors',     desc: 'Track the auteurs whose work you love most' },
  { to: '/lists/shows',     icon: '📺', label: 'Shows',         desc: 'Your ranked list of favorite TV series' },
  { to: '/lists/animated',  icon: '🎨', label: 'Animated',      desc: 'The best in animation, ranked your way' },
  { to: '/lists/horror',    icon: '🩸', label: 'Horror',        desc: 'Your definitive horror rankings' },
  { to: '/lists/comedies',  icon: '😄', label: 'Comedies',      desc: 'The films that made you laugh the hardest' },
  { to: '/lists/seasonal',  icon: '❄️', label: 'Seasonal',      desc: 'Holiday and seasonal films for the right moment' },
  { to: '/universe',        icon: '🌌', label: 'Universe',      desc: 'Your complete film identity in one dashboard' },
  { to: '/seen',            icon: '✓',  label: 'Seen Films',    desc: 'Every film you\'ve watched, tracked automatically' },
  { to: '/watchlist',       icon: '🔖', label: 'Watchlist',     desc: 'Films saved to watch next' },
  { to: '/friends',         icon: '👥', label: 'Friends',       desc: 'See what others are watching and ranking' },
  { to: '/statistics',      icon: '📊', label: 'Statistics',    desc: 'Your film personality — data driven and beautiful' },
  { to: '/about',           icon: 'ℹ', label: 'About',         desc: 'The story behind FilmFolio' },
]

export default function Home() {
  const { seenList, myList } = useFilm()
  const [bgIndex, setBgIndex] = useState(0)
  const intervalRef = useRef(null)
  const [exploreBackdrops, setExploreBackdrops] = useState([])
  const [myListBackdrops, setMyListBackdrops] = useState([])

  const hasMyList = myList.length > 0

  // Before the user has ranked anything, the hero pulls backdrops from the
  // curated Explore list (fixed order, first N candidates resolved via TMDB).
  useEffect(() => {
    if (hasMyList) return
    let cancelled = false
    const candidates = EXPLORE_MOVIES.slice(0, BACKDROP_CANDIDATE_COUNT)
    mapWithConcurrency(candidates, 6, (title) => resolveMovieWithRetry(title))
      .then((responses) => {
        if (cancelled) return
        const seen = new Set()
        const backdrops = []
        for (const results of responses) {
          const match = results?.[0]
          if (!match || !match.backdrop_path || seen.has(match.id)) continue
          seen.add(match.id)
          backdrops.push({
            tmdb_id: match.id,
            title: match.title,
            backdropUrl: getBackdropUrl(match.backdrop_path),
          })
          if (backdrops.length >= BACKDROP_POOL_SIZE) break
        }
        setExploreBackdrops(backdrops)
      })
    return () => { cancelled = true }
  }, [hasMyList])

  // Once the user has films of their own, the hero switches to their list instead.
  useEffect(() => {
    if (!hasMyList) return
    let cancelled = false
    const candidates = myList.slice(0, BACKDROP_CANDIDATE_COUNT)
    Promise.all(candidates.map(async (m) => {
      if (m.backdropUrl) return m
      const details = await getMovieDetails(m.tmdb_id)
      return details?.backdrop_path
        ? { ...m, backdropUrl: getBackdropUrl(details.backdrop_path) }
        : null
    })).then((results) => {
      if (cancelled) return
      setMyListBackdrops(results.filter((m) => m?.backdropUrl).slice(0, BACKDROP_POOL_SIZE))
    })
    return () => { cancelled = true }
  }, [hasMyList, myList])

  const backdropMovies = hasMyList ? myListBackdrops : exploreBackdrops

  // Reset the crossfade index whenever the backdrop source switches, so a
  // leftover index from a longer list can't point past the end of a shorter one.
  useEffect(() => {
    setBgIndex(0)
  }, [hasMyList])

  useEffect(() => {
    if (backdropMovies.length === 0) return
    intervalRef.current = setInterval(() => {
      setBgIndex((i) => (i + 1) % backdropMovies.length)
    }, 6000)
    return () => clearInterval(intervalRef.current)
  }, [backdropMovies.length])

  // User stats
  const myFilmsCount = myList.length
  const myYearsRange = myList.length >= 2
    ? `${Math.min(...myList.map((m) => parseInt(m.year)).filter(Boolean))}–${Math.max(...myList.map((m) => parseInt(m.year)).filter(Boolean))}`
    : '—'
  const seenCount = seenList.size
  const topFilm = myList[0] ?? null

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBackdrops}>
          {backdropMovies.map((m, i) => (
            <div
              key={m.tmdb_id}
              className={`${styles.heroBackdrop} ${i === bgIndex ? styles.active : ''}`}
              style={{ backgroundImage: `url(${m.backdropUrl})` }}
            />
          ))}
          {backdropMovies.length === 0 && (
            <div className={styles.heroBackdrop} style={{ background: 'var(--bg-secondary)' }} />
          )}
        </div>
        <div className={styles.heroVignette} />
        <div className={styles.heroGrain} />

        <div className={`container ${styles.heroContent}`}>
          <p className={styles.eyebrow}>A Personal Film Journal</p>
          <h1 className={styles.heroTitle}>FilmFolio</h1>
          <p className={styles.heroTagline}>The FilmFolio Experience</p>
          <div className={styles.heroCtas}>
            <Link to="/explore" className={styles.ctaPrimary}>
              Explore Films
            </Link>
            <Link to="/my-list" className={styles.ctaSecondary}>
              Build Your Film List
            </Link>
          </div>
        </div>
      </section>

      {/* Intro + Stats */}
      <section className={styles.intro}>
        <div className="container">
          <div className={styles.introGrid}>
            <div className={styles.introCopy}>
              <h2 className={styles.introHeading}>How to Use FilmFolio</h2>

              <div className={styles.howToStep}>
                <span className={styles.howToNum}>01</span>
                <p className={styles.introText}>
                  Start on the <Link to="/explore" className={styles.introLink}>Explore</Link> page,
                  where you can scroll through a feed of films to discover new titles. Add any film
                  you like straight to your list with a single tap.
                </p>
              </div>

              <div className={styles.howToStep}>
                <span className={styles.howToNum}>02</span>
                <p className={styles.introText}>
                  Once you're on <Link to="/my-list" className={styles.introLink}>My List</Link>, drag
                  and drop movies into any order or section you want — arrange them however makes
                  sense to you, whether that's by rank, mood, or category.
                </p>
              </div>

              <div className={styles.howToStep}>
                <span className={styles.howToNum}>03</span>
                <p className={styles.introText}>
                  As you build out your list, FilmFolio uses it to generate{' '}
                  <Link to="/recommendations" className={styles.introLink}>Recommendations</Link> —
                  personalized movie suggestions based on what you've already added, so the more you
                  list, the better your suggestions get.
                </p>
              </div>

              <div className={styles.howToStep}>
                <span className={styles.howToNum}>04</span>
                <p className={styles.introText}>
                  Want more focused collections? Create{' '}
                  <Link to="/universe" className={styles.introLink}>Specialty Lists</Link> — themed
                  lists like your favorite actors or animated films. Build these using movies already
                  on your main list, or add new films independently, just for that list.
                </p>
              </div>

              <div className={styles.howToStep}>
                <span className={styles.howToNum}>05</span>
                <p className={styles.introText}>
                  Need something faster? Use{' '}
                  <Link to="/quick-list" className={styles.introLink}>Quick Lists</Link> for
                  on-the-fly collections you want to save without the extra setup of a full specialty
                  list.
                </p>
              </div>

              <div className={styles.howToStep}>
                <span className={styles.howToNum}>06</span>
                <p className={styles.introText}>
                  Finally, add <Link to="/friends" className={styles.introLink}>Friends</Link> to
                  compare profiles side by side — see how your taste in film stacks up and find
                  common ground (or fun differences) in what you each love.
                </p>
              </div>
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statNum}>{myFilmsCount || '—'}</span>
                <span className={styles.statLabel}>Movies Ranked</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{myFilmsCount >= 2 ? myYearsRange : '—'}</span>
                <span className={styles.statLabel}>Years Spanning</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{seenCount}</span>
                <span className={styles.statLabel}>Films Seen</span>
              </div>
              <div className={`${styles.stat} ${styles.statFilm}`}>
                {topFilm ? (
                  <>
                    <img
                      src={topFilm.posterUrl || PLACEHOLDER_POSTER}
                      alt={topFilm.title}
                      className={styles.statPoster}
                    />
                    <div>
                      <span className={styles.statNumSmall}>#1 Film</span>
                      <span className={styles.statLabel}>{topFilm.title}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className={styles.statNum}>—</span>
                    <span className={styles.statLabel}>Your #1 Film</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Site Directory */}
      <section className={styles.directory}>
        <div className="container">
          <h2 className={styles.directoryHeading}>Everything in FilmFolio</h2>
          <div className={styles.directoryGrid}>
            {SITE_DIRECTORY.map(({ to, icon, label, desc }) => (
              <Link key={to} to={to} className={styles.dirCard}>
                <span className={styles.dirIcon}>{icon}</span>
                <div className={styles.dirInfo}>
                  <span className={styles.dirLabel}>{label}</span>
                  <span className={styles.dirDesc}>{desc}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
