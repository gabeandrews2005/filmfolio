// Pure clue-generation for Film Frenzy — no I/O here. Given a myList
// (post useStatsBackfill, so cast/director/character/popularity are
// present) and a Map of person bio data (from useFilmFrenzyPeople), builds
// a 4-category x 5-clue (100/200/300/400/500) board. Deterministic given
// its inputs except for the couple of deliberately-randomized picks noted
// inline (so repeat games don't always surface the exact same clue).
//
// Every category answers via structured input (multiple choice / numeric /
// higher-lower) rather than free-text self-grading, so results are graded
// automatically instead of self-reported.

function computeAppearanceMap(myList, mode) {
  const map = new Map()
  myList.forEach((m, i) => {
    const filmInfo = { title: m.title, rank: i + 1, year: m.year, genres: m.genres ?? [] }
    if (mode === 'cast') {
      m.cast?.forEach((a) => {
        const entry = map.get(a.id) ?? { name: a.name, films: [] }
        entry.films.push({ ...filmInfo, character: a.character || '' })
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
    result.push({ points: (result.length + 1) * 100, clue: null, answer: null, choices: null })
  }
  return result
}

function shuffle(arr) {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Up to 4 other names from the same role's candidate pool, deduped, never
// including the answer itself — used as multiple-choice distractors.
function buildDistractors(appearanceMap, excludeId, answerName, count = 4) {
  const names = new Set()
  for (const [id, v] of appearanceMap.entries()) {
    if (id === excludeId || v.name === answerName) continue
    names.add(v.name)
  }
  return shuffle([...names]).slice(0, count)
}

// The person's most prominent qualifying film — the one to actually name in
// the clue text (lowest rank number = highest on the user's list).
function pickFeaturedFilm(films) {
  return [...films].sort((a, b) => a.rank - b.rank)[0]
}

// Description never mentions the person's name (that's the answer) — built
// entirely from structured data (birthplace, appearance count, one named
// film + what they did in it) rather than TMDB's raw biography text, which
// very often opens with the person's own name and was giving the answer
// away as literally the first words of the clue.
function buildPersonClueText(kind, person, personData) {
  const place = personData?.placeOfBirth || 'an undisclosed location'
  const count = person.films.length
  const filmCountPhrase = `${count} film${count === 1 ? '' : 's'}`
  const film = pickFeaturedFilm(person.films)
  const yearPart = film.year ? ` (${film.year})` : ''

  if (kind === 'actor') {
    const role = film.character ? `play ${film.character}` : 'star in a leading role'
    return `This actor is from ${place}. They appear in ${filmCountPhrase} on your list. In ${film.title}${yearPart}, they ${role}.`
  }

  const genre = film.genres?.[0]?.toLowerCase()
  const genrePart = genre ? `a ${genre} film` : 'one of the films'
  return `This director is from ${place}. They directed ${filmCountPhrase} on your list. ${film.title}${yearPart} is ${genrePart} they directed.`
}

function buildPersonCategory(categoryName, kind, appearanceMap, peopleDataMap) {
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
    const distractors = buildDistractors(appearanceMap, person.id, person.name)
    return {
      points,
      clue: buildPersonClueText(kind, person, personData),
      answer: person.name,
      choices: shuffle([person.name, ...distractors]),
    }
  })
  return { name: categoryName, type: 'multipleChoice', clues: padClues(clues) }
}

// Edge distance (0 = top or bottom of the list, ~N/2 = dead center) is
// scale-invariant — works the same whether the list has 20 films or 100.
// Films near either edge are easiest to place; the dead center is hardest.
// Answered via a numeric text box, auto-graded against the exact rank.
function buildRankingCategory(myList) {
  const N = myList.length
  if (N === 0) return { name: 'Where Does It Rank?', type: 'numeric', clues: padClues([]) }

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
    answer: String(film.rank),
    choices: null,
  }))
  return { name: 'Where Does It Rank?', type: 'numeric', clues: padClues(clues) }
}

// Nearest-available-gap matching per tier (rather than a strict bucket that
// can come up empty for short lists) — always finds the closest-fit pair
// among sampled candidates instead of leaving a tier unfilled. Answered via
// Higher/Lower buttons: is the comparison film ranked higher (closer to #1)
// than the reference film named in the clue?
function buildHigherLowerCategory(myList) {
  const N = myList.length
  if (N < 2) return { name: 'Higher or Lower?', type: 'binary', clues: padClues([]) }

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
    if (available.length === 0) return { points, clue: null, answer: null, choices: null }
    const target = tierTargets[points]
    available.sort((a, b) => Math.abs(a.gap - target) - Math.abs(b.gap - target))
    const pick = available[0]
    usedKeys.add(`${pick.i}-${pick.j}`)
    const reference = myList[pick.i]
    const comparison = myList[pick.j]
    return {
      points,
      clue: `Does "${comparison.title}" rank Higher or Lower than "${reference.title}" on your list?`,
      answer: pick.j < pick.i ? 'higher' : 'lower',
      choices: null,
    }
  })
  return { name: 'Higher or Lower?', type: 'binary', clues }
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
      buildPersonCategory('Actors', 'actor', actorMap, peopleDataMap),
      buildRankingCategory(myList),
      buildPersonCategory('Directors', 'director', directorMap, peopleDataMap),
      buildHigherLowerCategory(myList),
    ],
  }
}
