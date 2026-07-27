import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import { getSubjects, getChaptersWithTasks, createSubject, calcSubjectPercent, calcTaskTypePoints } from '../lib/data'
import { Subject, Chapter, Task } from '../types'
import SubjectBarChart from '../components/SubjectBarChart'

type ChapterWithTasks = Chapter & { tasks: Task[] }
type SubjectWithStats = Subject & { percent: number; lecture: number; hw: number; dpp: number }

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')

  const isStudent = profile?.role === 'student'

  async function load() {
    if (!profile?.group_id) return
    const subs = await getSubjects(profile.group_id)
    const withStats = await Promise.all(
      subs.map(async (s) => {
        const chapters: ChapterWithTasks[] = await getChaptersWithTasks(s.id)
        const lecture = calcTaskTypePoints(chapters, 'lecture')
        const hw = calcTaskTypePoints(chapters, 'hw')
        const dpp = calcTaskTypePoints(chapters, 'dpp')
        return {
          ...s,
          percent: calcSubjectPercent(chapters),
          lecture: lecture.max ? (lecture.earned / lecture.max) * 100 : 0,
          hw: hw.max ? (hw.earned / hw.max) * 100 : 0,
          dpp: dpp.max ? (dpp.earned / dpp.max) * 100 : 0,
        }
      })
    )
    setSubjects(withStats)
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.group_id])

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.group_id || !newSubjectName.trim()) return
    await createSubject(profile.group_id, newSubjectName.trim(), '#00E5FF')
    setNewSubjectName('')
    setShowAddForm(false)
    await load()
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {profile?.name}</h1>
          <p className="text-gray-400 capitalize">{profile?.role}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/planner')}
            className="border border-gray-700 rounded-lg px-4 py-2 text-sm"
          >
            Planner & Attendance
          </button>
          <button
            onClick={() => navigate('/messages')}
            className="border border-gray-700 rounded-lg px-4 py-2 text-sm"
          >
            Chat / Files / Alerts
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="border border-gray-700 rounded-lg px-4 py-2 text-sm"
          >
            Settings
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="border border-gray-700 rounded-lg px-4 py-2 text-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      {isStudent && (
        <div className="mb-6">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-[#00E5FF] text-black font-medium rounded-lg px-4 py-2 text-sm"
            >
              + Add Subject
            </button>
          ) : (
            <form onSubmit={handleAddSubject} className="flex gap-2 max-w-md">
              <input
                type="text"
                placeholder="Subject name"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                autoFocus
                className="flex-1 bg-transparent border border-gray-700 rounded-lg px-4 py-2 text-[#FAFAFA] placeholder-gray-500 focus:outline-none focus:border-[#00E5FF]"
              />
              <button type="submit" className="bg-[#00E5FF] text-black font-medium rounded-lg px-4 py-2">
                Add
              </button>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : subjects.length === 0 ? (
        <p className="text-gray-500">No subjects yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/subject/${s.id}`)}
              className="bg-[var(--card)] rounded-lg p-5 cursor-pointer hover:bg-[#1a1a1a] transition"
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium">{s.name}</h3>
                <span className="text-[#00E5FF] text-sm font-medium">{s.percent}%</span>
              </div>
              <SubjectBarChart lecturePercent={s.lecture} hwPercent={s.hw} dppPercent={s.dpp} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}