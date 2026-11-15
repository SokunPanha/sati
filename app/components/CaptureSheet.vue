<script setup lang="ts">
// Create: the shared task form (TaskFields, same as Edit). A box is required; Repeat makes it a habit,
// "Add to Top" puts it on today's list. "Remind me" also gives the task a reminder. Editing an existing reminder
// (from the Reminders page) shows the reminder form instead.
const { t } = useI18n()
const topN = useTopN()
const toast = useToast()
const fmt = useFmt()
const { sheets } = useSheets()
const { capture } = useTasks()
const { focus } = useFocus()
const { form, isHabit, toTop, effectiveBox, canSave, reset, valid, apply, saveLabel } = useTaskForm()

const inFocus = computed(() => focus.value?.phase === 'focus')
/** editing an existing reminder (opened from the Reminders page) */
const editingReminder = computed(() => !!sheets.reminderId)

watch(() => sheets.capture, (open) => {
  if (open) reset(sheets.captureMode === 'reminder')
})

/** Create the task and apply the form. Returns false if the Top list was full. */
async function create() {
  const task = await capture(form.title, form.description, form.sessionMin)
  return task ? apply(task) : true
}

async function saveTask() {
  if (!valid()) return
  const n = effectiveBox.value
  const habit = isHabit.value
  const top = toTop.value
  const reminded = form.remind ? { description: `${t('reminder.saved')} · ${fmt.date(form.remDate)} ${form.remTime}` } : {}
  const fits = await create()
  sheets.capture = false
  if (top && !fits) {
    toast.add({ title: t('capture.savedTo', { name: t(`box.${n}`) }), description: t('task.top3Full', { top: topN.value }), color: 'warning' })
    return
  }
  toast.add({
    ...(habit
      ? { title: t('capture.savedHabit'), color: 'success', icon: 'i-lucide-repeat' }
      : top
        ? { title: t('task.addedTop3', { top: topN.value }), color: 'success', icon: 'i-lucide-star' }
        : { title: t('capture.savedTo', { name: t(`box.${n}`) }), color: 'success', icon: 'i-lucide-layout-grid' }),
    ...reminded
  } as any)
}

const title = computed(() => editingReminder.value ? t('reminder.editTitle') : t('capture.title'))
</script>

<template>
  <BottomSheet
    v-model:open="sheets.capture"
    :title="title"
    :description="editingReminder ? undefined : (inFocus ? t('capture.subFocus') : t('capture.sub'))"
  >
    <template v-if="!editingReminder">
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
        testid="capture"
        autofocus
        @submit="saveTask"
      />

      <UButton block size="xl" class="h-14 rounded-2xl text-[16px] font-semibold disabled:opacity-50" :disabled="!canSave" :label="inFocus ? t('capture.saveKeep') : saveLabel" data-testid="capture-save" @click="saveTask" />
    </template>

    <template v-else>
      <ReminderForm :key="sheets.reminderId || 'new'" :reminder-id="sheets.reminderId" :initial-title="form.title" @done="sheets.capture = false" />
    </template>
  </BottomSheet>
</template>
