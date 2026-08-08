import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import FilmCard from '../components/FilmCard'
import styles from './Watchlist.module.css'

export default function Watchlist() {
  const { watchlist, myList, quickList, horrorList, comediesList, animatedList, seasonalList } = useFilm()

  // A watchlist film only earns the "FilmFolio Pick!" badge once it was
  // added from Picks For You (fromRecommendations) AND has since made its
  // way onto one of the user's own lists — proof the algorithm's pick
  // actually panned out, not just a recommendation sitting unused.
  const userListPools = [myList, quickList, horrorList, comediesList, animatedList, seasonalList]
  function isFilmFolioPick(movie) {
    if (!movie.fromRecommendations) return false
    return userListPools.some((list) => list.some((m) => m.tmdb_id === movie.tmdb_id))
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Watchlist</h1>
          <span className={styles.count}>{watchlist.length} films</span>
        </div>

        {watchlist.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Save films to your watchlist and they'll appear here.
            </p>
            <Link to="/explore" className={styles.exploreLink}>Explore Films →</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {watchlist.map((movie) => (
              <FilmCard
                key={movie.tmdb_id}
                movie={movie}
                showAddToList
                filmFolioPick={isFilmFolioPick(movie)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
