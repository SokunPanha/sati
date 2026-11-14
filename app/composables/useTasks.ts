import type { Box, HistoryEvent, Repeat, RoutineLog, Task } from '~/types'
import { boxOf } from '~/utils/boxes'

export function isRoutineDue(task: Task, day: string): boolean {
  if (!task.isRoutine) return false
  const wd = weekdayOf(day)
  switch (task.repeat.type) {
    case 'daily': return true
    case 'weekdays': return wd >= 1 && wd <= 5
    case 'days': return task.repeat.days.includes(wd)
    default: return false
  }
}

/** Consecutive scheduled days completed, ending today (or yesterday if today is still open). */
export function routineStreak(task: Task, doneDays: Set<string>, today: string): number {
  let streak = 0
  let day = today
  const created = ymd(task.createdAt)
  for (let i = 0; i < 400; i++) {
    if (isRoutineDue(task, day)) {
      if (doneDays.has(day)) streak++
      else if (day !== today) break
    }
    if (day < created) break
    day = addDays(day, -1)
  }
  return streak
}

export async function logEvent(e: Omit<HistoryEvent, 'id' | 'date' | 'at'> & { at?: number }) {
  const at = e.at ?? Date.now()
  await requireDb().events.add({ ...e, id: uid(), at, date: ymd(at) })
}

export const useTasks = shared(() => {
  const { data: tasks, loaded } = useLiveQuery(db => db.tasks.toArray(), [] as Task[])
  const { data: routineLogs } = useLiveQuery(db => db.routineLogs.toArray(), [] as RoutineLog[])

  const today = computed(() => runtime.today)
  const inbox = computed(() => tasks.value.filter(t => t.status === 'inbox').sort((a, b) => a.createdAt - b.createdAt))
  /** sorted, unfinished, non-repeating tasks: the matrix */
  const active = computed(() => tasks.value
    .filter(t => t.status === 'active' && !t.isRoutine)
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (a.sortedAt || 0) - (b.sortedAt || 0)))
  const routines = computed(() => tasks.value.filter(t => t.isRoutine && t.status === 'active').sort((a, b) => a.createdAt - b.createdAt))
  const routinesToday = computed(() => routines.value.filter(t => isRoutineDue(t, today.value)))
  const top3 = computed(() => tasks.value
    .filter(t => t.top3Date === today.value && !t.isRoutine && t.status !== 'inbox')
    .sort((a, b) => a.top3Order - b.top3Order))

  const logsByTask = computed(() => {
    const map = new Map<string, Set<string>>()
    for (const l of routineLogs.value) {
      if (!map.has(l.taskId)) map.set(l.taskId, new Set())
      map.get(l.taskId)!.add(l.date)
    }
    return map
  })
  const routineDone = (task: Task, day = today.value) => logsByTask.value.get(task.id)?.has(day) ?? false
  const streakOf = (task: Task) => routineStreak(task, logsByTask.value.get(task.id) ?? new Set(), today.value)

  function byBox(box: Box) {
    return active.value.filter(t => t.box === box)
  }
  function top3For(day: string) {
    return tasks.value.filter(t => !t.isRoutine && t.status !== 'inbox' && (t.top3Date === day || t.planDate === day))
  }

  /** Capture: straight to the inbox, zero questions. */
  async function capture(title: string, description = '') {
    const clean = title.trim()
    if (!clean) return null
    const { settings } = useSettings()
    const task: Task = {
      id: uid(),
      title: clean,
      description: description.trim(),
      status: 'inbox',
      urgent: false,
      important: false,
      box: 4,
      area: '',
      dueDate: null,
      sessionMin: settings.value.focusMin,
      sessionsPlanned: 1,
      sessionsDone: 0,
      repeat: { type: 'none', days: [] },
      isRoutine: false,
      top3Date: null,
      top3Order: 0,
      planDate: null,
      carriedFrom: null,
      createdAt: Date.now(),
      sortedAt: null,
      doneAt: null
    }
    await requireDb().tasks.add(task)
    await logEvent({ type: 'captured', taskId: task.id, title: task.title, box: null, area: '' })
    return task
  }

  interface SortInput {
    title: string
    description?: string
    urgent: boolean
    important: boolean
    repeat: Repeat
    area: string
    dueDate: string | null
    sessionMin: number
    sessionsPlanned: number
  }

  /** Save the answers from the Sort sheet (also used for editing). */
  async function sort(id: string, input: SortInput) {
    const isRoutine = input.repeat.type !== 'none'
    const patch: Partial<Task> = {
      title: input.title.trim(),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      urgent: input.urgent,
      important: input.important,
      box: boxOf(input.urgent, input.important),
      repeat: plain(input.repeat),
      isRoutine,
      area: input.area,
      dueDate: isRoutine ? null : input.dueDate,
      sessionMin: input.sessionMin,
      sessionsPlanned: isRoutine ? 1 : input.sessionsPlanned
    }
    const cur = await requireDb().tasks.get(id)
    if (!cur) return
    if (cur.status === 'inbox') {
      patch.status = 'active'
      patch.sortedAt = Date.now()
    }
    if (isRoutine) {
      patch.top3Date = null
      patch.planDate = null
    }
    await requireDb().tasks.update(id, patch)
  }

  async function moveToBox(id: string, box: Box) {
    await requireDb().tasks.update(id, { box, urgent: box === 1 || box === 3, important: box === 1 || box === 2 })
  }

  async function remove(id: string) {
    const db = requireDb()
    await db.tasks.delete(id)
  }

  async function setDone(task: Task, done: boolean) {
    const db = requireDb()
    if (done) {
      await db.tasks.update(task.id, { status: 'done', doneAt: Date.now() })
      await logEvent({ type: 'done', taskId: task.id, title: task.title, box: task.box, area: task.area })
    }
    else {
      await db.tasks.update(task.id, { status: 'active', doneAt: null })
      const evs = await db.events.where('date').equals(runtime.today).filter(e => e.type === 'done' && e.taskId === task.id).primaryKeys()
      await db.events.bulkDelete(evs)
    }
  }

  const topLimit = () => useSettings().settings.value.topCount || 3

  /** The Top list holds at most `topCount` tasks per day (3 by default). Returns false when it is full. */
  async function addToTop3(id: string, day = today.value) {
    const current = tasks.value.filter(t => t.top3Date === day && !t.isRoutine)
    if (current.some(t => t.id === id)) return true
    if (current.length >= topLimit()) return false
    const order = Math.max(0, ...current.map(t => t.top3Order)) + 1
    await requireDb().tasks.update(id, { top3Date: day, top3Order: order, planDate: null })
    return true
  }
  async function removeFromTop3(id: string) {
    await requireDb().tasks.update(id, { top3Date: null, carriedFrom: null })
  }

  /** Review step 3: plan a task for another day without touching today's list. */
  async function planFor(id: string, day: string) {
    if (top3For(day).some(t => t.id === id)) return true
    if (top3For(day).length >= topLimit()) return false
    await requireDb().tasks.update(id, { planDate: day })
    return true
  }
  async function unplan(id: string) {
    await requireDb().tasks.update(id, { planDate: null })
  }

  async function clearBox(box: Box) {
    const ids = byBox(box).map(t => t.id)
    await requireDb().tasks.bulkDelete(ids)
    return ids.length
  }

  async function toggleRoutine(task: Task, minutes = 0, day = today.value) {
    const db = requireDb()
    const id = `${task.id}|${day}`
    if (await db.routineLogs.get(id)) await db.routineLogs.delete(id)
    else await db.routineLogs.put({ id, taskId: task.id, title: task.title, box: task.box, area: task.area, date: day, doneAt: Date.now(), minutes })
  }
  async function markRoutineDone(task: Task, minutes: number, day = runtime.today) {
    const db = requireDb()
    const id = `${task.id}|${day}`
    const cur = await db.routineLogs.get(id)
    await db.routineLogs.put({
      id, taskId: task.id, title: task.title, box: task.box, area: task.area, date: day,
      doneAt: cur?.doneAt ?? Date.now(), minutes: (cur?.minutes ?? 0) + minutes
    })
  }

  return {
    tasks, loaded, inbox, active, routines, routinesToday, top3, routineLogs,
    byBox, top3For, routineDone, streakOf,
    capture, sort, moveToBox, remove, setDone, addToTop3, removeFromTop3, planFor, unplan, clearBox,
    toggleRoutine, markRoutineDone
  }
})

