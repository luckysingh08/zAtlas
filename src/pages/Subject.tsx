import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { calcSubjectPercent, calcTaskTypePoints, createChapter, deleteChapter, deleteSubject, getChaptersWithTasks, getGroupMembers, progressForStudent, setStudentTaskProgress, taskTypesForChapters, updateChapter, updateSubject } from '../lib/data'
import { supabase } from '../supabaseClient'
import { Chapter, GroupMember, Task, TaskType } from '../types'
import AppShell, { Icon } from '../components/AppShell'
import ProgressRing from '../components/ProgressRing'

type ChapterWithTasks = Chapter & { tasks: Task[] }
const labelFor = (type: TaskType) => type === 'lecture' ? 'Lecture' : type.toUpperCase()

export default function Subject() {
  const { subjectId } = useParams()
  const [params] = useSearchParams()
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [subjectName, setSubjectName] = useState('')
  const [chapters, setChapters] = useState<ChapterWithTasks[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [newChapterName, setNewChapterName] = useState('')
  const [editing, setEditing] = useState<{ kind: 'subject' | 'chapter'; id?: string; value: string } | null>(null)
  const [error, setError] = useState('')
  const guardian = profile?.role === 'guardian'
  const requestedStudentId = params.get('student')
  const viewerId = guardian ? requestedStudentId || members.find((member) => member.role === 'student')?.id || '' : user?.id || ''
  const viewedStudent = members.find((member) => member.id === viewerId)
  const learnerChapters = viewerId ? progressForStudent(chapters, viewerId) : chapters

  async function load() {
    if (!subjectId) return
    setLoading(true)
    setError('')
    try {
      const { data, error: subjectError } = await supabase.from('subjects').select('name').eq('id', subjectId).maybeSingle()
      if (subjectError) throw subjectError
      if (!data) throw new Error('This subject is not available in your shared group.')
      const [nextChapters, nextMembers] = await Promise.all([
        getChaptersWithTasks(subjectId),
        profile?.group_id ? getGroupMembers(profile.group_id) : Promise.resolve([]),
      ])
      setSubjectName(data.name)
      setChapters(nextChapters)
      setMembers(nextMembers)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this subject.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [subjectId, profile?.group_id])

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!subjectId || !newChapterName.trim()) return
    setError('')
    try { await createChapter(subjectId, newChapterName.trim(), chapters.length); setNewChapterName(''); await load() } catch (createError) { setError(createError instanceof Error ? createError.message : 'The chapter could not be added.') }
  }

  async function toggle(chapter: ChapterWithTasks, type: TaskType, task: Task) {
    if (guardian || !user) return
    setError('')
    try { await setStudentTaskProgress(chapter, type, !task.done, user.id); await load() } catch (toggleError) { setError(toggleError instanceof Error ? toggleError.message : 'This task could not be updated.') }
  }

  async function saveEdit() {
    if (!editing?.value.trim()) return
    setError('')
    try {
      if (editing.kind === 'subject' && subjectId) await updateSubject(subjectId, editing.value.trim())
      if (editing.kind === 'chapter' && editing.id) await updateChapter(editing.id, editing.value.trim())
      setEditing(null)
      await load()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Your change could not be saved.') }
  }

  async function removeChapter(chapter: Chapter) {
    if (!window.confirm(`Remove “${chapter.name}” and its learning tasks?`)) return
    try { await deleteChapter(chapter.id); await load() } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'The chapter could not be deleted.') }
  }

  async function removeSubject() {
    if (!subjectId || !window.confirm(`Remove “${subjectName}” and all of its chapters?`)) return
    try { await deleteSubject(subjectId); navigate('/dashboard') } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'The subject could not be deleted.') }
  }

  const overall = calcSubjectPercent(learnerChapters)
  const lecture = calcTaskTypePoints(learnerChapters, 'lecture')
  const hw = calcTaskTypePoints(learnerChapters, 'hw')
  const dpp = calcTaskTypePoints(learnerChapters, 'dpp')
  const stats = { lecture: lecture.max ? (lecture.earned / lecture.max) * 100 : 0, hw: hw.max ? (hw.earned / hw.max) * 100 : 0, dpp: dpp.max ? (dpp.earned / dpp.max) * 100 : 0 }
  const taskTypes = taskTypesForChapters(chapters)

  return <AppShell title={loading ? 'Your subject' : subjectName || 'Subject'} eyebrow={guardian && viewedStudent ? `${viewedStudent.name}'s learning map` : 'Learning map'} variant="subject" action={<div className="page-action"><button className="btn" onClick={() => setEditing({ kind: 'subject', value: subjectName })}>Rename</button><button className="btn btn-danger" onClick={() => void removeSubject()}>Delete</button></div>}>
    {error && <p className="error">{error}</p>}
    {guardian && <p className="viewer-note">Viewing {viewedStudent?.name || 'a learner'}’s private progress. You can still organise subjects and chapters for the group.</p>}
    <div className="subject-layout"><aside className="surface panel subject-hero"><ProgressRing value={overall} label="complete" /><h2>{Math.round(overall)}% mapped</h2><p className="muted tiny">Every small check-in brings the bigger picture into focus.</p></aside><section className="surface panel"><div className="subject-top"><div><h2 className="surface-title">Chapters</h2><p className="muted tiny">Learners mark their own work; group members can keep the map organised.</p></div><span className="pill">{chapters.length} chapters</span></div><form className="form-row" onSubmit={(event) => void add(event)}><input className="field" placeholder="Add a chapter" value={newChapterName} onChange={(event) => setNewChapterName(event.target.value)} /><button className="btn btn-primary" type="submit"><Icon name="plus" size={15} /> Add</button></form><div className="chapter-list" style={{ marginTop: 18 }}>{learnerChapters.map((chapter) => <article className="surface chapter-card chapter-card-rich" key={chapter.id}><div className="chapter-title"><h3>{chapter.name}</h3><div><button className="text-button" onClick={() => setEditing({ kind: 'chapter', id: chapter.id, value: chapter.name })}>Edit</button><button className="text-button danger-link" onClick={() => void removeChapter(chapter)}>Remove</button></div></div><div className="task-toggles">{taskTypes.map((type) => { const task = chapter.tasks.find((candidate) => candidate.type === type); return task ? <button key={type} disabled={guardian} onClick={() => void toggle(chapters.find((item) => item.id === chapter.id)!, type, task)} className={`task-toggle ${task.done ? 'done' : ''}`}>{labelFor(type)}</button> : null })}</div><div className="chapter-meter"><i style={{ width: `${calcSubjectPercent([chapter])}%` }} /></div></article>)}{!loading && !chapters.length && <p className="empty">Start by adding the first chapter.</p>}</div></section></div>
    <section className="surface panel" style={{ marginTop: 22 }}><h2 className="surface-title">Completion signals</h2><div className="subject-grid">{Object.entries(stats).map(([name, value]) => <div className="surface panel" key={name}><span className="eyebrow">{name}</span><strong>{Math.round(value)}%</strong><div className="stat-bar" style={{ marginTop: 10 }}><i style={{ width: `${value}%` }} /></div></div>)}</div></section>
    {editing && <div className="modal-backdrop" onClick={() => setEditing(null)}><div className="modal" onClick={(event) => event.stopPropagation()}><h3>Rename {editing.kind}</h3><input autoFocus className="field" value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} /><div className="modal-actions" style={{ marginTop: 16 }}><button className="btn" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={() => void saveEdit()}>Save</button></div></div></div>}
  </AppShell>
}
