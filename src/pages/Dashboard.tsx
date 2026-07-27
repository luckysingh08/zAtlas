import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getSubjects, getChaptersWithTasks, createSubject, calcSubjectPercent, calcTaskTypePoints } from '../lib/data'
import { Subject, Chapter, Task } from '../types'
import AppShell, { Icon } from '../components/AppShell'
import ProgressRing from '../components/ProgressRing'

type ChapterWithTasks = Chapter & { tasks: Task[] }
type SubjectWithStats = Subject & { percent: number; lecture: number; hw: number; dpp: number }

export default function Dashboard() {
  const { profile } = useAuth(); const navigate = useNavigate()
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([]); const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false); const [newSubjectName, setNewSubjectName] = useState('')
  const isStudent = profile?.role === 'student'
  async function load() { if (!profile?.group_id) return; const subs = await getSubjects(profile.group_id); setSubjects(await Promise.all(subs.map(async s => { const chapters: ChapterWithTasks[] = await getChaptersWithTasks(s.id); const lecture = calcTaskTypePoints(chapters, 'lecture'), hw = calcTaskTypePoints(chapters, 'hw'), dpp = calcTaskTypePoints(chapters, 'dpp'); return { ...s, percent: calcSubjectPercent(chapters), lecture: lecture.max ? lecture.earned / lecture.max * 100 : 0, hw: hw.max ? hw.earned / hw.max * 100 : 0, dpp: dpp.max ? dpp.earned / dpp.max * 100 : 0 } }))); setLoading(false) }
  useEffect(() => { load() }, [profile?.group_id])
  async function handleAddSubject(e: React.FormEvent) { e.preventDefault(); if (!profile?.group_id || !newSubjectName.trim()) return; await createSubject(profile.group_id, newSubjectName.trim(), '#655fbd'); setNewSubjectName(''); setShowAddForm(false); await load() }
  const average = subjects.length ? subjects.reduce((sum, s) => sum + s.percent, 0) / subjects.length : 0
  return <AppShell title={`Good to see you, ${profile?.name?.split(' ')[0] || 'there'}.`} eyebrow="Learning cockpit" action={isStudent ? <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}><Icon name="plus" size={15} /> Add subject</button> : undefined}>
    {showAddForm && <form onSubmit={handleAddSubject} className="form-row surface panel"><input autoFocus className="field" placeholder="Name your new subject" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} /><button className="btn btn-primary" type="submit">Create</button></form>}
    <div className="dashboard-grid"><section className="surface panel"><div className="subject-top"><div><h2 className="surface-title">Your subjects</h2><p className="muted tiny">Open a space to pick up where you left off.</p></div><span className="pill">{subjects.length} active</span></div>
      {loading ? <p className="empty">Building your overview…</p> : subjects.length === 0 ? <p className="empty">Create your first subject to start your atlas.</p> : <div className="subject-grid">{subjects.map(s => <article key={s.id} className="surface subject-card" onClick={() => navigate(`/subject/${s.id}`)}><div className="subject-top"><span className="subject-name">{s.name}</span><span className="subject-percent">{Math.round(s.percent)}%</span></div><div className="stat-row">{[{label:'Lec',value:s.lecture},{label:'HW',value:s.hw},{label:'DPP',value:s.dpp}].map(item => <div className="stat-item" key={item.label}><span>{item.label}</span><div className="stat-bar"><i style={{ width:`${item.value}%` }} /></div></div>)}</div></article>)}</div>}</section>
      <aside className="surface panel focus-card"><ProgressRing value={average} label="overall pace" /><p>{subjects.length ? 'Keep the rhythm going.' : 'Your next milestone awaits.'}</p><small>{subjects.length ? `${Math.round(average)}% of your learning map is complete` : 'A calm place for focused progress'}</small></aside>
    </div>
  </AppShell>
}
