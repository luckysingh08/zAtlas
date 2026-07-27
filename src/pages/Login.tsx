import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { Role } from '../types'

export default function Login() {
  const { session, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [groupMode, setGroupMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleGoogleAuth() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) setError(error.message)
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) return
    setError('')
    setLoading(true)

    const { error: rpcErr } = await supabase.rpc('create_family_group', {
      p_name: name,
      p_role: role,
      p_group_name: groupName,
    })

    if (rpcErr) {
      setError(rpcErr.message)
      setLoading(false)
      return
    }

    await refreshProfile()
    setLoading(false)
    navigate('/dashboard')
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) return
    setError('')
    setLoading(true)

    const { error: profileErr } = await supabase
      .from('profiles')
      .insert({ id: session.user.id, group_id: null, name, role })

    if (profileErr) {
      setError(profileErr.message)
      setLoading(false)
      return
    }

    const { error: joinErr } = await supabase.rpc('join_group_by_code', {
      code: inviteCode.trim().toUpperCase(),
    })

    if (joinErr) {
      setError(joinErr.message)
      setLoading(false)
      return
    }

    await refreshProfile()
    setLoading(false)
    navigate('/dashboard')
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text)] px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-semibold mb-1">zAtlas</h1>
<p className="text-gray-400 mb-8">exam prep app — stay synced at every step of the way.</p>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-[#FAFAFA] placeholder-gray-500 focus:outline-none focus:border-[#00E5FF]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-[#FAFAFA] placeholder-gray-500 focus:outline-none focus:border-[#00E5FF]"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00E5FF] text-black font-medium rounded-lg py-3 disabled:opacity-50"
            >
              {loading ? 'Please wait...' : authMode === 'signup' ? 'Sign up' : 'Sign in'}
            </button>
          </form>

          <button
            onClick={handleGoogleAuth}
            className="w-full mt-3 border border-gray-700 rounded-lg py-3 text-[#FAFAFA]"
          >
            Continue with Google
          </button>

          <p className="text-center text-gray-400 text-sm mt-6">
            {authMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}
              className="text-[#00E5FF]"
            >
              {authMode === 'signup' ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    )
  }

  if (!profile || !profile.group_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text)] px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold mb-6">Set up your family group</h1>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setGroupMode('create')}
              className={`flex-1 py-2 rounded-lg border ${groupMode === 'create' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-gray-700 text-gray-400'}`}
            >
              Create Group
            </button>
            <button
              onClick={() => setGroupMode('join')}
              className={`flex-1 py-2 rounded-lg border ${groupMode === 'join' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-gray-700 text-gray-400'}`}
            >
              Join Group
            </button>
          </div>

          <form onSubmit={groupMode === 'create' ? handleCreateGroup : handleJoinGroup} className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-[#FAFAFA] placeholder-gray-500 focus:outline-none focus:border-[#00E5FF]"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex-1 py-2 rounded-lg border ${role === 'student' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-gray-700 text-gray-400'}`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setRole('guardian')}
                className={`flex-1 py-2 rounded-lg border ${role === 'guardian' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-gray-700 text-gray-400'}`}
              >
                Guardian
              </button>
            </div>

            {groupMode === 'create' ? (
              <input
                type="text"
                placeholder="Family group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                className="w-full bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-[#FAFAFA] placeholder-gray-500 focus:outline-none focus:border-[#00E5FF]"
              />
            ) : (
              <input
                type="text"
                placeholder="Invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                className="w-full bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-[#FAFAFA] placeholder-gray-500 focus:outline-none focus:border-[#00E5FF] uppercase"
              />
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00E5FF] text-black font-medium rounded-lg py-3 disabled:opacity-50"
            >
              {loading ? 'Please wait...' : groupMode === 'create' ? 'Create Group' : 'Join Group'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return null
}