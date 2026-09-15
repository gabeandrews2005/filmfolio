import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './ForgotPassword.module.css'

export default function ForgotPassword() {
  const { isConfigured, resetPassword, verifyRecoveryOtp, updatePassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [step, setStep] = useState('email') // 'email' | 'code' | 'done'
  const [email, setEmail] = useState(location.state?.email ?? '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSendCode(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Enter your email address.'); return }
    setSubmitting(true)
    const result = await resetPassword(email.trim())
    setSubmitting(false)
    if (!result.ok) { setError(result.error); return }
    setStep('code')
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setError('')
    if (!code.trim()) { setError('Enter the code from your email.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords don’t match.'); return }

    setSubmitting(true)
    const verified = await verifyRecoveryOtp(email.trim(), code.trim())
    if (!verified.ok) {
      setSubmitting(false)
      setError(verified.error)
      return
    }
    const updated = await updatePassword(newPassword)
    setSubmitting(false)
    if (!updated.ok) { setError(updated.error); return }
    setStep('done')
    setTimeout(() => { window.location.href = '/account' }, 1500)
  }

  if (!isConfigured) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.card}>
            <div className={styles.header}>
              <h1 className={styles.title}>Accounts aren't set up yet</h1>
              <p className={styles.subtitle}>The site owner hasn't connected a backend for accounts yet — check back soon.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.card}>
          {step === 'email' && (
            <>
              <div className={styles.header}>
                <h1 className={styles.title}>Reset Your Password</h1>
                <p className={styles.subtitle}>Enter your account email and we'll send you a one-time code.</p>
              </div>
              <form onSubmit={handleSendCode} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {error && <span className={styles.error}>{error}</span>}
                <div className={styles.actions}>
                  <button type="submit" className={styles.submitBtn} disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send Code →'}
                  </button>
                </div>
                <Link to="/account" className={styles.linkBtn}>Back to Log In</Link>
              </form>
            </>
          )}

          {step === 'code' && (
            <>
              <div className={styles.header}>
                <h1 className={styles.title}>Enter Your Code</h1>
                <p className={styles.subtitle}>We sent a one-time code to {email}. Enter it below along with your new password.</p>
              </div>
              <form onSubmit={handleResetPassword} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="reset-code">One-Time Code</label>
                  <input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    className={`${styles.input} ${styles.codeInput}`}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={8}
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="new-password">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    className={styles.input}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="confirm-password">Confirm Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    className={styles.input}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                {error && <span className={styles.error}>{error}</span>}
                <div className={styles.actions}>
                  <button type="submit" className={styles.submitBtn} disabled={submitting}>
                    {submitting ? 'Saving…' : 'Reset Password →'}
                  </button>
                </div>
                <button type="button" className={styles.linkBtn} onClick={() => { setStep('email'); setError('') }}>
                  Didn't get a code? Try again
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div className={styles.header}>
              <h1 className={styles.title}>Password Updated</h1>
              <p className={styles.subtitle}>Taking you back to your account…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
