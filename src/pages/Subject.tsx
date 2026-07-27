import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getChaptersWithTasks, createChapter, toggleTask, calcSubjectPercent, calcTaskTypePoints } from '../lib/data'
import { Chapter, Task, TaskType } from '../types'
import SubjectBarChart from '../components/SubjectBarChart'
import { supabase } from '../supabaseClient'

type ChapterWithTasks = Chapter & { tasks: Task[] }

export default function Subject() {
  const { subjectId } = useParams()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [subjectName, setSubjectName] = useState('')
  const [chapters, setChapters] = useState<ChapterWithTasks[]>([])
  const [loading, setLoading] = useState(true)
  const [newChapterName, setNewChapterName] = useState('')

  const isStudent = profile?.role === 'student'

  async function load() {
    if (!subjectId) return
    const { data: subj } = await supabase.from('subjects').select('name').eq('id', subjectId).single()
    if (subj) setSubjectName(subj.name)
    const data = await getChaptersWithTasks(subjectId)
    setChapters(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [subjectId])

  async function handleAddChapter(e: React.FormEvent) {
    e.preventDefault()
    if (!subjectId || !newChapterName.trim()) return
    await createChapter(subjectId, newChapterName.trim(), chapters.length)
    setNewChapterName('')
    await load()
  }

  async function handleToggle(task: Task) {
    if (!isStudent || !user) return
    await toggleTask(task.id, !task.done, user.id)
    await load()
  }

  if (loading) return <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-8">Loading...</div>

  const lecture = calcTaskTypePoints(chapters, 'lecture')
  const hw = calcTaskTypePoints(chapters, 'hw')
  const dpp = calcTaskTypePoints(chapters, 'dpp')
  const overallPercent = calcSubjectPercent(chapters)

  const typePill = (type: TaskType) => {
    switch (type) {
      case 'lecture': return 'Lecture'
      case 'hw': return 'HW'
      case 'dpp': return 'DPP'
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-8">
      <button onClick={() => navigate('/dashboard')} className="text-gray-400 mb-4 text-sm">← Back to Dashboard</button>
      <h1 className="text-3xl font-semibold mb-1">{subjectName}</h1>
      <p className="text-gray-400 mb-6">{overallPercent}% complete</p>

      <div className="bg-[var(--card)] rounded-lg p-6 mb-8 max-w-md">
        <SubjectBarChart
          size="large"
          lecturePercent={lecture.max ? (lecture.earned / lecture.max) * 100 : 0}
          hwPercent={hw.max ? (hw.earned / hw.max) * 100 : 0}
          dppPercent={dpp.max ? (dpp.earned / dpp.max) * 100 : 0}
        />
      </div>

      {isStudent && (
        <form onSubmit={handleAddChapter} className="flex gap-2 mb-6 max-w-md">
          <input
            type="text"
            placeholder="New chapter name"
            value={newChapterName}
            onChange={(e) => setNewChapterName(e.target.value)}
            className="flex-1 bg-transparent border border-gray-700 rounded-lg px-4 py-2 text-[#FAFAFA] placeholder-gray-500 focus:outline-none focus:border-[#00E5FF]"
          />
          <button type="submit" className="bg-[#00E5FF] text-black font-medium rounded-lg px-4 py-2">
            Add
          </button>
        </form>
      )}

      <div className="space-y-3 max-w-md">
        {chapters.map((ch) => (
          <div key={ch.id} className="bg-[var(--card)] rounded-lg p-4">
            <p className="font-medium mb-3">{ch.name}</p>
            <div className="flex gap-2">
              {(['lecture', 'hw', 'dpp'] as TaskType[]).map((type) => {
                const task = ch.tasks.find((t) => t.type === type)
                if (!task) return null
                return (
                  <button
                    key={type}
                    onClick={() => handleToggle(task)}
                    disabled={!isStudent}
                    className={`px-3 py-1.5 rounded-full text-xs border ${
                      task.done
                        ? 'bg-[#00E5FF] text-black border-[#00E5FF]'
                        : 'border-gray-700 text-gray-400'
                    } ${!isStudent ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {typePill(type)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {chapters.length === 0 && (
          <p className="text-gray-500 text-sm">No chapters yet.</p>
        )}
      </div>
    </div>
  )
}