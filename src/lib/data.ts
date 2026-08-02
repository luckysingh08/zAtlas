import { supabase } from '../supabaseClient'
import { Group, GroupMember, Subject, Chapter, Task, ChapterProgress, TaskType } from '../types'

export async function getGroup(groupId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', groupId)
    .single()
  if (error) throw error
  return data as Group
}

export async function getSubjects(groupId: string): Promise<Subject[]> {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('group_id', groupId)
    .order('name')
  if (error) throw error
  return data as Subject[]
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, group_id, name, role, avatar_url')
    .eq('group_id', groupId)
    .order('role')
    .order('name')
  if (error) throw error
  return data as GroupMember[]
}

export async function getChaptersWithTasks(subjectId: string): Promise<ChapterProgress[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('*, tasks(*)')
    .eq('subject_id', subjectId)
    .order('order_index')
  if (error) throw error
  return data as ChapterProgress[]
}

export async function createSubject(groupId: string, name: string, color: string) {
  const { error } = await supabase.from('subjects').insert({ group_id: groupId, name, color })
  if (error) throw error
}

export async function updateSubject(subjectId: string, name: string) {
  const { error } = await supabase.from('subjects').update({ name }).eq('id', subjectId)
  if (error) throw error
}

export async function deleteSubject(subjectId: string) {
  const { data, error } = await supabase.from('subjects').delete().eq('id', subjectId).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This subject could not be deleted. Please try again.')
}

export async function createChapter(subjectId: string, name: string, orderIndex: number) {
  const { data: chapter, error } = await supabase
    .from('chapters')
    .insert({ subject_id: subjectId, name, order_index: orderIndex })
    .select()
    .single()
  if (error) throw error

  // auto-create the 3 tasks per chapter (Lecture, HW, DPP)
  const { error: taskErr } = await supabase.from('tasks').insert([
    { chapter_id: chapter.id, type: 'lecture', points: 5 },
    { chapter_id: chapter.id, type: 'hw', points: 5 },
    { chapter_id: chapter.id, type: 'dpp', points: 5 },
  ])
  if (taskErr) throw taskErr
}

export async function updateChapter(chapterId: string, name: string) {
  const { error } = await supabase.from('chapters').update({ name }).eq('id', chapterId)
  if (error) throw error
}

export async function deleteChapter(chapterId: string) {
  const { data, error } = await supabase.from('chapters').delete().eq('id', chapterId).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This chapter could not be deleted. Please try again.')
}

