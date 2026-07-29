import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { createCalendarEventText, createPlan, DAYS, deletePlan, getAttendance, getPlans, parseCalendarEvent, togglePlan, upsertAttendance } from '../lib/data'
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
  const [eventTitle, setEventTitle] = useState('')
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

  const events = useMemo(() => plans.map(parseCalendarEvent).filter((event): event is NonNullable<typeof event> => Boolean(event)), [plans])
  const weeklyPlans = useMemo(() => plans.filter((plan) => !parseCalendarEvent(plan)), [plans])

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
    try {
      await upsertAttendance(profile.group_id, editing, status, null, user.id)
      setAttendance((items) => {
        const existing = items.find((item) => item.date === editing)
        const next: Attendance = existing ? { ...existing, status, marked_by: user.id } : { id: `local-${editing}`, group_id: profile.group_id!, date: editing, status, note: null, marked_by: user.id }
        return existing ? items.map((item) => item.date === editing ? next : item) : [...items, next]
      })
      setEditing(null)
    } catch (attendanceError) { setError(attendanceError instanceof Error ? attendanceError.message : 'Attendance could not be saved.') }
  }

  async function addEvent() {
    if (!editing || !profile?.group_id || !user || !eventTitle.trim()) return
    setError('')
    try {
      await createPlan(profile.group_id, new Date(`${editing}T12:00:00`).getDay(), createCalendarEventText(editing, eventTitle), user.id)
      setEventTitle('')
      await loadPlans()
    } catch (eventError) { setError(eventError instanceof Error ? eventError.message : 'The calendar event could not be added.') }
  }

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: last.getDate() }, (_, index) => dateString(new Date(month.getFullYear(), month.getMonth(), index + 1)))]
  const canEditAttendance = (date: string) => guardian || (student && date === today())
  const selectedEvents = events.filter((event) => event.date === editing)

  return <AppShell title="Make room for what matters." eyebrow="Weekly flow" variant="planner" action={<span className="pill"><Icon name="spark" size={13} /> Shared rhythm</span>}>
    {error && <p className="error">{error}</p>}
    <div className="planner-grid"><section className="surface panel"><h2 className="surface-title">This week</h2><div className="week-grid">{DAYS.map((name, index) => <div className="day-column" key={name}><h3>{name.slice(0, 3)}</h3>{weeklyPlans.filter((plan) => plan.day_of_week === index).map((plan) => <div className="plan-chip" key={plan.id}><input type="checkbox" checked={plan.done} onChange={() => void updatePlan(plan, 'toggle')} /><span className={plan.done ? 'done' : ''}>{plan.text}</span><button aria-label={`Delete ${plan.text}`} onClick={() => void updatePlan(plan, 'delete')}>×</button></div>)}</div>)}</div><form onSubmit={(event) => void add(event)} className="form-row"><select className="field select" value={day} onChange={(event) => setDay(Number(event.target.value))}>{DAYS.map((name, index) => <option key={name} value={index}>{name}</option>)}</select><input className="field" placeholder="A small commitment for this week" value={text} onChange={(event) => setText(event.target.value)} /><button className="btn btn-primary" type="submit"><Icon name="plus" size={15} /> Add</button></form></section>
      <section className="surface panel"><div className="calendar-head"><button className="btn icon-button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><h3>{month.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3><button className="btn icon-button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div><div className="calendar-grid">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => <span key={index} className="calendar-weekday">{label}</span>)}{cells.map((date, index) => { if (!date) return <span key={index} />; const record = attendance.find((item) => item.date === date); const count = events.filter((event) => event.date === date).length; return <button onClick={() => { setEditing(date); setEventTitle('') }} key={date} className={`calendar-day ${record?.status || ''} ${date === today() ? 'today' : ''}`}><span>{Number(date.slice(-2))}</span>{count > 0 && <i className="event-dot" title={`${count} event${count > 1 ? 's' : ''}`} />}</button> })}</div><p className="calendar-note">Tap any day to add an event. Attendance remains role-protected.</p></section>
    </div>
    {editing && <div className="modal-backdrop" onClick={() => setEditing(null)}><div className="modal calendar-modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{editing}</p><h3>Plan this day</h3></div><button className="text-button" onClick={() => setEditing(null)}>Close</button></div>{canEditAttendance(editing) && <><p className="muted tiny">Attendance</p><div className="modal-actions">{(['present', 'partial', 'absent'] as AttendanceStatus[]).map((status) => <button key={status} className={`btn attendance-action ${status}`} onClick={() => void mark(status)}>{status}</button>)}</div></>}<div className="event-editor"><p className="muted tiny">Calendar event</p><div className="form-row"><input className="field" placeholder="Test, revision, appointment…" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} /><button className="btn btn-primary" type="button" onClick={() => void addEvent()}>Add event</button></div></div>{selectedEvents.length > 0 && <div className="event-list">{selectedEvents.map((event) => <div className="event-row" key={event.id}><span><i className="event-dot" />{event.title}</span><button className="text-button" onClick={() => void updatePlan(plans.find((plan) => plan.id === event.id)!, 'delete')}>Remove</button></div>)}</div>}</div></div>}
  </AppShell>
}
