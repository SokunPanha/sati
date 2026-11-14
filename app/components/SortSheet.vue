<script setup lang="ts">
import type { Box, Repeat } from '~/types'
import { boxFlags } from '~/utils/boxes'

// Sort flow: walk the inbox (or edit one task). Pick the box directly; Repeat makes it a routine (habit).
const { t } = useI18n()
const fmt = useFmt()
const toast = useToast()
const { sheets } = useSheets()
const { tasks, inbox, sort } = useTasks()
const { settings, set } = useSettings()

const queue = ref<string[]>([])
const pos = ref(0)
const savedAny = ref(false)
const editing = computed(() => !!sheets.sortTaskId)
const current = computed(() => tasks.value.find(x => x.id === queue.value[pos.value]) || null)

const form = reactive({
  title: '',
  description: '',
  box: 4 as Box,
  repeatType: 'none' as Repeat['type'],
  days: [] as number[],
  area: '',
  dueDate: null as string | null,
  sessionMin: 45,
  sessionsPlanned: 1
})
const panel = ref<'area' | 'length' | null>(null)
const newArea = ref('')
const dueInput = ref<HTMLInputElement | null>(null)

watch(() => sheets.sort, (open) => {
  if (!open) return
  queue.value = sheets.sortTaskId ? [sheets.sortTaskId] : inbox.value.map(x => x.id)
  pos.value = 0
  savedAny.value = false
  if (!queue.value.length) sheets.sort = false
})

watch(current, (task) => {
  panel.value = null
  if (!task) return
  form.title = task.title
  form.description = task.description || ''
  form.box = task.box
  form.repeatType = task.repeat.type
  form.days = [...task.repeat.days]
  form.area = task.area
  form.dueDate = task.dueDate
  form.sessionMin = task.sessionMin || settings.value.focusMin
  form.sessionsPlanned = task.sessionsPlanned || 1
}, { immediate: true })

const isRoutine = computed(() => form.repeatType !== 'none')
const lengths = [15, 25, 30, 45, 60, 90]
const lengthLabel = computed(() => (!isRoutine.value && form.sessionsPlanned > 1 ? `${form.sessionsPlanned} × ` : '') + t('common.min', { n: form.sessionMin }))

async function addArea() {
  const name = newArea.value.trim()
  if (!name) return
  if (!settings.value.areas.includes(name)) await set('areas', [...settings.value.areas, name])
  form.area = name
  newArea.value = ''
  panel.value = null
}

function pickDue() {
  try {
    dueInput.value?.showPicker?.()
  }
  catch { /* overlay input handles the tap */ }
}

function advance() {
  if (pos.value + 1 >= queue.value.length) {
    sheets.sort = false
    if (savedAny.value && !editing.value) toast.add({ title: t('sort.allSorted'), color: 'success' })
  }
  else pos.value++
}

async function save() {
  const task = current.value
  if (!task || !form.title.trim()) return
  if (form.repeatType === 'days' && !form.days.length) {
    toast.add({ title: t('sort.pickDays'), color: 'warning' })
    return
  }
  await sort(task.id, {
    title: form.title,
    description: form.description,
    ...boxFlags(form.box),
    repeat: { type: form.repeatType, days: form.repeatType === 'days' ? [...form.days] : [] },
    area: form.area,
    dueDate: form.dueDate || null,
    sessionMin: form.sessionMin,
    sessionsPlanned: form.sessionsPlanned
  })
  savedAny.value = true
  advance()
}

const sheetTitle = computed(() => editing.value ? t('sort.editTitle') : t('sort.progress', { i: Math.min(pos.value + 1, queue.value.length), n: queue.value.length }))
const pill = 'flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border bg-white px-2.5 text-[14px] text-ink'
</script>

