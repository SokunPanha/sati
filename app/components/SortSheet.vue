<script setup lang="ts">
// Edit: the same task form as Create (TaskFields). Opened for one task, or to walk the inbox one task at a time.
const { t } = useI18n()
const topN = useTopN()
const toast = useToast()
const { sheets } = useSheets()
const { tasks, inbox } = useTasks()
const { form, load, valid, apply, saveLabel } = useTaskForm()

const queue = ref<string[]>([])
const pos = ref(0)
const savedAny = ref(false)
const editing = computed(() => !!sheets.sortTaskId)
const current = computed(() => tasks.value.find(x => x.id === queue.value[pos.value]) || null)

watch(() => sheets.sort, (open) => {
  if (!open) return
  queue.value = sheets.sortTaskId ? [sheets.sortTaskId] : inbox.value.map(x => x.id)
  pos.value = 0
  savedAny.value = false
  if (!queue.value.length) sheets.sort = false
})

// fill the form when the task changes (not on every live update of the same task)
watch(() => current.value?.id, () => {
  if (current.value) load(current.value)
}, { immediate: true })

function advance() {
  if (pos.value + 1 >= queue.value.length) {
    sheets.sort = false
    if (savedAny.value && !editing.value) toast.add({ title: t('sort.allSorted'), color: 'success' })
  }
  else pos.value++
}

async function save() {
  const task = current.value
  if (!task || !valid()) return
  if (!(await apply(task))) toast.add({ title: t('task.top3Full', { top: topN.value }), color: 'warning' })
  savedAny.value = true
  advance()
}

const sheetTitle = computed(() => editing.value ? t('sort.editTitle') : t('sort.progress', { i: Math.min(pos.value + 1, queue.value.length), n: queue.value.length }))
</script>

<template>
  <BottomSheet v-model:open="sheets.sort" :title="sheetTitle">
    <template v-if="current">
      <div class="contents" data-testid="sort-sheet">
        <TaskFields
          v-model:title="form.title"
          v-model:description="form.description"
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

        <div v-if="!editing" class="grid gap-2.5" style="grid-template-columns: 1fr 2fr">
          <button type="button" class="h-14 rounded-2xl border border-edge text-[15px] font-medium text-soft" data-testid="sort-skip" @click="advance()">
            {{ t('sort.skip') }}
          </button>
          <UButton block size="xl" class="h-14 rounded-2xl text-[16px] font-semibold disabled:opacity-50" :disabled="!form.title.trim()" :label="saveLabel" trailing-icon="i-lucide-arrow-right" :ui="{ label: 'truncate' }" data-testid="sort-save" @click="save" />
        </div>
        <UButton v-else block size="xl" class="h-14 rounded-2xl text-[16px] font-semibold disabled:opacity-50" :disabled="!form.title.trim()" :label="saveLabel" data-testid="sort-save" @click="save" />
      </div>
    </template>
  </BottomSheet>
</template>
