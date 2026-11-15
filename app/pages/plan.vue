<script setup lang="ts">
import type { Box, Task } from '~/types'

const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const { openSort, openTask } = useSheets()
const { inbox, active, routines, byBox, clearBox, addToTop3, removeFromTop3 } = useTasks()
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
/** Clear the Drop box in one tap; the toast can bring the tasks back. */
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

function sub(task: Task) {
  const parts: string[] = []
  if (task.sessionMin) parts.push(t('common.min', { n: task.sessionMin }))
  if (task.checklist?.length) parts.push(`✓ ${task.checklist.filter(c => c.done).length}/${task.checklist.length}`)
  return parts.join(' · ')
}
/** One tap on the star: add to / remove from today's Top list. */
async function toggleTop(task: Task) {
  if (task.top3Date === runtime.today) await removeFromTop3(task.id)
  else if (!(await addToTop3(task.id))) toast.add({ title: t('task.top3Full', { top: topN.value }), color: 'warning' })
}
const cells: Box[] = [1, 2, 3, 4]

// Search every open task and habit by title, note or checklist item.
const searching = ref(false)
const query = ref('')
const searchEl = ref<HTMLInputElement | null>(null)
function openSearch() {
  searching.value = true
  nextTick(() => searchEl.value?.focus())
}
function closeSearch() {
  searching.value = false
  query.value = ''
}
const results = computed(() => {
  const q = query.value.trim().toLocaleLowerCase()
  if (!q) return []
  const hit = (x: Task) => [x.title, x.description || '', ...(x.checklist || []).map(c => c.text)].some(s => s.toLocaleLowerCase().includes(q))
  return [...active.value, ...routines.value, ...inbox.value].filter(hit)
})
</script>

<template>
  <div data-testid="page-plan" style="padding-bottom: calc(120px + env(safe-area-inset-bottom))">
    <div class="flex items-end justify-between gap-3 px-[22px] pt-7">
      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="truncate text-[13px] font-medium text-soft">{{ t('plan.subtitle') }}</span>
        <h1 class="display m-0 text-[34px] font-bold">{{ t('plan.title') }}</h1>
      </div>
      <button v-if="!searching" type="button" class="tap -mr-2 mb-1 shrink-0 text-ink" :aria-label="t('plan.search')" data-testid="plan-search" @click="openSearch">
        <UIcon name="i-lucide-search" class="size-[22px]" />
      </button>
    </div>

    <div v-if="searching" class="mx-[22px] mt-4 flex items-center gap-2">
      <div class="flex h-12 min-w-0 grow items-center gap-2 rounded-[14px] border-2 border-brand bg-card px-3">
        <UIcon name="i-lucide-search" class="size-5 shrink-0 text-soft" />
        <input ref="searchEl" v-model="query" type="search" enterkeyhint="search" class="min-w-0 grow bg-transparent text-[16px] text-ink outline-none placeholder:text-faint" :placeholder="t('plan.searchPlaceholder')" :aria-label="t('plan.search')" data-testid="plan-search-input" @keydown.esc="closeSearch">
      </div>
      <button type="button" class="tap shrink-0 whitespace-nowrap px-1 text-[14px] font-semibold text-brand" data-testid="plan-search-close" @click="closeSearch">{{ t('common.cancel') }}</button>
    </div>
    <div v-if="searching && query.trim()" class="mx-[22px] mt-3 flex flex-col gap-2" data-testid="search-results">
      <div v-if="results.length" class="card flex flex-col overflow-hidden">
        <button v-for="task in results" :key="task.id" type="button" class="flex min-h-[52px] items-center gap-3 border-b border-rule2 px-4 py-2.5 text-left last:border-b-0" data-testid="search-row" @click="task.status === 'inbox' ? openSort(task.id) : openTask(task.id)">
          <span class="flex min-w-0 grow flex-col">
            <span class="truncate text-[14px] font-medium text-ink">{{ task.title }}</span>
            <span v-if="task.isRoutine" class="text-[12px] text-soft">{{ fmt.repeatLabel(task.repeat) }}</span>
          </span>
          <BoxBadge v-if="task.status !== 'inbox'" :box="task.box" />
        </button>
      </div>
      <p v-else class="m-0 px-1 text-[14px] text-soft" data-testid="search-empty">{{ t('plan.noResults') }}</p>
    </div>


    <div v-show="!(searching && query.trim())" class="mx-[22px] mt-4 flex flex-col gap-4" data-testid="plan-list">
      <!-- Tasks saved before a box was required: open one and pick its box -->
      <section v-if="inbox.length" class="flex flex-col gap-2" data-testid="no-box">
        <h2 class="m-0 flex min-h-[40px] items-center gap-2 text-[13px] font-semibold text-soft">{{ t('plan.noBox') }}<span class="font-medium">{{ inbox.length }}</span></h2>
        <div class="card flex flex-col overflow-hidden">
          <button v-for="task in inbox" :key="task.id" type="button" class="flex min-h-[52px] items-center border-b border-rule2 py-2.5 pl-4 pr-3 text-left last:border-b-0" data-testid="no-box-row" @click="openSort(task.id)">
            <span class="min-w-0 grow truncate text-[14px] font-medium text-ink" :title="task.title">{{ task.title }}</span>
            <UIcon name="i-lucide-chevron-right" class="size-[18px] shrink-0 text-soft" />
          </button>
        </div>
      </section>
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
        <button v-if="b === 4 && byBox(4).length && !isCollapsed(4)" type="button" class="-mt-1 flex min-h-[40px] items-center gap-1.5 self-end whitespace-nowrap px-1 text-[13px] font-semibold text-b1-tx" data-testid="clear-all" @click="clearDrop">
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
            <span class="text-[12px] text-soft">{{ [fmt.repeatLabel(r.repeat), r.sessionMin ? t('dur.m', { n: r.sessionMin }) : ''].filter(Boolean).join(' · ') }}</span>
          </span>
          <BoxBadge :box="r.box" short />
        </button>
      </div>
    </section>

    <TabBar />
  </div>
</template>
