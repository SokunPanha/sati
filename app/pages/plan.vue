<script setup lang="ts">
import type { Box, Task } from '~/types'

const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const { openSort, openTask } = useSheets()
const { inbox, routines, byBox, clearBox, addToTop3, removeFromTop3 } = useTasks()
const toast = useToast()

// Every task, grouped by box. Collapsed sections are remembered on this device.
const COLLAPSED_KEY = 'sati-plan-collapsed'
function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  }
  catch {
    return fallback
  }
}
function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  }
  catch { /* storage unavailable: keep it in memory only */ }
}
/** collapsed sections in list view: box numbers and 'routines' */
const collapsed = ref<Array<Box | 'routines'>>(readStore(COLLAPSED_KEY, []))
const isCollapsed = (k: Box | 'routines') => collapsed.value.includes(k)
function toggleSection(k: Box | 'routines') {
  collapsed.value = isCollapsed(k) ? collapsed.value.filter(x => x !== k) : [...collapsed.value, k]
  writeStore(COLLAPSED_KEY, collapsed.value)
}
const clearOpen = ref(false)

function sub(task: Task) {
  return t('common.min', { n: task.sessionMin })
}
/** One tap on the star: add to / remove from today's Top list. */
async function toggleTop(task: Task) {
  if (task.top3Date === runtime.today) await removeFromTop3(task.id)
  else if (!(await addToTop3(task.id))) toast.add({ title: t('task.top3Full', { top: topN.value }), color: 'warning' })
}
const cells: Box[] = [1, 2, 3, 4]
</script>

<template>
  <div data-testid="page-plan" style="padding-bottom: calc(120px + env(safe-area-inset-bottom))">
    <div class="flex items-end justify-between gap-3 px-[22px] pt-7">
      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="truncate text-[13px] font-medium text-soft">{{ t('plan.subtitle') }}</span>
        <h1 class="display m-0 text-[34px] font-bold">{{ t('plan.title') }}</h1>
      </div>
    </div>

    <button v-if="inbox.length" type="button" class="mx-[22px] mt-4 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-left text-white" style="width: calc(100% - 44px)" data-testid="inbox-bar" @click="openSort()">
      <span class="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-cream text-[14px] font-bold text-ink">{{ inbox.length }}</span>
      <span class="flex grow flex-col">
        <span class="text-[15px] font-semibold">{{ t('plan.inbox', { n: inbox.length }) }}</span>
        <span class="text-[12px] text-ringc">{{ t('plan.inboxSub') }}</span>
      </span>
      <span class="text-[14px] font-semibold text-mint">{{ t('plan.sort') }}</span>
    </button>

    <div class="mx-[22px] mt-4 flex flex-col gap-4" data-testid="plan-list">
      <section v-for="b in cells" :key="b" class="flex flex-col gap-2" :data-testid="`box-${b}`">
        <h2 class="m-0">
          <button
            type="button"
            class="-mx-1 flex min-h-[40px] w-[calc(100%+8px)] items-center gap-2 rounded-xl px-1 text-left text-[13px] font-semibold"
            :aria-expanded="!isCollapsed(b)"
            :data-testid="`list-toggle-${b}`"
            @click="toggleSection(b)"
          >
            <BoxBadge :box="b" /><span class="grow text-soft">{{ byBox(b).length }}</span>
            <UIcon name="i-lucide-chevron-down" class="size-[18px] shrink-0 text-soft transition-transform" :class="isCollapsed(b) ? '-rotate-90' : ''" />
          </button>
        </h2>
        <button v-if="b === 4 && byBox(4).length && !isCollapsed(4)" type="button" class="-mt-1 flex min-h-[40px] items-center gap-1.5 self-end whitespace-nowrap px-1 text-[13px] font-semibold text-b1-tx" data-testid="clear-all" @click="clearOpen = true">
          <UIcon name="i-lucide-trash-2" class="size-4" />{{ t('plan.clearAll') }}
        </button>
        <div v-if="byBox(b).length && !isCollapsed(b)" class="card flex flex-col overflow-hidden">
          <div v-for="task in byBox(b)" :key="task.id" class="flex items-center border-b border-rule2 last:border-b-0" data-testid="list-row">
            <button type="button" class="flex min-h-[52px] min-w-0 grow flex-col justify-center py-2.5 pl-4 pr-1 text-left" data-testid="matrix-task" @click="openTask(task.id)">
              <span class="truncate text-[14px] font-medium text-ink" :title="task.title">{{ task.title }}</span>
              <span v-if="sub(task)" class="truncate text-[12px] text-soft">{{ sub(task) }}</span>
            </button>
            <button
              type="button"
              class="tap mr-1.5 shrink-0 rounded-full"
              :aria-pressed="task.top3Date === runtime.today"
              :aria-label="task.top3Date === runtime.today ? t('task.removeTop3', { top: topN }) : t('task.addTop3', { top: topN })"
              data-testid="top-toggle"
              @click="toggleTop(task)"
            >
              <span
                class="flex size-8 items-center justify-center rounded-full"
                :class="task.top3Date === runtime.today ? 'bg-brand text-white' : 'border border-edge text-soft'"
              >
                <UIcon name="i-lucide-star" class="size-4" />
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <section v-if="routines.length" class="mx-[22px] mt-5 flex flex-col gap-2" data-testid="plan-routines">
      <h2 class="m-0">
        <button type="button" class="-mx-1 flex min-h-[40px] w-[calc(100%+8px)] items-center gap-1.5 rounded-xl px-1 text-left text-[15px] font-semibold" :aria-expanded="!isCollapsed('routines')" data-testid="list-toggle-routines" @click="toggleSection('routines')">
          <UIcon name="i-lucide-repeat" class="size-4" /><span class="grow">{{ t('plan.routines') }}</span><span class="text-[13px] font-medium text-soft">{{ routines.length }}</span>
          <UIcon name="i-lucide-chevron-down" class="size-[18px] shrink-0 text-soft transition-transform" :class="isCollapsed('routines') ? '-rotate-90' : ''" />
        </button>
      </h2>
      <div v-if="!isCollapsed('routines')" class="card flex flex-col overflow-hidden">
        <button v-for="r in routines" :key="r.id" type="button" class="flex min-h-[52px] items-center gap-2 border-b border-rule2 px-4 py-2.5 text-left last:border-b-0" data-testid="routine-row" @click="openTask(r.id)">
          <span class="flex min-w-0 grow flex-col">
            <span class="truncate text-[14px] font-medium text-ink" :title="r.title">{{ r.title }}</span>
            <span class="text-[12px] text-soft">{{ [fmt.repeatLabel(r.repeat), t('dur.m', { n: r.sessionMin })].join(' · ') }}</span>
          </span>
          <BoxBadge :box="r.box" short />
        </button>
      </div>
    </section>

    <ConfirmModal v-model:open="clearOpen" :title="t('plan.clearTitle')" :body="t('plan.clearBody', { n: byBox(4).length })" :confirm-label="t('plan.clearAll')" danger @confirm="clearBox(4)" />
    <TabBar />
  </div>
</template>
