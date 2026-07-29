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
  const [authView, setAuthView] = useState<'form' | 'forgot' | 'reset'>(() => new URLSearchParams(window.location.search).get('mode') === 'reset' ? 'reset' : 'form')
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
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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

  async function sendResetLink(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!isSupabaseConfigured) {
      setError(missingConfigMessage)
      return
    }
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?mode=reset`,
    })
    if (resetError) setError(resetError.message)
    else setNotice('Password reset link sent. Check your inbox and open the link on this device.')
    setLoading(false)
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (newPassword.length < 6) {
      setError('Use a password with at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) setError(updateError.message)
    else {
      setNotice('Password updated. You can now sign in with your new password.')
      await supabase.auth.signOut()
      window.history.replaceState({}, '', '/login')
      setAuthView('form')
      setMode('signin')
      setNewPassword('')
      setConfirmPassword('')
    }
    setLoading(false)
  }

  async function useAnotherEmail() {
    setError('')
    setNotice('')
    await supabase.auth.signOut()
    setEmail('')
    setPassword('')
    setAuthView('form')
    setMode('signin')
  }

  async function complete(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user || !isSupabaseConfigured) return
    setError('')
    setNotice('')
    setLoading(true)
    let completionError: Error | null = null
    if (groupMode === 'create') {
      // A previously abandoned Join attempt can leave an ungrouped profile behind.
      // Remove only that incomplete profile so the atomic database function can
      // create the group and profile together as designed.
      const { data: existingProfile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('group_id')
        .eq('id', session.user.id)
        .maybeSingle()
      if (profileLookupError) {
        completionError = profileLookupError
      } else if (existingProfile?.group_id) {
        await refreshProfile()
        setLoading(false)
        navigate('/dashboard')
        return
      } else if (existingProfile) {
        const { error: cleanupError } = await supabase.from('profiles').delete().eq('id', session.user.id)
        if (cleanupError) completionError = cleanupError
      }
      if (completionError) {
        setLoading(false)
        setError('This account has an incomplete setup record. Please sign out and sign in again, then retry creating the group.')
        return
      }
      const { error } = await supabase.rpc('create_family_group', { p_name: name, p_role: role, p_group_name: group })
      completionError = error
    } else {
      const { error: profileError } = await supabase.from('profiles').upsert({ id: session.user.id, group_id: null, name, role }, { onConflict: 'id' })
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
        {authView === 'reset' ? (
          <>
            <p className="eyebrow">Password recovery</p>
            <h2>Choose a new password.</h2>
            <p>Use a new password you have not used for this account before.</p>
            <form onSubmit={updatePassword} className="form-stack">
              <input className="field" type="password" placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={6} />
              <input className="field" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} />
              {error && <p className="error">{error}</p>}
              {notice && <p className="notice">{notice}</p>}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={loading}>{loading ? 'Updating…' : 'Save new password'}</button>
            </form>
          </>
        ) : !joining ? authView === 'forgot' ? (
          <>
            <button className="brand" onClick={() => setAuthView('form')}><span className="brand-mark">z</span><span>Atlas</span></button>
            <h1>Reset your password.</h1>
            <p>Enter the email you use for zAtlas. We’ll send a secure reset link.</p>
            <form onSubmit={sendResetLink} className="form-stack">
              <input className="field" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
              {error && <p className="error">{error}</p>}
              {notice && <p className="notice">{notice}</p>}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
              <button className="btn" type="button" onClick={() => setAuthView('form')}>Back to sign in</button>
            </form>
          </>
        ) : (
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
              {mode === 'signin' && <button type="button" className="text-button" onClick={() => { setError(''); setNotice(''); setAuthView('forgot') }}>Forgot password?</button>}
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
            <div className="account-switch"><span>Signed in as {session?.user.email}</span><button type="button" className="text-button" onClick={() => void useAnotherEmail()}>Use another email</button></div>
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
