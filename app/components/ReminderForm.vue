<script setup lang="ts">
import type { Reminder } from '~/types'

const props = defineProps<{ reminderId: string | null, initialTitle?: string }>()
const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const toast = useToast()
const { reminders, save, remove } = useReminders()

const title = ref('')
const date = ref(runtime.today)
const time = ref('09:00')
const alertBefore = ref(0)
const repeat = ref<Reminder['repeat']>('none')
const dateInput = ref<HTMLInputElement | null>(null)

function nextHour() {
  const d = new Date(Date.now() + 3600000)
  d.setMinutes(0, 0, 0)
  return { day: ymd(d), time: hhmm(d.getTime()) }
}

function reset() {
  const cur = props.reminderId ? reminders.value.find(r => r.id === props.reminderId) : null
  if (cur) {
    title.value = cur.title
    date.value = cur.date
    time.value = cur.time
    alertBefore.value = cur.alertBefore
    repeat.value = cur.repeat
  }
  else {
    const n = nextHour()
    title.value = props.initialTitle || ''
    date.value = n.day
    time.value = n.time
    alertBefore.value = 0
    repeat.value = 'none'
  }
}
watch(() => props.reminderId, reset, { immediate: true })

const tomorrow = computed(() => addDays(runtime.today, 1))
const isCustomDate = computed(() => date.value !== runtime.today && date.value !== tomorrow.value)
const alertOptions = computed(() => [
  { value: 0, label: t('reminder.onTime') },
  ...[5, 10, 15, 30].map(n => ({ value: n, label: t('reminder.minBefore', { n }) })),
  { value: 60, label: t('reminder.hourBefore') }
])
const repeatOptions = computed(() => (['none', 'daily', 'weekly', 'monthly'] as const).map(v => ({ value: v, label: t(`repeat.${v === 'none' ? 'never' : v}`) })))

function pickDate() {
  try {
    dateInput.value?.showPicker?.()
  }
  catch { /* the overlay input still receives the tap */ }
}

async function submit() {
  const clean = title.value.trim()
  if (!clean || !date.value || !time.value) return
  if (repeat.value === 'none' && atTime(date.value, time.value) <= Date.now()) {
    toast.add({ title: t('reminder.pastWarn'), color: 'warning' })
    return
  }
  const at = atTime(date.value, time.value)
  await save(
    { title: clean, date: date.value, time: time.value, alertBefore: alertBefore.value, repeat: repeat.value },
    props.reminderId,
    { title: alertBefore.value ? t('notif.reminderIn', { title: clean, n: alertBefore.value }) : clean, body: t('notif.reminderBody', { time: fmt.time(at) }) }
  )
  toast.add({ title: t('reminder.saved'), color: 'success' })
  emit('done')
}

async function del() {
  if (!props.reminderId) return
  await remove(props.reminderId)
  toast.add({ title: t('reminder.deleted') })
  emit('done')
}

const chip = 'flex h-11 items-center rounded-full px-3.5 text-[13px]'
const chipOff = 'border border-edge bg-white text-ink'
const chipOn = 'bg-rem font-semibold text-white'
</script>

<template>
  <form class="flex flex-col gap-4" data-testid="reminder-form" @submit.prevent="submit">
    <UInput
      v-model="title"
      :placeholder="t('reminder.placeholder')"
      :aria-label="t('reminder.placeholder')"
      size="xl"
      variant="none"
      autofocus
      :ui="{ root: 'w-full', base: 'display h-[54px] rounded-[14px] border-2 border-rem bg-white px-3.5 text-[19px] font-semibold text-ink placeholder:font-medium placeholder:text-faint' }"
      data-testid="reminder-title"
    />

    <div class="flex flex-col gap-2">
      <span class="text-[13px] font-semibold">{{ t('reminder.when') }}</span>
      <div class="flex flex-wrap gap-1.5">
        <button type="button" :class="[chip, date === runtime.today ? chipOn : chipOff]" :aria-pressed="date === runtime.today" @click="date = runtime.today">
          {{ t('common.today') }}
        </button>
        <button type="button" :class="[chip, date === tomorrow ? chipOn : chipOff]" :aria-pressed="date === tomorrow" @click="date = tomorrow">
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
        <label class="flex h-[56px] flex-col justify-center rounded-xl border border-edge bg-white px-3.5">
          <span class="truncate text-[11px] leading-tight text-soft">{{ t('reminder.time') }}</span>
          <input v-model="time" type="time" required class="-my-2 w-full border-none bg-transparent p-0 text-[16px] font-semibold text-ink outline-none" data-testid="reminder-time">
        </label>
        <label class="relative flex h-[56px] flex-col justify-center rounded-xl border border-edge bg-white pr-9 pl-3.5 focus-within:border-brand">
          <span class="truncate text-[11px] leading-tight text-soft">{{ t('reminder.alertMe') }}</span>
          <UIcon name="i-lucide-chevron-down" class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-soft" />
          <select v-model.number="alertBefore" class="-my-2 min-h-[44px] w-full cursor-pointer appearance-none truncate border-none bg-transparent p-0 text-[15px] font-semibold text-ink outline-none" data-testid="reminder-alert">
            <option v-for="o in alertOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-[13px] font-semibold">{{ t('repeat.label') }}</span>
      <SegmentedControl v-model="repeat" :options="repeatOptions" tone="dark" :label="t('repeat.label')" />
    </div>

    <UButton type="submit" block size="xl" class="h-[54px] rounded-2xl bg-rem text-[16px] font-semibold text-white hover:bg-rem-tx disabled:bg-rem/50" :disabled="!title.trim()" :label="t('reminder.save')" data-testid="reminder-save" />
    <span class="-mt-1.5 text-center text-[12px] text-soft">{{ t('reminder.note', { top: topN }) }}</span>
    <button v-if="reminderId" type="button" class="flex h-11 items-center justify-center gap-2 rounded-xl border border-b1-line text-[14px] font-semibold text-b1-tx" @click="del">
      <UIcon name="i-lucide-trash-2" class="size-4" />{{ t('reminder.delete') }}
    </button>
  </form>
</template>
