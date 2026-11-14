<script setup lang="ts">
// Time shown as a pill ("🕗 08:00"). The real <input type="time"> sits on top, invisible, so tapping
// opens the phone's own time picker; the pill never gets cut off like a styled time input does.
const model = defineModel<string>({ required: true })
defineProps<{ label?: string, testid?: string }>()

function onChange(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (v) model.value = v
}
function openPicker(e: Event) {
  try {
    (e.target as HTMLInputElement).showPicker?.()
  }
  catch { /* the native control handles the tap */ }
}
</script>

<template>
  <span class="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brand-tint pr-3 pl-2.5 text-[14px] font-semibold text-brand-dark focus-within:ring-2 focus-within:ring-brand">
    <UIcon name="i-lucide-clock-3" class="size-4 shrink-0" />
    <span class="tabular-nums">{{ model }}</span>
    <input
      type="time"
      :value="model"
      class="absolute inset-0 size-full cursor-pointer opacity-0"
      :aria-label="label"
      :data-testid="testid"
      @click="openPicker"
      @change="onChange"
    >
  </span>
</template>
