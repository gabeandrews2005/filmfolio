import { useNavigate } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import TopTenBuilder from '../components/TopTenBuilder'
import styles from './MyList.module.css'

export default function MyList() {
  const { myTop10 } = useFilm()
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Build Your Top 10</h1>
            <p className={styles.subtitle}>
              Pick any 10 films, rank them your way, and get personalized recommendations.
            </p>
          </div>
          {myTop10.length > 0 && (
            <button
              className={`${styles.recommendBtn} ${myTop10.length < 3 ? styles.disabled : ''}`}
              onClick={() => myTop10.length >= 3 && navigate('/recommendations')}
              disabled={myTop10.length < 3}
            >
              {myTop10.length < 3
                ? `Add ${3 - myTop10.length} more to get picks`
                : 'Get Recommendations →'}
            </button>
          )}
        </div>

        <TopTenBuilder />

        {myTop10.length >= 3 && (
          <div className={styles.footer}>
            <button className={styles.recommendBtnLg} onClick={() => navigate('/recommendations')}>
              Get My Recommendations →
            </button>
            <p className={styles.footerHint}>
              Based on your {myTop10.length} selected films
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
