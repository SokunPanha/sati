export type Box = 1 | 2 | 3 | 4
export type LocaleCode = 'km' | 'en'

export interface Profile {
  id: string
  name: string
  color: string
  /** resized (≤200×200) JPEG data URL, or null */
  photo: string | null
  /** SHA-256 hex of the 4-digit PIN, or null when the profile is not locked */
  pinHash: string | null
  locale: LocaleCode
  createdAt: number
  lastUsedAt: number
}

export interface Repeat {
  type: 'none' | 'daily' | 'weekdays' | 'days'
  /** weekdays 0 (Sun) – 6 (Sat); used when type === 'days' */
  days: number[]
}

export interface Task {
  id: string
  title: string
  /** optional longer note (older tasks may not have it) */
  description?: string
  status: 'inbox' | 'active' | 'done'
  urgent: boolean
  important: boolean
  box: Box
  area: string
  dueDate: string | null
  sessionMin: number
  sessionsPlanned: number
  sessionsDone: number
  repeat: Repeat
  /** repeating task: shows in "Daily routine", never uses a Top 3 slot */
  isRoutine: boolean
  top3Date: string | null
  top3Order: number
  /** picked in Review for a later day's Top 3 */
  planDate: string | null
  carriedFrom: string | null
  createdAt: number
  sortedAt: number | null
  doneAt: number | null
}

export interface FocusSession {
  id: string
  taskId: string | null
  title: string
  area: string
  box: Box
  isRoutine: boolean
  /** local YYYY-MM-DD of the start */
  date: string
  startAt: number
  endAt: number
  plannedMin: number
  actualMin: number
  completed: boolean
  endedEarly: boolean
}

export interface RoutineLog {
  /** `${taskId}|${date}` */
  id: string
  taskId: string
  title: string
  box: Box
  area: string
  date: string
  doneAt: number
  minutes: number
}

export interface Reminder {
  id: string
  title: string
  /** next (or last, when done) occurrence */
  date: string
  time: string
  at: number
  /** minutes before `at` to alert; 0 = on time */
  alertBefore: number
  repeat: 'none' | 'daily' | 'weekly' | 'monthly'
  /** minutes of focus to offer when it fires; 0 or missing = no focus */
  focusMin?: number
  done: boolean
  createdAt: number
}

export type NotifKind = 'reminder' | 'focus' | 'break' | 'morning' | 'evening' | 'box2' | 'routine' | 'due' | 'backup' | 'test'

export interface AppNotification {
  id: string
  kind: NotifKind
  title: string
  body: string
  at: number
  read: boolean
  url: string
  /** 'focus' shows a Start focus button for taskId */
  action: 'focus' | null
  taskId: string | null
  /** 'focus' without a task (a reminder): length of the session to start */
  focusMin?: number
}

export interface HistoryEvent {
  id: string
  type: 'captured' | 'done' | 'carried'
  date: string
  at: number
  taskId: string | null
  title: string
  box: Box | null
  area: string
  /** carried: the day the task moved to */
  toDate?: string
}

export interface NotifSettings {
  morning: boolean
  morningTime: string
  evening: boolean
  eveningTime: string
  focus: boolean
  routine: boolean
  routineTime: string
  box2: boolean
  box2Time: string
  due: boolean
  dueTime: string
  backup: boolean
}

export interface Settings {
  focusMin: number
  /** how many tasks fit in the daily "Top" list (default 3) */
  topCount: number
  breakMin: number
  dailyGoal: number
  areas: string[]
  /** 0 = Sunday, 1 = Monday */
  weekStart: number
  notif: NotifSettings
  quietOn: boolean
  quietFrom: string
  quietTo: string
  lastBackupAt: number | null
  notifAsked: boolean
}

export type FocusPhase = 'focus' | 'focus-done' | 'break' | 'break-done'

export interface ActiveFocus {
  id: string
  taskId: string | null
  /** "Batch in 1 block": several small box-3 tasks in one session */
  batchIds: string[]
  title: string
  area: string
  box: Box
  isRoutine: boolean
  plannedMin: number
  breakMin: number
  sessionNo: number
  sessionsPlanned: number
  phase: FocusPhase
  startAt: number
  /** when the running countdown ends; null while paused or waiting */
  endAt: number | null
  /** remaining ms while paused */
  pausedMs: number | null
}

export interface BackupFile {
  app: 'sati'
  version: 1
  exportedAt: string
  profiles: Array<{ profile: Profile, data: Record<string, any[]> }>
}

// Page flags used by app.vue (layout) and the profile middleware.
declare module '#app' {
  interface PageMeta {
    /** open without a profile (landing page) */
    public?: boolean
    /** full-width layout without the phone column or splash */
    wide?: boolean
  }
}
declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    wide?: boolean
  }
}
