<script setup lang="ts">
const props = defineProps<{ title: string, back?: string }>()
const { t } = useI18n()
const router = useRouter()
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push(props.back || '/')
}
</script>

<template>
  <header class="flex items-center gap-1">
    <button type="button" class="tap -ml-3 text-ink" :aria-label="t('common.back')" @click="goBack">
      <UIcon name="i-lucide-chevron-left" class="size-[22px]" />
    </button>
    <h1 class="display m-0 grow truncate text-[22px] font-semibold">
      {{ title }}
    </h1>
    <slot />
  </header>
</template>
