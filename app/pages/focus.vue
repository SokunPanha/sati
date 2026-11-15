<script setup lang="ts">
// Full-screen focus mode. The session is persisted (endAt timestamp), so a reload keeps the countdown.
const { t } = useI18n()
const { openCapture } = useSheets()
const { focus, remainingMs, totalMs, paused, pause, resume, extend, startBreak, again, finish, endEarly } = useFocus()
const toast = useToast()
const { tasks, streakOf } = useTasks()

const R = 122
const CIRC = 2 * Math.PI * R
const progress = computed(() => totalMs.value ? Math.min(1, Math.max(0, 1 - remainingMs.value / totalMs.value)) : 0)
const dashOffset = computed(() => CIRC * progress.value)
const phase = computed(() => focus.value?.phase)
const task = computed(() => tasks.value.find(x => x.id === focus.value?.taskId) || null)
/** The task's steps can be ticked while focusing. */
const steps = computed({
  get: () => task.value?.checklist || [],
  set: (v) => { if (task.value) requireDb().tasks.update(task.value.id, { checklist: v.map(x => ({ ...x })) }) }
})
const batchCount = computed(() => focus.value?.batchIds.length || 0)
const areaLabel = computed(() => focus.value?.area || (batchCount.value ? t('focus.batch') : t(`box.${focus.value?.box || 2}`)))

// Keep the screen on while the countdown runs (Screen Wake Lock API, where available).
let lock: any = null
async function acquireLock() {
  try {
    if ('wakeLock' in navigator && !lock && document.visibilityState === 'visible') {
      lock = await (navigator as any).wakeLock.request('screen')
      lock.addEventListener?.('release', () => { lock = null })
    }
  }
  catch { /* low battery or unsupported */ }
}
function releaseLock() {
  lock?.release?.().catch(() => {})
  lock = null
}
const shouldLock = computed(() => !!focus.value && focus.value.endAt !== null)
watch(shouldLock, v => v ? acquireLock() : releaseLock(), { immediate: true })
function onVisibility() {
  if (document.visibilityState === 'visible' && shouldLock.value) acquireLock()
}
onMounted(() => document.addEventListener('visibilitychange', onVisibility))
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  releaseLock()
})

/** End: a small confirm, then stop the session (time so far is kept) and go back to Today. */
const confirmEnd = ref(false)
async function endSession() {
  await endEarly()
  toast.add({ title: t('focus.ended') })
  await navigateTo('/today')
}

async function leave(markDone: boolean) {
  await finish(markDone)
  await navigateTo('/')
}
const ghost = 'flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-nightline text-[15px] font-medium text-paper'
const solid = 'flex h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl bg-paper text-[16px] font-semibold text-night'
</script>

