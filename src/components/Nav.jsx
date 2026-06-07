import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import HamburgerMenu from './HamburgerMenu'
import styles from './Nav.module.css'

export default function Nav() {
  const { myTop10, seenList } = useFilm()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <nav className={styles.nav}>
        <div className={`container ${styles.inner}`}>
          <NavLink to="/" className={styles.logo}>
            FilmFolio
          </NavLink>

          <ul className={styles.links}>
            <li>
              <NavLink
                to="/explore"
                className={({ isActive }) => isActive ? styles.active : ''}
              >
                Explore
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/my-list"
                className={({ isActive }) => isActive ? styles.active : ''}
              >
                My Top 10
                {myTop10.length > 0 && (
                  <span className={styles.badge}>{myTop10.length}</span>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/recommendations"
                className={({ isActive }) => isActive ? styles.active : ''}
              >
                Picks For You
              </NavLink>
            </li>
          </ul>

          <div className={styles.right}>
            <span className={styles.seen}>
              {seenList.size}<span className={styles.seenLabel}> seen</span>
            </span>
            <button
              className={styles.hamburger}
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <span className={styles.hamburgerBar} />
              <span className={styles.hamburgerBar} />
              <span className={styles.hamburgerBar} />
            </button>
          </div>
        </div>
      </nav>

      <HamburgerMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
