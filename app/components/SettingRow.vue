<script setup lang="ts">
// One settings row: coloured icon tile, one-line label + subtitle, a control on the right,
// and an optional second line ("below") for extra controls such as a time.
const props = withDefaults(defineProps<{
  icon: string
  label: string
  sub?: string
  tone?: 'brand' | 'rem' | 'b1' | 'b3' | 'violet' | 'ink'
  /** render as a button (whole row tappable) */
  button?: boolean
}>(), { tone: 'brand' })
const TONES = {
  brand: ['var(--color-brand-tint)', 'var(--color-brand)'],
  rem: ['var(--color-rem-bg)', 'var(--color-rem)'],
  b1: ['var(--color-b1-bg)', 'var(--color-b1)'],
  b3: ['var(--color-b3-bg)', 'var(--color-b3-tx)'],
  violet: ['var(--color-violet-bg)', 'var(--color-violet)'],
  ink: ['var(--color-b4-bg)', 'var(--color-ink)']
} as const
const tile = computed(() => ({ background: TONES[props.tone][0], color: TONES[props.tone][1] }))
</script>

<template>
  <component
    :is="button ? 'button' : 'div'"
    :type="button ? 'button' : undefined"
    class="flex w-full flex-col gap-2 border-b border-rule2 px-4 py-3 text-left last:border-b-0"
    :class="button ? 'active:bg-cream' : ''"
  >
    <div class="flex min-h-[40px] w-full items-center gap-3">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-[11px]" :style="tile"><UIcon :name="icon" class="size-[18px]" /></span>
      <span class="flex min-w-0 grow flex-col">
        <span class="truncate text-[15px] font-medium text-ink">{{ label }}</span>
        <span v-if="sub" class="truncate text-[12px] text-soft">{{ sub }}</span>
      </span>
      <slot />
      <UIcon v-if="button && !$slots.default" name="i-lucide-chevron-right" class="size-[18px] shrink-0 text-faint" />
    </div>
    <div v-if="$slots.below" class="flex flex-wrap items-center gap-2 pl-12">
      <slot name="below" />
    </div>
  </component>
</template>
