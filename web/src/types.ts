export type SemesterStatus = 'current' | 'past' | 'upcoming'

export interface Semester {
  id: string
  user_id?: string
  title: string
  year: number
  start_date: string
  end_date: string
  status: SemesterStatus
}

export interface Course {
  id: string
  semester_id: string
  user_id?: string
  code: string
  title: string
  lecturer?: string
  credits?: number
  color?: string
  schedule?: {
    days: string[]
    start: string
    end: string
  }
}

export type ActivityType =
  | 'assignment'
  | 'quiz'
  | 'exam'
  | 'project'
  | 'lab'
  | 'reading'
  | 'other'

export interface Activity {
  id: string
  course_id: string
  type: ActivityType
  title: string
  description?: string
  due_at: string
  priority: 1 | 2 | 3
  status: 'todo' | 'in_progress' | 'done'
  weight?: number
  attachments?: {
    bucket: string
    path: string
    name: string
  }[]
}

export interface Alarm {
  id: string
  user_id: string
  activity_id?: string
  label: string
  fire_at: string
  lead_minutes: number
  ringtone?: string
  channel: 'browser' | 'email' | 'both'
}

export interface DocumentItem {
  name: string
  path: string
  bucket: string
  mime: string
  size?: number
}

export interface Subject {
  id: string
  name: string
  color?: string
}

export interface LessonFile extends DocumentItem {
  id: string
  subject_id: string
  created_at?: string
}
