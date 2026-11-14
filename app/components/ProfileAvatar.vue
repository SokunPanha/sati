<script setup lang="ts">
import type { Profile } from '~/types'

const props = withDefaults(defineProps<{ profile: Pick<Profile, 'name' | 'color' | 'photo'> | null, size?: number }>(), { size: 36 })
const initial = computed(() => initialOf(props.profile?.name || ''))
</script>

<template>
  <span
    class="display flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white"
    :style="{ width: `${size}px`, height: `${size}px`, background: profile?.color || '#0F6E64', fontSize: `${Math.round(size * 0.4)}px`, lineHeight: 1 }"
  >
    <img v-if="profile?.photo" :src="profile.photo" alt="" class="size-full object-cover">
    <template v-else>{{ initial }}</template>
  </span>
</template>
