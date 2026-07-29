import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getGroup } from '../lib/data'
import { supabase } from '../supabaseClient'
import { Group } from '../types'
import AppShell from '../components/AppShell'

export default function Settings() {
  const { profile, refreshProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!profile?.group_id) return
    getGroup(profile.group_id).then(setGroup).catch((loadError: Error) => setError(loadError.message))
  }, [profile?.group_id])

  async function copyInviteCode() {
    if (!group?.invite_code) return
    try {
      await navigator.clipboard.writeText(group.invite_code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy the invite code. Please select it manually.')
    }
  }

  async function leave() {
    if (!profile || !window.confirm('Leave this family group? You will need an invite code to rejoin.')) return
    setError('')
    const { error: leaveError } = await supabase.from('profiles').update({ group_id: null }).eq('id', profile.id)
    if (leaveError) {
      setError(leaveError.message)
      return
    }
    await refreshProfile()
    navigate('/login')
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(signOutError.message)
  }

  return <AppShell title="A space that feels like yours." eyebrow="Preferences"><div className="settings-grid">
    <section className="surface settings-row"><div className="identity"><span className="avatar">{profile?.name?.slice(0, 1).toUpperCase()}</span><div><h2>{profile?.name}</h2><p className="capitalize">{profile?.role} profile</p></div></div><span className="pill">Active</span></section>
    <section className="surface settings-row"><div><h2>Appearance</h2><p>{theme === 'dark' ? 'Midnight' : 'Paper'} mode is active</p></div><button className="btn btn-primary" onClick={toggleTheme}>Use {theme === 'dark' ? 'light' : 'dark'} mode</button></section>
    <section className="surface settings-row"><div><h2>{group?.name || 'Family group'}</h2><p>Share this invite code with the other person in your family.</p></div><div className="invite-code"><code>{group?.invite_code || 'Loading…'}</code><button className="btn" disabled={!group} onClick={copyInviteCode}>{copied ? 'Copied' : 'Copy code'}</button></div></section>
    <section className="surface settings-row"><div><h2>Family group</h2><p>Step away from the shared space whenever needed.</p></div><button className="btn btn-danger" onClick={leave}>Leave group</button></section>
    <section className="surface settings-row"><div><h2>Session</h2><p>Sign out only from this device.</p></div><button className="btn" onClick={signOut}>Sign out</button></section>
    {error && <p className="error">{error}</p>}
  </div></AppShell>
}
