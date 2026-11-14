<script setup lang="ts">
import type { Box } from '~/types'

// Box name only (no numbers). `short` is kept so older callers still compile.
const props = withDefaults(defineProps<{ box: Box, short?: boolean }>(), { short: false })
const { t } = useI18n()
const style = computed(() => BOX_STYLES[props.box])
</script>

<template>
  <UBadge
    :label="t(`box.${box}`)"
    class="shrink-0 rounded-full px-2 py-[3px] text-[11px] font-semibold leading-tight ring-0"
    :style="{ background: style.bg, color: style.tx }"
  />
</template>
