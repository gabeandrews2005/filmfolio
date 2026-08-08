import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import styles from './HamburgerMenu.module.css'

const OVERFLOW_LINKS = [
  { to: '/lists/actors',    label: 'Actors' },
  { to: '/lists/directors', label: 'Directors' },
  { to: '/lists/shows',     label: 'Shows' },
  { to: '/lists/animated',  label: 'Animated' },
  { to: '/lists/horror',    label: 'Horror' },
  { to: '/lists/comedies',  label: 'Comedies' },
  { to: '/lists/seasonal',  label: 'Seasonal' },
  { to: '/seen',            label: 'Seen Films' },
  { to: '/watchlist',       label: 'Watchlist' },
  { to: '/quick-lists',     label: 'Saved Quick Lists' },
  { to: '/universe',        label: 'Universe' },
  { to: '/friends',         label: 'Friends' },
  { to: '/statistics',      label: 'Statistics' },
  { to: '/film-frenzy',     label: 'Film Frenzy' },
  { to: '/about',           label: 'About' },
]

export default function HamburgerMenu({ isOpen, onClose }) {
  const { user } = useFilm()

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-label="Navigation menu"
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Menu</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </div>

        {user ? (
          <NavLink to={`/profile/${user.username}`} className={styles.profileLink} onClick={onClose}>
            <div className={styles.profileAvatar}>
              {user.avatar
                ? <img src={user.avatar} alt={user.username} />
                : <span>{user.username[0].toUpperCase()}</span>
              }
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>{user.username}</span>
              <span className={styles.profileLabel}>View profile</span>
            </div>
          </NavLink>
        ) : (
          <NavLink to="/account" className={styles.profileLink} onClick={onClose}>
            <div className={styles.profileAvatar}>
              <span>?</span>
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>Create Account</span>
              <span className={styles.profileLabel}>Save your lists</span>
            </div>
          </NavLink>
        )}

        <nav className={styles.links}>
          {user && (
            <NavLink
              to="/account"
              className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}
              onClick={onClose}
            >
              Account
            </NavLink>
          )}
          {OVERFLOW_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}
              onClick={onClose}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.drawerFooter}>
          <span className={styles.footerBrand}>FilmFolio</span>
        </div>
      </div>
    </>
  )
}
