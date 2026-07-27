import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  DAYS, getPlans, createPlan, togglePlan, deletePlan,
  getAttendance, upsertAttendance,
} from '../lib/data'
import { Plan, Attendance, AttendanceStatus } from '../types'

function pad(n: number) { return n.toString().padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function todayStr() { return toDateStr(new Date()) }

export default function Planner() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const isStudent = profile?.role === 'student'
  const isGuardian = profile?.role === 'guardian'

  const [plans, setPlans] = useState<Plan[]>([])
  const [newPlanText, setNewPlanText] = useState('')
  const [newPlanDay, setNewPlanDay] = useState(new Date().getDay())

  const [viewMonth, setViewMonth] = useState(new Date())
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [editingDate, setEditingDate] = useState<string | null>(null)

  async function loadPlans() {
    if (!profile?.group_id) return
    setPlans(await getPlans(profile.group_id))
  }

  async function loadAttendance() {
    if (!profile?.group_id) return
    const start = toDateStr(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1))
    const end = toDateStr(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0))
    setAttendance(await getAttendance(profile.group_id, start, end))
  }

  useEffect(() => { loadPlans() }, [profile?.group_id])
  useEffect(() => { loadAttendance() }, [profile?.group_id, viewMonth])

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.group_id || !user || !newPlanText.trim()) return
    await createPlan(profile.group_id, newPlanDay, newPlanText.trim(), user.id)
    setNewPlanText('')
    await loadPlans()
  }

  async function handleToggle(plan: Plan) {
    await togglePlan(plan.id, !plan.done)
    await loadPlans()
  }

  async function handleDelete(planId: string) {
    await deletePlan(planId)
    await loadPlans()
  }

  async function handleMarkAttendance(date: string, status: AttendanceStatus, note: string) {
    if (!profile?.group_id || !user) return
    await upsertAttendance(profile.group_id, date, status, note || null, user.id)
    setEditingDate(null)
    await loadAttendance()
  }

  function canMarkDate(date: string) {
    if (isGuardian) return true
    if (isStudent) return date === todayStr()
    return false
  }

  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const lastDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
  const startWeekday = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const calendarCells: (string | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateStr(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1))),
  ]

  const statusColor = (status?: AttendanceStatus) => {
    if (status === 'present') return 'bg-[#00E5FF] text-black'
    if (status === 'absent') return 'bg-red-500/80 text-black'
    if (status === 'partial') return 'bg-yellow-500/80 text-black'
    return 'bg-[var(--card)] text-gray-400'
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-8">
      <button onClick={() => navigate('/dashboard')} className="text-gray-400 mb-4 text-sm">← Back to Dashboard</button>
      <h1 className="text-2xl font-semibold mb-6">Planner & Attendance</h1>

      {/* Weekly Planner */}
      <h2 className="text-lg font-medium mb-3">Weekly Planner</h2>
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-3 mb-4">
        {DAYS.map((day, idx) => (
          <div key={day} className="bg-[var(--card)] rounded-lg p-3 min-h-[120px]">
            <p className="text-sm font-medium mb-2">{day.slice(0, 3)}</p>
            <div className="space-y-2">
              {plans.filter((p) => p.day_of_week === idx).map((plan) => (
                <div key={plan.id} className="text-xs bg-[#0B0B0B] rounded p-2 flex items-start gap-1">
                  <input
                    type="checkbox"
                    checked={plan.done}
                    onChange={() => handleToggle(plan)}
                    className="mt-0.5 accent-[#00E5FF]"
                  />
                  <span className={plan.done ? 'line-through text-gray-500 flex-1' : 'flex-1'}>{plan.text}</span>
                  <button onClick={() => handleDelete(plan.id)} className="text-gray-600 hover:text-red-400">×</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAddPlan} className="flex gap-2 mb-10 max-w-lg">
        <select
          value={newPlanDay}
          onChange={(e) => setNewPlanDay(Number(e.target.value))}
          className="bg-[var(--card)] border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          {DAYS.map((day, idx) => <option key={day} value={idx}>{day}</option>)}
        </select>
        <input
          type="text"
          placeholder="Add a plan item..."
          value={newPlanText}
          onChange={(e) => setNewPlanText(e.target.value)}
          className="flex-1 bg-transparent border border-gray-700 rounded-lg px-4 py-2 text-[#FAFAFA] placeholder-gray-500 focus:outline-none focus:border-[#00E5FF]"
        />
        <button type="submit" className="bg-[#00E5FF] text-black font-medium rounded-lg px-4 py-2 text-sm">Add</button>
      </form>

      {/* Attendance Calendar */}
      <h2 className="text-lg font-medium mb-3">Attendance</h2>
      <div className="flex items-center gap-4 mb-3">
        <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="text-gray-400">←</button>
        <span className="text-sm">{viewMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="text-gray-400">→</button>
      </div>

      <div className="grid grid-cols-7 gap-2 max-w-xl mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 max-w-xl">
        {calendarCells.map((date, idx) => {
          if (!date) return <div key={idx} />
          const record = attendance.find((a) => a.date === date)
          const editable = canMarkDate(date)
          return (
            <button
              key={date}
              disabled={!editable}
              onClick={() => setEditingDate(date)}
              className={`aspect-square rounded-lg text-xs flex items-center justify-center ${statusColor(record?.status)} ${editable ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
            >
              {Number(date.split('-')[2])}
            </button>
          )
        })}
      </div>

      {editingDate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setEditingDate(null)}>
          <div className=" rounded-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium mb-4">Mark attendance — {editingDate}</h3>
            <div className="flex gap-2 mb-4">
              {(['present', 'absent', 'partial'] as AttendanceStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleMarkAttendance(editingDate, status, '')}
                  className={`flex-1 py-2 rounded-lg text-sm capitalize border ${statusColor(status)} border-transparent`}
                >
                  {status}
                </button>
              ))}
            </div>
            <button onClick={() => setEditingDate(null)} className="text-gray-400 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}