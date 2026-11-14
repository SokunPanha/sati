<script setup lang="ts">
import type { FocusSession, Task } from '~/types'

const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const { active: profile } = useProfile()
const { sheets, openSort, openTask } = useSheets()
const { settings } = useSettings()
const { top3, inbox, active: planTasks, routinesToday, routineDone, streakOf, setDone, toggleRoutine, loaded } = useTasks()
const { next: nextReminder, todayCount } = useReminders()
const { focus, remainingMs, start } = useFocus()

const { data: sessionsToday } = useLiveQuery(db => db.sessions.where('date').equals(runtime.today).toArray(), [] as FocusSession[], [() => runtime.today])
const { data: unread } = useLiveQuery(db => db.notifications.filter(n => !n.read).count(), 0)

const sessionsDone = computed(() => sessionsToday.value.filter(s => s.completed).length)
const goal = computed(() => settings.value.dailyGoal)
const upNext = computed(() => top3.value.find(x => x.status !== 'done') || null)
const rest = computed(() => top3.value.filter(x => x.id !== upNext.value?.id))
const doneCount = computed(() => top3.value.filter(x => x.status === 'done').length)
const routinesDone = computed(() => routinesToday.value.filter(r => routineDone(r)).length)
const focusOnBreak = computed(() => focus.value?.phase === 'break' || focus.value?.phase === 'break-done')

function meta(task: Task) {
  const parts = [task.area]
  if (task.status !== 'done') parts.push(`${task.sessionsPlanned} × ${t('common.min', { n: task.sessionMin })}`)
  if (task.carriedFrom) parts.push(t('today.carried'))
  return parts.filter(Boolean).join(' · ')
}

async function startFocus(task: Task) {
  await start(task)
  await navigateTo('/focus')
}

async function tapRoutine(task: Task) {
  if (routineDone(task)) await toggleRoutine(task)
  else await startFocus(task)
}

function routineSub(task: Task) {
  const n = streakOf(task)
  const mins = t('dur.m', { n: task.sessionMin })
  if (routineDone(task)) return t('today.streak', { n })
  return n > 0 ? `${t('today.streak', { n })} · ${mins}` : `${fmt.repeatLabel(task.repeat)} · ${mins}`
}
</script>

