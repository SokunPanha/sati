<script setup lang="ts">
import type { Box, FocusSession, HistoryEvent, RoutineLog } from '~/types'

const { t } = useI18n()
const fmt = useFmt()
const { settings } = useSettings()

type Mode = 'day' | 'week' | 'month' | 'custom'
const mode = ref<Mode>('week')
const anchor = ref(runtime.today)
const customFrom = ref(addDays(runtime.today, -13))
const customTo = ref(runtime.today)
const selectedDay = ref<string | null>(null)
const showFilter = ref(false)
const filterBox = ref<0 | Box>(0)
const filterArea = ref('')

const modeOptions = computed(() => (['day', 'week', 'month', 'custom'] as const).map(v => ({ value: v, label: t(`history.${v}`) })))
watch(mode, () => { selectedDay.value = null })

const weekStart = computed(() => settings.value.weekStart)
const range = computed(() => {
  if (mode.value === 'day') return { from: anchor.value, to: anchor.value }
  if (mode.value === 'week') {
    const from = startOfWeek(anchor.value, weekStart.value)
    return { from, to: addDays(from, 6) }
  }
  if (mode.value === 'month') return { from: startOfMonth(anchor.value), to: endOfMonth(anchor.value) }
  const from = customFrom.value <= customTo.value ? customFrom.value : customTo.value
  const to = customFrom.value <= customTo.value ? customTo.value : customFrom.value
  return { from, to }
})
/** days drawn in the bar chart (Day mode shows its whole week for context) */
const chartDays = computed(() => {
  if (mode.value === 'day') {
    const from = startOfWeek(anchor.value, weekStart.value)
    return rangeDays(from, addDays(from, 6))
  }
  return rangeDays(range.value.from, range.value.to).slice(-62)
})
const chartFrom = computed(() => chartDays.value[0] || range.value.from)
const chartTo = computed(() => chartDays.value[chartDays.value.length - 1] || range.value.to)
const deps = [() => chartFrom.value, () => chartTo.value]

const { data: sessions } = useLiveQuery(db => db.sessions.where('date').between(chartFrom.value, chartTo.value, true, true).toArray(), [] as FocusSession[], deps)
const { data: events } = useLiveQuery(db => db.events.where('date').between(chartFrom.value, chartTo.value, true, true).toArray(), [] as HistoryEvent[], deps)
const { data: logs } = useLiveQuery(db => db.routineLogs.where('date').between(chartFrom.value, chartTo.value, true, true).toArray(), [] as RoutineLog[], deps)

const pass = (x: { box: Box | null, area: string }) => (!filterBox.value || x.box === filterBox.value) && (!filterArea.value || x.area === filterArea.value)
const fSessions = computed(() => sessions.value.filter(pass))
const fEvents = computed(() => events.value.filter(pass))
const fLogs = computed(() => logs.value.filter(pass))
const filtered = computed(() => !!filterBox.value || !!filterArea.value)
const areaOptions = computed(() => Array.from(new Set([...settings.value.areas, ...sessions.value.map(s => s.area), ...events.value.map(e => e.area)].filter(Boolean))))

const minutesByDay = computed(() => {
  const map: Record<string, number> = {}
  for (const s of fSessions.value) map[s.date] = (map[s.date] || 0) + s.actualMin
  return map
})
const maxMin = computed(() => Math.max(30, ...chartDays.value.map(d => minutesByDay.value[d] || 0)))
const activeDay = computed(() => mode.value === 'day' ? anchor.value : selectedDay.value)

function tapBar(day: string) {
  if (day > runtime.today) return
  if (mode.value === 'day') anchor.value = day
  else selectedDay.value = selectedDay.value === day ? null : day
}

