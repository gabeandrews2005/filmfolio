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
            <p className={styles.para}>
              [Personal statement coming soon]
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
