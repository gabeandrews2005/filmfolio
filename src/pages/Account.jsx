import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { checkUsernameAvailable } from '../api/supabase'
import styles from './Account.module.css'

function SignedOutView() {
  const { signUp, signIn, resetPassword, isConfigured } = useAuth()
  const [mode, setMode] = useState('signup') // 'signup' | 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [usernameStatus, setUsernameStatus] = useState(null) // null | 'checking' | 'available' | 'taken'
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (mode !== 'signup' || username.trim().length < 2) { setUsernameStatus(null); return }
    debounceRef.current = setTimeout(async () => {
      setUsernameStatus('checking')
      const available = await checkUsernameAvailable(username.trim())
      setUsernameStatus(available ? 'available' : 'taken')
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [username, mode])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (mode === 'signup') {
      const trimmed = username.trim()
      if (trimmed.length < 2) { setError('Username must be at least 2 characters.'); return }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setError('Letters, numbers, and underscores only.'); return }
      if (usernameStatus === 'taken') { setError('That username is already taken.'); return }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
      setSubmitting(true)
      const result = await signUp({ email: email.trim(), password, username: trimmed, phone: phone.trim() || undefined })
      setSubmitting(false)
      if (!result.ok) { setError(result.error); return }
      if (result.needsEmailConfirmation) setNeedsConfirmation(true)
      // otherwise signUp() already hard-redirected on success
    } else {
      setSubmitting(true)
      const result = await signIn({ email: email.trim(), password })
      setSubmitting(false)
      if (!result.ok) setError(result.error)
      // otherwise signIn() already hard-redirected on success
    }
  }

  async function handleForgotPassword() {
    setError('')
    if (!email.trim()) { setError('Enter your email above first.'); return }
    const result = await resetPassword(email.trim())
    if (result.ok) setResetSent(true)
    else setError(result.error)
  }

  if (!isConfigured) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Accounts aren't set up yet</h1>
          <p className={styles.subtitle}>The site owner hasn't connected a backend for accounts yet — check back soon.</p>
        </div>
      </div>
    )
  }

  if (needsConfirmation) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>We sent a confirmation link to {email}. Click it, then come back and log in.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.title}>{mode === 'signup' ? 'Create Your Account' : 'Welcome Back'}</h1>
        <p className={styles.subtitle}>
          {mode === 'signup'
            ? 'Set up an account to save your lists to the cloud and connect with friends.'
            : 'Sign in to pick up right where you left off.'}
        </p>
      </div>

      <div className={styles.tabRow}>
        <button
          type="button"
          className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
          onClick={() => { setMode('signup'); setError('') }}
        >
          Sign Up
        </button>
        <button
          type="button"
          className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
          onClick={() => { setMode('login'); setError('') }}
        >
          Log In
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {mode === 'signup' && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className={styles.input}
              placeholder="e.g. film_lover"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
            />
            {usernameStatus === 'checking' && <span className={styles.hint}>Checking availability…</span>}
            {usernameStatus === 'available' && <span className={styles.hintOk}>Available</span>}
            {usernameStatus === 'taken' && <span className={styles.error}>That username is already taken.</span>}
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        {mode === 'signup' && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="phone">Phone (optional)</label>
            <input
              id="phone"
              type="tel"
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Just for your profile — never used to log in"
            />
          </div>
        )}

        {error && <span className={styles.error}>{error}</span>}
        {resetSent && <span className={styles.hintOk}>Password reset email sent.</span>}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || (mode === 'signup' && usernameStatus === 'taken')}
          >
            {submitting ? 'Please wait…' : mode === 'signup' ? 'Create Account →' : 'Log In →'}
          </button>
        </div>

        {mode === 'login' && (
          <button type="button" className={styles.linkBtn} onClick={handleForgotPassword}>
            Forgot password?
          </button>
        )}
      </form>
    </div>
  )
}

function SignedInView() {
  const { profile, session, signOut, updateProfile, updatePhone } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState(profile?.username ?? '')
  const [phone, setPhone] = useState(session?.user?.user_metadata?.phone ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const trimmed = username.trim()
    if (trimmed.length < 2) { setError('Username must be at least 2 characters.'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setError('Letters, numbers, and underscores only.'); return }

    const result = await updateProfile({ username: trimmed })
    if (!result.ok) { setError(result.error); return }
    if (phone.trim() !== (session?.user?.user_metadata?.phone ?? '')) {
      await updatePhone(phone.trim())
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleSignOut() {
    if (window.confirm('Sign out? Your lists stay saved to your account and on this device.')) {
      signOut()
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.title}>Account Settings</h1>
        <p className={styles.subtitle}>Update your profile.</p>
      </div>

      <div className={styles.avatarSection}>
        <div className={styles.avatarPreview}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="Profile" />
            : <span className={styles.avatarPlaceholder}>?</span>
          }
        </div>
        <button
          type="button"
          className={styles.avatarLabel}
          onClick={() => navigate('/my-list', { state: { pickingProfilePicture: true } })}
        >
          Select Film
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-username">Username</label>
          <input
            id="edit-username"
            type="text"
            className={styles.input}
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError('') }}
            maxLength={30}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Email</span>
          <span className={styles.readonlyValue}>{session?.user?.email}</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-phone">Phone</label>
          <input
            id="edit-phone"
            type="tel"
            className={styles.input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional — just for your profile"
          />
        </div>

        {error && <span className={styles.error}>{error}</span>}

        <div className={styles.actions}>
          <button type="submit" className={styles.submitBtn}>Save Changes</button>
          {saved && <span className={styles.savedMsg}>Saved</span>}
        </div>
      </form>

      <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  )
}

export default function Account() {
  const { session, authLoading } = useAuth()

  if (authLoading) {
    return <div className={styles.page}><div className="container" /></div>
  }

  return (
    <div className={styles.page}>
      <div className="container">
        {session ? <SignedInView /> : <SignedOutView />}
      </div>
    </div>
  )
}
