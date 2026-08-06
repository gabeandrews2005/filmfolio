import { useState } from 'react'
import styles from './RankPickerModal.module.css'

export default function RankPickerModal({ itemName, minRank = 1, maxRank, description, onSubmit, onCancel }) {
  const [rankInput, setRankInput] = useState('')
  const [error, setError] = useState('')

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onCancel()
  }

  function handleSubmit(e) {
    e.preventDefault()
    const rank = parseInt(rankInput, 10)
    if (!Number.isInteger(rank) || rank < minRank || rank > maxRank) {
      setError(`Enter a rank between ${minRank} and ${maxRank}.`)
      return
    }
    onSubmit(rank)
  }

  return (
    <div className={styles.overlay} onClick={handleBackdrop}>
      <div className={styles.box}>
        <p className={styles.text}>
          {description ?? (
            <>Your list is full. Pick a rank for <strong>{itemName}</strong> — whatever's there
            (and everything below it) shifts down a spot, and the last one drops off the list.</>
          )}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="number"
            inputMode="numeric"
            min={minRank}
            max={maxRank}
            value={rankInput}
            onChange={(e) => { setRankInput(e.target.value); setError('') }}
            className={styles.input}
            placeholder={`${minRank}–${maxRank}`}
            autoFocus
          />
          {error && <p className={styles.errorText}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn}>
              Add at Rank
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
