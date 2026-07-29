import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { calcSubjectPercent, calcTaskTypePoints, createSubject, getChaptersWithTasks, getSubjects } from '../lib/data'
import { Chapter, Subject, Task } from '../types'
import AppShell, { Icon } from '../components/AppShell'
import ProgressRing from '../components/ProgressRing'

type ChapterWithTasks = Chapter & { tasks: Task[] }
type SubjectWithStats = Subject & { percent: number; lecture: number; hw: number; dpp: number }

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [error, setError] = useState('')
  const isStudent = profile?.role === 'student'

  async function load() {
    if (!profile?.group_id) return
    setLoading(true)
    setError('')
    try {
      const rawSubjects = await getSubjects(profile.group_id)
      const nextSubjects = await Promise.all(rawSubjects.map(async (subject) => {
        const chapters: ChapterWithTasks[] = await getChaptersWithTasks(subject.id)
        const lecture = calcTaskTypePoints(chapters, 'lecture')
        const hw = calcTaskTypePoints(chapters, 'hw')
        const dpp = calcTaskTypePoints(chapters, 'dpp')
        return {
          ...subject,
          percent: calcSubjectPercent(chapters),
          lecture: lecture.max ? (lecture.earned / lecture.max) * 100 : 0,
          hw: hw.max ? (hw.earned / hw.max) * 100 : 0,
          dpp: dpp.max ? (dpp.earned / dpp.max) * 100 : 0,
        }
      }))
      setSubjects(nextSubjects)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your subjects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [profile?.group_id])

  async function handleAddSubject(event: React.FormEvent) {
    event.preventDefault()
    if (!profile?.group_id || !newSubjectName.trim()) return
    setError('')
    try {
      await createSubject(profile.group_id, newSubjectName.trim(), '#655fbd')
      setNewSubjectName('')
      setShowAddForm(false)
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'The subject could not be created.')
    }
  }

  const average = subjects.length ? subjects.reduce((sum, subject) => sum + subject.percent, 0) / subjects.length : 0

  return <AppShell title={`Good to see you, ${profile?.name?.split(' ')[0] || 'there'}.`} eyebrow="Learning cockpit" action={isStudent ? <button className="btn btn-primary" onClick={() => setShowAddForm((visible) => !visible)}><Icon name="plus" size={15} /> Add subject</button> : undefined}>
    {showAddForm && <form onSubmit={(event) => void handleAddSubject(event)} className="form-row surface panel"><input autoFocus className="field" placeholder="Name your new subject" value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} /><button className="btn btn-primary" type="submit">Create</button></form>}
    {error && <p className="error">{error}</p>}
    <div className="dashboard-grid"><section className="surface panel"><div className="subject-top"><div><h2 className="surface-title">Your subjects</h2><p className="muted tiny">Open a space to pick up where you left off.</p></div><span className="pill">{subjects.length} active</span></div>
      {loading ? <p className="empty">Building your overview…</p> : subjects.length === 0 ? <p className="empty">Create your first subject to start your atlas.</p> : <div className="subject-grid">{subjects.map((subject) => <article key={subject.id} className="surface subject-card" onClick={() => navigate(`/subject/${subject.id}`)}><div className="subject-top"><span className="subject-name">{subject.name}</span><span className="subject-percent">{Math.round(subject.percent)}%</span></div><div className="stat-row">{[{ label: 'Lec', value: subject.lecture }, { label: 'HW', value: subject.hw }, { label: 'DPP', value: subject.dpp }].map((item) => <div className="stat-item" key={item.label}><span>{item.label}</span><div className="stat-bar"><i style={{ width: `${item.value}%` }} /></div></div>)}</div></article>)}</div>}</section>
      <aside className="surface panel focus-card"><ProgressRing value={average} label="overall pace" /><p>{subjects.length ? 'Keep the rhythm going.' : 'Your next milestone awaits.'}</p><small>{subjects.length ? `${Math.round(average)}% of your learning map is complete` : 'A calm place for focused progress'}</small></aside>
    </div>
  </AppShell>
}
