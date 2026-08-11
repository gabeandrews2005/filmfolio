import { useState, useMemo, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useFilm } from '../../context/FilmContext'
import { searchMoviesByGenre, searchMovies, searchHolidayMovies, getMovieDetails, getPosterUrl, PLACEHOLDER_POSTER, safeSetItem, HOLIDAY_KEYWORD_TERMS } from '../../api/tmdb'
import FilmCard from '../../components/FilmCard'
import RankPickerModal from '../../components/RankPickerModal'
import ConfirmModal from '../../components/ConfirmModal'
import RECOMMENDED_ANIMATED from '../../data/recommendedAnimated.json'
import RECOMMENDED_HORROR from '../../data/recommendedHorror.json'
import RECOMMENDED_COMEDIES from '../../data/recommendedComedies.json'
import RECOMMENDED_SEASONAL from '../../data/recommendedSeasonal.json'
import styles from './GenreList.module.css'

// Recommended-pool title lookups fire fastest throttled, since blasting them
// all at once triggers TMDB rate-limiting; empty responses get retried with backoff.
async function resolveMovieWithRetry(title, genreId, attempt = 0) {
  const results = genreId ? await searchMoviesByGenre(title, genreId) : await searchMovies(title)
  if (results.length > 0 || attempt >= 2) return results
  await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  return resolveMovieWithRetry(title, genreId, attempt + 1)
}

// A handful of curated titles collide with a same-named remake/reboot that
// TMDB search ranks first (e.g. "Home Alone" surfacing 2021's "Home Sweet
// Home Alone" instead of the 1990 original) — pin those to an exact tmdb_id
// (verified against TMDB) instead of trusting the top search result.
const POOL_TITLE_OVERRIDES = {
  'Home Alone': 771, // (1990) — not 2021's "Home Sweet Home Alone"
}

