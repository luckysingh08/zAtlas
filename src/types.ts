export type Role = 'student' | 'guardian'
export type TaskType = 'lecture' | 'hw' | 'dpp'
export type AttendanceStatus = 'present' | 'absent' | 'partial'
export type MessageType = 'chat' | 'alert'

export interface Profile {
  id: string
  group_id: string | null
  name: string
  role: Role
  avatar_url: string | null
}

export interface GroupMember extends Profile {
  email?: string | null
}

export interface Group {
  id: string
  name: string
  invite_code: string
}

export interface Subject {
  id: string
  group_id: string
  name: string
  color: string | null
}

export interface Chapter {
  id: string
  subject_id: string
  name: string
  order_index: number
}

export interface Task {
  id: string
  chapter_id: string
  type: TaskType
  done: boolean
  points: number
  completed_by: string | null
  completed_at: string | null
}

export type ChapterProgress = Chapter & { tasks: Task[] }

export interface Plan {
  id: string
  group_id: string
  day_of_week: number
  text: string
  done: boolean
  created_by: string | null
}

export interface Attendance {
  id: string
  group_id: string
  date: string
  status: AttendanceStatus
  note: string | null
  marked_by: string | null
}

export interface Message {
  id: string
  group_id: string
  sender_id: string
  text: string
  type: MessageType
  created_at: string
  read_at: string | null
}

export interface FileRecord {
  id: string
  group_id: string
  uploader_id: string
  name: string
  url: string
  uploaded_at: string
}
