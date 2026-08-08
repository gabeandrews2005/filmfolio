// Pure clue-generation for Film Frenzy — no I/O here. Given a myList
// (post useStatsBackfill, so cast/director/overview/popularity are
// present) and a Map of person bio data (from useFilmFrenzyPeople), builds
// a 5-category x 5-clue (100/200/300/400/500) board. Deterministic given
// its inputs except for the couple of deliberately-randomized picks noted
// inline (so repeat games don't always surface the exact same clue).

function computeAppearanceMap(myList, mode) {
  const map = new Map()
  myList.forEach((m, i) => {
    const filmInfo = { title: m.title, rank: i + 1, year: m.year, genres: m.genres ?? [] }
    if (mode === 'cast') {
      m.cast?.forEach((a) => {
        const entry = map.get(a.id) ?? { name: a.name, films: [] }
        entry.films.push(filmInfo)
        map.set(a.id, entry)
      })
    } else {
      if (!m.directorId || !m.director) return
      const entry = map.get(m.directorId) ?? { name: m.director, films: [] }
      entry.films.push(filmInfo)
      map.set(m.directorId, entry)
    }
  })
  return map
}

// Points a category couldn't fill (not enough qualifying data) become
// "Not enough data" cells rather than crashing, duplicating a clue, or
// pulling from another category — always the *highest* point values, since
// those are exactly the ones needing the least-prominent people/films,
// which is exactly what ran out.
function padClues(clues) {
  const result = [...clues]
  while (result.length < 5) {
    result.push({ points: (result.length + 1) * 100, clue: null, hint: null, answer: null })
  }
  return result
}

function stripOwnTitles(text, titles) {
  let result = text
  titles.forEach((t) => {
    if (!t) return
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escaped, 'gi'), 'this film')
  })
  return result
}

const BIO_SENTENCE_COUNT = { 100: 3, 200: 2, 300: 2, 400: 1, 500: 1 }

// Real TMDB biography text when available, truncated to fewer sentences at
// higher point values; a synthesized fallback line (department/birthplace)
// for the many people TMDB has no biography for at all.
function buildBio(personData, points, ownTitles) {
  const bioText = personData?.biography
  if (bioText) {
    const sentences = bioText.split(/(?<=\.)\s+/).filter(Boolean)
    const n = BIO_SENTENCE_COUNT[points] ?? 1
    return stripOwnTitles(sentences.slice(0, n).join(' '), ownTitles)
  }
  const dept = personData?.knownForDepartment
  const pob = personData?.placeOfBirth
  if (dept || pob) {
    let line = dept ? `Known primarily for ${dept.toLowerCase()} work` : 'A name that keeps showing up on your list'
    if (pob) line += `, born in ${pob}`
    return `${line}.`
  }
  return 'A face that keeps showing up on your list.'
}

// Points toward one of the person's qualifying films without naming it —
// vagueness scales with point value (more identifying detail at 100, least
// at 500).
function buildHint(film, points, listLength) {
  const decade = film.year ? `${Math.floor(parseInt(film.year) / 10) * 10}s` : 'their'
  const genre = film.genres?.[0]?.toLowerCase() ?? 'genre'
  const topBand = Math.max(5, Math.ceil(listLength * 0.25))
  const rankBand = film.rank <= topBand ? `top ${topBand}` : 'list'

  if (points === 100) return `You'll also spot them in a ${decade} ${genre} film ranked in your ${rankBand}.`
  if (points === 200) return `They're also in a ${decade} film on your list.`
  if (points === 300) return `They're also in a film on your list from around the ${decade}.`
  return `They show up in one more film somewhere on your list.`
}

function buildPersonCategory(categoryName, appearanceMap, peopleDataMap, listLength) {
  let candidates = [...appearanceMap.entries()].filter(([, v]) => v.films.length >= 2)
  if (candidates.length < 5) candidates = [...appearanceMap.entries()] // relax to 1+ appearance

  const scored = candidates
    .map(([id, v]) => ({
      id, name: v.name, films: v.films,
      fame: v.films.length * 10 + (peopleDataMap.get(id)?.popularity ?? 0),
    }))
    .sort((a, b) => b.fame - a.fame)

  const clues = scored.slice(0, 5).map((person, i) => {
    const points = (i + 1) * 100
    const personData = peopleDataMap.get(person.id)
    const ownTitles = person.films.map((f) => f.title)
    const film = person.films[Math.floor(Math.random() * person.films.length)]
    return {
      points,
      clue: buildBio(personData, points, ownTitles),
      hint: buildHint(film, points, listLength),
      answer: person.name,
    }
  })
  return { name: categoryName, clues: padClues(clues) }
}

