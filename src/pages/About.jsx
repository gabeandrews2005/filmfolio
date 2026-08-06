import styles from './About.module.css'

export default function About() {
  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.title}>About FilmFolio</h1>
            <p className={styles.subtitle}>A personal film journal</p>
          </div>

          <div className={styles.text}>
            <p className={styles.para}>
              FilmFolio started as a simple idea: keeping track of the movies you've watched
              shouldn't feel like a chore, and finding what to watch next shouldn't mean
              scrolling through five different apps.
            </p>
            <p className={styles.para}>
              Built as a father-son project, FilmFolio blends a love of film with a passion
              for building things from the ground up. What began as a shared weekend project
              has grown into a full-fledged platform for tracking, rating, and discovering
              movies — designed by people who actually use it themselves.
            </p>
            <p className={styles.para}>
              Whether you're logging a classic you just rewatched, building out a list of
              everything you want to see this year, or just looking for your next favorite
              film, FilmFolio is built to make that process simple, fast, and genuinely
              enjoyable.
            </p>
            <p className={styles.para}>
              This is a project that's still growing — new features, refinements, and ideas
              are always in the works. Thanks for checking it out.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
