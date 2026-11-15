<script setup lang="ts">
import type { Reminder } from '~/types'

const props = defineProps<{ reminderId: string | null, initialTitle?: string }>()
const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const fmt = useFmt()
const toast = useToast()
const { reminders, save, remove } = useReminders()

const title = ref('')
const date = ref(runtime.today)
const time = ref('09:00')
const alertBefore = ref(0)
const repeat = ref<Reminder['repeat']>('none')
/** 0 = no focus session (the default for reminders) */
const focusMin = ref(0)

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
    focusMin.value = cur.focusMin ?? 0
  }
  else {
    const n = nextHour()
    title.value = props.initialTitle || ''
    date.value = n.day
    time.value = n.time
    alertBefore.value = 0
    repeat.value = 'none'
    focusMin.value = 0
  }
}
watch(() => props.reminderId, reset, { immediate: true })

const repeatOptions = computed(() => (['none', 'daily', 'weekly', 'monthly'] as const).map(v => ({ value: v, label: t(`repeat.${v === 'none' ? 'never' : v}`) })))

async function submit() {
  const clean = title.value.trim()
  if (!clean || !date.value || !time.value) return
  if (repeat.value === 'none' && atTime(date.value, time.value) <= Date.now()) {
    toast.add({ title: t('reminder.pastWarn'), color: 'warning' })
    return
  }
  const at = atTime(date.value, time.value)
  await save(
    { title: clean, date: date.value, time: time.value, alertBefore: alertBefore.value, repeat: repeat.value, focusMin: focusMin.value },
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
      :ui="{ root: 'w-full', base: 'display h-[54px] rounded-[14px] border-2 border-rem bg-card px-3.5 text-[19px] font-semibold text-ink placeholder:font-medium placeholder:text-faint' }"
      data-testid="reminder-title"
    />

    <div class="flex flex-col gap-2">
      <span class="text-[13px] font-semibold">{{ t('reminder.when') }}</span>
      <ReminderWhen v-model:date="date" v-model:time="time" v-model:alert-before="alertBefore" />
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-[13px] font-semibold">{{ t('repeat.label') }}</span>
      <SegmentedControl v-model="repeat" :options="repeatOptions" tone="dark" :label="t('repeat.label')" />
    </div>

    <FocusTimePicker v-model="focusMin" optional testid="reminder" />

    <UButton type="submit" block size="xl" class="h-[54px] rounded-2xl bg-rem text-[16px] font-semibold text-white hover:bg-rem-tx disabled:bg-rem/50" :disabled="!title.trim()" :label="t('reminder.save')" data-testid="reminder-save" />
    <button v-if="reminderId" type="button" class="flex h-11 items-center justify-center gap-2 rounded-xl border border-b1-line text-[14px] font-semibold text-b1-tx" @click="del">
      <UIcon name="i-lucide-trash-2" class="size-4" />{{ t('reminder.delete') }}
    </button>
  </form>
</template>
