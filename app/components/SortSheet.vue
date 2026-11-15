<script setup lang="ts">
// Edit one task: the same task form as Create (TaskFields). A box is required to save.
const { t } = useI18n()
const topN = useTopN()
const toast = useToast()
const { sheets } = useSheets()
const { tasks } = useTasks()
const { form, canSave, load, valid, apply, saveLabel } = useTaskForm()

const current = computed(() => tasks.value.find(x => x.id === sheets.sortTaskId) || null)

watch(() => sheets.sort, (open) => {
  if (open && !current.value) sheets.sort = false
})

// fill the form when the task changes (not on every live update of the same task)
watch([() => sheets.sort, () => current.value?.id], () => {
  if (sheets.sort && current.value) load(current.value)
}, { immediate: true })

async function save() {
  const task = current.value
  if (!task || !valid()) return
  if (!(await apply(task))) toast.add({ title: t('task.top3Full', { top: topN.value }), color: 'warning' })
  sheets.sort = false
}
</script>

<template>
  <BottomSheet v-model:open="sheets.sort" :title="t('sort.editTitle')">
    <template v-if="current">
      <div class="contents" data-testid="sort-sheet">
        <TaskFields
          v-model:title="form.title"
          v-model:description="form.description"
          v-model:checklist="form.checklist"
          v-model:box="form.box"
          v-model:repeat-type="form.repeatType"
          v-model:days="form.days"
          v-model:session-min="form.sessionMin"
          v-model:add-top="form.addTop"
          v-model:remind="form.remind"
          v-model:rem-date="form.remDate"
          v-model:rem-time="form.remTime"
          v-model:rem-alert="form.remAlert"
          testid="sort"
          @submit="save"
        />
        <UButton block size="xl" class="h-14 rounded-2xl text-[16px] font-semibold disabled:opacity-50" :disabled="!canSave" :label="saveLabel" data-testid="sort-save" @click="save" />
      </div>
    </template>
  </BottomSheet>
</template>
