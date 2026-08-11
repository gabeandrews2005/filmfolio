import { Link } from 'react-router-dom'
import { PLACEHOLDER_POSTER, getProfileUrl } from '../api/tmdb'
import useOmdbRatings from '../hooks/useOmdbRatings'
import RatingDisplay from './RatingDisplay'
import styles from './UniverseSection.module.css'

function UniverseCard({ item, rank, type }) {
  const imgUrl = item.posterUrl
    ?? (item.headshot_path ? getProfileUrl(item.headshot_path) : null)
    ?? PLACEHOLDER_POSTER
  const label = item.title ?? item.name ?? ''
  const year = item.year ?? ''
  // Only real films have a useful rating to fetch — people (actors/
  // directors) have no tmdb_id at all, and shows use a different TMDB
  // endpoint this movie-only lookup doesn't cover.
  const { ratings } = useOmdbRatings(type === 'movie' ? item.tmdb_id : null)

  return (
    <div className={styles.card}>
      <div className={styles.posterWrap}>
        <img
          src={imgUrl}
          alt={label}
          className={styles.poster}
          loading="lazy"
          onError={(e) => { e.target.src = PLACEHOLDER_POSTER }}
        />
        <span className={styles.rank}>#{rank}</span>
      </div>
      <div className={styles.info}>
        <span className={styles.cardTitle}>{label}</span>
        {year && <span className={styles.cardYear}>{year}</span>}
        {type === 'movie' && (
          <RatingDisplay
            compact
            rtScore={ratings?.rtScore}
            imdbRating={ratings?.imdbRating}
            tmdbScore={item.vote_average}
          />
        )}
      </div>
    </div>
  )
}

// dragHandleProps/isDragging are optional — only Profile's self-view (where
// section order is user-customizable) passes them; every other caller
// (Universe strips elsewhere, Saved Quick Lists, a friend's read-only
// profile) renders exactly as before with no handle at all.
export default function UniverseSection({ title, items, editPath, type = 'movie', dragHandleProps, isDragging }) {
  if (!items || items.length === 0) return null

  return (
    <section className={`${styles.section} ${isDragging ? styles.sectionDragging : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {dragHandleProps && (
            <button
              type="button"
              className={styles.dragHandle}
              aria-label={`Reorder ${title}`}
              {...dragHandleProps}
            >
              ⠿
            </button>
          )}
          <h2 className={styles.title}>{title}</h2>
        </div>
        {editPath && (
          <Link to={editPath} className={styles.editLink}>
            Edit →
          </Link>
        )}
      </div>

      <div className={styles.strip}>
        {items.map((item, i) => (
          <UniverseCard
            key={item.tmdb_id ?? item.person_id ?? i}
            item={item}
            rank={i + 1}
            type={type}
          />
        ))}
      </div>
    </section>
  )
}
