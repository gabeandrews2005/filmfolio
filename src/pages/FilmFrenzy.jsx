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
// Bumped when the board/clue shape changes in a way older saved boards
// can't render (e.g. category count/order, multiple-choice fields) — a
// version mismatch discards the stale save instead of rendering it broken.
const BOARD_VERSION = 2

function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.version === BOARD_VERSION ? parsed : null
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
  const [pendingResult, setPendingResult] = useState(null) // 'correct' | 'incorrect' | null
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [numericInput, setNumericInput] = useState('')
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
  const { peopleData } = useFilmFrenzyPeople(qualifyingIds)
  // Gate on the data itself, not useFilmFrenzyPeople's own `loading` flag —
  // the same staleness trap as isMyListStatsReady above: when qualifyingIds
  // flips from [] to real ids, this effect and the hook's internal fetch
  // effect commit together, but `loading` only flips to true once that
  // internal effect runs, one render after this one already read it as
  // still false. Reading peopleData's actual keys instead sidesteps the gap
  // (confirmed via testing: without this, boards built with a placeOfBirth
  // in the very first sentence rendered "an undisclosed location" for every
  // person even though the real bio data arrived moments later).
  const peopleDataReady = qualifyingIds.length === 0 || qualifyingIds.every((id) => peopleData.has(id))

  useEffect(() => {
    if (board || myList.length === 0 || !readyForClues || !peopleDataReady) return
    setBoard(buildBoard(myList, peopleData))
  }, [board, myList, peopleData, peopleDataReady, readyForClues])

  useEffect(() => {
    if (!board) return
    safeSetItem(LS_KEY, JSON.stringify({ version: BOARD_VERSION, board, answered, score }))
  }, [board, answered, score])

  function openClue(catIdx, clueIdx) {
    const key = `${catIdx}_${clueIdx}`
    if (answered[key]) return
    const clue = board.categories[catIdx].clues[clueIdx]
    if (!clue.clue) return
    setActiveClue({ catIdx, clueIdx })
    setPendingResult(null)
    setSelectedChoice(null)
    setNumericInput('')
  }

  function closeModal() {
    setActiveClue(null)
    setPendingResult(null)
    setSelectedChoice(null)
    setNumericInput('')
  }

  function gradeClue(result) {
    const { catIdx, clueIdx } = activeClue
    const clue = board.categories[catIdx].clues[clueIdx]
    const key = `${catIdx}_${clueIdx}`
    setAnswered((prev) => ({ ...prev, [key]: result }))
    if (result === 'correct') setScore((prev) => prev + clue.points)
    closeModal()
  }

  function submitChoice(choice) {
    if (pendingResult) return
    setSelectedChoice(choice)
    setPendingResult(choice === activeClueData.answer ? 'correct' : 'incorrect')
  }

  function submitBinary(choice) {
    if (pendingResult) return
    setSelectedChoice(choice)
    setPendingResult(choice === activeClueData.answer ? 'correct' : 'incorrect')
  }

  function submitNumeric() {
    if (pendingResult || numericInput.trim() === '') return
    const guess = parseInt(numericInput, 10)
    const correct = !Number.isNaN(guess) && guess === parseInt(activeClueData.answer, 10)
    setPendingResult(correct ? 'correct' : 'incorrect')
  }

  function confirmAnswer() {
    gradeClue(pendingResult)
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
  const activeCategoryType = activeClue ? board.categories[activeClue.catIdx].type : null

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

            {activeCategoryType === 'multipleChoice' && (
              <div className={styles.choiceGrid}>
                {activeClueData.choices.map((choice) => {
                  const isCorrectChoice = pendingResult && choice === activeClueData.answer
                  const isWrongSelected = pendingResult && choice === selectedChoice && choice !== activeClueData.answer
                  return (
                    <button
                      key={choice}
                      className={`${styles.choiceBtn} ${isCorrectChoice ? styles.choiceCorrect : ''} ${isWrongSelected ? styles.choiceWrong : ''}`}
                      onClick={() => submitChoice(choice)}
                      disabled={!!pendingResult}
                    >
                      {choice}
                    </button>
                  )
                })}
              </div>
            )}

            {activeCategoryType === 'binary' && (
              <div className={styles.binaryRow}>
                {['higher', 'lower'].map((choice) => {
                  const isCorrectChoice = pendingResult && choice === activeClueData.answer
                  const isWrongSelected = pendingResult && choice === selectedChoice && choice !== activeClueData.answer
                  return (
                    <button
                      key={choice}
                      className={`${styles.choiceBtn} ${isCorrectChoice ? styles.choiceCorrect : ''} ${isWrongSelected ? styles.choiceWrong : ''}`}
                      onClick={() => submitBinary(choice)}
                      disabled={!!pendingResult}
                    >
                      {choice === 'higher' ? 'Higher' : 'Lower'}
                    </button>
                  )
                })}
              </div>
            )}

            {!pendingResult && activeCategoryType === 'numeric' && (
              <form className={styles.numericRow} onSubmit={(e) => { e.preventDefault(); submitNumeric() }}>
                <input
                  type="number"
                  min="1"
                  value={numericInput}
                  onChange={(e) => setNumericInput(e.target.value)}
                  placeholder="Rank #"
                  className={styles.numericInput}
                  autoFocus
                />
                <button type="submit" className={styles.revealBtn}>Submit</button>
              </form>
            )}

            {pendingResult && (
              <>
                <p className={`${styles.modalAnswer} ${pendingResult === 'correct' ? styles.answerCorrect : styles.answerIncorrect}`}>
                  {pendingResult === 'correct' ? 'Correct!' : 'Not quite.'} The answer was <strong>{activeClueData.answer}</strong>.
                </p>
                <button className={styles.correctBtn} onClick={confirmAnswer}>
                  Continue{pendingResult === 'correct' ? ` (+${activeClueData.points})` : ''}
                </button>
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
