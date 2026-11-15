<script setup lang="ts">
// Bottom bar, icons only: Today · Plan · Mind map · (+) · Tomorrow · History · Settings.
// The centre + opens the capture sheet. Labels stay as aria-labels for screen readers.
const { t } = useI18n()
const route = useRoute()
const { openCapture } = useSheets()
const left = computed(() => [
  { to: '/today', label: t('tabs.today'), icon: 'i-lucide-circle-dot' },
  { to: '/plan', label: t('tabs.plan'), icon: 'i-lucide-layout-grid' },
  { to: '/mindmap', label: t('tabs.mindmap'), icon: 'i-lucide-network' }
])
const right = computed(() => [
  { to: '/review', label: t('tabs.review'), icon: 'i-lucide-sunrise' },
  { to: '/history', label: t('tabs.history'), icon: 'i-lucide-history' },
  { to: '/settings', label: t('tabs.settings'), icon: 'i-lucide-settings' }
])
</script>

<template>
  <nav class="fixed-col bottom-0 z-30 grid grid-cols-7 border-t border-rule bg-white" style="height: calc(64px + max(12px, env(safe-area-inset-bottom))); padding-bottom: max(12px, env(safe-area-inset-bottom))">
    <template v-for="(group, gi) in [left, right]" :key="gi">
      <NuxtLink
        v-for="tab in group"
        :key="tab.to"
        :to="tab.to"
        :aria-label="tab.label"
        :title="tab.label"
        :aria-current="route.path === tab.to ? 'page' : undefined"
        class="flex min-w-0 flex-col items-center justify-center gap-1"
        :class="route.path === tab.to ? 'text-brand' : 'text-soft'"
        :data-testid="`tab-${tab.to.slice(1) || 'today'}`"
      >
        <UIcon :name="tab.icon" class="size-6 shrink-0" />
        <span class="size-1 rounded-full" :class="route.path === tab.to ? 'bg-brand' : 'bg-transparent'" aria-hidden="true" />
      </NuxtLink>
      <div v-if="gi === 0" class="flex items-start justify-center">
        <button
          type="button"
          class="-mt-5 flex size-[56px] items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_18px_rgba(15,110,100,0.35)] ring-4 ring-white active:scale-95"
          :aria-label="t('tabs.add')"
          data-testid="capture-bar"
          @click="openCapture('task')"
        >
          <UIcon name="i-lucide-plus" class="size-7" />
        </button>
      </div>
    </template>
  </nav>
</template>