const viewDays = computed(() => {
  const days = activeDay.value ? [activeDay.value] : rangeDays(range.value.from, range.value.to)
  return days.filter(d => d <= runtime.today).reverse()
})
const inView = (d: string) => viewDays.value.includes(d)
const totals = computed(() => {
  const ss = fSessions.value.filter(s => inView(s.date))
  const total = ss.reduce((n, s) => n + s.actualMin, 0)
  const box2 = ss.filter(s => s.box === 2).reduce((n, s) => n + s.actualMin, 0)
  return {
    done: fEvents.value.filter(e => e.type === 'done' && inView(e.date)).length,
    focus: total,
    box2: total ? Math.round((box2 / total) * 100) : 0
  }
})

interface Entry { key: string, at: number, title: string, box: Box | null, sub: string, warn: boolean }
const timeline = computed(() => viewDays.value.map((day) => {
  const groups = new Map<string, { title: string, box: Box | null, at: number, min: number, count: number, early: number, done: boolean, routine: boolean, routineMin: number }>()
  const grab = (key: string, title: string, box: Box | null, at: number) => {
    if (!groups.has(key)) groups.set(key, { title, box, at, min: 0, count: 0, early: 0, done: false, routine: false, routineMin: 0 })
    const g = groups.get(key)!
    g.at = Math.max(g.at, at)
    return g
  }
  for (const s of fSessions.value.filter(x => x.date === day)) {
    const g = grab(s.taskId || s.title, s.title, s.box, s.endAt)
    g.min += s.actualMin
    g.count++
    if (s.endedEarly) g.early++
  }
  for (const e of fEvents.value.filter(x => x.date === day && x.type === 'done')) grab(e.taskId || e.title, e.title, e.box, e.at).done = true
  for (const l of fLogs.value.filter(x => x.date === day)) {
    const g = grab(l.taskId, l.title, l.box, l.doneAt)
    g.routine = true
    g.routineMin = l.minutes
  }
  const entries: Entry[] = Array.from(groups.entries()).map(([key, g]) => {
    const parts: string[] = []
    if (g.routine) parts.push(t('history.routine'))
    else if (g.done) parts.push(t('history.done'))
    if (g.count) parts.push(t('common.sessions', g.count), fmt.duration(g.min))
    else if (g.routine && g.routineMin) parts.push(fmt.duration(g.routineMin))
    if (g.early && !g.done) parts.push(t('history.endedEarly'))
    return { key, at: g.at, title: g.title, box: g.box, sub: parts.join(' · '), warn: false }
  })
  for (const e of fEvents.value.filter(x => x.date === day && x.type === 'carried')) {
    entries.push({ key: e.id, at: e.at, title: e.title, box: e.box, sub: t('history.notFinished', { date: fmt.weekdayShort(e.toDate || day) }), warn: true })
  }
  entries.sort((a, b) => b.at - a.at)
  const captured = filtered.value ? 0 : events.value.filter(x => x.date === day && x.type === 'captured').length
  const early = fSessions.value.filter(x => x.date === day && x.endedEarly).length
  const foot = [captured ? t('history.captured', captured) : '', early ? t('history.earlyCount', early) : ''].filter(Boolean).join(' · ')
  return { day, entries, foot, focus: minutesByDay.value[day] || 0 }
}).filter(d => d.entries.length || d.foot))

const rangeLabel = computed(() => {
  if (mode.value === 'day') return fmt.relativeDay(anchor.value) === fmt.date(anchor.value) ? fmt.date(anchor.value) : `${fmt.relativeDay(anchor.value)} · ${fmt.date(anchor.value)}`
  if (mode.value === 'month') return fmt.monthYear(anchor.value)
  return `${fmt.shortDate(range.value.from)} – ${fmt.shortDate(range.value.to)}`
})
const canNext = computed(() => range.value.to < runtime.today)
function shift(dir: number) {
  selectedDay.value = null
  if (mode.value === 'day') anchor.value = addDays(anchor.value, dir)
  else if (mode.value === 'week') anchor.value = addDays(anchor.value, 7 * dir)
  else if (mode.value === 'month') anchor.value = addMonths(startOfMonth(anchor.value), dir)
}
const dayTitle = (day: string) => day === runtime.today ? `${t('common.today')} · ${fmt.date(day)}` : fmt.date(day)
</script>

