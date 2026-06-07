import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PLACEHOLDER_POSTER } from '../api/tmdb'
import styles from './Friends.module.css'

// ── Hardcoded demo profiles ────────────────────────────────────────────────
const DEMO_PROFILES = [
  {
    username: 'gabe_films',
    displayName: 'Gabe',
    bio: 'The curator behind FilmFolio. Romance, drama, and anything that makes you feel something.',
    avatar: null,
    myList: [
      { tmdb_id: 332562, title: 'A Star Is Born',       year: '2018', posterUrl: null },
      { tmdb_id: 153,    title: 'Lost in Translation',   year: '2003', posterUrl: null },
      { tmdb_id: 137,    title: 'Groundhog Day',         year: '1993', posterUrl: null },
      { tmdb_id: 399055, title: 'The Shape of Water',    year: '2017', posterUrl: null },
      { tmdb_id: 9778,   title: 'Dazed and Confused',    year: '1993', posterUrl: null },
      { tmdb_id: 74643,  title: 'Midnight in Paris',     year: '2011', posterUrl: null },
      { tmdb_id: 19913,  title: '(500) Days of Summer',  year: '2009', posterUrl: null },
      { tmdb_id: 551064, title: 'The Peanut Butter Falcon', year: '2019', posterUrl: null },
      { tmdb_id: 313369, title: 'La La Land',            year: '2016', posterUrl: null },
      { tmdb_id: 120,    title: 'The Fellowship of the Ring', year: '2001', posterUrl: null },
    ],
  },
  {
    username: 'alex_films',
    displayName: 'Alex',
    bio: 'Classic cinema devotee. Kubrick, Coppola, Scorsese — the holy trinity.',
    avatar: null,
    myList: [
      { tmdb_id: 238,   title: 'The Godfather',         year: '1972', posterUrl: null },
      { tmdb_id: 769,   title: 'GoodFellas',             year: '1990', posterUrl: null },
      { tmdb_id: 703,   title: 'Taxi Driver',            year: '1976', posterUrl: null },
      { tmdb_id: 1422,  title: 'Chinatown',              year: '1974', posterUrl: null },
      { tmdb_id: 62,    title: '2001: A Space Odyssey',  year: '1968', posterUrl: null },
      { tmdb_id: 28,    title: 'Apocalypse Now',         year: '1979', posterUrl: null },
      { tmdb_id: 694,   title: 'The Shining',            year: '1980', posterUrl: null },
      { tmdb_id: 78,    title: 'Blade Runner',           year: '1982', posterUrl: null },
      { tmdb_id: 207,   title: 'Network',                year: '1976', posterUrl: null },
      { tmdb_id: 10918, title: 'Barry Lyndon',           year: '1975', posterUrl: null },
    ],
  },
  {
    username: 'maya_watches',
    displayName: 'Maya',
    bio: 'Romance, fairy tales, and films that linger long after the credits roll.',
    avatar: null,
    myList: [
      { tmdb_id: 4348,   title: 'Pride & Prejudice',              year: '2005', posterUrl: null },
      { tmdb_id: 194,    title: 'Amélie',                         year: '2001', posterUrl: null },
      { tmdb_id: 38,     title: 'Eternal Sunshine of the Spotless Mind', year: '2004', posterUrl: null },
      { tmdb_id: 153,    title: 'Lost in Translation',            year: '2003', posterUrl: null },
      { tmdb_id: 152601, title: 'Her',                            year: '2013', posterUrl: null },
      { tmdb_id: 289,    title: 'Casablanca',                     year: '1942', posterUrl: null },
      { tmdb_id: 10020,  title: 'Beauty and the Beast',           year: '1991', posterUrl: null },
      { tmdb_id: 120467, title: 'The Grand Budapest Hotel',        year: '2014', posterUrl: null },
      { tmdb_id: 11202,  title: 'Notting Hill',                   year: '1999', posterUrl: null },
      { tmdb_id: 4423,   title: 'Roman Holiday',                  year: '1953', posterUrl: null },
    ],
  },
  {
    username: 'dev_cinema',
    displayName: 'Dev',
    bio: 'Sci-fi, action, and films that rewire your brain. Nolan is God.',
    avatar: null,
    myList: [
      { tmdb_id: 157336, title: 'Interstellar',                    year: '2014', posterUrl: null },
      { tmdb_id: 603,    title: 'The Matrix',                      year: '1999', posterUrl: null },
      { tmdb_id: 76341,  title: 'Mad Max: Fury Road',              year: '2015', posterUrl: null },
      { tmdb_id: 27205,  title: 'Inception',                       year: '2010', posterUrl: null },
      { tmdb_id: 496243, title: 'Parasite',                        year: '2019', posterUrl: null },
      { tmdb_id: 545611, title: 'Everything Everywhere All at Once', year: '2022', posterUrl: null },
      { tmdb_id: 155,    title: 'The Dark Knight',                 year: '2008', posterUrl: null },
      { tmdb_id: 329865, title: 'Arrival',                         year: '2016', posterUrl: null },
      { tmdb_id: 438631, title: 'Dune',                            year: '2021', posterUrl: null },
      { tmdb_id: 6977,   title: 'No Country for Old Men',          year: '2007', posterUrl: null },
    ],
  },
]

