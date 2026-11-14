<script setup lang="ts">
// 28px circle inside a 44px touch target.
withDefaults(defineProps<{ checked: boolean, label: string, size?: number }>(), { size: 28 })
defineEmits<{ toggle: [] }>()
</script>

<template>
  <button type="button" role="checkbox" :aria-checked="checked" :aria-label="label" class="-m-2 flex size-11 shrink-0 items-center justify-center" @click.stop="$emit('toggle')">
    <span
      class="flex items-center justify-center rounded-full transition-colors"
      :class="checked ? 'bg-brand' : 'border-2 border-ringc bg-white'"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <UIcon v-if="checked" name="i-lucide-check" class="text-white" :style="{ width: `${size / 2}px`, height: `${size / 2}px` }" />
    </span>
  </button>
</template>
