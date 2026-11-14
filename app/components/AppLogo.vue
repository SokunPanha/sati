<script setup lang="ts">
// Sati logo: option E "compass" (your direction).
withDefaults(defineProps<{ size?: number, hub?: string, ring?: string }>(), { size: 112, hub: '#0E1C1A', ring: '#F5F4EF' })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 104 104" role="img" aria-label="Sati">
    <circle cx="52" cy="52" r="42" fill="none" :stroke="ring" stroke-width="6" />
    <path d="M52 18l11 34H41z" fill="#3FB8A3" />
    <path d="M41 52h22L52 86z" :fill="ring" opacity="0.35" />
    <circle cx="52" cy="52" r="6" :fill="hub" :stroke="ring" stroke-width="3" />
  </svg>
</template>
