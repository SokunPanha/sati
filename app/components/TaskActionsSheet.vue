<script setup lang="ts">
const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const toast = useToast()
const { sheets, openSort } = useSheets()
const { tasks, addToTop3, removeFromTop3, setDone, remove } = useTasks()
const { start } = useFocus()

const task = computed(() => tasks.value.find(x => x.id === sheets.taskId) || null)
const inTop3 = computed(() => task.value?.top3Date === runtime.today)
const sub = computed(() => {
  const x = task.value
  if (!x) return ''
  const parts = [fmt.boxLabel(x.box), t('common.min', { n: x.sessionMin })]
  if (x.isRoutine) parts.push(fmt.repeatLabel(x.repeat))
  return parts.join(' · ')
})

function close() {
  sheets.taskActions = false
}
async function toggleTop3() {
  if (!task.value) return
  if (inTop3.value) await removeFromTop3(task.value.id)
  else if (await addToTop3(task.value.id)) toast.add({ title: t('task.addedTop3', { top: topN.value }), color: 'success', icon: 'i-lucide-star' })
  else {
    toast.add({ title: t('task.top3Full', { top: topN.value }), color: 'warning' })
    return
  }
  close()
}
async function focusNow() {
  if (!task.value) return
  await start(task.value)
  close()
  await navigateTo('/focus')
}
async function done() {
  if (!task.value) return
  await setDone(task.value, true)
  close()
}
function edit() {
  const id = task.value?.id
  close()
  if (id) setTimeout(() => openSort(id), 250)
}
async function del() {
  if (!task.value) return
  await remove(task.value.id)
  toast.add({ title: t('task.deleted') })
  close()
}
const row = 'flex min-h-[52px] w-full items-center gap-3 border-b border-rule2 px-4 text-left text-[15px] text-ink last:border-b-0'
</script>

<template>
  <BottomSheet v-model:open="sheets.taskActions" :title="task?.title || t('task.actions')" :description="sub || undefined">
    <div v-if="task" class="flex flex-col gap-4" data-testid="task-actions">
      <p v-if="task.description" class="m-0 -mt-1 whitespace-pre-line rounded-2xl bg-white px-4 py-3 text-[15px] text-ink" data-testid="task-description">{{ task.description }}</p>
      <div class="card flex flex-col overflow-hidden">
        <button v-if="!task.isRoutine" type="button" :class="row" data-testid="action-top3" @click="toggleTop3">
          <UIcon :name="inTop3 ? 'i-lucide-star-off' : 'i-lucide-star'" class="size-5 text-brand" />
          {{ inTop3 ? t('task.removeTop3', { top: topN }) : t('task.addTop3', { top: topN }) }}
        </button>
        <button type="button" :class="row" data-testid="action-focus" @click="focusNow">
          <UIcon name="i-lucide-play" class="size-5 text-brand" />{{ t('task.startFocus', { n: task.sessionMin }) }}
        </button>
        <button v-if="!task.isRoutine" type="button" :class="row" @click="done">
          <UIcon name="i-lucide-circle-check" class="size-5 text-brand" />{{ t('task.markDone') }}
        </button>
        <button type="button" :class="row" data-testid="action-edit" @click="edit">
          <UIcon name="i-lucide-pencil" class="size-5 text-brand" />{{ t('task.edit') }}
        </button>
      </div>

      <button type="button" class="flex h-[52px] items-center justify-center gap-2 rounded-[14px] border border-b1-line text-[15px] font-semibold text-b1-tx" data-testid="action-delete" @click="del">
        <UIcon name="i-lucide-trash-2" class="size-[18px]" />{{ t('task.delete') }}
      </button>
    </div>
  </BottomSheet>
</template>
