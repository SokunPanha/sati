<script setup lang="ts">
import type { Box } from '~/types'

const props = withDefaults(defineProps<{ box: Box, short?: boolean }>(), { short: false })
const { t } = useI18n()
const style = computed(() => BOX_STYLES[props.box])
</script>

<template>
  <UBadge
    :label="short ? String(box) : `${box} · ${t(`box.${box}`)}`"
    class="shrink-0 rounded-full px-2 py-[3px] text-[11px] font-semibold leading-tight ring-0"
    :style="{ background: style.bg, color: style.tx }"
    :aria-label="`${t('box.n', { n: box })}: ${t(`box.${box}`)}`"
  />
</template>
