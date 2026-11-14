<script setup lang="ts">
import type { FocusSession, HistoryEvent, Task } from '~/types'

const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const toast = useToast()
const { openSort } = useSheets()
const { inbox, top3, active, top3For, planFor, unplan } = useTasks()

const { data: sessions } = useLiveQuery(db => db.sessions.where('date').equals(runtime.today).toArray(), [] as FocusSession[], [() => runtime.today])
const { data: events } = useLiveQuery(db => db.events.where('date').equals(runtime.today).toArray(), [] as HistoryEvent[], [() => runtime.today])

// Step 1 — the day at a glance
const focusMin = computed(() => sessions.value.reduce((n, s) => n + s.actualMin, 0))
const doneToday = computed(() => events.value.filter(e => e.type === 'done').length)
const top3Done = computed(() => top3.value.filter(x => x.status === 'done').length)
const byBoxMin = computed(() => BOXES.map(b => ({ box: b, min: sessions.value.filter(s => s.box === b).reduce((n, s) => n + s.actualMin, 0) })))
const share = (box: number) => focusMin.value ? Math.round((byBoxMin.value[box - 1]!.min / focusMin.value) * 100) : 0
const message = computed(() => {
  if (!focusMin.value) return t('review.msgNone')
  const p2 = share(2)
  if (p2 >= 50) return t('review.msgBox2Half')
  if (share(1) >= 50) return t('review.msgBox1')
  if (share(3) + share(4) >= 50) return t('review.msgBox34')
  return t('review.msgBox2Some', { p: p2 })
})
const summary = computed(() => top3.value.length
  ? t('review.summary', { done: top3Done.value, total: top3.value.length, time: fmt.duration(focusMin.value) })
  : t('review.summaryFree', { done: doneToday.value, time: fmt.duration(focusMin.value) }))

// Step 3 — tomorrow's Top 3: carry over unfinished, then box 1, then box 2
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
async function finish() {
  // Accept the remaining suggestions that the user did not remove: nothing is added silently.
  toast.add({ title: t('review.doneToast'), color: 'success', icon: 'i-lucide-moon' })
  await navigateTo('/')
}
const stepDot = 'flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white'
</script>

