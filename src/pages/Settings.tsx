import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../supabaseClient'

export default function Settings() {
  const { profile, refreshProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  async function handleLeaveGroup() {
    if (!profile) return
    const confirmed = window.confirm('Leave this family group? You will need an invite code to rejoin.')
    if (!confirmed) return
    await supabase.from('profiles').update({ group_id: null }).eq('id', profile.id)
    await refreshProfile()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-8">
      <button onClick={() => navigate('/dashboard')} className="text-gray-400 mb-6 text-sm">← Back to Dashboard</button>
      <h1 className="text-2xl font-semibold mb-8">Settings</h1>

      <div className="max-w-md space-y-6">
        <div className="bg-[var(--card)] rounded-lg p-5">
          <h2 className="text-sm text-gray-400 mb-3">Profile</h2>
          <p className="font-medium">{profile?.name}</p>
          <p className="text-gray-400 capitalize text-sm">{profile?.role}</p>
        </div>

        <div className="bg-[var(--card)] rounded-lg p-5 flex justify-between items-center">
          <div>
            <h2 className="text-sm text-gray-400 mb-1">Theme</h2>
            <p className="font-medium capitalize">{theme} mode</p>
          </div>
          <button
            onClick={toggleTheme}
            className="bg-[#00E5FF] text-black font-medium rounded-lg px-4 py-2 text-sm"
          >
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        <div className="bg-[var(--card)] rounded-lg p-5">
          <h2 className="text-sm text-gray-400 mb-3">Family Group</h2>
          <button
            onClick={handleLeaveGroup}
            className="border border-red-500/50 text-red-400 rounded-lg px-4 py-2 text-sm"
          >
            Leave Group
          </button>
        </div>

        <button
          onClick={() => supabase.auth.signOut()}
          className="border border-gray-700 rounded-lg px-4 py-2 text-sm w-full"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}