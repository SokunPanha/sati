<script setup lang="ts">
// Review step 3: pick tasks from Plan for a given day (max 3).
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ day: string }>()
const { t } = useI18n()
const topN = useTopN()
const toast = useToast()
const { active, top3For, planFor, unplan } = useTasks()

const list = computed(() => [...active.value].sort((a, b) => a.box - b.box))
const picked = computed(() => new Set(top3For(props.day).map(x => x.id)))

async function toggle(id: string) {
  if (picked.value.has(id)) await unplan(id)
  else if (!(await planFor(id, props.day))) toast.add({ title: t('task.top3Full', { top: topN.value }), color: 'warning' })
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('review.pickerTitle')" :description="t('review.pickerSub', { top: topN })">
    <p v-if="!list.length" class="m-0 text-[14px] text-soft">{{ t('review.pickerEmpty') }}</p>
    <div v-else class="card flex flex-col overflow-hidden">
      <button
        v-for="task in list"
        :key="task.id"
        type="button"
        role="checkbox"
        :aria-checked="picked.has(task.id)"
        class="flex min-h-[56px] items-center gap-3 border-b border-rule2 px-4 py-2.5 text-left last:border-b-0"
        @click="toggle(task.id)"
      >
        <span class="flex size-6 shrink-0 items-center justify-center rounded-full" :class="picked.has(task.id) ? 'bg-brand' : 'border-2 border-ringc'">
          <UIcon v-if="picked.has(task.id)" name="i-lucide-check" class="size-3.5 text-white" />
        </span>
        <span class="min-w-0 grow text-[14px] text-ink">{{ task.title }}</span>
        <BoxBadge :box="task.box" />
      </button>
    </div>
    <UButton block size="xl" color="neutral" class="h-[52px] rounded-2xl text-[15px] font-semibold" :label="t('common.done')" @click="open = false" />
  </BottomSheet>
</template>
