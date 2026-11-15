<script setup lang="ts">
// Screen 0. Khmer tagline first, English second.
</script>

<template>
  <div class="fixed inset-0 z-[9998] flex flex-col items-center overflow-hidden bg-night px-8 text-paper" style="padding-bottom: calc(56px + env(safe-area-inset-bottom))" role="status" aria-label="Sati">
    <svg width="560" height="560" viewBox="0 0 560 560" class="absolute left-1/2" style="top: 34.5%; transform: translate(-50%, -35.5%)" aria-hidden="true">
      <circle cx="280" cy="280" r="270" fill="none" stroke="#FFFFFF" stroke-opacity="0.05" stroke-width="2" />
      <circle cx="280" cy="280" r="200" fill="none" stroke="#FFFFFF" stroke-opacity="0.07" stroke-width="2" />
      <circle cx="280" cy="280" r="130" fill="none" stroke="#FFFFFF" stroke-opacity="0.09" stroke-width="2" />
    </svg>

    <div class="relative flex flex-col items-center gap-[26px]" style="margin-top: 34.4vh">
      <AppLogo :size="112" />
      <div class="flex flex-col items-center gap-1">
        <span class="text-[52px] font-bold leading-none" style="font-family: 'Space Grotesk', Inter, system-ui, sans-serif; letter-spacing: -1px">Sati</span>
        <span class="text-[22px] font-medium text-mint" style="line-height: 1.6">សតិ</span>
      </div>
    </div>

    <div class="relative mt-auto flex flex-col items-center gap-[22px]">
      <div class="flex gap-2.5" aria-hidden="true">
        <span v-for="i in 3" :key="i" class="size-2.5 rounded-full" :style="{ animation: 'sati-dot 1.2s infinite ease-in-out', animationDelay: `${(i - 1) * 0.2}s`, background: '#F5F4EF', opacity: 0.25 }" />
      </div>
      <div class="flex flex-col items-center gap-1.5 text-center">
        <span class="text-[15px] font-medium" style="line-height: 1.7">ចិត្តស្ងប់ ផ្ដោតលើរឿងម្ដងមួយ</span>
        <span class="text-[14px] text-mint">Calm mind. One thing at a time.</span>
      </div>
    </div>
  </div>
</template>
