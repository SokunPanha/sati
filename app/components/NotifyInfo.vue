<script setup lang="ts">
// Honest explanation of how local (server-less) notifications behave, in the user's language.
const { t } = useI18n()
const { permission, isStandalone } = useNotify()
const status = computed(() => {
  switch (permission.value) {
    case 'granted': return { text: t('notifyInfo.granted'), icon: 'i-lucide-bell-ring', ok: true }
    case 'denied': return { text: t('notifyInfo.denied'), icon: 'i-lucide-bell-off', ok: false }
    case 'unsupported': return { text: t('notifyInfo.unsupported'), icon: 'i-lucide-bell-off', ok: false }
    default: return { text: t('notifyInfo.default'), icon: 'i-lucide-bell', ok: false }
  }
})
</script>

<template>
  <div class="flex flex-col gap-2.5 rounded-2xl bg-rem-bg p-4 text-[13px] text-rem-tx">
    <div class="flex items-center gap-2 text-[14px] font-semibold">
      <UIcon name="i-lucide-smartphone" class="size-[18px] shrink-0" />
      {{ t('notifyInfo.title') }}
    </div>
    <p class="m-0">{{ t('notifyInfo.p1') }}</p>
    <p class="m-0">{{ t('notifyInfo.p2') }}</p>
    <p class="m-0">{{ t('notifyInfo.p3') }}</p>
    <p class="m-0">{{ t('notifyInfo.p4') }}</p>
    <div class="mt-1 flex flex-col gap-1.5 rounded-xl bg-card/70 p-3 font-medium">
      <span class="flex items-center gap-2" data-testid="perm-status"><UIcon :name="status.icon" class="size-4 shrink-0" />{{ status.text }}</span>
      <span class="flex items-center gap-2"><UIcon :name="isStandalone ? 'i-lucide-circle-check' : 'i-lucide-download'" class="size-4 shrink-0" />{{ isStandalone ? t('notifyInfo.installed') : t('notifyInfo.notInstalled') }}</span>
    </div>
  </div>
</template>