<template>
  <div class="flex flex-col gap-[18px] px-[22px] pb-10 pt-4" data-testid="page-history">
    <PageHeader :title="t('history.title')" back="/review">
      <button type="button" class="flex h-11 items-center gap-1.5 rounded-[10px] border bg-white px-3 text-[13px] font-medium text-ink" :class="filtered ? 'border-brand' : 'border-edge'" :aria-expanded="showFilter" data-testid="history-filter" @click="showFilter = !showFilter">
        <UIcon name="i-lucide-funnel" class="size-4" />{{ t('history.filter') }}
      </button>
    </PageHeader>

    <div v-if="showFilter" class="card flex flex-col gap-3 p-3">
      <div class="flex flex-wrap gap-1.5">
        <button type="button" class="h-10 rounded-full px-3 text-[13px]" :class="!filterBox ? 'bg-ink font-semibold text-white' : 'border border-edge text-ink'" @click="filterBox = 0">{{ t('history.allBoxes') }}</button>
        <button
          v-for="b in BOXES"
          :key="b"
          type="button"
          :aria-pressed="filterBox === b"
          class="h-10 rounded-full px-3 text-[13px] font-semibold"
          :style="{ background: BOX_STYLES[b].bg, color: BOX_STYLES[b].tx, boxShadow: filterBox === b ? `inset 0 0 0 2px ${BOX_STYLES[b].solid}` : 'none' }"
          @click="filterBox = b"
        >
          {{ fmt.boxLabel(b) }}
        </button>
      </div>
      <div class="relative">
        <select v-model="filterArea" class="field h-11 cursor-pointer appearance-none truncate !rounded-xl pr-10 !text-[14px]" :aria-label="t('history.allAreas')">
          <option value="">{{ t('history.allAreas') }}</option>
          <option v-for="a in areaOptions" :key="a" :value="a">{{ a }}</option>
        </select>
        <UIcon name="i-lucide-chevron-down" class="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-soft" />
      </div>
    </div>

    <SegmentedControl v-model="mode" :options="modeOptions" />

    <div class="flex flex-col gap-2.5">
      <div v-if="mode !== 'custom'" class="flex items-center justify-between">
        <button type="button" class="tap rounded-full text-ink" :aria-label="t('history.prev')" @click="shift(-1)"><UIcon name="i-lucide-chevron-left" class="size-[18px]" /></button>
        <span class="text-[15px] font-semibold" data-testid="history-range">{{ rangeLabel }}</span>
        <button type="button" class="tap rounded-full" :class="canNext ? 'text-ink' : 'text-ringc'" :disabled="!canNext" :aria-label="t('history.next')" @click="shift(1)"><UIcon name="i-lucide-chevron-right" class="size-[18px]" /></button>
      </div>
      <div v-else class="grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1 text-[12px] text-soft">{{ t('history.from') }}<input v-model="customFrom" type="date" :max="runtime.today" class="field !rounded-xl !text-[14px]"></label>
        <label class="flex flex-col gap-1 text-[12px] text-soft">{{ t('history.to') }}<input v-model="customTo" type="date" :max="runtime.today" class="field !rounded-xl !text-[14px]"></label>
      </div>

      <div class="grid h-24 items-end" :style="{ gridTemplateColumns: `repeat(${chartDays.length}, minmax(0, 1fr))`, gap: chartDays.length > 14 ? '2px' : '4px' }" data-testid="history-chart">
        <button
          v-for="d in chartDays"
          :key="d"
          type="button"
          :disabled="d > runtime.today"
          :aria-pressed="activeDay === d"
          :aria-label="`${fmt.date(d)}: ${fmt.duration(minutesByDay[d] || 0)}`"
          class="flex h-24 flex-col items-center justify-end gap-1.5"
          @click="tapBar(d)"
        >
          <span
            class="rounded-md"
            :class="[chartDays.length > 14 ? 'w-full max-w-[14px]' : 'w-[22px]', !(minutesByDay[d]) ? 'bg-edge' : (activeDay === d || (!activeDay && d === runtime.today) ? 'bg-brand' : 'bg-brand-soft')]"
            :style="{ height: `${minutesByDay[d] ? Math.max(6, Math.round((minutesByDay[d]! / maxMin) * 64)) : 4}px` }"
          />
          <span v-if="chartDays.length <= 14" class="text-[11px] leading-none" :class="activeDay === d ? 'font-bold text-brand' : (d > runtime.today ? 'text-faint' : 'text-soft')">{{ fmt.weekdayNarrow(d) }}</span>
          <span v-else class="text-[9px] leading-none text-soft">{{ parseYmd(d).getDate() % 5 === 0 || parseYmd(d).getDate() === 1 ? parseYmd(d).getDate() : '' }}&nbsp;</span>
        </button>
      </div>
      <span class="text-center text-[12px] text-soft">{{ t('history.chartHint') }}</span>
      <button v-if="selectedDay" type="button" class="mx-auto flex h-11 items-center rounded-full border border-edge bg-white px-4 text-[13px] font-medium" @click="selectedDay = null">{{ t('history.showAll') }}</button>
    </div>

    <div class="grid grid-cols-3 gap-2" data-testid="history-totals">
      <div class="card flex flex-col gap-0.5 !rounded-[14px] p-3"><span class="display text-[22px] font-semibold">{{ totals.done }}</span><span class="text-[12px] text-soft">{{ t('history.tasksDone') }}</span></div>
      <div class="card flex flex-col gap-0.5 !rounded-[14px] p-3"><span class="display text-[22px] font-semibold">{{ fmt.duration(totals.focus) }}</span><span class="text-[12px] text-soft">{{ t('history.focusTime') }}</span></div>
      <div class="flex flex-col gap-0.5 rounded-[14px] bg-brand-tint p-3 text-brand-dark"><span class="display text-[22px] font-semibold">{{ totals.box2 }}%</span><span class="text-[12px]">{{ t('history.inBox2') }}</span></div>
    </div>

    <p v-if="!timeline.length" class="card m-0 p-4 text-center text-[14px] text-soft" data-testid="history-empty">{{ t('history.noData') }}</p>

    <section v-for="d in timeline" :key="d.day" class="flex flex-col gap-2.5" data-testid="history-day">
      <div class="flex items-baseline justify-between">
        <h2 class="m-0 text-[15px] font-semibold">{{ dayTitle(d.day) }}</h2>
        <span v-if="d.focus" class="text-[12px] text-soft">{{ t('history.focusOfDay', { time: fmt.duration(d.focus) }) }}</span>
      </div>
      <div class="card flex flex-col px-4 py-1">
        <div v-for="e in d.entries" :key="e.key" class="flex items-start gap-3 border-b border-rule2 py-3 last:border-b-0" data-testid="history-entry">
          <span class="w-[52px] shrink-0 pt-0.5 text-[12px] text-soft">{{ e.warn ? '' : fmt.time(e.at) }}</span>
          <div class="flex min-w-0 grow flex-col gap-1">
            <span class="text-[14px] font-medium">{{ e.title }}</span>
            <span class="text-[12px]" :class="e.warn ? 'text-b1-tx' : 'text-soft'">{{ e.sub }}</span>
          </div>
          <BoxBadge v-if="e.box" :box="e.box" short />
        </div>
        <div v-if="d.foot" class="py-3 text-[14px] text-soft" :class="d.entries.length ? 'border-t border-rule2' : ''">{{ d.foot }}</div>
      </div>
    </section>
  </div>
</template>
