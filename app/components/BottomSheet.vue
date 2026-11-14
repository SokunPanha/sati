<script setup lang="ts">
// Bottom sheet built on Nuxt UI's UDrawer, styled like the design (cream, 26px corners, grab handle).
const open = defineModel<boolean>('open', { default: false })
const props = withDefaults(defineProps<{ title: string, description?: string, hideHeader?: boolean }>(), { hideHeader: false })

// Keep the whole sheet above the on-screen keyboard: sit on top of it and shrink to the visible height
// (the body scrolls inside), so the title and the first field never slide off the top of the screen.
const { inset, visible } = useKeyboardInset()
const contentStyle = computed(() => ({
  bottom: `${inset.value}px`,
  maxHeight: visible.value ? `min(94dvh, ${visible.value - 8}px)` : undefined
}))
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="props.title"
    :description="props.description || props.title"
    :content="{ style: contentStyle }"
    :ui="{
      overlay: 'bg-black/45',
      content: 'bg-cream ring-0 rounded-t-[26px] max-w-[480px] mx-auto max-h-[94dvh] shadow-2xl',
      handle: '!bg-ringc !w-10 !h-[5px] mt-3',
      container: 'px-[22px] pt-3 pb-safe gap-4',
      header: props.hideHeader ? 'sr-only' : 'sticky top-0 z-10 shrink-0 bg-cream pb-1',
      title: 'display text-[24px] font-semibold text-ink',
      description: props.description ? 'mt-1 text-[14px] text-soft' : 'sr-only',
      body: 'flex shrink-0 flex-col gap-4'
    }"
  >
    <template #body>
      <slot />
    </template>
  </UDrawer>
</template>
