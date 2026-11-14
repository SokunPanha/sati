<script setup lang="ts">
import type { Task } from '~/types'

// Today (/today). Dark header (greeting, Top progress ring, next reminder), then a cream sheet: the next Top task
// as a big card with "Start focus", the other Top tasks and the habits as rows (tick to finish, tap to open,
// ▶ to focus). Finished items leave the list (a toast offers Undo); the ring and counters keep the score.
const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const { active: profile } = useProfile()
const { sheets, openSort, openTask, openCapture } = useSheets()
const toast = useToast()
const { top3, inbox, active: planTasks, routinesToday, routineDone, streakOf, setDone, toggleRoutine, loaded } = useTasks()
const { next: nextReminder, todayCount } = useReminders()
const { focus, remainingMs, start } = useFocus()

const { data: unread } = useLiveQuery(db => db.notifications.filter(n => !n.read).count(), 0)

const upNext = computed(() => top3.value.find(x => x.status !== 'done') || null)
const doneCount = computed(() => top3.value.filter(x => x.status === 'done').length)
const allDone = computed(() => top3.value.length > 0 && doneCount.value === top3.value.length)
const openTop = computed(() => top3.value.filter(x => x.status !== 'done'))
const openRoutines = computed(() => routinesToday.value.filter(r => !routineDone(r)))
const routinesDone = computed(() => routinesToday.value.length - openRoutines.value.length)
const focusOnBreak = computed(() => focus.value?.phase === 'break' || focus.value?.phase === 'break-done')

const rest = computed(() => openTop.value.slice(1))
const greeting = computed(() => {
  const h = new Date(runtime.now).getHours()
  const key = h < 12 ? 'today.greetMorning' : h < 18 ? 'today.greetAfternoon' : 'today.greetEvening'
  return t(key, { name: profile.value?.name || '' })
})
const RING = 2 * Math.PI * 26
const ringOffset = computed(() => RING * (1 - (top3.value.length ? doneCount.value / top3.value.length : 0)))

function meta(task: Task) {
  const parts: string[] = []
  if (task.status !== 'done') parts.push(t('common.min', { n: task.sessionMin }))
  if (task.carriedFrom) parts.push(t('today.carried'))
  return parts.join(' · ')
}

function routineSub(task: Task) {
  const n = streakOf(task)
  return n > 0 ? t('today.streak', { n }) : fmt.repeatLabel(task.repeat)
}

/** Tick: finish it, it leaves the list, and the toast can bring it back. */
async function complete(task: Task, habit = false) {
  if (habit) await toggleRoutine(task)
  else await setDone(task, true)
  toast.add({
    title: t('today.doneToast', { title: task.title }),
    icon: 'i-lucide-circle-check',
    color: 'success',
    duration: 5000,
    actions: [{ label: t('common.undo'), color: 'neutral', variant: 'outline', onClick: () => { habit ? toggleRoutine(task) : setDone(task, false) } }]
  } as any)
}

async function startFocus(task: Task) {
  await start(task)
  await navigateTo('/focus')
}
</script>

