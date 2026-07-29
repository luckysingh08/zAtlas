import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { calcSubjectPercent, calcTaskTypePoints, createChapter, getChaptersWithTasks, toggleTask } from '../lib/data'
import { supabase } from '../supabaseClient'
import { Chapter, Task, TaskType } from '../types'
import AppShell, { Icon } from '../components/AppShell'
import ProgressRing from '../components/ProgressRing'

type ChapterWithTasks = Chapter & { tasks: Task[] }

export default function Subject() {
  const { subjectId } = useParams()
  const { profile, user } = useAuth()
  const [subjectName, setSubjectName] = useState('')
  const [chapters, setChapters] = useState<ChapterWithTasks[]>([])
  const [loading, setLoading] = useState(true)
  const [newChapterName, setNewChapterName] = useState('')
  const [error, setError] = useState('')
  const isStudent = profile?.role === 'student'

  async function load() {
    if (!subjectId) return
    setLoading(true)
    setError('')
    try {
      const { data, error: subjectError } = await supabase.from('subjects').select('name').eq('id', subjectId).maybeSingle()
      if (subjectError) throw subjectError
      if (!data) throw new Error('This subject is not available in your family group.')
      setSubjectName(data.name)
      setChapters(await getChaptersWithTasks(subjectId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this subject.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [subjectId])

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!subjectId || !newChapterName.trim()) return
    setError('')
    try { await createChapter(subjectId, newChapterName.trim(), chapters.length); setNewChapterName(''); await load() } catch (createError) { setError(createError instanceof Error ? createError.message : 'The chapter could not be added.') }
  }

  async function toggle(task: Task) {
    if (!isStudent || !user) return
    setError('')
    try { await toggleTask(task.id, !task.done, user.id); await load() } catch (toggleError) { setError(toggleError instanceof Error ? toggleError.message : 'This task could not be updated.') }
  }

  const overall = calcSubjectPercent(chapters)
  const lecture = calcTaskTypePoints(chapters, 'lecture')
  const hw = calcTaskTypePoints(chapters, 'hw')
  const dpp = calcTaskTypePoints(chapters, 'dpp')
  const stats = { lecture: lecture.max ? (lecture.earned / lecture.max) * 100 : 0, hw: hw.max ? (hw.earned / hw.max) * 100 : 0, dpp: dpp.max ? (dpp.earned / dpp.max) * 100 : 0 }

  return <AppShell title={loading ? 'Your subject' : subjectName || 'Subject'} eyebrow="Learning map" variant="subject" action={<span className="pill"><Icon name="spark" size={13} /> Intentional progress</span>}>
    {error && <p className="error">{error}</p>}
    <div className="subject-layout"><aside className="surface panel subject-hero"><ProgressRing value={overall} label="complete" /><h2>{Math.round(overall)}% mapped</h2><p className="muted tiny">Every small check-in brings the bigger picture into focus.</p></aside><section className="surface panel"><div className="subject-top"><div><h2 className="surface-title">Chapters</h2><p className="muted tiny">Mark each learning touchpoint as you finish it.</p></div><span className="pill">{chapters.length} chapters</span></div>{isStudent && <form className="form-row" onSubmit={(event) => void add(event)}><input className="field" placeholder="Add a chapter" value={newChapterName} onChange={(event) => setNewChapterName(event.target.value)} /><button className="btn btn-primary" type="submit"><Icon name="plus" size={15} /> Add</button></form>}<div className="chapter-list" style={{ marginTop: 18 }}>{chapters.map((chapter) => <article className="surface chapter-card" key={chapter.id}><h3>{chapter.name}</h3><div className="task-toggles">{(['lecture', 'hw', 'dpp'] as TaskType[]).map((type) => { const task = chapter.tasks.find((candidate) => candidate.type === type); return task ? <button key={type} disabled={!isStudent} onClick={() => void toggle(task)} className={`task-toggle ${task.done ? 'done' : ''}`}>{type === 'lecture' ? 'Lecture' : type.toUpperCase()}</button> : null })}</div></article>)}{!loading && !chapters.length && <p className="empty">Start by adding the first chapter.</p>}</div></section></div>
    <section className="surface panel" style={{ marginTop: 22 }}><h2 className="surface-title">Completion signals</h2><div className="subject-grid">{Object.entries(stats).map(([name, value]) => <div className="surface panel" key={name}><span className="eyebrow">{name}</span><strong>{Math.round(value)}%</strong><div className="stat-bar" style={{ marginTop: 10 }}><i style={{ width: `${value}%` }} /></div></div>)}</div></section>
  </AppShell>
}