// Edge distance (0 = top or bottom of the list, ~N/2 = dead center) is
// scale-invariant — works the same whether the list has 20 films or 100.
// Films near either edge are easiest to place; the dead center is hardest.
function buildRankingCategory(myList) {
  const N = myList.length
  if (N === 0) return { name: 'Where Does It Rank?', clues: padClues([]) }

  const withEdge = myList
    .map((m, i) => ({ title: m.title, rank: i + 1, edgeDistance: Math.min(i, N - 1 - i) }))
    .sort((a, b) => a.edgeDistance - b.edgeDistance)

  const used = new Set()
  const picks = []
  const tiers = Math.min(5, withEdge.length)
  for (let t = 0; t < tiers; t++) {
    const target = tiers > 1 ? Math.floor((t * (withEdge.length - 1)) / (tiers - 1)) : 0
    const jitter = Math.max(1, Math.floor(withEdge.length * 0.05))
    let idx = target
    let attempt = 0
    while (used.has(idx) && attempt < jitter * 4) {
      idx = Math.max(0, Math.min(withEdge.length - 1, target + Math.floor(Math.random() * (jitter * 2 + 1)) - jitter))
      attempt++
    }
    if (used.has(idx)) {
      const free = withEdge.findIndex((_, i2) => !used.has(i2))
      if (free === -1) break
      idx = free
    }
    used.add(idx)
    picks.push(withEdge[idx])
  }

  const clues = picks.map((film, i) => ({
    points: (i + 1) * 100,
    clue: film.title,
    hint: null,
    answer: String(film.rank),
  }))
  return { name: 'Where Does It Rank?', clues: padClues(clues) }
}

// Nearest-available-gap matching per tier (rather than a strict bucket that
// can come up empty for short lists) — always finds the closest-fit pair
// among sampled candidates instead of leaving a tier unfilled.
function buildHigherLowerCategory(myList) {
  const N = myList.length
  if (N < 2) return { name: 'Higher or Lower?', clues: padClues([]) }

  const tierTargets = { 100: 0.75, 200: 0.5, 300: 0.325, 400: 0.175, 500: 0.05 }
  const seen = new Set()
  const allPairs = []
  for (let a = 0; a < 500 && allPairs.length < 200; a++) {
    const i = Math.floor(Math.random() * N)
    const j = Math.floor(Math.random() * N)
    if (i === j) continue
    const key = i < j ? `${i}-${j}` : `${j}-${i}`
    if (seen.has(key)) continue
    seen.add(key)
    allPairs.push({ i, j, gap: Math.abs(i - j) / N })
  }

  const usedKeys = new Set()
  const clues = [100, 200, 300, 400, 500].map((points) => {
    const available = allPairs.filter((p) => !usedKeys.has(`${p.i}-${p.j}`))
    if (available.length === 0) return { points, clue: null, hint: null, answer: null }
    const target = tierTargets[points]
    available.sort((a, b) => Math.abs(a.gap - target) - Math.abs(b.gap - target))
    const pick = available[0]
    usedKeys.add(`${pick.i}-${pick.j}`)
    const filmA = myList[pick.i], filmB = myList[pick.j]
    return {
      points,
      clue: `Which ranks higher on your list: "${filmA.title}" or "${filmB.title}"?`,
      hint: null,
      answer: pick.i < pick.j ? filmA.title : filmB.title,
    }
  })
  return { name: 'Higher or Lower?', clues }
}

const PLOT_WORD_LIMITS = { 100: 45, 200: 35, 300: 28, 400: 20, 500: 14 }

// Sorted by TMDB popularity (public "how well-known" signal, not the
// user's own rank) — most popular gets the most generous excerpt, least
// popular the sparsest. Can only scrub the film's own title from its
// overview, not character names (that needs NLP this app has no access
// to) — a real, acceptable limitation, not a bug.
function buildPlotPointsCategory(myList) {
  const candidates = myList.filter((m) => m.overview && m.overview.length > 40 && m.popularity != null)
  if (candidates.length === 0) return { name: 'Plot Points', clues: padClues([]) }

  const sorted = [...candidates].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
  const used = new Set()
  const picks = []
  const tiers = Math.min(5, sorted.length)
  for (let t = 0; t < tiers; t++) {
    let idx = tiers > 1 ? Math.floor((t * (sorted.length - 1)) / (tiers - 1)) : 0
    while (used.has(idx) && idx < sorted.length - 1) idx++
    while (used.has(idx) && idx > 0) idx--
    if (used.has(idx)) break
    used.add(idx)
    picks.push(sorted[idx])
  }

  const clues = picks.map((film, i) => {
    const points = (i + 1) * 100
    const scrubbed = stripOwnTitles(film.overview, [film.title])
    const words = scrubbed.split(/\s+/)
    const limit = PLOT_WORD_LIMITS[points]
    const clue = words.length > limit ? `${words.slice(0, limit).join(' ')}…` : scrubbed
    return { points, clue, hint: null, answer: film.title }
  })
  return { name: 'Plot Points', clues: padClues(clues) }
}

// Person ids worth fetching bio data for before calling buildBoard — a
// generous pool (top 12 per role by raw appearance count) so buildBoard has
// room to apply the real fame-score ranking without needing to re-fetch.
export function getQualifyingPersonIds(myList) {
  const actorMap = computeAppearanceMap(myList, 'cast')
  const directorMap = computeAppearanceMap(myList, 'director')
  const topBy = (map) => [...map.entries()].sort((a, b) => b[1].films.length - a[1].films.length).slice(0, 12).map(([id]) => id)
  return [...new Set([...topBy(actorMap), ...topBy(directorMap)])]
}

export function buildBoard(myList, peopleDataMap) {
  const actorMap = computeAppearanceMap(myList, 'cast')
  const directorMap = computeAppearanceMap(myList, 'director')
  return {
    categories: [
      buildPersonCategory('Actors', actorMap, peopleDataMap, myList.length),
      buildRankingCategory(myList),
      buildPersonCategory('Directors', directorMap, peopleDataMap, myList.length),
      buildHigherLowerCategory(myList),
      buildPlotPointsCategory(myList),
    ],
  }
}