async function resolvePoolTitle(title, genreId) {
  const overrideId = POOL_TITLE_OVERRIDES[title]
  if (overrideId) {
    const details = await getMovieDetails(overrideId)
    return details ? [details] : []
  }
  return resolveMovieWithRetry(title, genreId)
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let index = 0
  async function run() {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

const RECOMMENDED_POOLS = {
  animated: RECOMMENDED_ANIMATED,
  horror: RECOMMENDED_HORROR,
  comedies: RECOMMENDED_COMEDIES,
  seasonal: RECOMMENDED_SEASONAL,
}

// Genre-biased search helps disambiguate pools whose titles collide with
// unrelated same-name films in other genres (e.g. an animated remake vs.
// its live-action version). Horror's and Comedies' curated lists include
// prestige drama/crime crossovers TMDB doesn't tag with that genre (Se7en,
// The Silence of the Lambs, Oldboy, Y Tu Mamá También...), so biasing there
// would silently drop real matches instead of helping. Seasonal has no
// single TMDB genre to bias toward anyway (GENRE_TMDB_IDS.seasonal is null).
const POOL_GENRE_BIAS = {
  animated: true,
  horror: false,
  comedies: false,
  seasonal: false,
}

function normalizeMovie(r) {
  return {
    tmdb_id: r.id,
    title: r.title,
    year: r.release_date?.slice(0, 4) ?? '',
    posterUrl: getPosterUrl(r.poster_path),
    overview: r.overview,
    vote_average: r.vote_average,
    director: '',
  }
}

const GENRE_MAP = {
  horror:   ['Horror', 'Thriller'],
  comedies: ['Comedy'],
  animated: ['Animation'],
  seasonal: null,
}

// Seasonal hillside geometry — shared between the hill bumps rendered in
// JSX and the tree placement below, so trees can be clustered near each
// bump's center (its tallest point) instead of drifting into gaps and
// floating above the hill line.
const HILL_BUMPS = {
  far:  [{ left: -15, width: 58 }, { left: 18, width: 50 }, { left: 48, width: 55 }, { left: 80, width: 48 }],
  mid:  [{ left: -10, width: 52 }, { left: 30, width: 58 }, { left: 72, width: 50 }],
  near: [{ left: -12, width: 58 }, { left: 40, width: 65 }],
}
// Conservative max bottom-% at each band's bump center (measured empirically).
const HILL_BAND_PEAK = { near: 20, mid: 13, far: 8 }

// Comedies — whimsical speech bubbles in a banner strip at the top of the
// page. Laid out in-flow (not fixed/absolute) so they can never end up
// hidden behind the search bar or grid at typical viewport widths.
const COMEDY_QUOTES = [
  { text: "I'll have what she's having", rotate: -4 },
  { text: "Who's on first?", rotate: 3 },
  { text: "It's just a flesh wound", rotate: -3 },
  { text: 'Well, that escalated quickly', rotate: 4 },
  { text: 'Alrighty then', rotate: -2 },
]

const GENRE_TMDB_IDS = {
  horror:   27,
  comedies: 35,
  animated: 16,
  seasonal: null,
}

const THEMES = {
  horror: {
    className: 'themeHorror',
    entrance: false,
  },
  seasonal: {
    className: 'themeSeasonal',
    entrance: true,
    entranceDuration: 2000,
  },
  animated: {
    className: 'themeAnimated',
    entrance: false,
  },
  comedies: {
    className: 'themeComedies',
    entrance: false,
  },
}

// Manually-added film in the grid — the only kind that's drag-reorderable;
// films sourced from the user's Top 100 keep their position fixed above.
function SortableManualCard({ movie, rank, onRemove, inTop100 }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(movie.tmdb_id),
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${styles.gridItem} ${inTop100 ? styles.top100Ring : styles.manualRing} ${styles.sortableItem} ${isDragging ? styles.gridDragging : ''}`}
    >
      <FilmCard movie={movie} rankBadge={rank} showAddToList={false} />
      <button
        className={styles.removeOverlay}
        onClick={(e) => { e.stopPropagation(); onRemove() }}
      >×</button>
    </div>
  )
}

export default function GenreList({ listType, title, maxItems = 50 }) {
  const { myList, addToList, removeFromList, reorderList } = useFilm()
  const listKey = `${listType}List`
  const userList = useFilm()[listKey] ?? []

  const [viewMode, setViewMode] = useState('grid')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)
  const [showEntrance, setShowEntrance] = useState(false)
  const [entranceDone, setEntranceDone] = useState(false)
  const [rankPickerMovie, setRankPickerMovie] = useState(null)

  // Per-session exclusions: tmdb_ids the user has removed from the derived section
  const [derivedExclusions, setDerivedExclusions] = useState(() => new Set())

  // Once separated, this list stops auto-pulling matching films from the
  // user's Top 100 — reversible, persisted per list type.
  const [separated, setSeparated] = useState(() => localStorage.getItem(`ff_separated_${listType}`) === 'true')
  const [showSeparateModal, setShowSeparateModal] = useState(false)
  const [showRevertModal, setShowRevertModal] = useState(false)

  function confirmSeparate() {
    safeSetItem(`ff_separated_${listType}`, 'true')
    setSeparated(true)
    setShowSeparateModal(false)
  }

  function confirmRevert() {
    safeSetItem(`ff_separated_${listType}`, 'false')
    setSeparated(false)
    setShowRevertModal(false)
  }

  const theme = THEMES[listType] ?? {}
  const genreId = GENRE_TMDB_IDS[listType]
  const recommendedPool = RECOMMENDED_POOLS[listType]

  const [poolMovies, setPoolMovies] = useState([])
  const [poolLoading, setPoolLoading] = useState(!!recommendedPool)

  // Resolve the curated recommended-films list to TMDB movies, in order
  useEffect(() => {
    if (!recommendedPool) return
    setPoolLoading(true)
    let cancelled = false
    const biasGenreId = POOL_GENRE_BIAS[listType] ? genreId : undefined
    mapWithConcurrency(recommendedPool, 6, (name) => resolvePoolTitle(name, biasGenreId))
      .then((responses) => {
        if (cancelled) return
        const seen = new Set()
        const movies = []
        for (const results of responses) {
          const match = results?.[0]
          if (!match || seen.has(match.id)) continue
          seen.add(match.id)
          movies.push(normalizeMovie(match))
        }
        setPoolMovies(movies)
        setPoolLoading(false)
      })
    return () => { cancelled = true }
  }, [recommendedPool, genreId, listType])

  useEffect(() => {
    if (theme.entrance && !entranceDone) {
      setShowEntrance(true)
      const t = setTimeout(() => {
        setShowEntrance(false)
        setEntranceDone(true)
      }, theme.entranceDuration)
      return () => clearTimeout(t)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ambient blood scene — randomized once per mount so drips/splats don't
  // jitter to new positions on every re-render. Extra density is clustered
  // near the left/right edges so blood visibly runs down the sides too.
  const bloodDrips = useMemo(() => {
    if (listType !== 'horror') return []
    const edge = Array.from({ length: 16 }, () => Math.random() * 14)
    const positions = [
      ...edge.map((v) => v),                 // left edge, 0–14%
      ...edge.map((v) => 100 - v),            // right edge, 86–100%
      ...Array.from({ length: 24 }, () => Math.random() * 100), // spread across the top
    ]
    return positions.map((left, i) => ({
      id: i,
      left,
      length: 20 + Math.random() * 65,
      duration: 4 + Math.random() * 5,
      delay: -(Math.random() * 8),
      width: 3 + Math.random() * 4,
    }))
  }, [listType])

  const bloodSplats = useMemo(() => {
    if (listType !== 'horror') return []
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      scale: 0.6 + Math.random() * 1.1,
      rotate: Math.random() * 360,
      opacity: 0.5 + Math.random() * 0.35,
    }))
  }, [listType])

  // Seasonal scenic background — trees clustered near each hill bump's
  // center (its tallest point) so every tree lands on visible hill rather
  // than drifting into a gap and floating above the skyline. Further-back
  // bands get smaller/fainter trees for depth. Randomized once per mount.
  const seasonalTrees = useMemo(() => {
    if (listType !== 'seasonal') return []
    const bandCounts = [['near', 14], ['mid', 12], ['far', 8]]
    const bandDepth = { near: 0, mid: 0.5, far: 1 }
    const trees = []
    let id = 0
    for (const [band, count] of bandCounts) {
      const bumps = HILL_BUMPS[band]
      const peak = HILL_BAND_PEAK[band]
      const depth = bandDepth[band]
      for (let i = 0; i < count; i++) {
        const bump = bumps[Math.floor(Math.random() * bumps.length)]
        const center = bump.left + bump.width / 2
        const jitter = (Math.random() - 0.5) * bump.width * 0.55
        const left = Math.max(0, Math.min(100, center + jitter))
        // How close the jitter landed to the bump's center (1 = dead center,
        // 0 = near its tapered edge) — trees near the edge sit lower.
        const closeness = 1 - Math.min(1, Math.abs(jitter) / (bump.width * 0.35))
        const bottom = Math.random() * peak * (0.3 + 0.6 * closeness)
        trees.push({
          id: id++,
          left,
          bottom,
          scale: 1.1 - depth * 0.65 + Math.random() * 0.15,
          opacity: 1 - depth * 0.25,
        })
      }
    }
    return trees
  }, [listType])

  const seasonalLights = useMemo(() => {
    if (listType !== 'seasonal') return []
    const colors = ['#e53935', '#43a047', '#fdd835', '#1e88e5', '#e53935', '#43a047']
    const count = 28
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: (i / (count - 1)) * 100,
      stem: 10 + Math.abs(Math.sin((i / (count - 1)) * Math.PI * 4.5)) * 26 + Math.random() * 4,
      color: colors[i % colors.length],
    }))
  }, [listType])

  const seasonalSnowflakes = useMemo(() => {
    if (listType !== 'seasonal') return []
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 6 + Math.random() * 14,
      duration: 7 + Math.random() * 9,
      delay: -(Math.random() * 14),
      drift: (Math.random() - 0.5) * 80,
    }))
  }, [listType])

  // Films from myList that match this genre, ordered by myList rank, excluding user-removed ones.
  // These lead the combined list and carry the gold "from your Top 100" border.
  // Once separated, this stays empty — the list no longer auto-pulls anything.
  // Seasonal has no TMDB genre to match against (GENRE_MAP.seasonal is
  // null) — it uses the same keyword-based holiday check the search box
  // already runs (HOLIDAY_KEYWORD_TERMS), against each film's backfilled
  // keywords, so e.g. Love Actually on the Top 100 surfaces here as a
  // Christmas movie instead of never being eligible at all.
  const myListSourced = useMemo(() => {
    if (separated) return []
    if (listType === 'seasonal') {
      return myList.filter((m) =>
        !derivedExclusions.has(m.tmdb_id) &&
        (m.keywords ?? []).some((kw) =>
          HOLIDAY_KEYWORD_TERMS.some((term) => kw.name?.toLowerCase().includes(term))
        )
      )
    }
    const genres = GENRE_MAP[listType]
    if (!genres) return []
    return myList
      .filter((m) =>
        m.genres?.some((g) => genres.includes(g)) &&
        !derivedExclusions.has(m.tmdb_id)
      )
  }, [myList, listType, derivedExclusions, separated])

  const myListSourcedIds = useMemo(
    () => new Set(myListSourced.map((m) => m.tmdb_id)),
    [myListSourced]
  )

  // Every tmdb_id currently on the user's Top 100, regardless of genre —
  // used only to decide whether a manually-added film still gets the gold
  // "also on your Top 100" ring, independent of the auto-derive/separated state.
  const top100Ids = useMemo(() => new Set(myList.map((m) => m.tmdb_id)), [myList])

  // Manually added films: stored userList items not also in the derived section.
  // These follow the derived films, in the order they were added / reordered.
  const manualItems = useMemo(
    () => userList.filter((m) => !myListSourcedIds.has(m.tmdb_id)),
    [userList, myListSourcedIds]
  )

  const listIds = useMemo(() => new Set(userList.map((m) => m.tmdb_id)), [userList])
  const combinedCount = myListSourced.length + manualItems.length

  const poolToShow = useMemo(
    () => poolMovies.filter((m) => !listIds.has(m.tmdb_id) && !myListSourcedIds.has(m.tmdb_id)),
    [poolMovies, listIds, myListSourcedIds]
  )

  function excludeFromDerived(tmdbId) {
    setDerivedExclusions((prev) => new Set([...prev, tmdbId]))
  }

  function handleSearch(value) {
    setQuery(value)
    clearTimeout(debounceTimer)
    if (!value.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const results = genreId
        ? await searchMoviesByGenre(value, genreId)
        : listType === 'seasonal'
          ? await searchHolidayMovies(value)
          : await searchMovies(value)
      setSearchResults(results.slice(0, 8))
      setSearching(false)
    }, 350)
    setDebounceTimer(timer)
  }

  // Adds directly if there's room. Once full, opens a rank picker instead of
  // doing nothing — but the rank only ranges over the manually-added section,
  // since the Top 100 films ahead of it have a fixed order.
  function addMovie(movie) {
    if (listIds.has(movie.tmdb_id) || myListSourcedIds.has(movie.tmdb_id)) return false
    if (combinedCount < maxItems) {
      addToList(listKey, movie)
      return true
    }
    if (myListSourced.length >= maxItems) return false // no room at all — every slot is a Top 100 film
    setRankPickerMovie(movie)
    return true
  }

  function addSearchResult(r) {
    const handled = addMovie(normalizeMovie(r))
    if (handled) {
      setQuery('')
      setSearchResults([])
    }
  }

  // Applies a new manual-items order, keeping any hidden overlap items
  // (stored items that also match the derived/Top 100 set) at the end.
  function commitManualReorder(newManualItems) {
    const hiddenItems = userList.filter((m) => myListSourcedIds.has(m.tmdb_id))
    reorderList(listKey, [...newManualItems, ...hiddenItems])
  }

  // Inserts a manually-added film at a combined-list rank, translating it into
  // a position within the manual section (ranks 1..myListSourced.length are
  // reserved for the fixed Top 100 films), and drops the last manual film if
  // the manual section is now over its share of maxItems.
  function insertManualAtRank(movie, rank) {
    const manualRank = rank - myListSourced.length
    const index = Math.min(Math.max(manualRank - 1, 0), manualItems.length)
    const newManual = [...manualItems]
    newManual.splice(index, 0, movie)
    const manualCap = Math.max(maxItems - myListSourced.length, 0)
    newManual.length = Math.min(newManual.length, manualCap)
    commitManualReorder(newManual)
  }

  // See MyList.jsx for why touch gets its own TouchSensor instead of a
  // shared PointerSensor.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleManualDragEndGrid(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = manualItems.findIndex((m) => String(m.tmdb_id) === active.id)
    const newIndex = manualItems.findIndex((m) => String(m.tmdb_id) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    commitManualReorder(arrayMove(manualItems, oldIndex, newIndex))
  }

  function handleManualDragEndList(result) {
    if (!result.destination) return
    const items = [...manualItems]
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    commitManualReorder(items)
  }

  const isFull = combinedCount >= maxItems
  // True edge case: every slot is consumed by fixed Top 100 films, so there's
  // no rank — not even via the picker — a new manual film could occupy.
  const noRoomAtAll = myListSourced.length >= maxItems
  const themeClass = theme.className ? styles[theme.className] ?? '' : ''
  const hasAnyContent = combinedCount > 0

  return (
    <div className={`${styles.page} ${themeClass}`}>
      {rankPickerMovie && (
        <RankPickerModal
          itemName={rankPickerMovie.title}
          minRank={myListSourced.length + 1}
          maxRank={maxItems}
          description={
            <>
              Your list is full ({maxItems}/{maxItems}). Pick a rank for <strong>{rankPickerMovie.title}</strong> —
              the first {myListSourced.length} spot{myListSourced.length === 1 ? '' : 's'} are locked to your Top 100
              films, so it'll land at #{myListSourced.length + 1} or later. Whatever's there (and everything below
              it) shifts down, and the last film drops off the list.
            </>
          }
          onSubmit={(rank) => {
            insertManualAtRank(rankPickerMovie, rank)
            setRankPickerMovie(null)
          }}
          onCancel={() => setRankPickerMovie(null)}
        />
      )}

      {showSeparateModal && (
        <ConfirmModal
          title="Separate from My List?"
          message={
            <>
              If you'd like to separate your {title} list from your Top 100, you can do that here.
              The films that currently show up here automatically because they're on your Top 100
              will be removed, and it'll become a clean, independent list.
              <br /><br />
              This doesn't mean you can't add those same films back — you still can, and once added
              they won't jump to the top or lock in place; they can be moved to any position like any
              other film here. If a film you add is also on your Top 100, its gold border will still
              show that.
            </>
          }
          confirmLabel="Separate List"
          destructive
          onConfirm={confirmSeparate}
          onCancel={() => setShowSeparateModal(false)}
        />
      )}

      {showRevertModal && (
        <ConfirmModal
          title="Revert Separation?"
          message={
            <>
              This reconnects your {title} list to your Top 100 — films from your Top 100 that match
              will start automatically showing up here again, pinned at the top, like before you
              separated it.
              <br /><br />
              Nothing you've added here gets removed. If a film you manually added is also on your
              Top 100, it'll just merge into that pinned section instead of appearing twice.
            </>
          }
          confirmLabel="Revert Separation"
          onConfirm={confirmRevert}
          onCancel={() => setShowRevertModal(false)}
        />
      )}

      {/* Horror — persistent ambient blood scene (not a one-time entrance) */}
      {listType === 'horror' && (
        <div className={styles.bloodScene} aria-hidden="true">
          {bloodDrips.map((d) => (
            <span
              key={`drip-${d.id}`}
              className={styles.bloodDrip}
              style={{
                left: `${d.left}%`,
                width: `${d.width}px`,
                animationDuration: `${d.duration}s`,
                animationDelay: `${d.delay}s`,
                '--drip-length': `${d.length}vh`,
              }}
            />
          ))}
          {bloodSplats.map((s) => (
            <span
              key={`splat-${s.id}`}
              className={styles.bloodSplat}
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                opacity: s.opacity,
                transform: `scale(${s.scale}) rotate(${s.rotate}deg)`,
              }}
            />
          ))}
        </div>
      )}
      {/* Seasonal snow entrance */}
      {listType === 'seasonal' && showEntrance && (
        <div className={styles.snowEntrance}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className={styles.snowflake} style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${1 + Math.random() * 2}s`,
              animationDelay: `${Math.random() * 1}s`,
              fontSize: `${8 + Math.random() * 16}px`,
            }}>❄</div>
          ))}
        </div>
      )}

      {/* Seasonal — persistent snowy hillside scene with trees, string lights, and falling snow */}
      {listType === 'seasonal' && (
        <div className={styles.seasonalScene} aria-hidden="true">
          <div className={styles.seasonalSky} />
          <div className={styles.seasonalSun} />
          <div className={styles.seasonalHillsFar}>
            {HILL_BUMPS.far.map((b, i) => (
              <span key={i} className={styles.hillBump} style={{ left: `${b.left}%`, width: `${b.width}%` }} />
            ))}
          </div>
          <div className={styles.seasonalHillsMid}>
            {HILL_BUMPS.mid.map((b, i) => (
              <span key={i} className={styles.hillBump} style={{ left: `${b.left}%`, width: `${b.width}%` }} />
            ))}
          </div>
          <div className={styles.seasonalHillsNear}>
            {HILL_BUMPS.near.map((b, i) => (
              <span key={i} className={styles.hillBump} style={{ left: `${b.left}%`, width: `${b.width}%` }} />
            ))}
          </div>
          {seasonalTrees.map((t) => (
            <span
              key={`tree-${t.id}`}
              className={styles.seasonalTree}
              style={{ left: `${t.left}%`, bottom: `${t.bottom}%`, transform: `scale(${t.scale})`, opacity: t.opacity }}
            >🎄</span>
          ))}
          <div className={styles.lightsString}>
            <div className={styles.lightsWire} />
            {seasonalLights.map((l) => (
              <span
                key={`light-${l.id}`}
                className={styles.lightBulb}
                style={{ left: `${l.left}%`, top: `${l.stem}px`, '--stem': `${l.stem}px`, background: l.color, boxShadow: `0 0 8px 3px ${l.color}` }}
              />
            ))}
          </div>
          <div className={styles.seasonalSnowfall}>
            {seasonalSnowflakes.map((f) => (
              <span
                key={`snow-${f.id}`}
                className={styles.seasonalSnowflake}
                style={{
                  left: `${f.left}%`,
                  fontSize: `${f.size}px`,
                  animationDuration: `${f.duration}s`,
                  animationDelay: `${f.delay}s`,
                  '--drift': `${f.drift}px`,
                }}
              >❄</span>
            ))}
          </div>
        </div>
      )}

      {/* Animated page — busy, playful ambient background scene */}
      {listType === 'animated' && (
        <div className={styles.animatedScene} aria-hidden="true">
          <span className={`${styles.flyer} ${styles.ptero1}`}>
            <span className={styles.pteroScale}>
              <span className={`${styles.pteroWing} ${styles.pteroWingLeft}`} />
              <span className={styles.pteroBody} />
              <span className={`${styles.pteroWing} ${styles.pteroWingRight}`} />
            </span>
          </span>
          <span className={`${styles.flyer} ${styles.ptero2}`}>
            <span className={styles.pteroScale}>
              <span className={`${styles.pteroWing} ${styles.pteroWingLeft}`} />
              <span className={styles.pteroBody} />
              <span className={`${styles.pteroWing} ${styles.pteroWingRight}`} />
            </span>
          </span>
          <span className={`${styles.flyer} ${styles.ptero3}`}>
            <span className={styles.pteroScale}>
              <span className={`${styles.pteroWing} ${styles.pteroWingLeft}`} />
              <span className={styles.pteroBody} />
              <span className={`${styles.pteroWing} ${styles.pteroWingRight}`} />
            </span>
          </span>
          <span className={`${styles.flyer} ${styles.plane1}`}>
            <span className={styles.planeSmoke} />
            <span className={styles.planeSmoke} />
            <span className={styles.planeSmoke} />
            <span className={styles.planeShape}>
              <span className={styles.planeTail} />
              <span className={styles.planeWing} />
              <span className={styles.planeBody} />
              <span className={styles.planeNose} />
            </span>
          </span>
          <span className={`${styles.flyer} ${styles.plane2}`}>
            <span className={styles.planeSmoke} />
            <span className={styles.planeSmoke} />
            <span className={styles.planeSmoke} />
            <span className={styles.planeShape}>
              <span className={styles.planeTail} />
              <span className={styles.planeWing} />
              <span className={styles.planeBody} />
              <span className={styles.planeNose} />
            </span>
          </span>
          <span className={`${styles.flyer} ${styles.plane3}`}>
            <span className={styles.planeSmoke} />
            <span className={styles.planeSmoke} />
            <span className={styles.planeSmoke} />
            <span className={styles.planeShape}>
              <span className={styles.planeTail} />
              <span className={styles.planeWing} />
              <span className={styles.planeBody} />
              <span className={styles.planeNose} />
            </span>
          </span>
          <span className={`${styles.volcano} ${styles.volcano1}`}>🌋</span>
          <span className={`${styles.volcano} ${styles.volcano2}`}>🌋</span>
          <span className={`${styles.volcanoSmoke} ${styles.smoke1a}`}>💨</span>
          <span className={`${styles.volcanoSmoke} ${styles.smoke1b}`}>💨</span>
          <span className={`${styles.volcanoSmoke} ${styles.smoke2a}`}>💨</span>
          <span className={`${styles.volcanoSmoke} ${styles.smoke2b}`}>💨</span>
        </div>
      )}

      <div className="container">
        {/* Comedies — whimsical speech bubbles, in-flow so they're always visible */}
        {listType === 'comedies' && (
          <div className={styles.comedyScene} aria-hidden="true">
            {COMEDY_QUOTES.map((q, i) => (
              <div
                key={i}
                className={styles.comedyBubble}
                style={{ transform: `rotate(${q.rotate}deg)` }}
              >
                {q.text}
              </div>
            ))}
          </div>
        )}

        <div className={styles.header}>
          <div>
            <h1 className={`${styles.title} ${listType === 'horror' ? styles.titleBleeding : ''}`}>{title}</h1>
          </div>
          <div className={styles.headerActions}>
            {!separated ? (
              <button
                className={styles.separateBtn}
                onClick={() => setShowSeparateModal(true)}
              >
                Separate from My List
              </button>
            ) : (
              <button
                className={styles.revertBtn}
                onClick={() => setShowRevertModal(true)}
              >
                Revert Separation
              </button>
            )}
            {hasAnyContent && (
              <button
                className={styles.toggleViewBtn}
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? 'List View' : 'Grid View'}
              </button>
            )}
          </div>
        </div>

        {/* Search bar for manual additions */}
        <div className={styles.searchBox}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={`Search ${title} films…`}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searching && <span className={styles.spinner}>⟳</span>}
        </div>

        {searchResults.length > 0 && (
          <div className={styles.results}>
            {searchResults.map((r) => {
              const alreadyShown = listIds.has(r.id) || myListSourcedIds.has(r.id)
              return (
                <div key={r.id} className={styles.resultRow}>
                  <img src={getPosterUrl(r.poster_path)} alt={r.title} className={styles.thumb} />
                  <div className={styles.resultInfo}>
                    <span className={styles.resultTitle}>{r.title}</span>
                    <span className={styles.resultYear}>{r.release_date?.slice(0, 4)}</span>
                  </div>
                  <button
                    className={`${styles.addBtn} ${alreadyShown ? styles.added : ''} ${!alreadyShown && noRoomAtAll ? styles.full : ''}`}
                    onClick={() => !alreadyShown && addSearchResult(r)}
                    disabled={alreadyShown || noRoomAtAll}
                    title={!alreadyShown && isFull && !noRoomAtAll ? 'List full — choose a rank to slot it in' : undefined}
                  >
                    {alreadyShown ? '✓' : noRoomAtAll ? '—' : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Combined list: Top 100 films (gold border, fixed order) followed
             by manually added films (regular border, drag-to-reorder) ────── */}
        {hasAnyContent && (
          <div className={styles.picksHeader}>
            <span className={styles.picksHint}>Gold border = from your Top 100 · drag to reorder added films</span>
            <span className={styles.picksCount}>{combinedCount} / {maxItems}</span>
          </div>
        )}

        {viewMode === 'grid' ? (
          <div className={styles.posterGrid}>
            {myListSourced.map((movie, i) => (
              <div key={movie.tmdb_id} className={`${styles.gridItem} ${styles.top100Ring}`}>
                <FilmCard movie={movie} rankBadge={i + 1} showAddToList={false} />
                <button
                  className={styles.removeOverlay}
                  onClick={() => excludeFromDerived(movie.tmdb_id)}
                  title="Remove from this view"
                >×</button>
              </div>
            ))}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleManualDragEndGrid}>
              <SortableContext items={manualItems.map((m) => String(m.tmdb_id))} strategy={rectSortingStrategy}>
                {manualItems.map((movie, i) => (
                  <SortableManualCard
                    key={movie.tmdb_id}
                    movie={movie}
                    rank={myListSourced.length + i + 1}
                    onRemove={() => removeFromList(listKey, movie.tmdb_id)}
                    inTop100={top100Ids.has(movie.tmdb_id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleManualDragEndList}>
            <Droppable droppableId="genre-list">
              {(provided) => (
                <ul className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                  {myListSourced.map((movie, i) => (
                    <li key={movie.tmdb_id} className={`${styles.listItem} ${styles.derivedItem} ${styles.top100ListItem}`}>
                      <span className={styles.rank}>#{i + 1}</span>
                      <img src={movie.posterUrl || PLACEHOLDER_POSTER} alt={movie.title} className={styles.thumb} />
                      <div className={styles.resultInfo}>
                        <span className={styles.resultTitle}>{movie.title}</span>
                        <span className={styles.resultYear}>{movie.year}</span>
                      </div>
                      <button
                        className={styles.removeBtn}
                        onClick={() => excludeFromDerived(movie.tmdb_id)}
                        title="Remove from this view"
                      >×</button>
                    </li>
                  ))}

                  {manualItems.map((movie, i) => (
                    <Draggable
                      key={String(movie.tmdb_id)}
                      draggableId={String(movie.tmdb_id)}
                      index={i}
                    >
                      {(provided, snapshot) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${styles.listItem} ${snapshot.isDragging ? styles.dragging : ''} ${top100Ids.has(movie.tmdb_id) ? styles.top100ListItem : ''}`}
                        >
                          <span className={styles.dragHandle} {...provided.dragHandleProps}>⠿</span>
                          <span className={styles.rank}>#{myListSourced.length + i + 1}</span>
                          <img src={movie.posterUrl || PLACEHOLDER_POSTER} alt={movie.title} className={styles.thumb} />
                          <div className={styles.resultInfo}>
                            <span className={styles.resultTitle}>{movie.title}</span>
                            <span className={styles.resultYear}>{movie.year}</span>
                          </div>
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeFromList(listKey, movie.tmdb_id)}
                          >×</button>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {/* Recommended pool */}
        {recommendedPool && (
          <div className={styles.poolSection}>
            <div className={styles.poolHeader}>
              <h2 className={styles.sectionTitle}>Recommended {title}</h2>
              {!poolLoading && <span className={styles.poolCount}>{poolToShow.length} to choose from</span>}
            </div>

            <div className={styles.posterGrid}>
              {poolLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <div key={`pool-sk-${i}`} className={styles.poolSkeleton}>
                      <div className={styles.poolSkeletonImg} />
                    </div>
                  ))
                : poolToShow.map((movie) => (
                    <div key={movie.tmdb_id} className={styles.gridItem}>
                      <FilmCard movie={movie} showAddToList={false} />
                      <button
                        className={styles.poolAddOverlay}
                        onClick={(e) => { e.stopPropagation(); addMovie(movie) }}
                        disabled={noRoomAtAll}
                        title={noRoomAtAll ? 'Your Top 100 fills every slot — no room to add more' : isFull ? 'List full — pick a rank to slot it in' : undefined}
                        aria-label={`Add ${movie.title}`}
                      >+</button>
                    </div>
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
