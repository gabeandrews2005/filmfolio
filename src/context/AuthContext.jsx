import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, getProfileById, checkUsernameAvailable, updateOwnProfile } from '../api/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    let cancelled = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) setProfile(await getProfileById(data.session.user.id))
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (cancelled) return
      setSession(newSession)
      setProfile(newSession ? await getProfileById(newSession.user.id) : null)
    })

    return () => { cancelled = true; listener.subscription.unsubscribe() }
  }, [])

  // Username availability is pre-checked here for a friendly inline error;
  // the DB's unique index (lower(username)) is the real backstop for the
  // rare race of two people submitting the same name at once — that case
  // surfaces as a generic Supabase error, caught and re-worded below.
  const signUp = useCallback(async ({ email, password, username, phone }) => {
    if (!supabase) return { ok: false, error: 'Accounts aren’t set up yet.' }
    const available = await checkUsernameAvailable(username)
    if (!available) return { ok: false, error: 'That username is already taken.' }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, ...(phone ? { phone } : {}) } },
    })
    if (error) {
      if (/database error saving new user/i.test(error.message)) {
        return { ok: false, error: 'That username was just taken — try another.' }
      }
      return { ok: false, error: error.message }
    }
    if (!data.session) {
      // "Confirm email" is on in the Supabase project despite the plan's
      // recommendation to disable it — signUp succeeded but there's no
      // session yet, so hard-reloading now would just land on a signed-out
      // homepage with no explanation.
      return { ok: true, needsEmailConfirmation: true }
    }
    // Hard reload (not in-place state update) so every piece of app state
    // re-initializes clean against the new session — see FilmContext's
    // Race C notes for why an in-place transition is unsafe here.
    window.location.href = '/'
    return { ok: true }
  }, [])

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) return { ok: false, error: 'Accounts aren’t set up yet.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: error.message }
    window.location.href = '/'
    return { ok: true }
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    window.location.href = '/'
  }, [])

  const updateProfile = useCallback(async ({ username, avatarDataUri }) => {
    if (!session) return { ok: false, error: 'Not signed in.' }
    if (username !== undefined && username !== profile?.username) {
      const available = await checkUsernameAvailable(username)
      if (!available) return { ok: false, error: 'That username is already taken.' }
    }
    const patch = {}
    if (username !== undefined) patch.username = username
    if (avatarDataUri !== undefined) patch.avatar_url = avatarDataUri
    const result = await updateOwnProfile(session.user.id, patch)
    if (result.ok) setProfile((prev) => ({ ...prev, ...patch }))
    return result
  }, [session, profile])

  const updatePhone = useCallback(async (phone) => {
    if (!supabase) return { ok: false, error: 'Accounts aren’t set up yet.' }
    const { error } = await supabase.auth.updateUser({ data: { phone } })
    if (error) return { ok: false, error: error.message }
    setSession((prev) => prev
      ? { ...prev, user: { ...prev.user, user_metadata: { ...prev.user.user_metadata, phone } } }
      : prev)
    return { ok: true }
  }, [])

  const resetPassword = useCallback(async (email) => {
    if (!supabase) return { ok: false, error: 'Accounts aren’t set up yet.' }
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }, [])

  return (
    <AuthContext.Provider value={{
      session, profile, authLoading, isConfigured: !!supabase,
      signUp, signIn, signOut, updateProfile, updatePhone, resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
