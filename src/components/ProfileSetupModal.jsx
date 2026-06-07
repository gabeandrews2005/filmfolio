import { useState } from 'react'
import { useFilm } from '../context/FilmContext'
import styles from './ProfileSetupModal.module.css'

export default function ProfileSetupModal({ onComplete }) {
  const { setUser } = useFilm()
  const [username, setUsername] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [error, setError] = useState('')

  function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setAvatar(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = username.trim()
    if (trimmed.length < 2) {
      setError('Username must be at least 2 characters.')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError('Letters, numbers, and underscores only.')
      return
    }
    const userData = {
      username: trimmed,
      avatar: avatar ?? null,
      createdAt: new Date().toISOString(),
    }
    setUser(userData)
    onComplete(userData)
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Welcome to FilmFolio</h2>
          <p className={styles.subtitle}>Create a profile to save your lists and connect with friends.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarPreview}>
              {avatar
                ? <img src={avatar} alt="Avatar preview" />
                : <span className={styles.avatarPlaceholder}>?</span>
              }
            </div>
            <label className={styles.avatarLabel}>
              <input type="file" accept="image/*" onChange={handleAvatarChange} className={styles.fileInput} />
              {avatar ? 'Change photo' : 'Add photo (optional)'}
            </label>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className={styles.input}
              placeholder="e.g. film_lover"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError('') }}
              maxLength={30}
              autoFocus
            />
            {error && <span className={styles.error}>{error}</span>}
          </div>

          <button type="submit" className={styles.submitBtn} disabled={!username.trim()}>
            Create Profile →
          </button>

          <button type="button" className={styles.skipBtn} onClick={() => onComplete(null)}>
            Skip for now
          </button>
        </form>
      </div>
    </div>
  )
}
