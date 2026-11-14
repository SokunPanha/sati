<script setup lang="ts" generic="T extends string | number">
const model = defineModel<T>({ required: true })
withDefaults(defineProps<{
  options: Array<{ value: T, label: string, icon?: string, iconColor?: string }>
  /** active pill: dark (ink) or light (white) */
  tone?: 'dark' | 'light'
  label?: string
  /** adds data-testid="<testid>-<value>" to each option */
  testid?: string
}>(), { tone: 'light' })
</script>

<template>
  <div class="grid rounded-xl bg-seg p-[3px]" :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }" role="group" :aria-label="label">
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      :aria-pressed="model === o.value"
      :data-testid="testid ? `${testid}-${o.value}` : undefined"
      class="flex min-h-[40px] items-center justify-center gap-1.5 rounded-[9px] px-1 text-[13px] leading-tight transition-colors"
      :class="model === o.value
        ? (tone === 'dark' ? 'bg-ink font-semibold text-white' : 'bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]')
        : 'text-soft'"
      @click="model = o.value"
    >
      <UIcon v-if="o.icon" :name="o.icon" class="size-4 shrink-0" :style="{ color: o.iconColor }" />
      <span class="truncate">{{ o.label }}</span>
    </button>
  </div>
</template>
