import { getProfileUrl } from '../api/tmdb'
import styles from './PersonCard.module.css'

const PLACEHOLDER_PERSON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='185' height='278' viewBox='0 0 185 278'%3E%3Crect width='185' height='278' fill='%23141414'/%3E%3Ccircle cx='92' cy='95' r='40' fill='%232a2520'/%3E%3Cellipse cx='92' cy='200' rx='60' ry='40' fill='%232a2520'/%3E%3C/svg%3E`

export default function PersonCard({ person, rank, onRemove, draggable }) {
  const imgUrl = person.headshot_path
    ? getProfileUrl(person.headshot_path)
    : PLACEHOLDER_PERSON

  return (
    <div className={styles.card}>
      <div className={styles.imageWrap}>
        <img
          src={imgUrl}
          alt={person.name}
          className={styles.image}
          loading="lazy"
          onError={(e) => { e.target.src = PLACEHOLDER_PERSON }}
        />
        {rank !== undefined && (
          <span className={styles.rankBadge}>#{rank}</span>
        )}
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{person.name}</span>
      </div>
      {onRemove && (
        <button
          className={styles.removeBtn}
          onClick={() => onRemove(person.person_id)}
          aria-label={`Remove ${person.name}`}
        >
          ×
        </button>
      )}
    </div>
  )
}