<template>
  <div data-testid="page-review" style="padding-bottom: calc(110px + env(safe-area-inset-bottom))">
    <div class="relative flex flex-col gap-0.5 px-[22px] pt-7">
      <NuxtLink to="/history" class="absolute right-[22px] top-6 flex h-11 items-center gap-1.5 rounded-full border border-edge bg-white px-3.5 text-[13px] font-semibold text-ink" data-testid="to-history">
        <UIcon name="i-lucide-calendar" class="size-4" />{{ t('review.history') }}
      </NuxtLink>
      <span class="pr-28 text-[13px] font-medium text-soft">{{ t('review.sub') }}</span>
      <h1 class="display m-0 text-[34px] font-bold">{{ t('review.title') }}</h1>
    </div>

    <div class="flex flex-col gap-3 px-[22px] pt-[18px]">
      <section class="card flex flex-col gap-3 !rounded-[18px] p-4" data-testid="review-step1">
        <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span :class="stepDot">1</span>
          <span class="grow text-[15px] font-semibold">{{ t('review.step1') }}</span>
          <span class="text-[13px] text-soft">{{ summary }}</span>
        </div>
        <div class="flex h-3 gap-0.5 overflow-hidden rounded-full" :class="focusMin ? '' : 'bg-edge'" role="img" :aria-label="byBoxMin.map(b => `${fmt.boxLabel(b.box)}: ${fmt.duration(b.min)}`).join(', ')">
          <template v-for="b in byBoxMin" :key="b.box">
            <div v-if="b.min" :style="{ width: `${(b.min / focusMin) * 100}%`, background: BOX_STYLES[b.box].solid }" />
          </template>
        </div>
        <div v-if="focusMin" class="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-soft">
          <template v-for="b in byBoxMin" :key="b.box">
            <span v-if="b.min" class="flex items-center gap-1.5"><span class="size-2 rounded-full" :style="{ background: BOX_STYLES[b.box].solid }" />{{ t(`box.${b.box}`) }} {{ fmt.duration(b.min) }}</span>
          </template>
        </div>
        <span class="text-[13px] font-medium text-brand-dark">{{ message }}</span>
      </section>

      <section class="card flex items-center gap-2.5 !rounded-[18px] p-4" data-testid="review-step2">
        <span :class="stepDot">2</span>
        <span class="flex grow flex-col gap-0.5">
          <span class="text-[15px] font-semibold">{{ t('review.step2') }}</span>
          <span class="text-[13px] text-soft">{{ inbox.length ? t('review.inboxCount', inbox.length) : t('review.inboxEmpty') }}</span>
        </span>
        <button v-if="inbox.length" type="button" class="flex h-11 items-center rounded-[10px] bg-ink px-3.5 text-[13px] font-semibold text-white" @click="openSort()">
          {{ t('review.sort') }}
        </button>
        <UIcon v-else name="i-lucide-circle-check" class="size-6 text-brand" />
      </section>

      <section class="card flex flex-col gap-2 !rounded-[18px] p-4" data-testid="review-step3">
        <div class="mb-1 flex items-center gap-2.5">
          <span :class="stepDot">3</span>
          <span class="grow text-[15px] font-semibold">{{ t('review.step3', { top: topN }) }}</span>
          <span class="text-[13px] text-soft">{{ picked.length }}/{{ topN }}</span>
        </div>
        <div v-for="task in picked" :key="task.id" class="flex min-h-[44px] items-center gap-2.5" data-testid="tomorrow-pick">
          <UIcon name="i-lucide-circle-check" class="size-5 shrink-0 text-brand" />
          <span class="min-w-0 grow text-[14px]">{{ task.title }} <span v-if="isCarried(task)" class="text-soft">{{ t('review.carried') }}</span></span>
          <BoxBadge :box="task.box" />
          <button v-if="task.planDate" type="button" class="tap -mr-2 text-soft" :aria-label="t('common.remove')" @click="unplan(task.id)"><UIcon name="i-lucide-x" class="size-4" /></button>
        </div>
        <template v-if="suggestions.length">
          <span class="caps mt-1 text-[11px] font-semibold text-soft">{{ t('review.suggested') }}</span>
          <div v-for="task in suggestions" :key="task.id" class="flex min-h-[44px] items-center gap-2.5" data-testid="tomorrow-suggestion">
            <span class="min-w-0 grow text-[14px] text-soft">{{ task.title }} <span v-if="isCarried(task)">{{ t('review.carried') }}</span></span>
            <BoxBadge :box="task.box" />
            <button type="button" class="flex h-11 shrink-0 items-center gap-1 rounded-[10px] border border-edge bg-white px-3 text-[13px] font-semibold text-ink" @click="add(task)">
              <UIcon name="i-lucide-plus" class="size-4" />{{ t('common.add') }}
            </button>
          </div>
        </template>
        <span v-else-if="!picked.length" class="text-[13px] text-soft">{{ t('review.noSuggestions') }}</span>
        <button v-if="picked.length < 3 && active.length" type="button" class="mt-1 h-11 rounded-xl border border-dashed border-ringc text-[14px] text-soft" data-testid="pick-more" @click="pickerOpen = true">
          {{ t('review.pickMore', { n: topN - picked.length }) }}
        </button>
      </section>

      <UButton block size="xl" color="neutral" class="mt-1 h-14 rounded-2xl text-[16px] font-semibold" :label="t('review.doneToday')" data-testid="review-done" @click="finish" />
    </div>

    <TaskPickerSheet v-model:open="pickerOpen" :day="tomorrow" />
    <TabBar />
  </div>
</template>
