import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import styles from './HamburgerMenu.module.css'

const OVERFLOW_LINKS = [
  { to: '/lists/actors',    label: 'Actors' },
  { to: '/lists/shows',     label: 'Shows' },
  { to: '/lists/directors', label: 'Directors' },
  { to: '/lists/animated',  label: 'Animated' },
  { to: '/lists/horror',    label: 'Horror' },
  { to: '/lists/comedies',  label: 'Comedies' },
  { to: '/lists/seasonal',  label: 'Seasonal' },
  { to: '/universe',        label: 'Universe' },
  { to: '/friends',         label: 'Friends' },
  { to: '/about',           label: 'About' },
]

export default function HamburgerMenu({ isOpen, onClose }) {
  const { user } = useFilm()

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
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

        {user && (
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
        )}

        <nav className={styles.links}>
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