<template>
  <div class="fixed inset-0 z-20 overflow-y-auto bg-night text-paper" data-testid="page-focus">
    <div class="app-col flex min-h-full flex-col items-center px-6" style="padding-top: calc(28px + env(safe-area-inset-top)); padding-bottom: calc(36px + env(safe-area-inset-bottom))">
      <template v-if="focus">
        <div class="flex w-full items-center justify-between">
          <span class="text-[13px] font-medium text-nighttext">{{ phase === 'break' || phase === 'break-done' ? t('focus.breakTitle') : t('focus.session', { n: focus.sessionNo, total: focus.sessionsPlanned }) }}</span>
          <button v-if="phase === 'focus'" type="button" class="flex h-11 items-center rounded-full border border-nightline px-4 text-[13px] font-medium text-nighttext" data-testid="focus-end" @click="confirmEnd = true">
            {{ t('focus.end') }}
          </button>
        </div>

        <div class="mt-12 flex flex-col items-center gap-2 text-center">
          <span class="caps text-[13px] font-semibold text-mint">{{ areaLabel }}</span>
          <h1 class="display m-0 text-[28px] font-semibold" data-testid="focus-title">{{ focus.title }}</h1>
          <p v-if="task?.description" class="m-0 line-clamp-3 max-w-[320px] whitespace-pre-line text-[14px] text-nighttext" data-testid="focus-description">{{ task.description }}</p>
          <ChecklistEditor v-if="steps.length" v-model="steps" dark class="mt-2 w-full max-w-[340px] text-left" testid="focus-steps" />
        </div>

        <!-- Countdown (focus or break) -->
        <template v-if="phase === 'focus' || phase === 'break'">
          <div class="relative mt-10 flex size-[270px] items-center justify-center">
            <svg width="270" height="270" viewBox="0 0 270 270" class="absolute left-0 top-0" aria-hidden="true">
              <circle cx="135" cy="135" :r="R" fill="none" stroke="#1C3330" stroke-width="10" />
              <circle cx="135" cy="135" :r="R" fill="none" :stroke="phase === 'break' ? '#9FE0D3' : '#3FB8A3'" stroke-width="10" stroke-linecap="round" :stroke-dasharray="CIRC" :stroke-dashoffset="dashOffset" transform="rotate(-90 135 135)" />
            </svg>
            <div class="relative flex flex-col items-center gap-1.5">
              <span class="text-[66px] font-semibold leading-none tabular-nums" style="font-family: 'Space Grotesk', Inter, sans-serif; letter-spacing: -1px" role="timer" data-testid="focus-clock">{{ clock(remainingMs) }}</span>
              <div v-if="phase === 'focus'" class="flex items-center gap-2">
                <button type="button" class="flex size-11 items-center justify-center rounded-full border border-nightline text-paper" :aria-label="paused ? t('focus.resume') : t('focus.pause')" data-testid="focus-pause" @click="paused ? resume() : pause()">
                  <UIcon :name="paused ? 'i-lucide-play' : 'i-lucide-pause'" class="size-4" />
                </button>
                <button type="button" class="flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-nightline px-3.5 text-[14px] font-semibold text-paper" :aria-label="t('focus.add5')" data-testid="focus-add5" @click="extend(5)">
                  +5
                </button>
              </div>
              <span v-if="paused" class="text-[12px] text-nighttext">{{ t('focus.paused') }}</span>
            </div>
          </div>

          <div class="mt-auto flex w-full flex-col items-center gap-3.5 pt-8">
            <template v-if="phase === 'focus'">
              <button type="button" :class="solid" data-testid="focus-capture" @click="openCapture('task')">
                <UIcon name="i-lucide-lightbulb" class="size-5" />{{ t('focus.onMind') }}
              </button>
              <span class="text-[13px] text-nighttext">{{ t('focus.then', { n: focus.breakMin }) }}</span>
            </template>
            <template v-else>
              <span class="text-center text-[14px] text-nighttext">{{ t('focus.breakSub') }}</span>
              <button type="button" :class="ghost" @click="again()">{{ t('focus.skipBreak') }}</button>
            </template>
          </div>
        </template>

        <!-- Session finished / break finished: decide what's next -->
        <template v-else>
          <div class="mt-10 flex flex-col items-center gap-3 text-center">
            <span class="flex size-[88px] items-center justify-center rounded-full bg-night2 text-accent">
              <UIcon :name="phase === 'focus-done' ? 'i-lucide-circle-check' : 'i-lucide-coffee'" class="size-11" />
            </span>
            <span class="display text-[24px] font-semibold" data-testid="focus-finished">{{ phase === 'focus-done' ? t('focus.doneTitle') : t('focus.breakOverTitle') }}</span>
            <span class="text-[14px] text-nighttext">
              {{ phase === 'focus-done'
                ? (focus.isRoutine && task ? t('focus.routineDone', { n: streakOf(task) }) : t('focus.doneBody', { n: focus.plannedMin }))
                : t('focus.breakOverBody') }}
            </span>
          </div>
          <div class="mt-auto flex w-full flex-col gap-3 pt-8">
            <button v-if="phase === 'focus-done'" type="button" :class="solid" data-testid="take-break" @click="startBreak()">
              <UIcon name="i-lucide-coffee" class="size-5" />{{ t('focus.takeBreak', { n: focus.breakMin }) }}
            </button>
            <button v-else type="button" :class="solid" @click="again()">
              <UIcon name="i-lucide-play" class="size-5" />{{ t('focus.nextSession', { n: focus.plannedMin }) }}
            </button>
            <button v-if="!focus.isRoutine" type="button" :class="ghost" data-testid="focus-mark-done" @click="leave(true)">
              <UIcon name="i-lucide-check" class="size-[18px]" />{{ batchCount ? t('focus.markAllDone', { n: batchCount }) : t('focus.markDone') }}
            </button>
            <button v-if="phase === 'focus-done'" type="button" :class="ghost" @click="again()">{{ t('focus.another') }}</button>
            <button type="button" class="flex h-11 w-full items-center justify-center text-[14px] font-medium text-nighttext" data-testid="focus-back" @click="leave(false)">{{ t('focus.backToday') }}</button>
          </div>
        </template>
      </template>

      <div v-else class="my-auto flex flex-col items-center gap-4 text-center" data-testid="focus-none">
        <AppLogo :size="72" />
        <span class="display text-[22px] font-semibold">{{ t('focus.noneTitle') }}</span>
        <span class="text-[14px] text-nighttext">{{ t('focus.noneBody') }}</span>
        <NuxtLink to="/" class="mt-2 flex h-[52px] items-center justify-center rounded-2xl bg-paper px-6 text-[15px] font-semibold text-night">{{ t('focus.backToday') }}</NuxtLink>
      </div>
    </div>
    <ConfirmModal v-model:open="confirmEnd" :title="t('capture.needStop')" :body="t('capture.minLeft', { n: Math.ceil(remainingMs / 60000) })" :confirm-label="t('capture.endSession')" danger @confirm="endSession" />
  </div>
</template>
