import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import UniverseSection from '../components/UniverseSection'
import styles from './SavedQuickLists.module.css'

export default function SavedQuickLists() {
  const { savedQuickLists, deleteSavedQuickList } = useFilm()

  // Newest saved first.
  const lists = [...savedQuickLists].reverse()

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Saved Quick Lists</h1>
          <span className={styles.count}>{lists.length} saved</span>
        </div>

        {lists.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Save a Quick List and it'll appear here, one row per batch.
            </p>
            <Link to="/quick-list" className={styles.exploreLink}>Build a Quick List →</Link>
          </div>
        ) : (
          <div className={styles.sections}>
            {lists.map((list) => (
              <div key={list.id} className={styles.listBlock}>
                <div className={styles.listBlockMeta}>
                  <span className={styles.savedDate}>
                    Saved {new Date(list.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => deleteSavedQuickList(list.id)}
                  >
                    Delete
                  </button>
                </div>
                <UniverseSection title={list.name} items={list.films} type="movie" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