export async function toggleTask(taskId: string, done: boolean, userId: string) {
  const { error } = await supabase
    .from('tasks')
    .update({
      done,
      // Keep the task owner even when it is unchecked. This allows every student
      // in a shared group to keep an independent progress record.
      completed_by: userId,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', taskId)
  if (error) throw error
}

export function taskTypesForChapters(chapters: ChapterProgress[]): TaskType[] {
  const types = new Set<TaskType>(['lecture', 'hw', 'dpp'])
  chapters.forEach((chapter) => chapter.tasks.forEach((task) => types.add(task.type)))
  return [...types]
}

export function tasksForStudent(chapter: ChapterProgress, studentId: string): Task[] {
  const result: Task[] = []
  taskTypesForChapters([chapter]).forEach((type) => {
    const owned = chapter.tasks.find((task) => task.type === type && task.completed_by === studentId)
    const template = chapter.tasks.find((task) => task.type === type)
    if (owned) result.push(owned)
    else if (template) result.push({ ...template, id: '', done: false, completed_by: studentId, completed_at: null })
  })
  return result
}

export function progressForStudent(chapters: ChapterProgress[], studentId: string): ChapterProgress[] {
  return chapters.map((chapter) => ({ ...chapter, tasks: tasksForStudent(chapter, studentId) }))
}

export async function setStudentTaskProgress(chapter: ChapterProgress, type: TaskType, done: boolean, userId: string) {
  const existing = chapter.tasks.find((task) => task.type === type && task.completed_by === userId)
  if (existing) return toggleTask(existing.id, done, userId)

  const template = chapter.tasks.find((task) => task.type === type)
  if (!template) throw new Error('This learning task is not available.')
  const { error } = await supabase.from('tasks').insert({
    chapter_id: chapter.id,
    type,
    points: template.points,
    done,
    completed_by: userId,
    completed_at: done ? new Date().toISOString() : null,
  })
  if (error) throw error
}

// points earned / (chapters * 15) * 100, per the brief's formula
export function calcSubjectPercent(chapters: (Chapter & { tasks: Task[] })[]): number {
  if (chapters.length === 0) return 0
  const earned = chapters.reduce(
    (sum, ch) => sum + ch.tasks.filter((t) => t.done).reduce((s, t) => s + t.points, 0),
    0
  )
  const max = chapters.length * 15
  return max === 0 ? 0 : Math.round((earned / max) * 100)
}

export function calcTaskTypePoints(chapters: (Chapter & { tasks: Task[] })[], type: 'lecture' | 'hw' | 'dpp') {
  const earned = chapters.reduce((sum, ch) => {
    const t = ch.tasks.find((t) => t.type === type)
    return sum + (t?.done ? t.points : 0)
  }, 0)
  const max = chapters.length * 5
  return { earned, max }
}
import { Plan, Attendance, AttendanceStatus, Message, FileRecord, MessageType } from '../types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export { DAYS }

export async function getPlans(groupId: string): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('group_id', groupId)
    .order('day_of_week')
  if (error) throw error
  return data as Plan[]
}

export async function createPlan(groupId: string, dayOfWeek: number, text: string, userId: string) {
  const { error } = await supabase
    .from('plans')
    .insert({ group_id: groupId, day_of_week: dayOfWeek, text, created_by: userId })
  if (error) throw error
}

export async function togglePlan(planId: string, done: boolean) {
  const { error } = await supabase.from('plans').update({ done }).eq('id', planId)
  if (error) throw error
}

export async function deletePlan(planId: string) {
  const { error } = await supabase.from('plans').delete().eq('id', planId)
  if (error) throw error
}

const calendarEventPrefix = '__zatlas_event__|'

export interface CalendarEvent {
  id: string
  date: string
  title: string
  created_by: string | null
}

export function createCalendarEventText(date: string, title: string) {
  return `${calendarEventPrefix}${date}|${encodeURIComponent(title.trim())}`
}

export function parseCalendarEvent(plan: Plan): CalendarEvent | null {
  if (!plan.text.startsWith(calendarEventPrefix)) return null
  const [, date, encodedTitle] = plan.text.split('|')
  if (!date || !encodedTitle) return null
  try {
    return { id: plan.id, date, title: decodeURIComponent(encodedTitle), created_by: plan.created_by }
  } catch {
    return null
  }
}

export async function getAttendance(groupId: string, monthStart: string, monthEnd: string): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('group_id', groupId)
    .gte('date', monthStart)
    .lte('date', monthEnd)
  if (error) throw error
  return data as Attendance[]
}

export async function upsertAttendance(
  groupId: string,
  date: string,
  status: AttendanceStatus,
  note: string | null,
  userId: string
) {
  const { error } = await supabase
    .from('attendance')
    .upsert(
      { group_id: groupId, date, status, note, marked_by: userId },
      { onConflict: 'group_id,date' }
    )
  if (error) throw error
}
export async function getMessages(groupId: string, type: MessageType): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('group_id', groupId)
    .eq('type', type)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Message[]
}

export async function sendMessage(groupId: string, senderId: string, text: string, type: MessageType): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ group_id: groupId, sender_id: senderId, text, type })
    .select()
    .single()
  if (error) throw error
  return data as Message
}

export async function deleteMessage(messageId: string) {
  const { data, error } = await supabase.from('messages').delete().eq('id', messageId).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('The message was not deleted. Check your group permissions and try again.')
}

export async function getFiles(groupId: string): Promise<FileRecord[]> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('group_id', groupId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return data as FileRecord[]
}

export async function uploadFile(groupId: string, uploaderId: string, file: File): Promise<FileRecord> {
  const path = `${groupId}/${Date.now()}_${file.name}`
  const { error: uploadErr } = await supabase.storage.from('files').upload(path, file)
  if (uploadErr) throw uploadErr

  const { data, error: insertErr } = await supabase
    .from('files')
    .insert({ group_id: groupId, uploader_id: uploaderId, name: file.name, url: path })
    .select()
    .single()
  if (insertErr) {
    await supabase.storage.from('files').remove([path])
    throw insertErr
  }
  return data as FileRecord
}

export async function deleteFile(file: FileRecord) {
  const { data, error } = await supabase.from('files').delete().eq('id', file.id).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('The file was not deleted. Check your group permissions and try again.')
  const { error: storageError } = await supabase.storage.from('files').remove([file.url])
  if (storageError) console.warn('The file record was deleted, but its stored copy could not be removed.', storageError)
}

export async function getFileDownloadUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('files').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
