import type { Reminder } from '~/types'

/** Next occurrence strictly after `now` for a repeating reminder. */
export function advanceReminder(r: Reminder, now: number): Reminder {
  let day = r.date
  let at = r.at
  let guard = 0
  while (at <= now && guard++ < 5000) {
    if (r.repeat === 'daily') day = addDays(day, 1)
    else if (r.repeat === 'weekly') day = addDays(day, 7)
    else if (r.repeat === 'monthly') day = addMonths(day, 1)
    else break
    at = atTime(day, r.time)
  }
  return { ...r, date: day, at }
}

export const reminderKey = (r: Reminder) => `rem|${r.id}|${r.at}`

export const useReminders = shared(() => {
  const { data: reminders, loaded } = useLiveQuery(db => db.reminders.orderBy('at').toArray(), [] as Reminder[])

  const upcoming = computed(() => reminders.value.filter(r => !r.done))
  const past = computed(() => reminders.value.filter(r => r.done).sort((a, b) => b.at - a.at))
  const next = computed(() => upcoming.value.find(r => r.at >= runtime.now - 60000) || null)
  const todayCount = computed(() => upcoming.value.filter(r => r.date === runtime.today && r.at >= runtime.now - 60000).length)

  interface Input { title: string, date: string, time: string, alertBefore: number, repeat: Reminder['repeat'] }

  async function save(input: Input, id: string | null = null, texts?: { title: string, body: string }) {
    const db = requireDb()
    const notify = useNotify()
    let at = atTime(input.date, input.time)
    let rem: Reminder = {
      id: id || uid(),
      title: input.title.trim(),
      date: input.date,
      time: input.time,
      at,
      alertBefore: input.alertBefore,
      repeat: input.repeat,
      done: false,
      createdAt: Date.now()
    }
    if (id) {
      const cur = await db.reminders.get(id)
      if (cur) rem.createdAt = cur.createdAt
      await notify.cancelTrigger(`rem|${id}|`)
    }
    // A repeating reminder saved with a past time starts at its next occurrence.
    if (rem.repeat !== 'none' && at <= Date.now()) rem = advanceReminder(rem, Date.now())
    at = rem.at
    await db.reminders.put(rem)
    // Bonus: let the OS fire it even if the app is closed (Notification Triggers, where available).
    if (texts && notify.supportsTriggers && notify.permission.value === 'granted') {
      const ok = await notify.scheduleTrigger(reminderKey(rem), at - rem.alertBefore * 60000, texts.title, texts.body, '/reminders')
      if (ok) await db.fired.put({ key: `trig|${reminderKey(rem)}`, at: Date.now() })
    }
    return rem
  }

  async function remove(id: string) {
    await requireDb().reminders.delete(id)
    await useNotify().cancelTrigger(`rem|${id}|`)
  }

  return { reminders, loaded, upcoming, past, next, todayCount, save, remove }
})
