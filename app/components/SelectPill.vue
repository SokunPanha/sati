<script setup lang="ts" generic="T extends string | number">
// Dropdown shown as a filled pill ("45 min ⇅"). The real <select> sits on top, invisible, so tapping it opens
// the phone's own picker (wheel on iPhone, list on Android) and keyboard / screen readers work as usual.
const model = defineModel<T>({ required: true })
const props = defineProps<{ options: Array<{ value: T, label: string }>, label?: string, testid?: string }>()
const current = computed(() => props.options.find(o => o.value === model.value)?.label ?? String(model.value))

function onChange(e: Event) {
  const raw = (e.target as HTMLSelectElement).value
  const hit = props.options.find(o => String(o.value) === raw)
  if (hit) model.value = hit.value
}
</script>

<template>
  <span class="relative inline-flex h-9 max-w-[55%] shrink-0 items-center gap-1 rounded-full bg-brand-tint pr-2 pl-3.5 text-[14px] font-semibold text-brand-dark transition-colors hover:bg-brand-soft focus-within:ring-2 focus-within:ring-brand">
    <span class="truncate">{{ current }}</span>
    <UIcon name="i-lucide-chevrons-up-down" class="size-4 shrink-0 opacity-70" />
    <select
      class="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      :value="String(model)"
      :aria-label="label"
      :data-testid="testid"
      @change="onChange"
    >
      <option v-for="o in options" :key="String(o.value)" :value="String(o.value)">{{ o.label }}</option>
    </select>
  </span>
</template>
