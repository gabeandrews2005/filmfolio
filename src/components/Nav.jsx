import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import HamburgerMenu from './HamburgerMenu'
import styles from './Nav.module.css'

export default function Nav() {
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
                My List
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/quick-list"
                className={({ isActive }) => isActive ? styles.active : ''}
              >
                Quick List
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
