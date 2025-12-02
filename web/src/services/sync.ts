import { supabase } from '../supabaseClient'
import type { Activity, Alarm, Course, Semester } from '../types'
import { clearPendingChanges, readPendingChanges } from './localCache'

interface SyncPayload {
  semesters: Semester[]
  courses: Course[]
  activities: Activity[]
  alarms: Alarm[]
}

export async function syncChanges(_state: SyncPayload) {
  // naive sync: push pending queue; in production use proper diff + last_updated fields.
  const queued = await readPendingChanges()
  if (!queued.length) return

  try {
    for (const change of queued) {
      switch (change.type) {
        case 'semester':
          await supabase.from('semesters').upsert(change.data)
          break
        case 'course':
          await supabase.from('courses').upsert(change.data)
          break
        case 'activity':
          await supabase.from('activities').upsert(change.data)
          break
        case 'alarm':
          await supabase.from('alarms').upsert(change.data)
          break
        default:
          break
      }
    }
    await clearPendingChanges()
  } catch (err) {
    console.error('Sync failed', err)
    throw err
  }
}

export function groupCounts(state: SyncPayload) {
  const openActivities = state.activities.filter((a) => a.status !== 'done')
  const overdue = openActivities.filter((a) => new Date(a.due_at).getTime() < Date.now())
  return {
    semesters: state.semesters.length,
    courses: state.courses.length,
    openActivities: openActivities.length,
    overdue: overdue.length
  }
}
