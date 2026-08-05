import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import styles from './Account.module.css'

export default function Account() {
  const { user, setUser } = useFilm()
  const navigate = useNavigate()
  const [username, setUsername] = useState(user?.username ?? '')
  const [avatar, setAvatar] = useState(user?.avatar ?? null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

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
      createdAt: user?.createdAt ?? new Date().toISOString(),
    }
    setUser(userData)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleSignOut() {
    if (window.confirm('Sign out and clear your profile? Your lists will stay saved on this device.')) {
      setUser(null)
      navigate('/')
    }
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>{user ? 'Account Settings' : 'Create Your Account'}</h1>
            <p className={styles.subtitle}>
              {user
                ? 'Update your username and photo.'
                : 'Set up a profile to save your lists and connect with friends.'}
            </p>
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
              />
              {error && <span className={styles.error}>{error}</span>}
            </div>

            <div className={styles.actions}>
              <button type="submit" className={styles.submitBtn} disabled={!username.trim()}>
                {user ? 'Save Changes' : 'Create Account →'}
              </button>
              {saved && <span className={styles.savedMsg}>Saved</span>}
            </div>
          </form>

          {user && (
            <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
