import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import { PLACEHOLDER_POSTER } from '../api/tmdb'
import styles from './Home.module.css'

export default function Home() {
  const { movies, seenList } = useFilm()
  const [bgIndex, setBgIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const intervalRef = useRef(null)

  const backdropMovies = movies
    .filter((m) => m.backdropUrl)
    .slice(0, 8)

  useEffect(() => {
    if (backdropMovies.length === 0) return
    setLoaded(true)
    intervalRef.current = setInterval(() => {
      setBgIndex((i) => (i + 1) % backdropMovies.length)
    }, 6000)
    return () => clearInterval(intervalRef.current)
  }, [backdropMovies.length])

  const featuredMovies = [...movies]
    .sort(() => Math.random() - 0.5)
    .slice(0, 12)

  const yearsRange = movies.length
    ? `${Math.min(...movies.map((m) => m.year))}–${Math.max(...movies.map((m) => m.year))}`
    : ''

  const countries = 12

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
          <p className={styles.eyebrow}>A Curated Film Journal</p>
          <h1 className={styles.heroTitle}>FilmFolio</h1>
          <p className={styles.heroTagline}>Discover Your Perfect Movie Picks</p>
          <div className={styles.heroCtas}>
            <Link to="/movies" className={styles.ctaPrimary}>
              Explore My Top 100
            </Link>
            <Link to="/my-list" className={styles.ctaSecondary}>
              Build Your Top 10
            </Link>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className={styles.intro}>
        <div className="container">
          <div className={styles.introGrid}>
            <div className={styles.introCopy}>
              <h2 className={styles.introHeading}>A Movie Lover's Corner</h2>
              <p className={styles.introText}>
                FilmFolio is a personal curation of cinema's finest — spanning silent masterworks to
                contemporary breakthroughs. These are the films that shaped a love of the medium,
                chosen not by algorithm but by genuine devotion to the art form.
              </p>
              <p className={styles.introText}>
                Browse the top 100, track what you've seen, build your own ranked list, and discover
                what to watch next based on your taste.
              </p>
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statNum}>100</span>
                <span className={styles.statLabel}>Films Curated</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{yearsRange}</span>
                <span className={styles.statLabel}>Years Spanning</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{countries}+</span>
                <span className={styles.statLabel}>Countries</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{seenList.size}</span>
                <span className={styles.statLabel}>You've Seen</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured strip */}
      <section className={styles.featured}>
        <div className="container">
          <h2 className={styles.featuredHeading}>From the Collection</h2>
        </div>
        <div className={styles.strip}>
          {featuredMovies.map((movie) => (
            <Link to="/movies" key={movie.rank} className={styles.stripCard}>
              <img
                src={movie.posterUrl || PLACEHOLDER_POSTER}
                alt={movie.title}
                className={styles.stripPoster}
                loading="lazy"
              />
              <div className={styles.stripOverlay}>
                <span className={styles.stripTitle}>{movie.title}</span>
                <span className={styles.stripYear}>{movie.year}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="container">
          <div className={styles.featuredFooter}>
            <Link to="/movies" className={styles.viewAll}>
              View all 100 films →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
