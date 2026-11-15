<script setup lang="ts">
import type { Box, Repeat } from '~/types'

// The task form. Create (CaptureSheet) and Edit (SortSheet) both use it, so the two always look and work the same:
// title, description, box, Repeat (habit), "Focus time" (off by default), "Add to Top" and "Remind me".
const props = withDefaults(defineProps<{ testid?: string, autofocus?: boolean }>(), { testid: 'capture', autofocus: false })
const emit = defineEmits<{ submit: [] }>()
const title = defineModel<string>('title', { required: true })
const description = defineModel<string>('description', { required: true })
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

/** Ticking "Add to Top" with no box chosen selects Do now, so the tiles show where it goes. */
function toggleTop() {
  addTop.value = !addTop.value
  if (addTop.value && !box.value) box.value = 1
}
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
    :ui="{ root: 'w-full', base: 'min-h-20 resize-none rounded-[14px] border-2 border-brand bg-white p-3.5 text-[16px] text-ink placeholder:text-faint' }"
    :data-testid="testid === 'capture' ? 'capture-text' : id('title')"
    @keydown.enter.exact.prevent="emit('submit')"
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
    :data-testid="id('description')"
  />

  <div class="flex flex-col gap-2">
    <span class="text-[13px] font-semibold">{{ t('capture.sortNow') }}</span>
    <BoxPicker v-model="box" :habit="isHabit" :testid="testid" />
  </div>
  <RepeatPicker v-model:type="repeatType" v-model:days="days" />
  <button
    type="button"
    role="switch"
    :aria-checked="!!sessionMin"
    class="flex min-h-[48px] items-center gap-3 rounded-2xl border bg-white px-3.5 text-left"
    :class="sessionMin ? 'border-2 border-brand' : 'border-edge'"
    :data-testid="id('focus')"
    @click="toggleFocus"
  >
    <span class="flex size-7 shrink-0 items-center justify-center rounded-full" :class="sessionMin ? 'bg-brand text-white' : 'border border-edge text-soft'">
      <UIcon name="i-lucide-timer" class="size-4" />
    </span>
    <span class="grow text-[14px] font-medium text-ink">{{ t('focusTime.label') }}</span>
    <span v-if="sessionMin" class="shrink-0 whitespace-nowrap text-[13px] text-soft">{{ t('common.min', { n: sessionMin }) }}</span>
    <UIcon v-if="sessionMin" name="i-lucide-check" class="size-5 shrink-0 text-brand" />
  </button>
  <FocusTimePicker v-if="sessionMin" v-model="sessionMin" bare :testid="testid" />

  <button
    v-if="!isHabit"
    type="button"
    role="switch"
    :aria-checked="addTop"
    class="flex min-h-[48px] items-center gap-3 rounded-2xl border bg-white px-3.5 text-left"
    :class="addTop ? 'border-2 border-brand' : 'border-edge'"
    :data-testid="id('top')"
    @click="toggleTop"
  >
    <span class="flex size-7 shrink-0 items-center justify-center rounded-full" :class="addTop ? 'bg-brand text-white' : 'border border-edge text-soft'">
      <UIcon name="i-lucide-star" class="size-4" />
    </span>
    <span class="grow text-[14px] font-medium text-ink">{{ t('task.addTop3', { top: topN }) }}</span>
    <UIcon v-if="addTop" name="i-lucide-check" class="size-5 shrink-0 text-brand" />
  </button>

  <button
    type="button"
    role="switch"
    :aria-checked="remind"
    class="flex min-h-[48px] items-center gap-3 rounded-2xl border bg-white px-3.5 text-left"
    :class="remind ? 'border-2 border-rem' : 'border-edge'"
    :data-testid="id('remind')"
    @click="remind = !remind"
  >
    <span class="flex size-7 shrink-0 items-center justify-center rounded-full" :class="remind ? 'bg-rem text-white' : 'border border-edge text-soft'">
      <UIcon name="i-lucide-alarm-clock" class="size-4" />
    </span>
    <span class="grow text-[14px] font-medium text-ink">{{ t('capture.remind') }}</span>
    <UIcon v-if="remind" name="i-lucide-check" class="size-5 shrink-0 text-rem" />
  </button>
  <ReminderWhen v-if="remind" v-model:date="remDate" v-model:time="remTime" v-model:alert-before="remAlert" />
</template>
