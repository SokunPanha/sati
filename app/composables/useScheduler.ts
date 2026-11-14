import type { ProfileDb } from './useDb'
import type { Settings } from '~/types'

type T = (key: string, params?: any) => string

const TICK_MS = 15000
/** catch-up windows: how late an alert may still be shown as a system notification */
const REMINDER_CATCHUP = 6 * 3600000
const DAILY_CATCHUP = 4 * 3600000

let timer: ReturnType<typeof setInterval> | null = null
let busy = false
let t: T = k => k
let fmtTime: (ts: number) => string = ts => hhmm(ts)
let lastDay = ''

/** Atomically claim an alert key: only the first caller (across tabs too) gets `true`. */
async function claim(db: ProfileDb, key: string): Promise<boolean> {
  try {
    await db.fired.add({ key, at: Date.now() })
    return true
  }
  catch {
    return false
  }
}

async function checkReminders(db: ProfileDb, now: number) {
  const { deliver } = useNotify()
  const list = await db.reminders.filter(r => !r.done).toArray()
  for (const r of list) {
    const alertAt = r.at - r.alertBefore * 60000
    if (now >= alertAt) {
      const key = reminderKey(r)
      if (await claim(db, key)) {
        const early = r.alertBefore > 0 && now < r.at
        const title = early ? t('notif.reminderIn', { title: r.title, n: r.alertBefore }) : r.title
        const body = `${t('notif.reminderBody', { time: fmtTime(r.at) })}${r.repeat !== 'none' ? ' · ' + t(`repeat.${r.repeat}`) : ''}`
        const viaTrigger = !!(await db.fired.get(`trig|${key}`))
        await deliver({
          kind: 'reminder',
          title,
          body,
          // with a focus time, open the list where its Start focus button is
          url: r.focusMin ? '/notifications' : '/reminders',
          ...(r.focusMin ? { action: 'focus' as const, focusMin: r.focusMin } : {}),
          at: Math.max(alertAt, now - REMINDER_CATCHUP),
          inAppOnly: viaTrigger || now - alertAt > REMINDER_CATCHUP,
          tag: key
        })
      }
    }
    if (now >= r.at) {
      if (r.repeat === 'none') await db.reminders.update(r.id, { done: true })
      else {
        const next = advanceReminder(r, now)
        await db.reminders.update(r.id, { date: next.date, at: next.at })
      }
    }
  }
}

/** A once-a-day alert is due when its time has passed today, within the catch-up window. */
function dueToday(now: number, today: string, time: string) {
  const at = atTime(today, time)
  return now >= at && now - at <= DAILY_CATCHUP
}

async function checkDaily(db: ProfileDb, s: Settings, now: number, today: string) {
  const { deliver } = useNotify()
  const n = s.notif

  if (n.morning && dueToday(now, today, n.morningTime) && await claim(db, `morning|${today}`)) {
    const top3 = await db.tasks.where('top3Date').equals(today).count()
    await deliver({
      kind: 'morning',
      title: t('notif.morningTitle', { top: s.topCount || 3 }),
      body: top3 ? t('notif.morningBodyReady', { n: top3, top: s.topCount || 3 }) : t('notif.morningBody'),
      url: top3 ? '/' : '/plan'
    })
  }

  if (n.routine && dueToday(now, today, n.routineTime)) {
    const routines = (await db.tasks.filter(x => x.isRoutine && x.status === 'active').toArray()).filter(x => isRoutineDue(x, today))
    const logs = new Set((await db.routineLogs.where('date').equals(today).toArray()).map(l => l.taskId))
    const left = routines.filter(x => !logs.has(x.id))
    if (left.length && await claim(db, `routine|${today}`)) {
      const first = left[0]!
      await deliver({
        kind: 'routine',
        title: left.length === 1 ? t('notif.routineTitleOne', { title: first.title }) : t('notif.routineTitle', { n: left.length }),
        body: t('notif.routineBody', { title: first.title, n: first.sessionMin }),
        url: '/notifications',
        action: 'focus',
        taskId: first.id
      })
    }
  }

  if (n.evening && dueToday(now, today, n.eveningTime) && await claim(db, `evening|${today}`)) {
    await deliver({ kind: 'evening', title: t('notif.eveningTitle'), body: t('notif.eveningBody', { top: s.topCount || 3 }), url: '/review' })
  }

  // Weekly backup reminder: on the last day of the week, at review time.
  const lastDayOfWeek = (s.weekStart + 6) % 7
  if (n.backup && weekdayOf(today) === lastDayOfWeek && dueToday(now, today, n.eveningTime)) {
    const stale = !s.lastBackupAt || now - s.lastBackupAt > 6 * 86400000
    const hasData = (await db.tasks.count()) > 0
    if (stale && hasData && await claim(db, `backup|${today}`)) {
      await deliver({ kind: 'backup', title: t('notif.backupTitle'), body: t('notif.backupBody'), url: '/settings' })
    }
  }
}

async function tick() {
  if (busy) return
  const db = activeDb.value
  if (!db) return
  busy = true
  try {
    const now = Date.now()
    const today = ymd(now)
    runtime.now = now
    runtime.today = today
    if (today !== lastDay) {
      lastDay = today
      await rolloverTop3(db, today, (await readSettings(db)).topCount || 3)
      // keep the de-dup table small
      await db.fired.where('at').below(now - 45 * 86400000).delete()
    }
    const settings = await readSettings(db)
    await checkReminders(db, now)
    await checkDaily(db, settings, now, today)
  }
  catch (e) {
    console.error('[sati] scheduler', e)
  }
  finally {
    busy = false
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') tick()
}

/**
 * Local scheduler (there is no server): checks every ~15 s, on start, when the app
 * becomes visible again and when the profile changes. Anything missed while the app
 * was closed is caught up, and each alert is recorded so it never fires twice.
 */
export function useScheduler() {
  function start(translate: T, timeFormatter: (ts: number) => string) {
    t = translate
    fmtTime = timeFormatter
    if (timer) return
    timer = setInterval(tick, TICK_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    watch(activeDb, () => {
      lastDay = ''
      tick()
    })
    tick()
  }
  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onVisible)
    window.removeEventListener('online', onVisible)
  }
  return { start, stop, tick }
}
