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
              But the real origin goes back further than that. When I was 15, I started a movie
              list on a Google Sheet — nothing fancy, just a way to keep track of what I'd
              watched. Over the years, that spreadsheet grew. And grew. What started as a single
              running list turned into dozens of specialty lists, categories, and rankings, until
              it became this sprawling, slightly out-of-control document that somehow still made
              sense to me.
            </p>
            <p className={styles.para}>
              I started showing it to friends, and before long I had a bit of a reputation as the
              "movie guy" — the person people came to when they wanted a recommendation. I loved
              that. What I wanted next was for my friends to build their own lists too, even the
              ones who weren't nearly as obsessed with film as I was. But every time I tried to
              get someone to start one, it turned into this daunting, overwhelming task. Too many
              categories, too much effort, not enough payoff. The thing that worked so well for
              me wasn't working for anyone else.
            </p>
            <p className={styles.para}>
              That idea sat in the back of my head for a while — until I got to college. I
              remember sitting in my dorm room those first few months feeling confused,
              homesick, and pretty alone. So I did what felt natural: I put myself to work. I
              sketched out a rough plan for a website — something that could do what my
              spreadsheet did, but simpler, more visual, and actually usable by people who didn't
              want to build a 12-tab spreadsheet just to track their movie nights. I spent days
              on it, then eventually made friends, started feeling more like myself, and the
              website idea quietly got shelved.
            </p>

            <div className={styles.contact}>
              <div className={styles.contactLinks}>
                <a
                  href="https://docs.google.com/spreadsheets/d/185hXbV7gVaARgN3kzKRY-XCvfLg4Bb9KyHQdBoIggQA/edit?usp=drivesdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contactLink}
                >
                  <span className={styles.contactIcon}>📊</span>
                  The original spreadsheet, from age 15
                </a>
                <a
                  href="https://docs.google.com/document/d/1xTfp6ySHHrqdMvNzmIinvPhwCCIORsy9QK-Q8xPL0Rs/edit?tab=t.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contactLink}
                >
                  <span className={styles.contactIcon}>📝</span>
                  The original website layout, sketched in that dorm room
                </a>
              </div>
            </div>

            <p className={styles.para}>
              A couple years later, I got a call from my dad. He'd built a working prototype —
              based on that same website plan I'd sent him years earlier and had almost
              completely forgotten about. Seeing it again lit the fire right back up. I started
              sending him updates and ideas, and over time the project moved fully into my hands,
              growing into what FilmFolio is today.
            </p>
            <p className={styles.para}>
              Built as a father-son project, FilmFolio blends a love of film with a passion for
              building things from the ground up. It's designed by someone who actually uses it —
              obsessively — and it's built to make tracking, rating, and discovering movies
              simple, fast, and genuinely enjoyable, without needing a 15-year-old's Google Sheet
              habit to make it work.
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