<template>
  <BottomSheet v-model:open="sheets.sort" :title="sheetTitle" hide-header>
    <div v-if="current" class="flex flex-col gap-4" data-testid="sort-sheet">
      <div class="-mt-2 flex items-center justify-between">
        <span class="text-[13px] font-semibold text-soft">{{ sheetTitle }}</span>
        <button type="button" class="tap -mr-2.5 text-soft" :aria-label="t('common.close')" @click="sheets.sort = false">
          <UIcon name="i-lucide-x" class="size-5" />
        </button>
      </div>

      <UInput
        v-model="form.title"
        variant="none"
        :aria-label="t('sort.titleLabel')"
        :ui="{ root: '-mt-2.5 w-full', base: 'display h-[52px] rounded-[14px] border border-edge bg-white px-3.5 text-[19px] font-semibold text-ink focus:border-brand' }"
        data-testid="sort-title"
      />
      <UTextarea
        v-model="form.description"
        :rows="2"
        autoresize
        :maxrows="6"
        variant="none"
        :placeholder="t('task.descriptionPlaceholder')"
        :aria-label="t('task.description')"
        :ui="{ root: '-mt-2 w-full', base: 'resize-none rounded-[14px] border border-edge bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-faint focus:border-brand' }"
        data-testid="sort-description"
      />

      <BoxPicker v-model="form.box" :habit="isRoutine" testid="sort" />

      <RepeatPicker v-model:type="form.repeatType" v-model:days="form.days" />

      <div class="grid gap-2" :class="isRoutine ? 'grid-cols-2' : 'grid-cols-3'">
        <button type="button" :class="[pill, panel === 'area' ? 'border-ink' : 'border-edge']" :aria-expanded="panel === 'area'" data-testid="sort-area" @click="panel = panel === 'area' ? null : 'area'">
          <UIcon name="i-lucide-list" class="size-4 shrink-0" /><span class="truncate">{{ form.area || t('sort.area') }}</span>
        </button>
        <button type="button" :class="[pill, panel === 'length' ? 'border-ink' : 'border-edge']" :aria-expanded="panel === 'length'" @click="panel = panel === 'length' ? null : 'length'">
          <UIcon name="i-lucide-timer" class="size-4 shrink-0" /><span class="truncate">{{ lengthLabel }}</span>
        </button>
        <label v-if="!isRoutine" :class="[pill, 'relative cursor-pointer border-edge']" @click="pickDue">
          <UIcon name="i-lucide-calendar" class="size-4 shrink-0" /><span class="truncate">{{ form.dueDate ? fmt.shortDate(form.dueDate) : t('sort.due') }}</span>
          <input ref="dueInput" v-model="form.dueDate" type="date" class="absolute inset-0 size-full cursor-pointer opacity-0" :aria-label="t('sort.due')">
        </label>
      </div>

      <div v-if="panel === 'area'" class="flex flex-col gap-2 rounded-2xl border border-rule bg-white p-3">
        <div class="flex flex-wrap gap-1.5">
          <button type="button" class="h-10 rounded-full px-3 text-[13px]" :class="!form.area ? 'bg-ink font-semibold text-white' : 'border border-edge text-soft'" @click="form.area = ''; panel = null">
            {{ t('sort.noArea') }}
          </button>
          <button
            v-for="a in settings.areas"
            :key="a"
            type="button"
            class="h-10 rounded-full px-3 text-[13px]"
            :class="form.area === a ? 'bg-ink font-semibold text-white' : 'border border-edge text-ink'"
            :data-testid="`area-${a}`"
            @click="form.area = a; panel = null"
          >
            {{ a }}
          </button>
        </div>
        <form class="flex gap-2" @submit.prevent="addArea">
          <input v-model="newArea" class="field h-11 grow !rounded-xl !text-[14px]" :placeholder="t('sort.newArea')" :aria-label="t('sort.newArea')">
          <button type="submit" class="tap rounded-xl bg-ink px-3 text-white" :aria-label="t('common.add')"><UIcon name="i-lucide-plus" class="size-[18px]" /></button>
        </form>
      </div>

      <div v-if="panel === 'length'" class="flex flex-col gap-3 rounded-2xl border border-rule bg-white p-3">
        <div class="flex flex-col gap-1.5">
          <span class="text-[12px] font-semibold text-soft">{{ t('sort.length') }}</span>
          <div class="grid grid-cols-6 gap-1.5">
            <button v-for="n in lengths" :key="n" type="button" class="h-10 rounded-[10px] text-[13px]" :class="form.sessionMin === n ? 'bg-ink font-semibold text-white' : 'border border-edge text-ink'" @click="form.sessionMin = n">
              {{ n }}
            </button>
          </div>
        </div>
        <div v-if="!isRoutine" class="flex items-center justify-between">
          <span class="text-[12px] font-semibold text-soft">{{ t('sort.count') }}</span>
          <div class="flex items-center gap-1">
            <button type="button" class="tap rounded-xl border border-edge" :aria-label="'−'" @click="form.sessionsPlanned = Math.max(1, form.sessionsPlanned - 1)"><UIcon name="i-lucide-minus" class="size-4" /></button>
            <span class="display w-8 text-center text-[17px] font-semibold">{{ form.sessionsPlanned }}</span>
            <button type="button" class="tap rounded-xl border border-edge" :aria-label="'+'" @click="form.sessionsPlanned = Math.min(8, form.sessionsPlanned + 1)"><UIcon name="i-lucide-plus" class="size-4" /></button>
          </div>
        </div>
      </div>

      <div class="grid gap-2.5" style="grid-template-columns: 1fr 2fr">
        <button type="button" class="h-[54px] rounded-2xl border border-edge text-[15px] font-medium text-soft" data-testid="sort-skip" @click="editing ? (sheets.sort = false) : advance()">
          {{ editing ? t('common.cancel') : t('sort.skip') }}
        </button>
        <UButton block size="xl" class="h-[54px] rounded-2xl text-[16px] font-semibold" :disabled="!form.title.trim()" :label="editing ? t('common.save') : t('sort.saveNext')" :trailing-icon="editing ? undefined : 'i-lucide-arrow-right'" data-testid="sort-save" @click="save" />
      </div>
    </div>
  </BottomSheet>
</template>
