<script setup lang="ts">
import type { FocusSession, HistoryEvent, RoutineLog, Task } from '~/types'

// Plan tomorrow: one job — build tomorrow's Top N. It mirrors the day rollover (rolloverTop3): tasks planned for
// tomorrow come first, then today's unfinished Top tasks fill the room that is left (they move by themselves).
// Below: every open task, one tap to plan it for tomorrow. Adding saves at once.
const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const toast = useToast()
const { top3, active, routines, byBox, clearBox, planFor, unplan } = useTasks()
const { settings } = useSettings()

const { data: sessions } = useLiveQuery(db => db.sessions.where('date').equals(runtime.today).toArray(), [] as FocusSession[], [() => runtime.today])
const { data: events } = useLiveQuery(db => db.events.where('date').equals(runtime.today).toArray(), [] as HistoryEvent[], [() => runtime.today])

const focusMin = computed(() => sessions.value.reduce((n, s) => n + s.actualMin, 0))
const doneToday = computed(() => events.value.filter(e => e.type === 'done').length)
const top3Done = computed(() => top3.value.filter(x => x.status === 'done').length)
const todayLine = computed(() => `${t('common.today')} · ${top3.value.length
  ? t('review.summary', { done: top3Done.value, total: top3.value.length, time: fmt.duration(focusMin.value) })
  : t('review.summaryFree', { done: doneToday.value, time: fmt.duration(focusMin.value) })}`)

// Tomorrow's Top, as the rollover will build it: planned first, then today's unfinished Top tasks while there is room.
const tomorrow = computed(() => addDays(runtime.today, 1))
const planned = computed(() => active.value.filter(x => !x.isRoutine && x.planDate === tomorrow.value))
const carried = computed(() => {
  const ids = new Set(planned.value.map(x => x.id))
  const room = Math.max(0, topN.value - planned.value.length)
  return top3.value.filter(x => x.status === 'active' && !x.planDate && !ids.has(x.id)).slice(0, room)
})
const tomorrowCount = computed(() => planned.value.length + carried.value.length)
/** Every other open task, Do now first, to plan for tomorrow with one tap. */
const candidates = computed(() => {
  const taken = new Set([...planned.value, ...carried.value].map(x => x.id))
  return active.value.filter(x => !x.isRoutine && !taken.has(x.id)).sort((a, b) => a.box - b.box)
})

// ---- Weekly review: on the last day of the week, a look back before planning the next one ----
const weekFrom = computed(() => startOfWeek(runtime.today, settings.value.weekStart))
const isWeekEnd = computed(() => addDays(weekFrom.value, 6) === runtime.today)
const { data: weekEvents } = useLiveQuery(db => db.events.where('date').between(weekFrom.value, runtime.today, true, true).toArray(), [] as HistoryEvent[], [() => weekFrom.value, () => runtime.today])
const { data: weekSessions } = useLiveQuery(db => db.sessions.where('date').between(weekFrom.value, runtime.today, true, true).toArray(), [] as FocusSession[], [() => weekFrom.value, () => runtime.today])
const { data: weekLogs } = useLiveQuery(db => db.routineLogs.where('date').between(weekFrom.value, runtime.today, true, true).toArray(), [] as RoutineLog[], [() => weekFrom.value, () => runtime.today])
const week = computed(() => {
  let due = 0
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekFrom.value, i)
    if (day > runtime.today) break
    due += routines.value.filter(r => ymd(r.createdAt) <= day && isRoutineDue(r, day)).length
  }
  return {
    done: weekEvents.value.filter(e => e.type === 'done').length,
    focus: weekSessions.value.reduce((n, s) => n + s.actualMin, 0),
    habits: due ? Math.min(100, Math.round((weekLogs.value.length / due) * 100)) : null
  }
})
async function clearDrop() {
  const rows = byBox(4).map(x => toRaw(x))
  if (!rows.length) return
  await clearBox(4)
  toast.add({
    title: t('plan.cleared', { n: rows.length }),
    duration: 6000,
    actions: [{ label: t('common.undo'), color: 'neutral', variant: 'outline', onClick: () => { requireDb().tasks.bulkPut(rows) } }]
  } as any)
}

async function add(task: Task) {
  if (!(await planFor(task.id, tomorrow.value))) toast.add({ title: t('task.top3Full', { top: topN.value }), color: 'warning' })
}
</script>

