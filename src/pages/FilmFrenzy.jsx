import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFilm } from '../context/FilmContext'
import useStatsBackfill from '../hooks/useStatsBackfill'
import useFilmFrenzyPeople from '../hooks/useFilmFrenzyPeople'
import { getQualifyingPersonIds, buildBoard } from '../utils/filmFrenzyClues'
import { safeSetItem } from '../api/tmdb'
import ConfirmModal from '../components/ConfirmModal'
import styles from './FilmFrenzy.module.css'

const LS_KEY = 'ff_film_frenzy'

function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function FilmFrenzy() {
  const { myList, patchListItems } = useFilm()
  useStatsBackfill(myList, patchListItems)

  const saved = useMemo(() => loadSaved(), [])
  const [board, setBoard] = useState(() => saved?.board ?? null)
  const [answered, setAnswered] = useState(() => saved?.answered ?? {})
  const [score, setScore] = useState(() => saved?.score ?? 0)
  const [activeClue, setActiveClue] = useState(null) // { catIdx, clueIdx }
  const [revealed, setRevealed] = useState(false)
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false)

  // Whether myList's stats-backfill has actually landed — checked against
  // the real data (the statsBackfilled marker), not useStatsBackfill's own
  // `backfilling` boolean. That flag is set via a *later* effect within the
  // same commit useStatsBackfill's own effect runs in, so on the very first
  // render it's one render-cycle stale — reading it directly here raced
  // ahead of the actual backfill and built a board from pre-backfill myList
  // (confirmed: Actors/Directors/Plot Points all came back empty). A 20s
  // timeout fallback keeps this from getting permanently stuck if even one
  // film's backfill can never succeed (e.g. a broken tmdb_id).
  const isMyListStatsReady = myList.length > 0 && myList.every((m) => m.statsBackfilled)
  const [forceReady, setForceReady] = useState(false)
  useEffect(() => {
    if (isMyListStatsReady || forceReady) return
    const timer = setTimeout(() => setForceReady(true), 20000)
    return () => clearTimeout(timer)
  }, [isMyListStatsReady, forceReady])
  const readyForClues = isMyListStatsReady || forceReady

  // Only need the (small) bio-fetch pool while there's no board yet — a
  // restored or freshly-built board already has every clue's text baked
  // in, nothing further to fetch.
  const qualifyingIds = useMemo(
    () => (board || !readyForClues ? [] : getQualifyingPersonIds(myList)),
    [myList, board, readyForClues]
  )
  const { peopleData, loading: peopleLoading } = useFilmFrenzyPeople(qualifyingIds)

  useEffect(() => {
    if (board || myList.length === 0 || !readyForClues || peopleLoading) return
    setBoard(buildBoard(myList, peopleData))
  }, [board, myList, peopleData, peopleLoading, readyForClues])

  useEffect(() => {
    if (!board) return
    safeSetItem(LS_KEY, JSON.stringify({ board, answered, score }))
  }, [board, answered, score])

  function openClue(catIdx, clueIdx) {
    const key = `${catIdx}_${clueIdx}`
    if (answered[key]) return
    const clue = board.categories[catIdx].clues[clueIdx]
    if (!clue.clue) return
    setActiveClue({ catIdx, clueIdx })
    setRevealed(false)
  }

  function closeModal() {
    setActiveClue(null)
    setRevealed(false)
  }

  function gradeClue(result) {
    const { catIdx, clueIdx } = activeClue
    const clue = board.categories[catIdx].clues[clueIdx]
    const key = `${catIdx}_${clueIdx}`
    setAnswered((prev) => ({ ...prev, [key]: result }))
    if (result === 'correct') setScore((prev) => prev + clue.points)
    closeModal()
  }

  function confirmNewGame() {
    localStorage.removeItem(LS_KEY)
    setBoard(null)
    setAnswered({})
    setScore(0)
    setShowNewGameConfirm(false)
  }

  const hasList = myList.length > 0
  const isBuilding = hasList && !board
  const activeClueData = activeClue ? board.categories[activeClue.catIdx].clues[activeClue.clueIdx] : null
  const activeCategoryName = activeClue ? board.categories[activeClue.catIdx].name : ''

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Film Frenzy</h1>
            <p className={styles.subtitle}>Trivia generated entirely from your own Top 100.</p>
          </div>
          {board && (
            <div className={styles.headerActions}>
              <span className={styles.score}>{score.toLocaleString()} pts</span>
              <button className={styles.newGameBtn} onClick={() => setShowNewGameConfirm(true)}>
                New Game
              </button>
            </div>
          )}
        </div>

        {!hasList && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>Build your film list first and we'll turn it into a trivia board.</p>
            <Link to="/my-list" className={styles.emptyLink}>Build My List →</Link>
          </div>
        )}

        {isBuilding && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Building your board…</p>
          </div>
        )}

        {board && (
          <div className={styles.board}>
            <div className={styles.headerRow}>
              {board.categories.map((cat) => (
                <div key={cat.name} className={styles.categoryHeader}>{cat.name}</div>
              ))}
            </div>
            {[0, 1, 2, 3, 4].map((rowIdx) => (
              <div key={rowIdx} className={styles.row}>
                {board.categories.map((cat, catIdx) => {
                  const clue = cat.clues[rowIdx]
                  const key = `${catIdx}_${rowIdx}`
                  const result = answered[key]
                  const unavailable = !clue.clue
                  return (
                    <button
                      key={key}
                      className={`${styles.cell} ${result ? styles.cellDone : ''} ${unavailable ? styles.cellUnavailable : ''}`}
                      onClick={() => openClue(catIdx, rowIdx)}
                      disabled={!!result || unavailable}
                    >
                      {result === 'correct' ? '✓' : result === 'incorrect' ? '—' : unavailable ? 'N/A' : clue.points}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {activeClue && (
        <div className={styles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className={styles.modal}>
            <button className={styles.modalClose} onClick={closeModal} aria-label="Close">×</button>
            <p className={styles.modalCategory}>{activeCategoryName} · {activeClueData.points} pts</p>
            <p className={styles.modalClueText}>{activeClueData.clue}</p>
            {activeClueData.hint && <p className={styles.modalHint}>{activeClueData.hint}</p>}

            {!revealed ? (
              <button className={styles.revealBtn} onClick={() => setRevealed(true)}>Reveal Answer</button>
            ) : (
              <>
                <p className={styles.modalAnswer}>Answer: <strong>{activeClueData.answer}</strong></p>
                <div className={styles.gradeActions}>
                  <button className={styles.correctBtn} onClick={() => gradeClue('correct')}>
                    Got it right (+{activeClueData.points})
                  </button>
                  <button className={styles.incorrectBtn} onClick={() => gradeClue('incorrect')}>
                    Got it wrong
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showNewGameConfirm && (
        <ConfirmModal
          title="Start a New Game?"
          message="This clears your current board and score and builds a fresh one from your Top 100."
          confirmLabel="New Game"
          destructive
          onConfirm={confirmNewGame}
          onCancel={() => setShowNewGameConfirm(false)}
        />
      )}
    </div>
  )
}