function ProfileCard({ profile, onClick }) {
  return (
    <button className={styles.profileCard} onClick={() => onClick(profile)}>
      <div className={styles.cardAvatar}>
        {profile.avatar
          ? <img src={profile.avatar} alt={profile.displayName} />
          : <span>{profile.displayName[0]}</span>
        }
      </div>
      <div className={styles.cardInfo}>
        <span className={styles.cardName}>{profile.displayName}</span>
        <span className={styles.cardUsername}>@{profile.username}</span>
        <p className={styles.cardBio}>{profile.bio}</p>
      </div>
      <div className={styles.cardFilms}>
        {profile.myList.slice(0, 4).map((m) => (
          <div key={m.tmdb_id} className={styles.cardMiniPoster}>
            <img
              src={m.posterUrl || PLACEHOLDER_POSTER}
              alt={m.title}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </button>
  )
}

function ProfileDetail({ profile, onBack }) {
  return (
    <div className={styles.detail}>
      <button className={styles.backBtn} onClick={onBack}>← Back to Friends</button>

      <div className={styles.detailHeader}>
        <div className={styles.detailAvatar}>
          {profile.avatar
            ? <img src={profile.avatar} alt={profile.displayName} />
            : <span>{profile.displayName[0]}</span>
          }
        </div>
        <div>
          <h2 className={styles.detailName}>{profile.displayName}</h2>
          <p className={styles.detailUsername}>@{profile.username}</p>
          <p className={styles.detailBio}>{profile.bio}</p>
        </div>
      </div>

      <div className={styles.detailSection}>
        <h3 className={styles.detailSectionTitle}>Top 10</h3>
        <div className={styles.detailGrid}>
          {profile.myList.map((m, i) => (
            <div key={m.tmdb_id} className={styles.detailCard}>
              <div className={styles.detailPosterWrap}>
                <img
                  src={m.posterUrl || PLACEHOLDER_POSTER}
                  alt={m.title}
                  className={styles.detailPoster}
                  loading="lazy"
                />
                <span className={styles.detailRank}>#{i + 1}</span>
              </div>
              <span className={styles.detailTitle}>{m.title}</span>
              <span className={styles.detailYear}>{m.year}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Friends() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const filtered = DEMO_PROFILES.filter((p) =>
    !search.trim() ||
    p.displayName.toLowerCase().includes(search.toLowerCase()) ||
    p.username.toLowerCase().includes(search.toLowerCase())
  )

  if (selected) {
    return (
      <div className={styles.page}>
        <div className="container">
          <ProfileDetail profile={selected} onBack={() => setSelected(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Friends</h1>
          <p className={styles.subtitle}>
            Browse film lovers and see their ranked lists.
          </p>
        </div>

        <div className={styles.searchWrap}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Find a friend by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.notice}>
          <span className={styles.noticeIcon}>ℹ</span>
          Friends & social features coming soon. These are demo profiles for now.
        </div>

        <div className={styles.grid}>
          {filtered.map((profile) => (
            <ProfileCard
              key={profile.username}
              profile={profile}
              onClick={setSelected}
            />
          ))}
          {filtered.length === 0 && (
            <p className={styles.noResults}>No profiles found for "{search}"</p>
          )}
        </div>
      </div>
    </div>
  )
}
