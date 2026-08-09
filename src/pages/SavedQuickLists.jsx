import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import UniverseSection from '../components/UniverseSection'
import ConfirmModal from '../components/ConfirmModal'
import styles from './SavedQuickLists.module.css'

export default function SavedQuickLists() {
  const { savedQuickLists, deleteSavedQuickList, quickList, loadQuickList } = useFilm()
  const navigate = useNavigate()
  const [pendingEdit, setPendingEdit] = useState(null) // list awaiting overwrite confirmation

  // Newest saved first.
  const lists = [...savedQuickLists].reverse()

  function openForEditing(list) {
    loadQuickList(list.films)
    navigate('/quick-list', { state: { editingSavedListId: list.id, editingSavedListName: list.name } })
  }

  function handleEditClick(list) {
    // The working Quick List is a separate scratch space — editing a saved
    // list loads its films into it, which would silently wipe out whatever
    // the user was already building there if it's non-empty.
    if (quickList.length > 0) {
      setPendingEdit(list)
    } else {
      openForEditing(list)
    }
  }

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
                  <div className={styles.listBlockActions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => handleEditClick(list)}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteSavedQuickList(list.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <UniverseSection title={list.name} items={list.films} type="movie" />
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingEdit && (
        <ConfirmModal
          title="Replace your working Quick List?"
          message={`Editing "${pendingEdit.name}" will load its films into your working Quick List, replacing what's there now. Save or clear your current Quick List first if you want to keep it.`}
          confirmLabel="Continue Editing"
          destructive
          onConfirm={() => { openForEditing(pendingEdit); setPendingEdit(null) }}
          onCancel={() => setPendingEdit(null)}
        />
      )}
    </div>
  )
}