<template>
  <div data-testid="page-review" style="padding-bottom: calc(110px + env(safe-area-inset-bottom))">
    <div class="relative flex flex-col gap-0.5 px-[22px] pt-7">
      <span class="text-[13px] font-medium text-soft" data-testid="review-today">{{ todayLine }}</span>
      <h1 class="display m-0 text-[34px] font-bold">{{ t('review.title') }}</h1>
    </div>

    <div class="flex flex-col gap-3 px-[22px] pt-[18px]">
      <section v-if="isWeekEnd" class="flex flex-col gap-3 rounded-[18px] bg-night p-4 text-paper" data-testid="week-review">
        <span class="text-[15px] font-semibold">{{ t('review.weekTitle') }}</span>
        <div class="grid gap-2" :class="week.habits === null ? 'grid-cols-2' : 'grid-cols-3'">
          <div class="flex flex-col gap-0.5 rounded-[14px] bg-night2 p-3"><span class="display text-[22px] font-semibold">{{ week.done }}</span><span class="text-[12px] text-nighttext">{{ t('review.weekDone') }}</span></div>
          <div class="flex flex-col gap-0.5 rounded-[14px] bg-night2 p-3"><span class="display text-[22px] font-semibold">{{ fmt.duration(week.focus) }}</span><span class="text-[12px] text-nighttext">{{ t('review.weekFocus') }}</span></div>
          <div v-if="week.habits !== null" class="flex flex-col gap-0.5 rounded-[14px] bg-night2 p-3"><span class="display text-[22px] font-semibold">{{ week.habits }}%</span><span class="text-[12px] text-nighttext">{{ t('review.weekHabits') }}</span></div>
        </div>
        <div v-if="byBox(4).length" class="flex items-center gap-3 rounded-[14px] bg-night2 p-3">
          <span class="grow text-[14px]">{{ t('review.weekDrop', { n: byBox(4).length }) }}</span>
          <button type="button" class="flex h-10 shrink-0 items-center whitespace-nowrap rounded-[10px] bg-paper px-3.5 text-[13px] font-semibold text-night" data-testid="week-clear-drop" @click="clearDrop">{{ t('plan.clearAll') }}</button>
        </div>
      </section>

      <section class="card flex flex-col !rounded-[18px] p-4 pb-2" data-testid="review-top">
        <div class="mb-1 flex items-center gap-2.5">
          <span class="grow text-[15px] font-semibold">{{ t('review.step3', { top: topN }) }}</span>
          <span class="text-[13px] font-semibold" :class="tomorrowCount >= topN ? 'text-brand' : 'text-soft'" data-testid="tomorrow-count">{{ tomorrowCount }}/{{ topN }}</span>
        </div>

        <div v-for="task in planned" :key="task.id" class="flex min-h-[48px] items-center gap-3 border-b border-rule2 last:border-b-0" data-testid="tomorrow-pick">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-white"><UIcon name="i-lucide-check" class="size-4" /></span>
          <span class="min-w-0 grow truncate text-[14px] font-medium">{{ task.title }}</span>
          <BoxBadge :box="task.box" />
          <button type="button" class="tap -mr-2 text-soft" :aria-label="t('common.remove')" @click="unplan(task.id)"><UIcon name="i-lucide-x" class="size-4" /></button>
        </div>
        <div v-for="task in carried" :key="task.id" class="flex min-h-[48px] items-center gap-3 border-b border-rule2 last:border-b-0" data-testid="tomorrow-carried">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand"><UIcon name="i-lucide-corner-down-right" class="size-3.5" /></span>
          <span class="flex min-w-0 grow flex-col">
            <span class="truncate text-[14px] font-medium">{{ task.title }}</span>
            <span class="text-[12px] text-soft">{{ t('review.carried') }}</span>
          </span>
          <BoxBadge :box="task.box" />
        </div>

        <span v-if="!tomorrowCount" class="py-2 text-[13px] text-soft">{{ t('review.emptyTomorrow') }}</span>
      </section>

      <section v-if="candidates.length" class="card flex flex-col !rounded-[18px] p-4 pb-2" data-testid="review-candidates">
        <span class="mb-1 text-[15px] font-semibold">{{ t('review.addFrom') }}</span>
        <button
          v-for="task in candidates"
          :key="task.id"
          type="button"
          class="flex min-h-[48px] items-center gap-3 border-b border-rule2 text-left last:border-b-0"
          :aria-label="`${t('common.add')}: ${task.title}`"
          data-testid="tomorrow-suggestion"
          @click="add(task)"
        >
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-ringc text-soft"><UIcon name="i-lucide-plus" class="size-3.5" /></span>
          <span class="min-w-0 grow truncate text-[14px] text-ink">{{ task.title }}</span>
          <BoxBadge :box="task.box" />
        </button>
      </section>
      <span v-else-if="!active.length" class="px-1 text-[13px] text-soft">{{ t('review.noSuggestions') }}</span>
    </div>

    <TabBar />
  </div>
</template>
