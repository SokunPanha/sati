<script setup lang="ts">
import type { FocusSession, HistoryEvent, Task } from '~/types'

// Plan tomorrow: one job — build tomorrow's Top N. It mirrors the day rollover (rolloverTop3): tasks planned for
// tomorrow come first, then today's unfinished Top tasks fill the room that is left (they move by themselves).
// Below: every open task, one tap to plan it for tomorrow. Adding saves at once.
const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const toast = useToast()
const { openSort } = useSheets()
const { inbox, top3, active, planFor, unplan } = useTasks()

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
      <section v-if="inbox.length" class="card flex items-center gap-3 !rounded-[18px] p-4" data-testid="review-inbox">
        <UIcon name="i-lucide-inbox" class="size-5 shrink-0 text-soft" />
        <span class="grow text-[14px] font-medium">{{ t('review.inboxCount', inbox.length) }}</span>
        <button type="button" class="flex h-11 shrink-0 items-center whitespace-nowrap rounded-[10px] bg-ink px-4 text-[13px] font-semibold text-white" @click="openSort()">
          {{ t('review.sort') }}
        </button>
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
