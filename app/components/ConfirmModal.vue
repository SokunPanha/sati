<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
withDefaults(defineProps<{ title: string, body: string, confirmLabel: string, danger?: boolean }>(), { danger: false })
const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()
function confirm() {
  open.value = false
  emit('confirm')
}
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="body" :close="false" :ui="{ content: 'max-w-[400px] rounded-[20px] bg-cream', title: 'display text-[19px] text-ink', description: 'text-[14px] text-soft', footer: 'justify-end gap-2' }">
    <template #footer>
      <UButton color="neutral" variant="outline" size="lg" class="min-h-[44px] rounded-xl bg-white px-4" :label="t('common.cancel')" @click="open = false" />
      <UButton size="lg" class="min-h-[44px] rounded-xl px-4" :class="danger ? 'bg-b1 text-white hover:bg-b1-tx' : ''" :label="confirmLabel" data-testid="confirm-yes" @click="confirm" />
    </template>
  </UModal>
</template>
