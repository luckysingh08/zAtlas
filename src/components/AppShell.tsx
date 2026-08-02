import { ReactNode, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../supabaseClient'
import { getFiles, getMessages } from '../lib/data'

type IconName = 'home' | 'plan' | 'inbox' | 'settings' | 'arrow' | 'plus' | 'spark'

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9v10h13V9" /><path d="M9.5 19v-5h5v5" /></>,
    plan: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 2v4M16 2v4M8 10h8M8 14h5" /></>,
    inbox: <><path d="M4 5h16v14H4z" /><path d="M4 14h4l2 3h4l2-3h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V20h-3v-.12A1.7 1.7 0 0 0 10.66 18.3a1.7 1.7 0 0 0-1.88.34l-.06.06L6.6 16.58l.06-.06A1.7 1.7 0 0 0 7 14.64a1.7 1.7 0 0 0-1.56-1.04H5.3v-3h.12A1.7 1.7 0 0 0 7 9.56a1.7 1.7 0 0 0-.34-1.88L6.6 7.62 8.72 5.5l.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.7 4.34V4.2h3v.14a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 9.56a1.7 1.7 0 0 0 1.56 1.04h.14v3h-.14A1.7 1.7 0 0 0 19.4 15Z" /></>,
    arrow: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    spark: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function Ambient({ variant = 'atlas' }: { variant?: 'atlas' | 'planner' | 'inbox' | 'subject' }) {
  return <div className={`ambient ambient-${variant}`} aria-hidden="true"><i /><b /><em /><span /></div>
}

export default function AppShell({ title, eyebrow, children, variant = 'atlas', action }: { title: string; eyebrow?: string; children: ReactNode; variant?: 'atlas' | 'planner' | 'inbox' | 'subject'; action?: ReactNode }) {
  const { profile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [hasUpdates, setHasUpdates] = useState(false)
  const seenKey = profile?.group_id && profile?.id ? `zatlas-seen-${profile.group_id}-${profile.id}` : ''

  useEffect(() => {
    if (!profile?.group_id || !profile.id || !seenKey) return
    if (location.pathname === '/messages') {
      localStorage.setItem(seenKey, new Date().toISOString())
      setHasUpdates(false)
      return
    }
    async function checkForUpdates() {
      try {
        const since = localStorage.getItem(seenKey) || new Date(0).toISOString()
        const [chat, alerts, files] = await Promise.all([getMessages(profile!.group_id!, 'chat'), getMessages(profile!.group_id!, 'alert'), getFiles(profile!.group_id!)])
        setHasUpdates([...chat, ...alerts].some((item) => item.sender_id !== profile!.id && item.created_at > since) || files.some((item) => item.uploader_id !== profile!.id && item.uploaded_at > since))
      } catch { /* The Connect page will display the detailed error if data is unavailable. */ }
    }
    void checkForUpdates()
    const channel = supabase.channel(`sidebar-updates-${profile.group_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${profile.group_id}` }, (payload) => { if ((payload.new as { sender_id?: string }).sender_id !== profile.id) setHasUpdates(true) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'files', filter: `group_id=eq.${profile.group_id}` }, (payload) => { if ((payload.new as { uploader_id?: string }).uploader_id !== profile.id) setHasUpdates(true) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [profile?.group_id, profile?.id, location.pathname, seenKey])
  const items = [
    { to: '/dashboard', label: 'Overview', icon: 'home' as IconName },
    { to: '/planner', label: 'Planner', icon: 'plan' as IconName },
    { to: '/messages', label: 'Connect', icon: 'inbox' as IconName },
    { to: '/settings', label: 'Settings', icon: 'settings' as IconName },
  ]
  return <main className="app-shell"><Ambient variant={variant} />
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate('/dashboard')}><span className="brand-mark">z</span><span>Atlas</span></button>
      <nav className="side-nav">{items.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon"><Icon name={item.icon} />{item.to === '/messages' && hasUpdates && <b className="nav-notice" />}</span><span>{item.label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><button className="profile-mini" onClick={() => navigate('/settings')}><span>{profile?.name?.slice(0, 1).toUpperCase() || 'Z'}</span><small>{profile?.role || 'member'}</small></button><button className="side-utility" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? '☼' : '◐'}</button><button className="side-utility" onClick={() => supabase.auth.signOut()} aria-label="Sign out">↗</button></div>
    </aside>
    <section className="workspace"><header className="page-head"><div><p className="eyebrow">{eyebrow || 'Your private learning space'}</p><h1>{title}</h1></div><div className="page-action">{action}</div></header>{children}</section>
  </main>
}