/**
 * Day rollover for Top 3 (runs at start-up and whenever the date changes):
 * 1. tasks planned in Review for today (or earlier) become today's Top 3;
 * 2. unfinished Top 3 tasks from earlier days are carried over while there is room.
 * Every carry-over is logged so History can show "not finished · moved to …".
 */
export async function rolloverTop3(db = requireDb(), today = ymd(), limit = 3) {
  await db.transaction('rw', db.tasks, db.events, async () => {
    const all = await db.tasks.toArray()
    const open = all.filter(t => t.status === 'active' && !t.isRoutine)
    let used = all.filter(t => t.top3Date === today && !t.isRoutine).length
    let order = Math.max(0, ...all.filter(t => t.top3Date === today).map(t => t.top3Order))
    const carry = async (t: Task, from: string | null) => {
      const carried = !!from && from < today
      await db.tasks.update(t.id, { top3Date: today, top3Order: ++order, planDate: null, carriedFrom: carried ? from : null })
      if (carried) {
        await db.events.add({ id: uid(), type: 'carried', date: from!, at: atTime(from!, '23:59'), taskId: t.id, title: t.title, box: t.box, area: t.area, toDate: today })
      }
      used++
    }
    for (const t of open.filter(t => t.planDate && t.planDate <= today)) {
      if (t.top3Date === today) await db.tasks.update(t.id, { planDate: null })
      else if (used < limit) await carry(t, t.top3Date)
      else await db.tasks.update(t.id, { planDate: null, top3Date: null })
    }
    for (const t of open.filter(t => !t.planDate && t.top3Date && t.top3Date < today)) {
      if (used < limit) await carry(t, t.top3Date)
      else await db.tasks.update(t.id, { top3Date: null })
    }
  })
}