<template>
  <div data-testid="page-today" style="padding-bottom: calc(120px + env(safe-area-inset-bottom))">
    <div class="flex items-center justify-between px-[22px] pt-4">
      <span class="text-[13px] font-medium text-soft">{{ fmt.longDate(runtime.today) }}</span>
      <div class="flex items-center gap-1">
        <NuxtLink to="/notifications" class="tap relative text-ink" :aria-label="unread ? t('today.notificationsNew', { n: unread }) : t('today.notifications')" data-testid="bell">
          <UIcon name="i-lucide-bell" class="size-[22px]" />
          <span v-if="unread" class="absolute right-[9px] top-[9px] size-[9px] rounded-full border-2 border-cream bg-b1" data-testid="unread-dot" />
        </NuxtLink>
        <button type="button" class="tap" :aria-label="t('today.switchProfile', { name: profile?.name || '' })" data-testid="avatar" @click="sheets.profiles = true">
          <ProfileAvatar :profile="profile" :size="36" />
        </button>
      </div>
    </div>

    <div class="flex items-end justify-between px-[22px]">
      <h1 class="display m-0 text-[34px] font-bold">{{ t('today.title') }}</h1>
      <div class="flex flex-col items-end gap-1.5 pb-1.5">
        <span class="text-[12px] text-soft">{{ t('today.sessionsOf', { done: sessionsDone, goal }) }}</span>
        <div class="grid gap-1" :style="{ gridTemplateColumns: `repeat(${goal}, minmax(0, 1fr))`, width: `${Math.min(140, goal * 24)}px` }" aria-hidden="true">
          <div v-for="i in goal" :key="i" class="h-1.5 rounded-full" :class="i <= sessionsDone ? 'bg-brand' : 'bg-edge'" />
        </div>
      </div>
    </div>

    <NuxtLink v-if="nextReminder" to="/reminders" class="card mx-[22px] mt-3.5 flex min-h-[44px] items-center gap-2.5 !rounded-xl px-3 text-ink" :aria-label="`${t('today.nextReminder')}: ${fmt.time(nextReminder.at)} ${nextReminder.title}`" data-testid="next-reminder">
      <UIcon name="i-lucide-alarm-clock" class="size-[18px] shrink-0 text-rem" />
      <span class="shrink-0 text-[14px] font-bold text-rem-tx">{{ nextReminder.date === runtime.today ? fmt.time(nextReminder.at) : `${fmt.relativeDay(nextReminder.date)} ${fmt.time(nextReminder.at)}` }}</span>
      <span class="min-w-0 grow truncate text-[14px]">{{ nextReminder.title }}</span>
      <span v-if="todayCount > 1" class="shrink-0 text-[12px] text-soft">{{ t('today.moreToday', { n: todayCount - 1 }) }}</span>
    </NuxtLink>

    <!-- A session is running or waiting: always offer the way back -->
    <NuxtLink v-if="focus" to="/focus" class="mx-[22px] mt-3 flex flex-col gap-4 rounded-[22px] bg-night p-5 text-white" data-testid="hero-focus">
      <span class="caps text-[12px] font-semibold text-mint">{{ focusOnBreak ? t('today.onBreak') : t('today.inFocus') }}</span>
      <span class="display text-[24px] font-semibold">{{ focus.title }}</span>
      <span class="flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-accent text-[16px] font-semibold text-night">
        <UIcon name="i-lucide-play" class="size-[18px]" />{{ t('today.resumeFocus', { time: clock(remainingMs) }) }}
      </span>
    </NuxtLink>

    <div v-else-if="upNext" class="mx-[22px] mt-3 flex flex-col gap-4 rounded-[22px] bg-brand p-5 text-white" data-testid="hero">
      <div class="flex items-center justify-between gap-2">
        <span class="caps text-[12px] font-semibold text-brand-pale">{{ t('today.upNext') }}</span>
        <BoxBadge :box="upNext.box" />
      </div>
      <div class="flex flex-col gap-1">
        <span class="display text-[26px] font-semibold" data-testid="hero-title">{{ upNext.title }}</span>
        <span class="text-[14px] text-brand-pale">{{ meta(upNext) }}</span>
      </div>
      <button type="button" class="flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-white text-[16px] font-semibold text-brand-dark" data-testid="start-focus" @click="startFocus(upNext)">
        <UIcon name="i-lucide-play" class="size-[18px]" />{{ t('today.startFocus', { n: upNext.sessionMin }) }}
      </button>
      <button type="button" class="-my-2 flex min-h-[44px] items-center justify-center gap-1.5 text-[13px] font-medium text-brand-pale" @click="setDone(upNext, true)">
        <UIcon name="i-lucide-check" class="size-4" />{{ t('today.markDone') }}
      </button>
    </div>

    <div v-else-if="loaded && top3.length" class="mx-[22px] mt-3 flex flex-col gap-2 rounded-[22px] bg-brand-tint p-5 text-brand-dark" data-testid="hero-done">
      <UIcon name="i-lucide-circle-check" class="size-7" />
      <span class="display text-[22px] font-semibold">{{ t('today.allDoneTitle', { top: topN }) }}</span>
      <span class="text-[14px]">{{ t('today.allDoneBody') }}</span>
    </div>

    <div v-else-if="loaded" class="card mx-[22px] mt-3 flex flex-col gap-3 !rounded-[22px] p-5" data-testid="hero-empty">
      <span class="display text-[22px] font-semibold">{{ t('today.noTop3Title', { top: topN }) }}</span>
      <span class="text-[14px] text-soft">{{ planTasks.length || inbox.length ? t('today.noTop3Body', { top: topN }) : t('today.emptyStart') }}</span>
      <UButton v-if="planTasks.length" to="/plan" block size="xl" class="h-[52px] rounded-[14px] text-[15px] font-semibold" icon="i-lucide-layout-grid" :label="t('today.pickFromPlan')" data-testid="pick-from-plan" />
      <UButton v-if="inbox.length" block size="xl" color="neutral" class="h-[52px] rounded-[14px] text-[15px] font-semibold" icon="i-lucide-inbox" :label="t('today.sortInbox', { n: inbox.length })" data-testid="sort-inbox" @click="openSort()" />
    </div>

    <template v-if="rest.length || (focus && top3.length)">
      <div class="flex items-baseline justify-between px-[22px] pb-2.5 pt-6">
        <h2 class="m-0 text-[15px] font-semibold">{{ upNext && !focus ? t('today.restTop3', { top: topN }) : t('today.top3', { top: topN }) }}</h2>
        <span v-if="doneCount" class="text-[13px] text-soft">{{ t('today.doneCount', { n: doneCount }) }}</span>
      </div>
      <div class="card mx-[22px] flex flex-col overflow-hidden">
        <div v-for="task in (focus ? top3 : rest)" :key="task.id" class="flex items-center gap-3 border-b border-rule2 px-4 py-3.5 last:border-b-0" data-testid="top3-row">
          <CheckCircle :checked="task.status === 'done'" :label="task.status === 'done' ? t('today.markUndone') : t('today.markDone')" @toggle="setDone(task, task.status !== 'done')" />
          <button type="button" class="flex min-w-0 grow flex-col gap-0.5 text-left" @click="openTask(task.id)">
            <span class="truncate text-[15px]" :class="task.status === 'done' ? 'text-soft line-through' : 'font-medium text-ink'" :title="task.title">{{ task.title }}</span>
            <span v-if="meta(task)" class="truncate text-[12px] text-soft">{{ meta(task) }}</span>
          </button>
          <BoxBadge v-if="task.status !== 'done'" :box="task.box" />
        </div>
      </div>
    </template>

    <template v-if="routinesToday.length">
      <div class="flex items-baseline justify-between px-[22px] pb-2.5 pt-5">
        <h2 class="m-0 text-[15px] font-semibold">{{ t('today.routine') }}</h2>
        <span class="text-[13px] text-soft">{{ t('today.routineOf', { done: routinesDone, total: routinesToday.length }) }}</span>
      </div>
      <div class="mx-[22px] grid grid-cols-3 gap-2">
        <div
          v-for="r in routinesToday"
          :key="r.id"
          class="relative flex min-h-[76px] flex-col justify-between rounded-[14px] px-3 py-2.5"
          :class="routineDone(r) ? 'bg-brand-tint text-brand-dark' : 'border border-rule bg-white text-ink'"
          data-testid="routine-tile"
        >
          <button type="button" class="absolute inset-0 rounded-[14px]" :aria-label="routineDone(r) ? `${r.title}: ${t('today.markUndone')}` : `${r.title}: ${t('today.startFocus', { n: r.sessionMin })}`" @click="tapRoutine(r)" />
          <span class="flex items-center gap-1.5 text-[14px] font-semibold">
            <button type="button" role="checkbox" :aria-checked="routineDone(r)" :aria-label="`${r.title}: ${routineDone(r) ? t('today.markUndone') : t('today.markDone')}`" class="relative z-10 -m-3 flex size-11 shrink-0 items-center justify-center" data-testid="routine-check" @click.stop="toggleRoutine(r)">
              <span class="flex size-[18px] items-center justify-center rounded-full" :class="routineDone(r) ? 'bg-brand' : 'border-2 border-ringc'">
                <UIcon v-if="routineDone(r)" name="i-lucide-check" class="size-2.5 text-white" />
              </span>
            </button>
            <span class="truncate pl-1">{{ r.title }}</span>
          </span>
          <span class="truncate text-[12px]" :class="routineDone(r) ? 'font-medium' : 'text-soft'">{{ routineSub(r) }}</span>
        </div>
      </div>
    </template>

    <TabBar />
  </div>
</template>
