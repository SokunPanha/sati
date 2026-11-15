<script setup lang="ts">
import type { ChecklistItem } from '~/types'

// Small steps inside a task. `editable`: rename, remove and add steps (the task form); otherwise only tick them
// (task sheet, focus screen). Ticking always works.
const props = withDefaults(defineProps<{ editable?: boolean, testid?: string, dark?: boolean }>(), { editable: false, testid: 'steps', dark: false })
const items = defineModel<ChecklistItem[]>({ required: true })
const emit = defineEmits<{ toggle: [item: ChecklistItem] }>()
const { t } = useI18n()

const draft = ref('')
const addEl = ref<HTMLInputElement | null>(null)

function add() {
  const text = draft.value.trim()
  if (!text) return
  items.value = [...items.value, { id: uid(), text, done: false }]
  draft.value = ''
  nextTick(() => addEl.value?.focus())
}
function toggle(item: ChecklistItem) {
  items.value = items.value.map(x => x.id === item.id ? { ...x, done: !x.done } : x)
  emit('toggle', item)
}
function rename(item: ChecklistItem, text: string) {
  items.value = items.value.map(x => x.id === item.id ? { ...x, text } : x)
}
function removeItem(item: ChecklistItem) {
  items.value = items.value.filter(x => x.id !== item.id)
}
defineExpose({ focus: () => addEl.value?.focus() })
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-[14px] border" :class="dark ? 'border-nightline' : 'border-edge bg-card'" :data-testid="testid">
    <div v-for="item in items" :key="item.id" class="flex min-h-[46px] items-center gap-2 border-b px-2" :class="dark ? 'border-nightline' : 'border-rule2'" :data-testid="`${testid}-item`">
      <button
        type="button"
        role="checkbox"
        :aria-checked="item.done"
        :aria-label="item.text"
        class="flex size-10 shrink-0 items-center justify-center"
        :data-testid="`${testid}-tick`"
        @click="toggle(item)"
      >
        <span class="flex size-[22px] items-center justify-center rounded-md border-2" :class="item.done ? 'border-brand bg-brand text-white' : dark ? 'border-nighttext' : 'border-ringc'">
          <UIcon v-if="item.done" name="i-lucide-check" class="size-3.5" />
        </span>
      </button>
      <input
        v-if="props.editable"
        :value="item.text"
        class="min-w-0 grow bg-transparent text-[15px] outline-none"
        :class="item.done ? 'text-soft line-through' : 'text-ink'"
        :aria-label="t('steps.step')"
        @change="rename(item, ($event.target as HTMLInputElement).value)"
      >
      <span v-else class="min-w-0 grow text-[15px]" :class="item.done ? (dark ? 'text-nighttext line-through' : 'text-soft line-through') : (dark ? 'text-paper' : 'text-ink')">{{ item.text }}</span>
      <button v-if="props.editable" type="button" class="tap shrink-0 text-soft" :aria-label="`${item.text}: ${t('common.delete')}`" @click="removeItem(item)">
        <UIcon name="i-lucide-x" class="size-4" />
      </button>
    </div>
    <div v-if="props.editable" class="flex min-h-[46px] items-center gap-2 px-2">
      <span class="flex size-10 shrink-0 items-center justify-center text-soft"><UIcon name="i-lucide-plus" class="size-4" /></span>
      <input
        ref="addEl"
        v-model="draft"
        enterkeyhint="done"
        class="min-w-0 grow bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
        :placeholder="t('steps.add')"
        :aria-label="t('steps.add')"
        :data-testid="`${testid}-add`"
        @keydown.enter.prevent="add"
        @blur="add"
      >
    </div>
  </div>
</template>
