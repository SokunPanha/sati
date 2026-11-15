<script setup lang="ts">
import type { Repeat } from '~/types'

// "Repeat" choice that turns a task into a habit (daily routine). Shared by the capture sheet and the
// sort sheet so both look and behave the same.
const type = defineModel<Repeat['type']>('type', { required: true })
const days = defineModel<number[]>('days', { required: true })
const { t } = useI18n()
const fmt = useFmt()
const { settings } = useSettings()

const options = computed(() => [
  { value: 'none' as const, label: t('repeat.never') },
  { value: 'daily' as const, label: t('repeat.daily') },
  { value: 'weekdays' as const, label: t('repeat.weekdays') },
  { value: 'days' as const, label: t('repeat.pick') }
])
const weekdays = computed(() => Array.from({ length: 7 }, (_, i) => (i + settings.value.weekStart) % 7)
  .map(d => ({ value: d, label: fmt.weekdayShort(addDays('2023-01-01', d)) })))

function toggleDay(d: number) {
  days.value = days.value.includes(d) ? days.value.filter(x => x !== d) : [...days.value, d]
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="flex items-center gap-1.5 text-[13px] font-semibold"><UIcon name="i-lucide-repeat" class="size-4" />{{ t('repeat.label') }}</span>
    <SegmentedControl v-model="type" :options="options" tone="dark" :label="t('repeat.label')" />
    <div v-if="type === 'days'" class="grid grid-cols-7 gap-1">
      <button
        v-for="d in weekdays"
        :key="d.value"
        type="button"
        :aria-pressed="days.includes(d.value)"
        class="h-11 rounded-[10px] text-[12px]"
        :class="days.includes(d.value) ? 'bg-brand font-semibold text-white' : 'border border-edge bg-card text-ink'"
        @click="toggleDay(d.value)"
      >
        {{ d.label }}
      </button>
    </div>
  </div>
</template>
