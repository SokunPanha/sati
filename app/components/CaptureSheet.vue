<script setup lang="ts">
import type { Box, Repeat } from '~/types'
import { boxFlags } from '~/utils/boxes'

// Capture: one form for tasks and habits. Optionally pick a box (Do now / Schedule / Limit / Drop) and Repeat
// (same controls as the sort sheet) to file it right away: a box on the board, or a habit (daily routine).
// Pick nothing and it goes to the inbox to sort later. Also switches to "Reminder".
const { t } = useI18n()
const topN = useTopN()
const toast = useToast()
const { sheets } = useSheets()
const { capture, sort, addToTop3 } = useTasks()
const { focus, remainingMs, endEarly } = useFocus()
const { settings } = useSettings()

const text = ref('')
const description = ref('')
const picked = ref<Box | null>(null)
const repeatType = ref<Repeat['type']>('none')
const repeatDays = ref<number[]>([])
const sessionMin = ref(settings.value.focusMin)
const isHabit = computed(() => repeatType.value !== 'none')
/** also put it in today's Top list (not for habits: they never use a Top slot) */
const addTop = ref(false)
const toTop = computed(() => addTop.value && !isHabit.value)
/** null = nothing answered → inbox. Defaults: a habit → Schedule, a Top task → Do now. */
const box = computed<Box | null>(() => picked.value ?? (isHabit.value ? 2 : toTop.value ? 1 : null))
const inFocus = computed(() => focus.value?.phase === 'focus')
const minutesLeft = computed(() => Math.ceil(remainingMs.value / 60000))
const mode = computed({
  get: () => sheets.captureMode,
  set: (v) => { sheets.captureMode = v }
})
const modeOptions = computed(() => [
  { value: 'task' as const, label: t('capture.taskOrIdea') },
  { value: 'reminder' as const, label: t('capture.reminder'), icon: 'i-lucide-alarm-clock', iconColor: '#2563A8' }
])

watch(() => sheets.capture, (open) => {
  if (!open) return
  text.value = ''
  description.value = ''
  picked.value = null
  addTop.value = false
  repeatType.value = 'none'
  repeatDays.value = []
  sessionMin.value = settings.value.focusMin
})

/** Capture, and file it right away when a box / Repeat / Top was chosen. Returns false if the Top list was full. */
async function captureAndSort() {
  const task = await capture(text.value, description.value, sessionMin.value)
  if (!task || !box.value) return true
  await sort(task.id, {
    title: task.title,
    ...boxFlags(box.value),
    repeat: { type: repeatType.value, days: repeatType.value === 'days' ? [...repeatDays.value] : [] },
    area: '',
    dueDate: null,
    sessionMin: task.sessionMin,
    sessionsPlanned: 1
  })
  return toTop.value ? addToTop3(task.id) : true
}

/** Ticking "Add to Top" with no box chosen selects Do now, so the tiles show where it goes. */
function toggleTop() {
  addTop.value = !addTop.value
  if (addTop.value && !picked.value) picked.value = 1
}

function daysMissing() {
  if (repeatType.value !== 'days' || repeatDays.value.length) return false
  toast.add({ title: t('sort.pickDays'), color: 'warning' })
  return true
}

async function saveTask() {
  if (!text.value.trim() || daysMissing()) return
  const n = box.value
  const habit = isHabit.value
  const top = toTop.value
  const fits = await captureAndSort()
  text.value = ''
  sheets.capture = false
  if (top && !fits) {
    toast.add({ title: t('capture.savedTo', { name: t(`box.${n}`) }), description: t('task.top3Full', { top: topN.value }), color: 'warning' })
    return
  }
  toast.add(habit
    ? { title: t('capture.savedHabit'), color: 'success', icon: 'i-lucide-repeat' }
    : top
      ? { title: t('task.addedTop3', { top: topN.value }), color: 'success', icon: 'i-lucide-star' }
      : n
      ? { title: t('capture.savedTo', { name: t(`box.${n}`) }), color: 'success', icon: 'i-lucide-layout-grid' }
      : { title: t('capture.saved'), color: 'success', icon: 'i-lucide-inbox' })
}

