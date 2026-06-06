import { useState } from 'react'
import shows from '../data/shows.json'
import actors from '../data/actors.json'
import directors from '../data/directors.json'
import animated from '../data/animated.json'
import comedies from '../data/comedies.json'
import horror from '../data/horror.json'
import seasonal from '../data/seasonal.json'
import nostalgic from '../data/nostalgic.json'
import songs from '../data/songs.json'
import styles from './Universe.module.css'

const TABS = [
  { id: 'shows',     label: 'Top 15 Shows' },
  { id: 'actors',    label: 'Top 50 Actors' },
  { id: 'directors', label: 'Top 26 Directors' },
  { id: 'animated',  label: 'Top 25 Animated' },
  { id: 'comedies',  label: 'Pure Comedies' },
  { id: 'horror',    label: 'Horror' },
  { id: 'seasonal',  label: 'Seasonal' },
  { id: 'nostalgic', label: 'Nostalgic' },
  { id: 'songs',     label: 'Top Songs' },
]

function RatingBar({ score, max = 10 }) {
  const pct = Math.round((score / max) * 100)
  return (
    <div className={styles.ratingBar}>
      <div className={styles.ratingFill} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ShowsTable() {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Genre</th>
            <th>RT</th>
            <th>Overall</th>
            <th>Avg Score</th>
            <th>Best Season</th>
            <th>Best Episode</th>
          </tr>
        </thead>
        <tbody>
          {shows.map(s => (
            <tr key={s.rank}>
              <td className={styles.rankCell}>{s.rank}</td>
              <td className={styles.titleCell}>{s.title}</td>
              <td className={styles.metaCell}>{s.genre}</td>
              <td className={styles.scoreCell}>{s.rt_score}%</td>
              <td className={styles.scoreCell}>{s.overall_rating}/10</td>
              <td className={styles.avgCell}>
                <div className={styles.avgWrap}>
                  <span>{s.avg_score}/10</span>
                  <RatingBar score={s.avg_score} />
                </div>
              </td>
              <td className={styles.metaCell}>{s.best_season}</td>
              <td className={styles.episodeCell}>{s.best_episode}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PeopleTable({ data, type }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Best {type === 'actor' ? 'Role' : 'Film'}</th>
            <th>RT &gt;90%</th>
            <th>Cert. Fresh</th>
            <th>Fresh %</th>
            <th>Oscar Noms</th>
            <th>Oscars</th>
            <th>In Top 100</th>
          </tr>
        </thead>
        <tbody>
          {data.map(p => (
            <tr key={p.rank}>
              <td className={styles.rankCell}>{p.rank}</td>
              <td className={styles.titleCell}>{p.name}</td>
              <td className={styles.metaCell}>{p.best_movie}</td>
              <td className={styles.scoreCell}>{p.above_90_rt}</td>
              <td className={styles.scoreCell}>{p.certified_fresh}</td>
              <td className={styles.scoreCell}>{p.fresh_pct}%</td>
              <td className={styles.scoreCell}>{p.oscar_noms}</td>
              <td className={styles.scoreCell}>{p.oscars}</td>
              <td className={styles.scoreCell}>{p.movies_in_top_100}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FilmTable({ data, showNostalgia = false, showSeason = false }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Year</th>
            <th>Director</th>
            <th>RT</th>
            {showNostalgia && <th>Nostalgia</th>}
            {showSeason && <th>Season</th>}
            <th>Overall</th>
            <th>Avg Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map(m => (
            <tr key={m.rank}>
              <td className={styles.rankCell}>{m.rank}</td>
              <td className={styles.titleCell}>{m.title}</td>
              <td className={styles.scoreCell}>{m.year}</td>
              <td className={styles.metaCell}>{m.director}</td>
              <td className={styles.scoreCell}>{m.rt_score != null ? `${m.rt_score}%` : '—'}</td>
              {showNostalgia && <td className={styles.scoreCell}>{m.nostalgia_rating}/10</td>}
              {showSeason && <td className={styles.metaCell}>{m.season}</td>}
              <td className={styles.scoreCell}>{m.overall_rating != null ? `${m.overall_rating}/10` : '—'}</td>
              <td className={styles.avgCell}>
                {m.avg_score != null ? (
                  <div className={styles.avgWrap}>
                    <span>{m.avg_score}/10</span>
                    <RatingBar score={m.avg_score} />
                  </div>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SongsTable() {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Song</th>
            <th>From</th>
          </tr>
        </thead>
        <tbody>
          {songs.map(s => (
            <tr key={s.rank}>
              <td className={styles.rankCell}>{s.rank}</td>
              <td className={styles.titleCell}>{s.title}</td>
              <td className={styles.metaCell}>{s.movie}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Universe() {
  const [activeTab, setActiveTab] = useState('shows')

  return (
    <div className={styles.page}>
      <div className="container">
        <header className={styles.header}>
          <h1 className={styles.title}>Gabe's Universe</h1>
          <p className={styles.subtitle}>
            Beyond the Top 100 — every ranking, every list, every obsession.
          </p>
        </header>

        <div className={styles.tabs}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {activeTab === 'shows'     && <ShowsTable />}
          {activeTab === 'actors'    && <PeopleTable data={actors}    type="actor" />}
          {activeTab === 'directors' && <PeopleTable data={directors} type="director" />}
          {activeTab === 'animated'  && <FilmTable data={animated} />}
          {activeTab === 'comedies'  && <FilmTable data={comedies} />}
          {activeTab === 'horror'    && <FilmTable data={horror} />}
          {activeTab === 'seasonal'  && <FilmTable data={seasonal} showSeason />}
          {activeTab === 'nostalgic' && <FilmTable data={nostalgic} showNostalgia />}
          {activeTab === 'songs'     && <SongsTable />}
        </div>
      </div>
    </div>
  )
}
