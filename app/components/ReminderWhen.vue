<script setup lang="ts">
// When a reminder fires: day chips (Today / Tomorrow / pick a date), time, and how early to alert.
// Shared by the capture sheet ("Remind me") and the reminder edit form.
const date = defineModel<string>('date', { required: true })
const time = defineModel<string>('time', { required: true })
const alertBefore = defineModel<number>('alertBefore', { required: true })

const { t } = useI18n()
const fmt = useFmt()
const dateInput = ref<HTMLInputElement | null>(null)

const tomorrow = computed(() => addDays(runtime.today, 1))
const isCustomDate = computed(() => date.value !== runtime.today && date.value !== tomorrow.value)
const alertOptions = computed(() => [
  { value: 0, label: t('reminder.onTime') },
  ...[5, 10, 15, 30].map(n => ({ value: n, label: t('reminder.minBefore', { n }) })),
  { value: 60, label: t('reminder.hourBefore') }
])

function pickDate() {
  try {
    dateInput.value?.showPicker?.()
  }
  catch { /* the overlay input still receives the tap */ }
}

const chip = 'flex h-11 items-center whitespace-nowrap rounded-full px-3.5 text-[13px]'
const chipOff = 'border border-edge bg-card text-ink'
const chipOn = 'bg-rem font-semibold text-white'
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="reminder-when">
    <div class="flex flex-wrap gap-1.5">
      <button type="button" :class="[chip, date === runtime.today ? chipOn : chipOff]" :aria-pressed="date === runtime.today" data-testid="reminder-today" @click="date = runtime.today">
        {{ t('common.today') }}
      </button>
      <button type="button" :class="[chip, date === tomorrow ? chipOn : chipOff]" :aria-pressed="date === tomorrow" data-testid="reminder-tomorrow" @click="date = tomorrow">
        {{ t('common.tomorrow') }}
      </button>
      <span v-if="isCustomDate" :class="[chip, chipOn]">{{ fmt.date(date) }}</span>
      <label :class="[chip, chipOff, 'relative cursor-pointer gap-1.5']" @click="pickDate">
        <UIcon name="i-lucide-calendar" class="size-4" />
        {{ t('reminder.pickDate') }}
        <input ref="dateInput" v-model="date" type="date" :min="runtime.today" class="absolute inset-0 size-full cursor-pointer opacity-0" :aria-label="t('reminder.pickDate')" data-testid="reminder-date">
      </label>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <label class="flex h-[56px] flex-col justify-center rounded-xl border border-edge bg-card px-3.5">
        <span class="truncate text-[11px] leading-tight text-soft">{{ t('reminder.time') }}</span>
        <input v-model="time" type="time" required class="-my-2 w-full border-none bg-transparent p-0 text-[16px] font-semibold text-ink outline-none" data-testid="reminder-time">
      </label>
      <label class="relative flex h-[56px] flex-col justify-center rounded-xl border border-edge bg-card pr-9 pl-3.5 focus-within:border-brand">
        <span class="truncate text-[11px] leading-tight text-soft">{{ t('reminder.alertMe') }}</span>
        <UIcon name="i-lucide-chevron-down" class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-soft" />
        <select v-model.number="alertBefore" class="-my-2 min-h-[44px] w-full cursor-pointer appearance-none truncate border-none bg-transparent p-0 text-[15px] font-semibold text-ink outline-none" data-testid="reminder-alert">
          <option v-for="o in alertOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
    </div>
  </div>
</template>