async function stopSession() {
  if (text.value.trim() && !daysMissing()) await captureAndSort()
  await endEarly()
  sheets.capture = false
  toast.add({ title: t('focus.ended') })
  await navigateTo('/')
}

const title = computed(() => mode.value === 'task'
  ? t('capture.title')
  : (sheets.reminderId ? t('reminder.editTitle') : t('reminder.newTitle')))
</script>

<template>
  <BottomSheet
    v-model:open="sheets.capture"
    :title="title"
    :description="mode === 'task' ? (inFocus ? t('capture.subFocus') : t('capture.sub')) : undefined"
    :hide-header="mode === 'reminder'"
  >
    <template v-if="mode === 'task'">
      <SegmentedControl v-model="mode" :options="modeOptions" data-testid="capture-mode" />
      <UTextarea
        v-model="text"
        :rows="3"
        autofocus
        variant="none"
        :placeholder="t('capture.placeholder')"
        :aria-label="t('capture.placeholder')"
        :ui="{ root: 'w-full', base: 'h-20 resize-none rounded-[14px] border-2 border-brand bg-white p-3.5 text-[16px] text-ink placeholder:text-faint' }"
        data-testid="capture-text"
        @keydown.enter.exact.prevent="saveTask"
      />
      <UTextarea
        v-model="description"
        :rows="2"
        autoresize
        :maxrows="6"
        variant="none"
        :placeholder="t('task.descriptionPlaceholder')"
        :aria-label="t('task.description')"
        :ui="{ root: '-mt-1.5 w-full', base: 'resize-none rounded-[14px] border border-edge bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-faint focus:border-brand' }"
        data-testid="capture-description"
      />

      <div class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold">{{ t('capture.sortNow') }}</span>
        <BoxPicker v-model="picked" optional :habit="isHabit" testid="capture" />
      </div>
      <RepeatPicker v-model:type="repeatType" v-model:days="repeatDays" />
      <FocusTimePicker v-model="sessionMin" testid="capture" />
      <button
        v-if="!isHabit"
        type="button"
        role="switch"
        :aria-checked="addTop"
        class="flex min-h-[48px] items-center gap-3 rounded-2xl border bg-white px-3.5 text-left"
        :class="addTop ? 'border-2 border-brand' : 'border-edge'"
        data-testid="capture-top"
        @click="toggleTop"
      >
        <span class="flex size-7 shrink-0 items-center justify-center rounded-full" :class="addTop ? 'bg-brand text-white' : 'border border-edge text-soft'">
          <UIcon name="i-lucide-star" class="size-4" />
        </span>
        <span class="grow text-[14px] font-medium text-ink">{{ t('task.addTop3', { top: topN }) }}</span>
        <UIcon v-if="addTop" name="i-lucide-check" class="size-5 shrink-0 text-brand" />
      </button>

      <UButton block size="xl" class="h-14 rounded-2xl text-[16px] font-semibold disabled:opacity-50" :disabled="!text.trim()" :label="inFocus ? t('capture.saveKeep') : (isHabit ? t('capture.saveHabit') : box ? t('capture.saveTo', { name: t(`box.${box}`) }) : t('capture.save'))" data-testid="capture-save" @click="saveTask" />

      <template v-if="inFocus">
        <div class="h-px bg-rule" />
        <div class="flex items-center gap-3">
          <div class="flex grow flex-col gap-0.5">
            <span class="text-[14px] font-semibold">{{ t('capture.needStop') }}</span>
            <span class="text-[13px] text-soft">{{ t('capture.minLeft', { n: minutesLeft }) }}</span>
          </div>
          <button type="button" class="h-11 shrink-0 rounded-xl border border-b1-line px-4 text-[14px] font-semibold text-b1-tx" data-testid="end-session" @click="stopSession">
            {{ t('capture.endSession') }}
          </button>
        </div>
      </template>
    </template>

    <template v-else>
      <SegmentedControl v-if="!sheets.reminderId" v-model="mode" :options="modeOptions" />
      <ReminderForm :key="sheets.reminderId || 'new'" :reminder-id="sheets.reminderId" :initial-title="text" @done="sheets.capture = false" />
    </template>
  </BottomSheet>
</template>
