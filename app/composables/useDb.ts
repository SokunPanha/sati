import Dexie, { liveQuery, type Table } from 'dexie'
import type { AppNotification, FocusSession, HistoryEvent, Profile, Reminder, RoutineLog, Task } from '~/types'

/** Meta database: the list of profiles and which one is active. */
export class MetaDb extends Dexie {
  profiles!: Table<Profile, string>
  kv!: Table<{ key: string, value: any }, string>

  constructor() {
    super('sati-meta')
    this.version(1).stores({ profiles: 'id', kv: 'key' })
  }
}

/** One database per profile, so profiles never share any data. */
export class ProfileDb extends Dexie {
  tasks!: Table<Task, string>
  sessions!: Table<FocusSession, string>
  routineLogs!: Table<RoutineLog, string>
  reminders!: Table<Reminder, string>
  notifications!: Table<AppNotification, string>
  settings!: Table<{ key: string, value: any }, string>
  events!: Table<HistoryEvent, string>
  /** scheduler de-duplication: one row per alert already delivered */
  fired!: Table<{ key: string, at: number }, string>

  constructor(profileId: string) {
    super(profileDbName(profileId))
    this.version(1).stores({
      tasks: 'id, status, top3Date, planDate',
      sessions: 'id, date, taskId, startAt',
      routineLogs: 'id, taskId, date',
      reminders: 'id, at',
      notifications: 'id, at, kind',
      settings: 'key',
      events: 'id, date, type',
      fired: 'key, at'
    })
  }
}

export const PROFILE_TABLES = ['tasks', 'sessions', 'routineLogs', 'reminders', 'notifications', 'settings', 'events', 'fired'] as const

export function profileDbName(id: string) {
  return `sati-p-${id}`
}

let meta: MetaDb | null = null
const open = new Map<string, ProfileDb>()

export function metaDb(): MetaDb {
  if (!meta) meta = new MetaDb()
  return meta
}

export function profileDb(id: string): ProfileDb {
  let db = open.get(id)
  if (!db) {
    db = new ProfileDb(id)
    open.set(id, db)
  }
  return db
}

export async function deleteProfileDb(id: string) {
  const db = open.get(id)
  if (db) {
    db.close()
    open.delete(id)
  }
  await Dexie.delete(profileDbName(id))
}

/** The active profile's database (null until a profile exists). */
export const activeDb = shallowRef<ProfileDb | null>(null)

export function requireDb(): ProfileDb {
  if (!activeDb.value) throw new Error('No active profile')
  return activeDb.value
}

/**
 * Reactive Dexie query. Re-subscribes whenever the active profile (or any extra
 * dependency) changes, so every screen always shows the current profile's data.
 */
export function useLiveQuery<T>(query: (db: ProfileDb) => Promise<T> | T, initial: T, deps: Array<() => unknown> = []) {
  const data = shallowRef<T>(initial)
  const loaded = ref(false)
  let sub: { unsubscribe: () => void } | null = null

  const stop = watch([activeDb, ...deps], () => {
    sub?.unsubscribe()
    sub = null
    const db = activeDb.value
    if (!db) {
      data.value = initial
      return
    }
    sub = liveQuery(() => query(db)).subscribe({
      next: (v) => {
        data.value = v
        loaded.value = true
      },
      error: e => console.error('[sati] liveQuery', e)
    })
  }, { immediate: true })

  onScopeDispose(() => {
    stop()
    sub?.unsubscribe()
  })
  return { data, loaded }
}

/** Run a composable once for the whole app (shared state that outlives pages). */
export function shared<T>(factory: () => T): () => T {
  let value: T | undefined
  let made = false
  return () => {
    if (!made) {
      const scope = effectScope(true)
      value = scope.run(factory)
      made = true
    }
    return value as T
  }
}
