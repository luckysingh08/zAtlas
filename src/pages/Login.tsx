import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ambient } from '../components/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, supabase } from '../supabaseClient'
import { Role } from '../types'

export default function Login() {
  const { session, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [groupMode, setGroupMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [group, setGroup] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')

  const missingConfigMessage = 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a local .env file to enable sign in.'

  async function auth(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!isSupabaseConfigured) {
      setError(missingConfigMessage)
      return
    }
    setLoading(true)
    const { data, error } = mode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else if (mode === 'signup' && !data.session) setNotice('Check your inbox to confirm your email, then sign in.')
    setLoading(false)
  }

  async function complete(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user || !isSupabaseConfigured) return
    setError('')
    setNotice('')
    setLoading(true)
    let completionError: Error | null = null
    if (groupMode === 'create') {
      const { error } = await supabase.rpc('create_family_group', { p_name: name, p_role: role, p_group_name: group })
      completionError = error
    } else {
      const { error: profileError } = await supabase.from('profiles').insert({ id: session.user.id, group_id: null, name, role })
      completionError = profileError
      if (!profileError) {
        const { error } = await supabase.rpc('join_group_by_code', { code: code.trim().toUpperCase() })
        completionError = error
      }
    }
    setLoading(false)
    if (completionError) {
      setError(completionError.message)
      return
    }
    await refreshProfile()
    navigate('/dashboard')
  }

  async function googleAuth() {
    setError('')
    if (!isSupabaseConfigured) {
      setError(missingConfigMessage)
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    })
    if (error) setError(error.message)
  }

  if (session && profile?.group_id) return null

  const joining = Boolean(session)
  const primaryLabel = loading ? 'Just a moment...' : mode === 'signin' ? 'Continue to Atlas' : 'Create your space'

  return (
    <main className="auth">
      <Ambient variant={joining ? 'subject' : 'atlas'} />
      <section className="surface auth-card">
        {!joining ? (
          <>
            <button className="brand">
              <span className="brand-mark">z</span>
              <span>Atlas</span>
            </button>
            <h1>Learning, in orbit.</h1>
            <p>A quieter home for your study rhythm and the people cheering you on.</p>
            {!isSupabaseConfigured && <p className="error">{missingConfigMessage}</p>}
            <div className="auth-tabs">
              <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button>
              <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
            </div>
            <form onSubmit={auth} className="form-stack">
              <input className="field" type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input className="field" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              {error && <p className="error">{error}</p>}
              {notice && <p className="notice">{notice}</p>}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={loading}>{primaryLabel}</button>
            </form>
            <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={googleAuth}>Continue with Google</button>
          </>
        ) : (
          <>
            <p className="eyebrow">One last detail</p>
            <h2>Make your shared space feel personal.</h2>
            <div className="auth-tabs">
              <button className={groupMode === 'create' ? 'active' : ''} onClick={() => setGroupMode('create')}>Create group</button>
              <button className={groupMode === 'join' ? 'active' : ''} onClick={() => setGroupMode('join')}>Join group</button>
            </div>
            <form onSubmit={complete} className="form-stack">
              <input className="field" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
              <div className="auth-tabs">
                <button type="button" className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}>Student</button>
                <button type="button" className={role === 'guardian' ? 'active' : ''} onClick={() => setRole('guardian')}>Guardian</button>
              </div>
              {groupMode === 'create'
                ? <input className="field" placeholder="Family group name" value={group} onChange={(e) => setGroup(e.target.value)} required />
                : <input className="field" placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} required />}
              {error && <p className="error">{error}</p>}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={loading}>{loading ? 'Preparing your Atlas...' : groupMode === 'create' ? 'Create group' : 'Join group'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
