import type { ActiveFocus, FocusSession, Task } from '~/types'

interface FocusTexts {
  doneTitle: (title: string) => string
  doneBody: (breakMin: number) => string
  breakTitle: () => string
  breakBody: (title: string) => string
}

const KEY = 'activeFocus'

export const useFocus = shared(() => {
  const focus = ref<ActiveFocus | null>(null)
  const remainingMs = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null
  let finishing = false
  let texts: FocusTexts | null = null

  const running = computed(() => !!focus.value && focus.value.endAt !== null && (focus.value.phase === 'focus' || focus.value.phase === 'break'))
  const paused = computed(() => !!focus.value && focus.value.pausedMs !== null)
  const totalMs = computed(() => {
    const f = focus.value
    if (!f) return 0
    return (f.phase === 'break' || f.phase === 'break-done' ? f.breakMin : f.plannedMin) * 60000
  })

  watchEffect(() => {
    runtime.focusing = !!focus.value && focus.value.phase === 'focus' && focus.value.endAt !== null
  })

  async function persist() {
    const db = activeDb.value
    if (!db) return
    if (focus.value) await db.settings.put({ key: KEY, value: plain(focus.value) })
    else await db.settings.delete(KEY)
  }

  function compute() {
    const f = focus.value
    if (!f) {
      remainingMs.value = 0
      return
    }
    if (f.pausedMs !== null) remainingMs.value = f.pausedMs
    else if (f.endAt !== null) remainingMs.value = Math.max(0, f.endAt - Date.now())
    else remainingMs.value = 0
  }

  async function tick() {
    compute()
    const f = focus.value
    if (!f || f.endAt === null || finishing) return
    if (Date.now() >= f.endAt) {
      finishing = true
      try {
        if (f.phase === 'focus') await completeFocus()
        else if (f.phase === 'break') await completeBreak()
      }
      finally {
        finishing = false
      }
    }
  }

  function ensureTimer() {
    if (!timer) timer = setInterval(tick, 250)
  }

  /** Load the persisted session of the active profile (survives reloads and profile switches). */
  async function load() {
    const db = activeDb.value
    focus.value = null
    if (db) {
      const row = await db.settings.get(KEY)
      focus.value = (row?.value as ActiveFocus) || null
    }
    compute()
    ensureTimer()
    await tick()
  }

  function setTexts(t: FocusTexts) {
    texts = t
  }

  async function logSession(f: ActiveFocus, endAt: number, completed: boolean, actualMin: number) {
    const s: FocusSession = {
      id: uid(),
      taskId: f.taskId,
      title: f.title,
      area: f.area,
      box: f.box,
      isRoutine: f.isRoutine,
      date: ymd(f.startAt),
      startAt: f.startAt,
      endAt,
      plannedMin: f.plannedMin,
      actualMin,
      completed,
      endedEarly: !completed
    }
    await requireDb().sessions.add(s)
    return s
  }

  async function start(task: Task, opts: { minutes?: number } = {}) {
    const { settings } = useSettings()
    const minutes = opts.minutes || task.sessionMin || settings.value.focusMin
    const now = Date.now()
    focus.value = {
      id: uid(),
      taskId: task.id,
      batchIds: [],
      title: task.title,
      area: task.area,
      box: task.box,
      isRoutine: task.isRoutine,
      plannedMin: minutes,
      breakMin: settings.value.breakMin,
      sessionNo: Math.min(task.sessionsDone + 1, Math.max(task.sessionsPlanned, task.sessionsDone + 1)),
      sessionsPlanned: Math.max(task.sessionsPlanned, task.sessionsDone + 1),
      phase: 'focus',
      startAt: now,
      endAt: now + minutes * 60000,
      pausedMs: null
    }
    compute()
    await persist()
    ensureTimer()
  }

  /** "Batch in 1 block": one session for several small tasks; with no tasks, a plain session (a reminder's focus time). */
  async function startBatch(tasks: Task[], title: string, minutes: number) {
    const { settings } = useSettings()
    const now = Date.now()
    focus.value = {
      id: uid(),
      taskId: null,
      batchIds: tasks.map(t => t.id),
      title,
      area: '',
      box: tasks.length ? 3 : 2,
      isRoutine: false,
      plannedMin: minutes,
      breakMin: settings.value.breakMin,
      sessionNo: 1,
      sessionsPlanned: 1,
      phase: 'focus',
      startAt: now,
      endAt: now + minutes * 60000,
      pausedMs: null
    }
    compute()
    await persist()
    ensureTimer()
  }

  async function pause() {
    const f = focus.value
    if (!f || f.endAt === null) return
    f.pausedMs = Math.max(0, f.endAt - Date.now())
    f.endAt = null
    compute()
    await persist()
  }

  async function resume() {
    const f = focus.value
    if (!f || f.pausedMs === null) return
    f.endAt = Date.now() + f.pausedMs
    f.pausedMs = null
    compute()
    await persist()
  }

  /** Add minutes to the running (or paused) focus session. */
  async function extend(min = 5) {
    const f = focus.value
    if (!f || f.phase !== 'focus') return
    if (f.pausedMs !== null) f.pausedMs += min * 60000
    else if (f.endAt !== null) f.endAt += min * 60000
    else return
    f.plannedMin += min
    compute()
    await persist()
  }

  async function completeFocus() {
    const f = focus.value
    if (!f) return
    const endAt = f.endAt ?? Date.now()
    const db = requireDb()
    await logSession(f, endAt, true, f.plannedMin)
    if (f.taskId) {
      const task = await db.tasks.get(f.taskId)
      if (task) {
        await db.tasks.update(task.id, { sessionsDone: task.sessionsDone + 1 })
        if (task.isRoutine) await useTasks().markRoutineDone(task, f.plannedMin, ymd(f.startAt))
      }
    }
    f.phase = 'focus-done'
    f.endAt = null
    f.pausedMs = null
    compute()
    await persist()
    if (texts) {
      await useNotify().deliver({
        kind: 'focus',
        title: texts.doneTitle(f.title),
        body: texts.doneBody(f.breakMin),
        url: '/focus',
        at: endAt,
        // ended long ago while the app was closed: keep it in the list, don't buzz now
        inAppOnly: Date.now() - endAt > 3 * 3600000,
        tag: 'sati-focus'
      })
    }
  }

  async function completeBreak() {
    const f = focus.value
    if (!f) return
    const endAt = f.endAt ?? Date.now()
    f.phase = 'break-done'
    f.endAt = null
    compute()
    await persist()
    if (texts) {
      await useNotify().deliver({
        kind: 'break',
        title: texts.breakTitle(),
        body: texts.breakBody(f.title),
        url: '/focus',
        at: endAt,
        inAppOnly: Date.now() - endAt > 3 * 3600000,
        tag: 'sati-focus'
      })
    }
  }

  /** End a running session early. It is still logged (as "ended early") when at least a minute was spent. */
  async function endEarly() {
    const f = focus.value
    if (!f) return
    if (f.phase === 'focus') {
      const left = f.pausedMs ?? Math.max(0, (f.endAt ?? Date.now()) - Date.now())
      const spentMin = Math.round((f.plannedMin * 60000 - left) / 60000)
      if (spentMin >= 1) await logSession(f, Date.now(), false, spentMin)
    }
    focus.value = null
    compute()
    await persist()
  }

  async function startBreak() {
    const f = focus.value
    if (!f) return
    f.phase = 'break'
    f.endAt = Date.now() + f.breakMin * 60000
    f.pausedMs = null
    compute()
    await persist()
  }

  /** Another session on the same task. */
  async function again() {
    const f = focus.value
    if (!f) return
    const now = Date.now()
    f.id = uid()
    f.phase = 'focus'
    f.sessionNo += 1
    f.sessionsPlanned = Math.max(f.sessionsPlanned, f.sessionNo)
    f.startAt = now
    f.endAt = now + f.plannedMin * 60000
    f.pausedMs = null
    compute()
    await persist()
  }

  /** Leave focus mode; optionally mark the task (or the whole batch) done. */
  async function finish(markDone: boolean) {
    const f = focus.value
    if (!f) return
    if (markDone) {
      const db = requireDb()
      const ids = f.taskId ? [f.taskId] : f.batchIds
      for (const id of ids) {
        const task = await db.tasks.get(id)
        if (task && !task.isRoutine && task.status !== 'done') await useTasks().setDone(task, true)
      }
    }
    focus.value = null
    compute()
    await persist()
  }

  watch(activeDb, () => { load() })

  return { focus, remainingMs, totalMs, running, paused, load, setTexts, start, startBatch, pause, resume, extend, endEarly, startBreak, again, finish }
})
