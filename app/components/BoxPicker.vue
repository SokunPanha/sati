<script setup lang="ts">
import type { Box } from '~/types'

// Pick one of the 4 boxes directly: Do now, Schedule, Limit, Drop. Shared by the capture sheet and the
// edit sheet so both look and behave the same. A box is required to save a task.
const props = withDefaults(defineProps<{ optional?: boolean, habit?: boolean, testid?: string }>(), { testid: 'box' })
const model = defineModel<Box | null>({ required: true })
const { t } = useI18n()
const topN = useTopN()

function pick(b: Box) {
  model.value = props.optional && model.value === b ? null : b
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="grid grid-cols-2 gap-2" role="radiogroup" :aria-label="t('box.pick')">
      <button
        v-for="b in BOXES"
        :key="b"
        type="button"
        role="radio"
        :aria-checked="model === b"
        class="flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-[14px] font-semibold"
        :style="{ background: BOX_STYLES[b].bg, color: BOX_STYLES[b].tx, borderColor: model === b ? BOX_STYLES[b].solid : 'transparent' }"
        :data-testid="`${testid}-box-${b}`"
        @click="pick(b)"
      >
        <UIcon v-if="model === b" name="i-lucide-check" class="size-4 shrink-0" />
        <span class="truncate">{{ t(`box.${b}`) }}</span>
      </button>
    </div>
    <span class="min-h-[18px] px-1 text-[12px] text-soft" :data-testid="`${testid}-result`" :data-box="model ?? ''">
      {{ !model ? t('capture.pickBox') : habit ? t('sort.routineHint', { top: topN }) : t(`sort.hint${model}`, { top: topN }) }}
    </span>
  </div>
</template>