<template>
  <div class="today" data-testid="page-today" style="padding-bottom: calc(120px + env(safe-area-inset-bottom))">
    <!-- Header -->
    <section class="relative overflow-hidden bg-night px-[22px] pt-3 pb-12 text-cream">
      <svg width="420" height="420" viewBox="0 0 420 420" class="pointer-events-none absolute -top-[150px] -right-[150px]" aria-hidden="true">
        <circle cx="210" cy="210" r="200" fill="none" stroke="#FFFFFF" stroke-opacity="0.04" stroke-width="2" />
        <circle cx="210" cy="210" r="140" fill="none" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="2" />
        <circle cx="210" cy="210" r="80" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2" />
      </svg>

      <div class="relative flex items-center justify-between">
        <span class="text-[13px] font-medium text-nighttext">{{ fmt.longDate(runtime.today) }}</span>
        <div class="flex items-center gap-1">
          <NuxtLink to="/notifications" class="tap relative text-cream" :aria-label="unread ? t('today.notificationsNew', { n: unread }) : t('today.notifications')" data-testid="bell">
            <UIcon name="i-lucide-bell" class="size-[22px]" />
            <span v-if="unread" class="absolute right-[9px] top-[9px] size-[9px] rounded-full border-2 border-night bg-b1" data-testid="unread-dot" />
          </NuxtLink>
          <button type="button" class="tap" :aria-label="t('today.switchProfile', { name: profile?.name || '' })" data-testid="avatar" @click="sheets.profiles = true">
            <ProfileAvatar :profile="profile" :size="36" />
          </button>
        </div>
      </div>

      <div class="relative mt-3 flex items-center gap-4">
        <h1 class="display m-0 min-w-0 grow text-[28px] font-bold">{{ greeting }}</h1>
        <div v-if="top3.length" class="relative size-[64px] shrink-0" :aria-label="`${t('today.top3', { top: topN })}: ${t('today.routineOf', { done: doneCount, total: top3.length })}`" role="img">
          <svg viewBox="0 0 64 64" class="size-full -rotate-90" aria-hidden="true">
            <circle cx="32" cy="32" r="26" fill="none" stroke="#2E4844" stroke-width="6" />
            <circle cx="32" cy="32" r="26" fill="none" stroke="#3FB8A3" stroke-width="6" stroke-linecap="round" :stroke-dasharray="RING" :stroke-dashoffset="ringOffset" class="transition-[stroke-dashoffset] duration-500" />
          </svg>
          <span class="display absolute inset-0 flex items-center justify-center text-[16px] font-bold" data-testid="top-progress">{{ doneCount }}/{{ top3.length }}</span>
        </div>
      </div>

      <NuxtLink v-if="nextReminder" to="/reminders" class="relative mt-4 flex min-h-[44px] items-center gap-2.5 rounded-full bg-night2 px-3.5 text-cream" :aria-label="`${t('today.nextReminder')}: ${fmt.time(nextReminder.at)} ${nextReminder.title}`" data-testid="next-reminder">
        <UIcon name="i-lucide-alarm-clock" class="size-[18px] shrink-0 text-mint" />
        <span class="shrink-0 text-[14px] font-bold text-mint">{{ nextReminder.date === runtime.today ? fmt.time(nextReminder.at) : `${fmt.relativeDay(nextReminder.date)} ${fmt.time(nextReminder.at)}` }}</span>
        <span class="min-w-0 grow truncate text-[14px]">{{ nextReminder.title }}</span>
        <span v-if="todayCount > 1" class="shrink-0 text-[12px] text-nighttext">{{ t('today.moreToday', { n: todayCount - 1 }) }}</span>
      </NuxtLink>
    </section>

    <!-- Sheet -->
    <section class="sheet relative -mt-6 flex flex-col gap-3 rounded-t-[28px] bg-cream px-[22px] pt-6">
      <!-- A session is running or waiting: always offer the way back -->
      <NuxtLink v-if="focus" to="/focus" class="flex items-center gap-3 rounded-[20px] bg-night p-4 text-white shadow-[0_14px_30px_-16px_rgba(14,28,26,0.8)]" data-testid="hero-focus">
        <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-night2"><UIcon name="i-lucide-timer" class="size-5 text-mint" /></span>
        <span class="flex min-w-0 grow flex-col gap-0.5">
          <span class="text-[12px] font-semibold text-mint">{{ focusOnBreak ? t('today.onBreak') : t('today.inFocus') }}</span>
          <span class="truncate text-[16px] font-semibold">{{ focus.title }}</span>
        </span>
        <span class="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-accent px-3.5 text-[15px] font-semibold text-night">
          <UIcon name="i-lucide-play" class="size-4" />{{ clock(remainingMs) }}
        </span>
      </NuxtLink>

      <!-- Up next: the first unfinished Top task -->
      <div v-if="upNext" class="next relative overflow-hidden rounded-[22px] bg-white p-4 pl-5" data-testid="top3-row">
        <span class="absolute inset-y-0 left-0 w-1.5" :style="{ background: BOX_STYLES[upNext.box].solid }" aria-hidden="true" />
        <div class="flex items-center justify-between gap-2">
          <span class="text-[12px] font-semibold text-brand">{{ t('today.upNext') }}</span>
          <BoxBadge :box="upNext.box" />
        </div>
        <div class="mt-1.5 flex items-start gap-3">
          <CheckCircle :checked="false" :label="t('today.markDone')" class="mt-0.5" @toggle="complete(upNext)" />
          <button type="button" class="flex min-w-0 grow flex-col gap-0.5 text-left" @click="openTask(upNext.id)">
            <span class="display text-[20px] font-semibold text-ink" data-testid="hero-title">{{ upNext.title }}</span>
            <span v-if="meta(upNext)" class="text-[13px] text-soft">{{ meta(upNext) }}</span>
          </button>
        </div>
        <button v-if="!focus" type="button" class="mt-3.5 flex h-[50px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[14px] bg-brand text-[15px] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(15,110,100,0.8)]" data-testid="start-focus" @click="startFocus(upNext)">
          <UIcon name="i-lucide-play" class="size-[18px]" />{{ t('today.startFocus', { n: upNext.sessionMin }) }}
        </button>
      </div>

      <!-- The other Top tasks -->
      <div v-if="rest.length" class="card flex flex-col overflow-hidden !rounded-[18px]">
        <div v-for="task in rest" :key="task.id" class="relative flex min-h-[62px] items-center gap-3 border-b border-rule2 px-4 py-2 last:border-b-0" data-testid="top3-row">
          <CheckCircle :checked="false" :label="t('today.markDone')" @toggle="complete(task)" />
          <button type="button" class="flex min-w-0 grow flex-col gap-0.5 text-left" @click="openTask(task.id)">
            <span class="truncate text-[15px] font-medium text-ink" :title="task.title">{{ task.title }}</span>
            <span class="flex items-center gap-1.5 truncate text-[12px] text-soft">
              <span class="size-2 shrink-0 rounded-full" :style="{ background: BOX_STYLES[task.box].solid }" aria-hidden="true" />{{ meta(task) }}
            </span>
          </button>
          <button
            v-if="!focus"
            type="button"
            class="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand"
            :aria-label="`${task.title}: ${t('today.startFocus', { n: task.sessionMin })}`"
            data-testid="row-focus"
            @click="startFocus(task)"
          >
            <UIcon name="i-lucide-play" class="size-[18px]" />
          </button>
        </div>
      </div>

      <!-- All Top tasks finished -->
      <div v-if="allDone" class="flex items-center gap-3.5 rounded-[22px] bg-brand-tint p-4 text-brand-dark" data-testid="hero-done">
        <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-white"><UIcon name="i-lucide-party-popper" class="size-6" /></span>
        <span class="display text-[18px] font-semibold">{{ t('today.allDoneTitle', { top: topN }) }}</span>
      </div>

      <!-- No Top tasks yet: one way forward -->
      <div v-else-if="loaded && !top3.length" class="flex flex-col items-center gap-3 rounded-[22px] bg-white p-6 text-center" data-testid="hero-empty">
        <span class="flex size-14 items-center justify-center rounded-full bg-brand-tint text-brand"><UIcon name="i-lucide-star" class="size-7" /></span>
        <span class="display text-[18px] font-semibold">{{ t('today.noTop3Title', { top: topN }) }}</span>
        <UButton v-if="planTasks.length" to="/plan" block size="xl" class="h-[52px] whitespace-nowrap rounded-[14px] text-[15px] font-semibold" icon="i-lucide-layout-grid" :label="t('today.pickFromPlan')" data-testid="pick-from-plan" />
        <UButton v-if="inbox.length" block size="xl" :color="planTasks.length ? 'neutral' : 'primary'" :variant="planTasks.length ? 'outline' : 'solid'" class="h-[52px] whitespace-nowrap rounded-[14px] text-[15px] font-semibold" icon="i-lucide-inbox" :label="t('today.sortInbox', { n: inbox.length })" data-testid="sort-inbox" @click="openSort()" />
        <UButton v-if="!planTasks.length && !inbox.length" block size="xl" class="h-[52px] whitespace-nowrap rounded-[14px] text-[15px] font-semibold" icon="i-lucide-plus" :label="t('today.addTask')" data-testid="add-first" @click="openCapture('task')" />
      </div>

      <!-- Habits -->
      <template v-if="routinesToday.length">
        <div class="flex items-baseline justify-between px-1 pt-3">
          <h2 class="m-0 flex items-center gap-1.5 text-[15px] font-semibold"><UIcon name="i-lucide-repeat" class="size-4 text-brand" />{{ t('today.routine') }}</h2>
          <span class="text-[13px] text-soft">{{ t('today.routineOf', { done: routinesDone, total: routinesToday.length }) }}</span>
        </div>
        <div v-if="openRoutines.length" class="card flex flex-col overflow-hidden !rounded-[18px]">
          <div v-for="r in openRoutines" :key="r.id" class="flex min-h-[60px] items-center gap-3 border-b border-rule2 px-4 py-2 last:border-b-0" data-testid="routine-tile">
            <CheckCircle :checked="false" :label="`${r.title}: ${t('today.markDone')}`" data-testid="routine-check" @toggle="complete(r, true)" />
            <button type="button" class="flex min-w-0 grow flex-col gap-0.5 text-left" @click="openTask(r.id)">
              <span class="truncate text-[15px] font-medium text-ink">{{ r.title }}</span>
              <span class="flex items-center gap-1 truncate text-[12px]" :class="streakOf(r) > 0 ? 'font-medium text-b1' : 'text-soft'">
                <UIcon v-if="streakOf(r) > 0" name="i-lucide-flame" class="size-3.5 shrink-0" />{{ routineSub(r) }}
              </span>
            </button>
            <button
              v-if="!focus"
              type="button"
              class="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand"
              :aria-label="`${r.title}: ${t('today.startFocus', { n: r.sessionMin })}`"
              data-testid="routine-focus"
              @click="startFocus(r)"
            >
              <UIcon name="i-lucide-play" class="size-[18px]" />
            </button>
          </div>
        </div>
        <p v-else class="m-0 flex items-center gap-2.5 rounded-[18px] bg-brand-tint p-4 text-[15px] font-semibold text-brand-dark" data-testid="routines-done">
          <UIcon name="i-lucide-circle-check" class="size-5 shrink-0" />{{ t('today.routinesDone') }}
        </p>
      </template>
    </section>

    <TabBar />
  </div>
</template>

<style scoped>
/* Dark up to the very top edge (behind the notch), like the splash and welcome screens. */
.today {
  margin-top: calc(-1 * env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top);
  min-height: 100dvh;
}
.next { box-shadow: 0 1px 0 var(--color-rule), 0 18px 36px -22px rgba(14, 28, 26, 0.45); }
</style>
