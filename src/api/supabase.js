import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Undefined (not a throwing client) when unconfigured — the app must keep
// working in pure guest/localStorage mode for anyone who hasn't set up a
// Supabase project, same as it always has for TMDB/OMDb being unset.
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

export async function getUserData(userId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_data')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) { console.error('getUserData failed', error); return null }
  return data // { data, updated_at } or null if no row yet
}

// Returns the server's authoritative updated_at on success (used as the
// sync-race comparison point — client clocks can't be trusted for that),
// or null on failure.
export async function upsertUserData(userId, blob) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, data: blob }, { onConflict: 'user_id' })
    .select('updated_at')
    .single()
  if (error) { console.error('upsertUserData failed', error); return null }
  return data.updated_at
}

export async function getProfileById(userId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) { console.error('getProfileById failed', error); return null }
  return data
}

export async function getProfileByUsername(username) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, created_at')
    .ilike('username', username)
    .maybeSingle()
  if (error) { console.error('getProfileByUsername failed', error); return null }
  return data
}

export async function checkUsernameAvailable(username) {
  if (!supabase) return true
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle()
  if (error) { console.error('checkUsernameAvailable failed', error); return false }
  return !data
}

export async function updateOwnProfile(userId, patch) {
  if (!supabase) return false
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
  if (error) { console.error('updateOwnProfile failed', error); return { ok: false, error } }
  return { ok: true }
}

export async function searchProfiles(query, excludeUserId) {
  if (!supabase || !query.trim()) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', `%${query.trim()}%`)
    .neq('id', excludeUserId)
    .limit(20)
  if (error) { console.error('searchProfiles failed', error); return [] }
  return data ?? []
}

export async function sendFriendRequest(requesterId, addresseeId) {
  if (!supabase) return { ok: false }
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
  if (error) { console.error('sendFriendRequest failed', error); return { ok: false, error } }
  return { ok: true }
}

export async function respondToFriendRequest(friendshipId, accept) {
  if (!supabase) return false
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
    .eq('id', friendshipId)
  if (error) { console.error('respondToFriendRequest failed', error); return false }
  return true
}

export async function withdrawFriendRequest(friendshipId) {
  if (!supabase) return false
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  if (error) { console.error('withdrawFriendRequest failed', error); return false }
  return true
}

// Same delete policy covers both an accepted-friendship unfriend and a
// pending-request withdrawal — one function either way.
export const unfriend = withdrawFriendRequest

// Fetches every friendship row involving this user (both directions), then
// a separate batched profiles lookup for "the other person" in each row —
// simpler and more robust than relying on PostgREST's embed syntax across
// two FKs to the same table (requester_id/addressee_id both -> auth.users).
export async function listMyFriendships(userId) {
  if (!supabase) return { accepted: [], incoming: [], outgoing: [] }
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, created_at')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  if (error) { console.error('listMyFriendships failed', error); return { accepted: [], incoming: [], outgoing: [] } }

  const otherIds = [...new Set((rows ?? []).map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id)))]
  let profilesById = new Map()
  if (otherIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', otherIds)
    profilesById = new Map((profiles ?? []).map((p) => [p.id, p]))
  }

  const accepted = [], incoming = [], outgoing = []
  for (const row of rows ?? []) {
    const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id
    const entry = { friendshipId: row.id, profile: profilesById.get(otherId) ?? null, createdAt: row.created_at }
    if (row.status === 'accepted') accepted.push(entry)
    else if (row.status === 'pending' && row.addressee_id === userId) incoming.push(entry)
    else if (row.status === 'pending' && row.requester_id === userId) outgoing.push(entry)
  }
  return { accepted, incoming, outgoing }
}
