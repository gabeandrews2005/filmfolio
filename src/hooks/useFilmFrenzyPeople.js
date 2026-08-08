import { useState, useEffect } from 'react'
import { getPersonDetails } from '../api/tmdb'

const CONCURRENCY = 4

// Fetches biography/popularity for a small pool of people (the qualifying
// 2+-appearance actors/directors, typically well under 30) — separate from
// useStatsBackfill since this only needs to run for a handful of people,
// not every film, and doesn't need to persist onto myList (TMDB's own 24h
// localStorage cache already makes repeat visits fast; there's nothing
// here that needs to survive independent of that).
export default function useFilmFrenzyPeople(personIds) {
  const [data, setData] = useState(new Map())
  const [loading, setLoading] = useState(personIds.length > 0)

  useEffect(() => {
    if (personIds.length === 0) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    async function run() {
      const results = new Map()
      let index = 0
      async function worker() {
        while (index < personIds.length) {
          const id = personIds[index++]
          const details = await getPersonDetails(id)
          if (cancelled) return
          results.set(id, {
            biography: details?.biography || '',
            popularity: details?.popularity ?? 0,
            knownForDepartment: details?.known_for_department ?? null,
            placeOfBirth: details?.place_of_birth ?? null,
          })
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, personIds.length) }, worker))
      if (!cancelled) {
        setData(results)
        setLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personIds.join(',')])

  return { peopleData: data, loading }
}
