<script setup lang="ts">
import type { FocusSession, HistoryEvent, Task } from '~/types'

// Plan tomorrow: one job — pick tomorrow's Top N. One line about today, the inbox only when something waits,
// then one list: picked tasks (✓, tap × to remove) followed by suggestions (tap + to add). Adding saves at once.
const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const toast = useToast()
const { openSort } = useSheets()
const { inbox, top3, active, top3For, planFor, unplan } = useTasks()

const { data: sessions } = useLiveQuery(db => db.sessions.where('date').equals(runtime.today).toArray(), [] as FocusSession[], [() => runtime.today])
const { data: events } = useLiveQuery(db => db.events.where('date').equals(runtime.today).toArray(), [] as HistoryEvent[], [() => runtime.today])

const focusMin = computed(() => sessions.value.reduce((n, s) => n + s.actualMin, 0))
const doneToday = computed(() => events.value.filter(e => e.type === 'done').length)
const top3Done = computed(() => top3.value.filter(x => x.status === 'done').length)
const todayLine = computed(() => `${t('common.today')} · ${top3.value.length
  ? t('review.summary', { done: top3Done.value, total: top3.value.length, time: fmt.duration(focusMin.value) })
  : t('review.summaryFree', { done: doneToday.value, time: fmt.duration(focusMin.value) })}`)

// Tomorrow's Top: suggest unfinished Top tasks first, then Do now, then Schedule.
const tomorrow = computed(() => addDays(runtime.today, 1))
const picked = computed(() => top3For(tomorrow.value))
const unfinishedToday = computed(() => top3.value.filter(x => x.status === 'active'))
const suggestions = computed<Task[]>(() => {
  const room = topN.value - picked.value.length
  if (room <= 0) return []
  const taken = new Set(picked.value.map(x => x.id))
  const pool = [...unfinishedToday.value, ...active.value.filter(x => x.box === 1), ...active.value.filter(x => x.box === 2)]
  const out: Task[] = []
  for (const task of pool) {
    if (taken.has(task.id)) continue
    taken.add(task.id)
    out.push(task)
    if (out.length >= room) break
  }
  return out
})
const isCarried = (task: Task) => unfinishedToday.value.some(x => x.id === task.id)
const pickerOpen = ref(false)

async function add(task: Task) {
  if (!(await planFor(task.id, tomorrow.value))) toast.add({ title: t('task.top3Full', { top: topN.value }), color: 'warning' })
}
</script>

<template>
  <div data-testid="page-review" style="padding-bottom: calc(110px + env(safe-area-inset-bottom))">
    <div class="relative flex flex-col gap-0.5 px-[22px] pt-7">
      <NuxtLink to="/history" class="absolute right-[22px] top-6 flex h-11 items-center gap-1.5 rounded-full border border-edge bg-white px-3.5 text-[13px] font-semibold text-ink" data-testid="to-history">
        <UIcon name="i-lucide-calendar" class="size-4" />{{ t('review.history') }}
      </NuxtLink>
      <span class="pr-28 text-[13px] font-medium text-soft" data-testid="review-today">{{ todayLine }}</span>
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
          <span class="text-[13px] font-semibold" :class="picked.length >= topN ? 'text-brand' : 'text-soft'">{{ picked.length }}/{{ topN }}</span>
        </div>

        <div v-for="task in picked" :key="task.id" class="flex min-h-[48px] items-center gap-3 border-b border-rule2 last:border-b-0" data-testid="tomorrow-pick">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-white"><UIcon name="i-lucide-check" class="size-4" /></span>
          <span class="min-w-0 grow text-[14px] font-medium">{{ task.title }} <span v-if="isCarried(task)" class="font-normal text-soft">{{ t('review.carried') }}</span></span>
          <BoxBadge :box="task.box" />
          <button v-if="task.planDate" type="button" class="tap -mr-2 text-soft" :aria-label="t('common.remove')" @click="unplan(task.id)"><UIcon name="i-lucide-x" class="size-4" /></button>
        </div>

        <button
          v-for="task in suggestions"
          :key="task.id"
          type="button"
          class="flex min-h-[48px] items-center gap-3 border-b border-rule2 text-left last:border-b-0"
          :aria-label="`${t('common.add')}: ${task.title}`"
          data-testid="tomorrow-suggestion"
          @click="add(task)"
        >
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-ringc text-soft"><UIcon name="i-lucide-plus" class="size-3.5" /></span>
          <span class="min-w-0 grow text-[14px] text-soft">{{ task.title }} <span v-if="isCarried(task)">{{ t('review.carried') }}</span></span>
          <BoxBadge :box="task.box" />
        </button>

        <span v-if="!picked.length && !suggestions.length" class="py-2 text-[13px] text-soft">{{ t('review.noSuggestions') }}</span>

        <button v-if="picked.length < topN && active.length" type="button" class="my-2 h-11 whitespace-nowrap rounded-xl border border-dashed border-ringc text-[14px] text-soft" data-testid="pick-more" @click="pickerOpen = true">
          {{ t('review.pickMore', { n: topN - picked.length }) }}
        </button>
      </section>
    </div>

    <TaskPickerSheet v-model:open="pickerOpen" :day="tomorrow" />
    <TabBar />
  </div>
</template>
