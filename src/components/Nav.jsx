import { NavLink } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import styles from './Nav.module.css'

export default function Nav() {
  const { myTop10, seenList } = useFilm()

  return (
    <nav className={styles.nav}>
      <div className={`container ${styles.inner}`}>
        <NavLink to="/" className={styles.logo}>
          FilmFolio
        </NavLink>
        <ul className={styles.links}>
          <li>
            <NavLink
              to="/movies"
              className={({ isActive }) => isActive ? styles.active : ''}
            >
              Top 100
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
          <li>
            <NavLink
              to="/about"
              className={({ isActive }) => isActive ? styles.active : ''}
            >
              About
            </NavLink>
          </li>
        </ul>
        <span className={styles.seen}>
          {seenList.size}<span className={styles.seenLabel}> seen</span>
        </span>
      </div>
    </nav>
  )
}
