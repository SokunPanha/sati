<script setup lang="ts">
// "Focus time" choice (minutes). Tasks always have one; reminders pass `optional` to get a "None" chip (0).
const props = defineProps<{ optional?: boolean, testid?: string }>()
const minutes = defineModel<number>({ required: true })
const { t } = useI18n()

const options = computed(() => {
  const list = props.optional ? [0, 15, 25, 30, 45, 60] : [15, 25, 30, 45, 60, 90]
  // keep a custom value (e.g. a different default from Settings) selectable: it takes the nearest chip's place
  const cur = minutes.value
  if (cur && !list.includes(cur)) {
    let near = props.optional ? 1 : 0
    for (let i = near; i < list.length; i++) if (Math.abs(list[i]! - cur) < Math.abs(list[near]! - cur)) near = i
    list[near] = cur
  }
  return list.sort((a, b) => a - b)
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="flex items-center gap-1.5 text-[13px] font-semibold">
      <UIcon name="i-lucide-timer" class="size-4" />{{ t('focusTime.label') }}
      <span class="ml-auto font-normal text-soft">{{ minutes ? t('common.min', { n: minutes }) : t('focusTime.none') }}</span>
    </span>
    <div class="grid grid-cols-6 gap-1.5" role="group" :aria-label="t('focusTime.label')">
      <button
        v-for="n in options"
        :key="n"
        type="button"
        :aria-pressed="minutes === n"
        :aria-label="n ? t('common.min', { n }) : t('focusTime.none')"
        class="h-11 whitespace-nowrap rounded-[10px] text-[13px]"
        :class="minutes === n ? 'bg-ink font-semibold text-white' : 'border border-edge bg-white text-ink'"
        :data-testid="testid ? `${testid}-focus-${n}` : undefined"
        @click="minutes = n"
      >
        {{ n || t('focusTime.none') }}
      </button>
    </div>
  </div>
</template>
