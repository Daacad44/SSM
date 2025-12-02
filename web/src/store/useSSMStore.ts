import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Activity, Alarm, Course, LessonFile, Semester, Subject } from '../types'
import { persist } from 'zustand/middleware'
import { savePendingChange } from '../services/localCache'
import { syncChanges } from '../services/sync'

interface SSMState {
  semesters: Semester[]
  courses: Course[]
  activities: Activity[]
  alarms: Alarm[]
  subjects: Subject[]
  lessonFiles: LessonFile[]
  addSemester: (payload: Omit<Semester, 'id'>) => void
  addCourse: (payload: Omit<Course, 'id'>) => void
  addActivity: (payload: Omit<Activity, 'id'>) => void
  addAlarm: (payload: Omit<Alarm, 'id'>) => void
  addSubject: (payload: Omit<Subject, 'id'>) => void
  setLessonFiles: (payload: LessonFile[]) => void
  removeLessonFile: (path: string) => void
  markActivity: (id: string, status: Activity['status']) => void
  syncNow: () => Promise<void>
}

const seedSemester: Semester = {
  id: uuid(),
  title: 'Fall',
  year: new Date().getFullYear(),
  start_date: new Date().toISOString().substring(0, 10),
  end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().substring(0, 10),
  status: 'current'
}

export const useSSMStore = create<SSMState>()(
  persist(
    (set, get) => ({
      semesters: [seedSemester],
      courses: [],
      activities: [],
      alarms: [],
      subjects: [],
      lessonFiles: [],
      addSemester: (payload) => {
        const semester = { ...payload, id: uuid() }
        set((state) => ({ semesters: [...state.semesters, semester] }))
        savePendingChange({ type: 'semester', data: semester })
      },
      addCourse: (payload) => {
        const course = { ...payload, id: uuid() }
        set((state) => ({ courses: [...state.courses, course] }))
        savePendingChange({ type: 'course', data: course })
      },
      addActivity: (payload) => {
        const activity = { ...payload, id: uuid() }
        set((state) => ({ activities: [...state.activities, activity] }))
        savePendingChange({ type: 'activity', data: activity })
      },
      addAlarm: (payload) => {
        const alarm = { ...payload, id: uuid() }
        set((state) => ({ alarms: [...state.alarms, alarm] }))
        savePendingChange({ type: 'alarm', data: alarm })
      },
      addSubject: (payload) => {
        const subject = { ...payload, id: uuid() }
        set((state) => ({ subjects: [...state.subjects, subject] }))
      },
      setLessonFiles: (payload) => set(() => ({ lessonFiles: payload })),
      removeLessonFile: (path: string) =>
        set((state) => ({ lessonFiles: state.lessonFiles.filter((f) => f.path !== path) })),
      markActivity: (id, status) =>
        set((state) => ({
          activities: state.activities.map((a) => (a.id === id ? { ...a, status } : a))
        })),
      syncNow: async () => {
        await syncChanges({
          semesters: get().semesters,
          courses: get().courses,
          activities: get().activities,
          alarms: get().alarms
        })
      }
    }),
    {
      name: 'ssm-store'
    }
  )
)
