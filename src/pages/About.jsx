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

          <div className={styles.body}>
            <div className={styles.photoWrap}>
              <div className={styles.photoPlaceholder}>
                <span className={styles.photoIcon}>◻</span>
                <span className={styles.photoLabel}>Photo coming soon</span>
              </div>
            </div>

            <div className={styles.text}>
              <h2 className={styles.sectionHeading}>The Story</h2>
              <p className={styles.para}>
                FilmFolio is Gabe's personal curation — a love letter to cinema assembled over
                years of watching, rewatching, and arguing about film. The list represents a
                genuine attempt to capture the movies that matter most: not necessarily the most
                popular, but the ones that linger.
              </p>
              <p className={styles.para}>
                [Gabe's personal story goes here. Replace this placeholder with your own words —
                what got you into film, your favorite theaters, your watching habits, or the moment
                you knew movies were more than entertainment.]
              </p>
              <p className={styles.para}>
                The list spans 1941 to the present, drawing from festival darlings, Hollywood
                classics, international arthouse, and animation. It will keep changing — because
                a real film education never stops.
              </p>

              <h2 className={styles.sectionHeading}>The Project</h2>
              <p className={styles.para}>
                FilmFolio is a passion project built to share this list with friends, track what
                they've seen, and offer recommendations powered by The Movie Database. It's personal,
                opinionated, and unashamedly a work in progress.
              </p>

              <div className={styles.contact}>
                <h2 className={styles.sectionHeading}>Get in Touch</h2>
                <p className={styles.para}>
                  Want to argue about the ranking? Think something crucial is missing?
                </p>
                <div className={styles.contactLinks}>
                  <a href="#" className={styles.contactLink}>
                    <span className={styles.contactIcon}>✉</span>
                    Email · [your@email.com]
                  </a>
                  <a href="#" className={styles.contactLink}>
                    <span className={styles.contactIcon}>⌗</span>
                    Letterboxd · [your username]
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
