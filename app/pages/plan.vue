<script setup lang="ts">
import type { Box, Task } from '~/types'

const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const { openSort, openTask } = useSheets()
const { inbox, routines, byBox, clearBox, addToTop3, removeFromTop3 } = useTasks()
const toast = useToast()
const { startBatch } = useFocus()

// List view is the default; the chosen view and collapsed sections are remembered on this device.
const VIEW_KEY = 'sati-plan-view'
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
const view = ref<'matrix' | 'list'>(readStore(VIEW_KEY, 'list') === 'matrix' ? 'matrix' : 'list')
watch(view, v => writeStore(VIEW_KEY, v))
/** collapsed sections in list view: box numbers and 'routines' */
const collapsed = ref<Array<Box | 'routines'>>(readStore(COLLAPSED_KEY, []))
const isCollapsed = (k: Box | 'routines') => collapsed.value.includes(k)
function toggleSection(k: Box | 'routines') {
  collapsed.value = isCollapsed(k) ? collapsed.value.filter(x => x !== k) : [...collapsed.value, k]
  writeStore(COLLAPSED_KEY, collapsed.value)
}
const viewOptions = computed(() => [
  { value: 'matrix' as const, label: t('plan.viewMatrix'), icon: 'i-lucide-layout-grid' },
  { value: 'list' as const, label: t('plan.viewList'), icon: 'i-lucide-list' }
])
const MAX = 3
const clearOpen = ref(false)

function sub(task: Task) {
  return [task.area, task.dueDate ? fmt.shortDate(task.dueDate) : ''].filter(Boolean).join(' · ')
}
/** One tap on the star: add to / remove from today's Top list. */
async function toggleTop(task: Task) {
  if (task.top3Date === runtime.today) await removeFromTop3(task.id)
  else if (!(await addToTop3(task.id))) toast.add({ title: t('task.top3Full', { top: topN.value }), color: 'warning' })
}
async function batch() {
  const list = byBox(3)
  if (!list.length) return
  await startBatch(list, t('plan.batchTitle', { n: list.length }), Math.min(45, Math.max(15, list.length * 10)))
  await navigateTo('/focus')
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
      <SegmentedControl v-model="view" :options="viewOptions" class="mb-1.5 w-[168px] shrink-0" />
    </div>

    <button v-if="inbox.length" type="button" class="mx-[22px] mt-4 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-left text-white" style="width: calc(100% - 44px)" data-testid="inbox-bar" @click="openSort()">
      <span class="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-cream text-[14px] font-bold text-ink">{{ inbox.length }}</span>
      <span class="flex grow flex-col">
        <span class="text-[15px] font-semibold">{{ t('plan.inbox', { n: inbox.length }) }}</span>
        <span class="text-[12px] text-ringc">{{ t('plan.inboxSub') }}</span>
      </span>
      <span class="text-[14px] font-semibold text-mint">{{ t('plan.sort') }}</span>
    </button>

    <!-- 2×2 urgent / important matrix -->
    <template v-if="view === 'matrix'">
      <div class="caps mx-[22px] mt-4 grid grid-cols-2 gap-2 text-center text-[11px] font-semibold text-soft">
        <span>{{ t('plan.urgent') }}</span><span>{{ t('plan.notUrgent') }}</span>
      </div>
      <div class="mx-[22px] mt-1.5 grid grid-cols-2 gap-2" data-testid="matrix">
        <section
          v-for="b in cells"
          :key="b"
          class="flex flex-col gap-2 rounded-[18px] p-3"
          :class="b <= 2 ? 'min-h-[232px]' : 'min-h-[200px]'"
          :style="{ background: BOX_STYLES[b].bg, boxShadow: b === 2 ? 'inset 0 0 0 2px #0F6E64' : 'none' }"
          :data-testid="`box-${b}`"
        >
          <h2 class="display m-0 text-[16px] font-semibold" :style="{ color: BOX_STYLES[b].tx }">{{ fmt.boxLabel(b) }}</h2>
          <button
            v-for="task in byBox(b).slice(0, MAX)"
            :key="task.id"
            type="button"
            class="flex min-h-[44px] flex-col justify-center gap-0.5 rounded-[10px] bg-white px-2.5 py-2 text-left"
            data-testid="matrix-task"
            @click="openTask(task.id)"
          >
            <span class="flex min-w-0 items-start gap-1 text-[13px] leading-snug" :class="b === 4 ? 'text-soft' : 'font-medium text-ink'">
              <UIcon v-if="task.top3Date === runtime.today" name="i-lucide-star" class="mt-0.5 size-3 shrink-0 text-brand" :aria-label="t('plan.inTop3', { top: topN })" />
              <span class="truncate" :title="task.title">{{ task.title }}</span>
            </span>
            <span v-if="sub(task)" class="truncate text-[11px] text-soft">{{ sub(task) }}</span>
          </button>
          <span v-if="!byBox(b).length" class="text-[12px] opacity-60" :style="{ color: BOX_STYLES[b].tx }">{{ t('plan.empty') }}</span>

          <div class="mt-auto flex flex-col gap-1.5">
            <button v-if="byBox(b).length > MAX" type="button" class="min-h-[32px] text-left text-[11px] font-semibold" :style="{ color: BOX_STYLES[b].tx }" @click="view = 'list'">
              {{ t('plan.more', { n: byBox(b).length - MAX }) }}
            </button>
            <span v-if="b === 1" class="text-[11px]" :style="{ color: BOX_STYLES[1].tx }">{{ t('plan.first', { top: topN }) }}</span>
            <span v-else-if="b === 2" class="text-[11px] font-semibold" :style="{ color: BOX_STYLES[2].tx }">{{ t('plan.protect') }}</span>
            <button v-else-if="b === 3" type="button" class="min-h-[44px] rounded-[10px] bg-white px-2 text-[12px] font-semibold disabled:opacity-50" :style="{ color: BOX_STYLES[3].tx }" :disabled="!byBox(3).length" data-testid="batch" @click="batch">
              {{ t('plan.batch') }}
            </button>
            <button v-else type="button" class="min-h-[44px] rounded-[10px] bg-white px-2 text-[12px] font-semibold disabled:opacity-50" :style="{ color: BOX_STYLES[4].tx }" :disabled="!byBox(4).length" data-testid="clear-all" @click="clearOpen = true">
              {{ t('plan.clearAll') }}
            </button>
          </div>
        </section>
      </div>
      <p class="mx-[22px] mt-2 text-center text-[11px] text-soft">{{ t('plan.tapHint', { top: topN }) }}</p>
    </template>

    <!-- List view: every task, grouped by box -->
    <div v-else class="mx-[22px] mt-4 flex flex-col gap-4" data-testid="plan-list">
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
            <span class="text-[12px] text-soft">{{ [fmt.repeatLabel(r.repeat), t('dur.m', { n: r.sessionMin }), r.area].filter(Boolean).join(' · ') }}</span>
          </span>
          <BoxBadge :box="r.box" short />
        </button>
      </div>
    </section>

    <ConfirmModal v-model:open="clearOpen" :title="t('plan.clearTitle')" :body="t('plan.clearBody', { n: byBox(4).length })" :confirm-label="t('plan.clearAll')" danger @confirm="clearBox(4)" />
    <TabBar />
  </div>
</template>
