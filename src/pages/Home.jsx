import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER } from '../api/tmdb'
import styles from './Home.module.css'

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
  const { movies, seenList, myList } = useFilm()
  const [bgIndex, setBgIndex] = useState(0)
  const intervalRef = useRef(null)

  const backdropMovies = movies.filter((m) => m.backdropUrl).slice(0, 8)

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
              <h2 className={styles.introHeading}>The FilmFolio Experience</h2>
              <p className={styles.introText}>
                FilmFolio is your personal film universe. Rank your favorite movies, build lists across
                every genre, discover films tailored to your taste, and track everything you've seen.
                Your lists. Your rankings. Your cinema.
              </p>
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
