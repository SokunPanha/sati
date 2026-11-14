<script setup lang="ts">
import type { Reminder } from '~/types'

const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const { openCapture } = useSheets()
const { upcoming, past } = useReminders()

const tab = ref<'upcoming' | 'past'>('upcoming')
const tabs = computed(() => [{ value: 'upcoming' as const, label: t('reminders.upcoming') }, { value: 'past' as const, label: t('reminders.past') }])
const list = computed(() => tab.value === 'upcoming' ? upcoming.value : past.value)
const groups = computed(() => {
  const out: Array<{ day: string, items: Reminder[] }> = []
  for (const r of list.value) {
    const last = out[out.length - 1]
    if (last && last.day === r.date) last.items.push(r)
    else out.push({ day: r.date, items: [r] })
  }
  return out
})
function alertText(r: Reminder) {
  const a = r.alertBefore === 0 ? t('reminders.alertOnTime') : r.alertBefore === 60 ? t('reminders.alertHour') : t('reminders.alertBefore', { n: r.alertBefore })
  return [r.repeat !== 'none' && t(`repeat.${r.repeat}`), a, r.focusMin && t('reminders.focus', { n: r.focusMin })].filter(Boolean).join(' · ')
}
const dayLabel = (day: string) => day === runtime.today ? `${t('common.today')} · ${fmt.date(day)}` : day === addDays(runtime.today, 1) ? `${t('common.tomorrow')} · ${fmt.date(day)}` : fmt.date(day)
</script>

<template>
  <div class="flex min-h-dvh flex-col gap-[18px] px-[22px] pt-4 pb-safe" data-testid="page-reminders">
    <PageHeader :title="t('reminders.title')" back="/">
      <button type="button" class="flex size-11 items-center justify-center rounded-full bg-rem text-white" :aria-label="t('reminders.new')" data-testid="new-reminder" @click="openCapture('reminder')">
        <UIcon name="i-lucide-plus" class="size-5" />
      </button>
    </PageHeader>

    <SegmentedControl v-model="tab" :options="tabs" />

    <p v-if="!groups.length" class="card m-0 p-4 text-center text-[14px] text-soft">{{ tab === 'upcoming' ? t('reminders.empty') : t('reminders.emptyPast') }}</p>

    <section v-for="g in groups" :key="g.day" class="flex flex-col gap-2">
      <h2 class="section-label caps">{{ dayLabel(g.day) }}</h2>
      <div class="card flex flex-col overflow-hidden">
        <button v-for="r in g.items" :key="r.id" type="button" class="flex min-h-[64px] items-center gap-3.5 border-b border-rule2 px-4 py-2.5 text-left text-ink last:border-b-0" data-testid="reminder-row" @click="openCapture('reminder', r.id)">
          <span class="w-[68px] shrink-0 text-[15px] font-bold leading-tight" :class="r.done ? 'text-soft' : 'text-rem-tx'">{{ fmt.time(r.at) }}</span>
          <span class="flex min-w-0 grow flex-col gap-0.5">
            <span class="text-[15px] font-medium" :class="r.done ? 'text-soft' : ''">{{ r.title }}</span>
            <span class="flex items-center gap-1 text-[12px] text-soft"><UIcon v-if="r.repeat !== 'none'" name="i-lucide-repeat" class="size-3 shrink-0" />{{ alertText(r) }}</span>
          </span>
          <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-soft" />
        </button>
      </div>
    </section>

    <span class="mt-auto text-center text-[12px] text-soft">{{ t('reminders.hint') }}<br>{{ t('reminder.note', { top: topN }) }}</span>
  </div>
</template>
