import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { createPlan, DAYS, deletePlan, getAttendance, getPlans, togglePlan, upsertAttendance } from '../lib/data'
import { Attendance, AttendanceStatus, Plan } from '../types'
import AppShell, { Icon } from '../components/AppShell'

const pad = (value: number) => value.toString().padStart(2, '0')
const dateString = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const today = () => dateString(new Date())

export default function Planner() {
  const { profile, user } = useAuth()
  const student = profile?.role === 'student'
  const guardian = profile?.role === 'guardian'
  const [plans, setPlans] = useState<Plan[]>([])
  const [text, setText] = useState('')
  const [day, setDay] = useState(new Date().getDay())
  const [month, setMonth] = useState(new Date())
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function loadPlans() {
    if (!profile?.group_id) return
    try { setPlans(await getPlans(profile.group_id)) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load the weekly plan.') }
  }

  async function loadAttendance() {
    if (!profile?.group_id) return
    const start = dateString(new Date(month.getFullYear(), month.getMonth(), 1))
    const end = dateString(new Date(month.getFullYear(), month.getMonth() + 1, 0))
    try { setAttendance(await getAttendance(profile.group_id, start, end)) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load attendance.') }
  }

  useEffect(() => { void loadPlans() }, [profile?.group_id])
  useEffect(() => { void loadAttendance() }, [profile?.group_id, month])

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!profile?.group_id || !user || !text.trim()) return
    setError('')
    try { await createPlan(profile.group_id, day, text.trim(), user.id); setText(''); await loadPlans() } catch (createError) { setError(createError instanceof Error ? createError.message : 'The plan item could not be added.') }
  }

  async function updatePlan(plan: Plan, action: 'toggle' | 'delete') {
    setError('')
    try {
      if (action === 'toggle') await togglePlan(plan.id, !plan.done)
      else await deletePlan(plan.id)
      await loadPlans()
    } catch (planError) { setError(planError instanceof Error ? planError.message : 'The plan could not be updated.') }
  }

  async function mark(status: AttendanceStatus) {
    if (!editing || !profile?.group_id || !user) return
    setError('')
    try { await upsertAttendance(profile.group_id, editing, status, null, user.id); setEditing(null); await loadAttendance() } catch (attendanceError) { setError(attendanceError instanceof Error ? attendanceError.message : 'Attendance could not be saved.') }
  }

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: last.getDate() }, (_, index) => dateString(new Date(month.getFullYear(), month.getMonth(), index + 1)))]
  const canEditDate = (date: string) => guardian || (student && date === today())

  return <AppShell title="Make room for what matters." eyebrow="Weekly flow" variant="planner" action={<span className="pill"><Icon name="spark" size={13} /> A little at a time</span>}>
    {error && <p className="error">{error}</p>}
    <div className="planner-grid"><section className="surface panel"><h2 className="surface-title">This week</h2><div className="week-grid">{DAYS.map((name, index) => <div className="day-column" key={name}><h3>{name.slice(0, 3)}</h3>{plans.filter((plan) => plan.day_of_week === index).map((plan) => <div className="plan-chip" key={plan.id}><input type="checkbox" checked={plan.done} onChange={() => void updatePlan(plan, 'toggle')} /><span className={plan.done ? 'done' : ''}>{plan.text}</span><button aria-label={`Delete ${plan.text}`} onClick={() => void updatePlan(plan, 'delete')}>×</button></div>)}</div>)}</div><form onSubmit={(event) => void add(event)} className="form-row"><select className="field select" value={day} onChange={(event) => setDay(Number(event.target.value))}>{DAYS.map((name, index) => <option key={name} value={index}>{name}</option>)}</select><input className="field" placeholder="A small commitment for this week" value={text} onChange={(event) => setText(event.target.value)} /><button className="btn btn-primary" type="submit"><Icon name="plus" size={15} /> Add</button></form></section>
      <section className="surface panel"><div className="calendar-head"><button className="btn icon-button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><h3>{month.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3><button className="btn icon-button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div><div className="calendar-grid">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => <span key={index} className="calendar-weekday">{label}</span>)}{cells.map((date, index) => { if (!date) return <span key={index} />; const record = attendance.find((item) => item.date === date); return <button disabled={!canEditDate(date)} onClick={() => setEditing(date)} key={date} className={`calendar-day ${record?.status || ''}`}>{Number(date.slice(-2))}</button> })}</div></section>
    </div>
    {editing && <div className="modal-backdrop" onClick={() => setEditing(null)}><div className="modal" onClick={(event) => event.stopPropagation()}><h3>Mark {editing}</h3><div className="modal-actions">{(['present', 'partial', 'absent'] as AttendanceStatus[]).map((status) => <button key={status} className={`btn ${status === 'present' ? 'btn-primary' : ''}`} onClick={() => void mark(status)}>{status}</button>)}</div></div></div>}
  </AppShell>
}
