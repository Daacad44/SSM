import { openDB } from 'idb'

const DB_NAME = 'ssm-local'
const STORE = 'pending'

export interface PendingChange {
  id?: string
  type: 'semester' | 'course' | 'activity' | 'alarm'
  data: Record<string, unknown>
  createdAt?: number
}

export async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

export async function savePendingChange(change: PendingChange) {
  const db = await getDb()
  await db.add(STORE, { ...change, createdAt: Date.now() })
}

export async function readPendingChanges(): Promise<PendingChange[]> {
  const db = await getDb()
  return db.getAll(STORE)
}

export async function clearPendingChanges() {
  const db = await getDb()
  await db.clear(STORE)
}
