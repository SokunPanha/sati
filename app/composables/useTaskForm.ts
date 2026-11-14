import type { Box, Repeat, Task } from '~/types'
import { boxFlags } from '~/utils/boxes'

/** Values of the shared task form (TaskFields), used by both Create and Edit. */
export interface TaskFormState {
  title: string
  description: string
  box: Box | null
  repeatType: Repeat['type']
  days: number[]
  sessionMin: number
  addTop: boolean
  remind: boolean
  remDate: string
  remTime: string
  remAlert: number
}

function nextHour() {
  const d = new Date(Date.now() + 3600000)
  d.setMinutes(0, 0, 0)
  return { day: ymd(d), time: hhmm(d.getTime()) }
}

/** Shared state + save logic for the task form, so Create and Edit behave the same. */
export function useTaskForm() {
  const { t } = useI18n()
  const toast = useToast()
  const fmt = useFmt()
  const { settings } = useSettings()
  const { tasks, sort, addToTop3, removeFromTop3 } = useTasks()
  const { reminders, save: saveReminder, remove: removeReminder } = useReminders()

  const form = reactive<TaskFormState>({
    title: '', description: '', box: null, repeatType: 'none', days: [], sessionMin: 45,
    addTop: false, remind: false, remDate: runtime.today, remTime: '09:00', remAlert: 0
  })
  const isHabit = computed(() => form.repeatType !== 'none')
  const toTop = computed(() => form.addTop && !isHabit.value)
  /** null = inbox. Defaults: a habit → Schedule, a Top task → Do now. */
  const effectiveBox = computed<Box | null>(() => form.box ?? (isHabit.value ? 2 : toTop.value ? 1 : null))

  const reminderOf = (taskId: string) => reminders.value.find(r => r.taskId === taskId && !r.done) || null

  /** Empty form for a new task (`remind` pre-ticked when opened as "new reminder"). */
  function reset(remind = false) {
    const n = nextHour()
    Object.assign(form, {
      title: '', description: '', box: null, repeatType: 'none', days: [], sessionMin: settings.value.focusMin,
      addTop: false, remind, remDate: n.day, remTime: n.time, remAlert: 0
    })
  }

  /** Fill the form from an existing task (and its reminder, if it has one). */
  function load(task: Task) {
    const rem = reminderOf(task.id)
    const n = nextHour()
    Object.assign(form, {
      title: task.title,
      description: task.description || '',
      box: task.status === 'inbox' ? null : task.box,
      repeatType: task.repeat.type,
      days: [...task.repeat.days],
      sessionMin: task.sessionMin || settings.value.focusMin,
      addTop: task.top3Date === runtime.today,
      remind: !!rem,
      remDate: rem?.date ?? n.day,
      remTime: rem?.time ?? n.time,
      remAlert: rem?.alertBefore ?? 0
    })
  }

  /** Checks before saving; shows a toast and returns false when something is missing. */
  function valid() {
    if (!form.title.trim()) return false
    if (form.repeatType === 'days' && !form.days.length) {
      toast.add({ title: t('sort.pickDays'), color: 'warning' })
      return false
    }
    if (form.remind && form.repeatType !== 'daily' && atTime(form.remDate, form.remTime) <= Date.now()) {
      toast.add({ title: t('reminder.pastWarn'), color: 'warning' })
      return false
    }
    return true
  }

  /** Write the form onto a task (new or existing). Returns false if the Top list was full. */
  async function apply(task: Task) {
    const db = requireDb()
    const b = effectiveBox.value
    if (b) {
      await sort(task.id, {
        title: form.title,
        description: form.description,
        ...boxFlags(b),
        repeat: { type: form.repeatType, days: form.repeatType === 'days' ? [...form.days] : [] },
        // area and due date are no longer in the form: keep what older tasks already have
        area: task.area,
        dueDate: task.dueDate,
        sessionMin: form.sessionMin,
        sessionsPlanned: 1
      })
    }
    else {
      // no box: the task (back) in the inbox, with the edited text and focus time
      await db.tasks.update(task.id, {
        title: form.title.trim(), description: form.description.trim(), sessionMin: form.sessionMin,
        status: task.status === 'done' ? 'done' : 'inbox', repeat: { type: 'none', days: [] }, isRoutine: false
      })
    }

    // Reminder: create / update / remove the one that belongs to this task
    const cur = reminderOf(task.id)
    if (form.remind) {
      const title = form.title.trim()
      const at = atTime(form.remDate, form.remTime)
      await saveReminder(
        { title, date: form.remDate, time: form.remTime, alertBefore: form.remAlert, repeat: form.repeatType === 'daily' ? 'daily' : 'none', focusMin: form.sessionMin, taskId: task.id },
        cur?.id ?? null,
        { title: form.remAlert ? t('notif.reminderIn', { title, n: form.remAlert }) : title, body: t('notif.reminderBody', { time: fmt.time(at) }) }
      )
    }
    else if (cur) await removeReminder(cur.id)

    // Top list
    const inTop = tasks.value.find(x => x.id === task.id)?.top3Date === runtime.today || task.top3Date === runtime.today
    if (toTop.value && b) return addToTop3(task.id)
    if (!toTop.value && inTop) await removeFromTop3(task.id)
    return true
  }

  /** Label of the Save button: where the task will go. */
  const saveLabel = computed(() => isHabit.value
    ? t('capture.saveHabit')
    : effectiveBox.value ? t('capture.saveTo', { name: t(`box.${effectiveBox.value}`) }) : t('capture.save'))

  return { form, isHabit, toTop, effectiveBox, reset, load, valid, apply, saveLabel }
}
