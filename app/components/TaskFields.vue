<script setup lang="ts">
import type { Box, ChecklistItem, Repeat } from '~/types'

// The task form. Create (CaptureSheet) and Edit (SortSheet) both use it, so the two always look and work the same:
// title, description, box, then one row of switches (Focus time, Add to Top, Remind me) and Repeat (habit) last.
const props = withDefaults(defineProps<{ testid?: string, autofocus?: boolean }>(), { testid: 'capture', autofocus: false })
const emit = defineEmits<{ submit: [] }>()
const title = defineModel<string>('title', { required: true })
const description = defineModel<string>('description', { required: true })
const checklist = defineModel<ChecklistItem[]>('checklist', { default: () => [] })
/** null = no box picked yet: the form can't be saved until one is */
const box = defineModel<Box | null>('box', { required: true })
const repeatType = defineModel<Repeat['type']>('repeatType', { required: true })
const days = defineModel<number[]>('days', { required: true })
const sessionMin = defineModel<number>('sessionMin', { required: true })
const addTop = defineModel<boolean>('addTop', { required: true })
const remind = defineModel<boolean>('remind', { required: true })
const remDate = defineModel<string>('remDate', { required: true })
const remTime = defineModel<string>('remTime', { required: true })
const remAlert = defineModel<number>('remAlert', { required: true })

const { t } = useI18n()
const topN = useTopN()
const isHabit = computed(() => repeatType.value !== 'none')
const id = (name: string) => `${props.testid}-${name}`

/** Focus time is off (0) unless switched on; on starts at the default from Settings. */
const { settings } = useSettings()
function toggleFocus() {
  sessionMin.value = sessionMin.value ? 0 : (settings.value.focusMin || 25)
}

/** The note field stays hidden behind "+ Note" until it is wanted (or the task already has one). */
const noteOpen = ref(false)
const showNote = computed(() => noteOpen.value || !!description.value)
const noteEl = ref<{ textareaRef?: HTMLTextAreaElement } | null>(null)
function openNote() {
  noteOpen.value = true
  nextTick(() => noteEl.value?.textareaRef?.focus())
}
/** Steps (checklist) also stay hidden behind "+ Steps" until wanted. */
const stepsOpen = ref(false)
const showSteps = computed(() => stepsOpen.value || checklist.value.length > 0)
const stepsEl = ref<{ focus: () => void } | null>(null)
function openSteps() {
  stepsOpen.value = true
  nextTick(() => stepsEl.value?.focus())
}

/** Ticking "Add to Top" with no box chosen selects Do now, so the tiles show where it goes. */
function toggleTop() {
  // read the new value first: a v-model value only updates after the parent re-renders
  const on = !addTop.value
  addTop.value = on
  if (on && !box.value) box.value = 1
}

const chips = computed(() => [
  { key: 'focus', icon: 'i-lucide-timer', label: t('task.chipFocus'), aria: t('focusTime.label'), on: !!sessionMin.value, border: 'border-brand', fill: 'bg-brand', toggle: toggleFocus },
  ...(isHabit.value ? [] : [{ key: 'top', icon: 'i-lucide-star', label: t('task.chipTop', { top: topN.value }), aria: t('task.addTop3', { top: topN.value }), on: addTop.value, border: 'border-brand', fill: 'bg-brand', toggle: toggleTop }]),
  { key: 'remind', icon: 'i-lucide-alarm-clock', label: t('task.chipRemind'), aria: t('capture.remind'), on: remind.value, border: 'border-rem', fill: 'bg-rem', toggle: () => { remind.value = !remind.value } }
])
</script>

<template>
  <UTextarea
    v-model="title"
    :rows="2"
    autoresize
    :maxrows="4"
    :autofocus="autofocus"
    variant="none"
    :placeholder="t('capture.placeholder')"
    :aria-label="t('capture.placeholder')"
    :ui="{ root: 'w-full', base: 'min-h-20 resize-none rounded-[14px] border-2 border-brand bg-card p-3.5 text-[16px] text-ink placeholder:text-faint' }"
    :data-testid="testid === 'capture' ? 'capture-text' : id('title')"
    @keydown.enter.exact.prevent="emit('submit')"
  />
  <div v-if="!showNote || !showSteps" class="-mt-1.5 flex items-center gap-4">
    <button v-if="!showNote" type="button" class="flex min-h-[36px] items-center gap-1 px-1 text-[14px] font-medium text-brand" :data-testid="id('add-note')" @click="openNote">
      <UIcon name="i-lucide-plus" class="size-4" />{{ t('task.addNote') }}
    </button>
    <button v-if="!showSteps" type="button" class="flex min-h-[36px] items-center gap-1 px-1 text-[14px] font-medium text-brand" :data-testid="id('add-steps')" @click="openSteps">
      <UIcon name="i-lucide-plus" class="size-4" />{{ t('steps.title') }}
    </button>
  </div>
  <UTextarea
    v-if="showNote"
    ref="noteEl"
    v-model="description"
    :rows="2"
    autoresize
    :maxrows="6"
    variant="none"
    :placeholder="t('task.descriptionPlaceholder')"
    :aria-label="t('task.description')"
    :ui="{ root: '-mt-1.5 w-full', base: 'resize-none rounded-[14px] border border-edge bg-card px-3.5 py-2.5 text-[15px] text-ink placeholder:text-faint focus:border-brand' }"
    :data-testid="id('description')"
  />

  <ChecklistEditor v-if="showSteps" ref="stepsEl" v-model="checklist" editable :testid="id('steps')" />

  <div class="flex flex-col gap-2">
    <span class="text-[13px] font-semibold">{{ t('capture.sortNow') }}</span>
    <BoxPicker v-model="box" :habit="isHabit" :testid="testid" />
  </div>
  <!-- Focus · Top · Remind: one row of switches; the options of the ones that are on open below -->
  <div class="grid gap-2" :class="isHabit ? 'grid-cols-2' : 'grid-cols-3'">
    <button
      v-for="c in chips"
      :key="c.key"
      type="button"
      role="switch"
      :aria-checked="c.on"
      :aria-label="c.aria"
      class="flex h-[68px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border bg-card px-1"
      :class="c.on ? `border-2 ${c.border}` : 'border-edge'"
      :data-testid="id(c.key)"
      @click="c.toggle()"
    >
      <span class="flex size-7 shrink-0 items-center justify-center rounded-full" :class="c.on ? `${c.fill} text-white` : 'border border-edge text-soft'">
        <UIcon :name="c.on ? 'i-lucide-check' : c.icon" class="size-4" />
      </span>
      <span class="max-w-full truncate whitespace-nowrap text-[13px] font-medium text-ink">{{ c.label }}</span>
    </button>
  </div>
  <FocusTimePicker v-if="sessionMin" v-model="sessionMin" :testid="testid" />
  <div v-if="remind" class="flex flex-col gap-2">
    <span class="flex items-center gap-1.5 text-[13px] font-semibold"><UIcon name="i-lucide-alarm-clock" class="size-4" />{{ t('capture.remind') }}</span>
    <ReminderWhen v-model:date="remDate" v-model:time="remTime" v-model:alert-before="remAlert" />
  </div>

  <RepeatPicker v-model:type="repeatType" v-model:days="days" />
</template>
