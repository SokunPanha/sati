<script setup lang="ts">
const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const toast = useToast()
const { sheets, openSort } = useSheets()
const { tasks, top3, addToTop3, removeFromTop3, setDone, remove, makeUpNext, routineDone, toggleRoutine, streakOf } = useTasks()
const { start } = useFocus()
const { settings } = useSettings()

const task = computed(() => tasks.value.find(x => x.id === sheets.taskId) || null)
const inTop3 = computed(() => task.value?.top3Date === runtime.today)
const sub = computed(() => {
  const x = task.value
  if (!x) return ''
  const parts = x.status === 'inbox' ? [] : [fmt.boxLabel(x.box)]
  if (x.sessionMin) parts.push(t('common.min', { n: x.sessionMin }))
  if (x.checklist?.length) parts.push(`✓ ${t('steps.progress', { done: x.checklist.filter(c => c.done).length, total: x.checklist.length })}`)
  if (x.isRoutine) parts.push(fmt.repeatLabel(x.repeat))
  return parts.join(' · ')
})

function close() {
  sheets.taskActions = false
}
async function toggleTop3() {
  if (!task.value) return
  if (inTop3.value) await removeFromTop3(task.value.id)
  else if (await addToTop3(task.value.id)) toast.add({ title: t('task.addedTop3', { top: topN.value }), color: 'success', icon: 'i-lucide-star' })
  else {
    toast.add({ title: t('task.top3Full', { top: topN.value }), color: 'warning' })
    return
  }
  close()
}
async function focusNow() {
  if (!task.value) return
  await start(task.value)
  close()
  await navigateTo('/focus')
}
async function done() {
  if (!task.value) return
  await setDone(task.value, true)
  close()
}
function edit() {
  const id = task.value?.id
  close()
  if (id) setTimeout(() => openSort(id), 250)
}
/** One tap deletes; the toast can bring it back. */
async function del() {
  if (!task.value) return
  const copy = toRaw(task.value)
  await remove(copy.id)
  close()
  toast.add({
    title: t('task.deleted'),
    duration: 5000,
    actions: [{ label: t('common.undo'), color: 'neutral', variant: 'outline', onClick: () => { requireDb().tasks.put(copy) } }]
  } as any)
}
/** Ticking a step saves straight away. */
const steps = computed({
  get: () => task.value?.checklist || [],
  set: (v) => { if (task.value) requireDb().tasks.update(task.value.id, { checklist: v.map(x => ({ ...x })) }) }
})

/** In the Top list but not the next one: offer to make it next. */
const canBeNext = computed(() => {
  const x = task.value
  if (!x || !inTop3.value || x.status === 'done') return false
  return top3.value.find(y => y.status !== 'done')?.id !== x.id
})
async function upNext() {
  if (!task.value) return
  await makeUpNext(task.value.id)
  close()
}

// Habit: the last 5 weeks, one tick per day it is due (tap a past day to fix a missed tick).
const fmtDay = (d: string) => fmt.date(d, { weekday: 'long', day: 'numeric', month: 'short' })
const habitDays = computed(() => {
  const x = task.value
  if (!x?.isRoutine) return []
  const today = runtime.today
  const offset = (weekdayOf(today) + 6) % 7 // weeks start on Monday
  const start = addDays(today, -(28 + offset))
  const created = ymd(x.createdAt)
  return Array.from({ length: 35 }, (_, i) => {
    const day = addDays(start, i)
    const future = day > today
    const due = !future && day >= created && isRoutineDue(x, day)
    return { day, n: Number(day.slice(8)), future, due, done: routineDone(x, day), today: day === today }
  })
})
const weekdays = computed(() => Array.from({ length: 7 }, (_, i) => fmt.weekdayNarrow(addDays('2024-01-01', i))))
async function tickDay(day: string) {
  if (task.value) await toggleRoutine(task.value, 0, day)
}

const row = 'flex min-h-[52px] w-full items-center gap-3 border-b border-rule2 px-4 text-left text-[15px] text-ink last:border-b-0'
</script>

<template>
  <BottomSheet v-model:open="sheets.taskActions" :title="task?.title || t('task.actions')" :description="sub || undefined">
    <div v-if="task" class="flex flex-col gap-4" data-testid="task-actions">
      <p v-if="task.description" class="m-0 -mt-1 whitespace-pre-line rounded-2xl bg-card px-4 py-3 text-[15px] text-ink" data-testid="task-description">{{ task.description }}</p>
      <ChecklistEditor v-if="steps.length" v-model="steps" testid="sheet-steps" />

      <section v-if="task.isRoutine" class="card flex flex-col gap-2 p-3" data-testid="habit-calendar">
        <div class="flex items-center justify-between px-1">
          <span class="text-[13px] font-semibold">{{ t('task.last5Weeks') }}</span>
          <span v-if="streakOf(task) > 0" class="flex items-center gap-1 text-[13px] font-medium text-b1"><UIcon name="i-lucide-flame" class="size-4" />{{ t('today.streak', { n: streakOf(task) }) }}</span>
        </div>
        <div class="grid grid-cols-7 gap-1 text-center">
          <span v-for="(w, i) in weekdays" :key="i" class="text-[11px] text-soft">{{ w }}</span>
          <button
            v-for="d in habitDays"
            :key="d.day"
            type="button"
            class="flex aspect-square items-center justify-center rounded-full text-[12px]"
            :class="[d.done ? 'bg-brand font-semibold text-white' : d.due ? 'border border-edge text-ink' : 'text-faint', d.today && !d.done ? 'ring-2 ring-brand' : '']"
            :disabled="!d.due"
            :aria-pressed="d.due ? d.done : undefined"
            :aria-label="fmtDay(d.day)"
            :data-testid="d.due ? `habit-day-${d.day}` : undefined"
            @click="tickDay(d.day)"
          >
            {{ d.future ? '' : d.n }}
          </button>
        </div>
      </section>

      <div class="card flex flex-col overflow-hidden">
        <button v-if="!task.isRoutine" type="button" :class="row" data-testid="action-top3" @click="toggleTop3">
          <UIcon :name="inTop3 ? 'i-lucide-star-off' : 'i-lucide-star'" class="size-5 text-brand" />
          {{ inTop3 ? t('task.removeTop3', { top: topN }) : t('task.addTop3', { top: topN }) }}
        </button>
        <button v-if="canBeNext" type="button" :class="row" data-testid="action-up-next" @click="upNext">
          <UIcon name="i-lucide-arrow-up-to-line" class="size-5 text-brand" />{{ t('task.makeNext') }}
        </button>
        <button type="button" :class="row" data-testid="action-focus" @click="focusNow">
          <UIcon name="i-lucide-play" class="size-5 text-brand" />{{ t('task.startFocus', { n: task.sessionMin || settings.focusMin }) }}
        </button>
        <button v-if="!task.isRoutine" type="button" :class="row" @click="done">
          <UIcon name="i-lucide-circle-check" class="size-5 text-brand" />{{ t('task.markDone') }}
        </button>
        <button type="button" :class="row" data-testid="action-edit" @click="edit">
          <UIcon name="i-lucide-pencil" class="size-5 text-brand" />{{ t('task.edit') }}
        </button>
      </div>

      <button type="button" class="flex h-[52px] items-center justify-center gap-2 rounded-[14px] border border-b1-line text-[15px] font-semibold text-b1-tx" data-testid="action-delete" @click="del">
        <UIcon name="i-lucide-trash-2" class="size-[18px]" />{{ t('task.delete') }}
      </button>
    </div>
  </BottomSheet>
</template>
