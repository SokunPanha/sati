import type { ProfileDb } from '~/composables/useDb'

/** Consecutive days (ending today, or yesterday if today is still empty) with focus or a routine done. */
export function streakFromDays(days: Set<string>, today: string): number {
  let day = days.has(today) ? today : addDays(today, -1)
  let n = 0
  while (days.has(day) && n < 2000) {
    n++
    day = addDays(day, -1)
  }
  return n
}

export async function profileSummary(db: ProfileDb, today: string) {
  const [sessions, logs, tasks] = await Promise.all([
    db.sessions.toArray(),
    db.routineLogs.toArray(),
    db.tasks.filter(t => t.isRoutine && t.status === 'active').count()
  ])
  const days = new Set<string>()
  for (const s of sessions) if (s.actualMin > 0) days.add(s.date)
  for (const l of logs) days.add(l.date)
  return { routines: tasks, streak: streakFromDays(days, today) }
}
