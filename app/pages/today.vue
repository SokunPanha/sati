<script setup lang="ts">
import type { Task } from '~/types'

// Today (/today): one list for the Top tasks and one for habits, with the same row everywhere:
// tick to finish, tap the title to open it, ▶ to start a focus session. The first unfinished Top task gets the
// solid ▶ (that's "up next"). A running session shows a card to go back to it.
const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const { active: profile } = useProfile()
const { sheets, openSort, openTask, openCapture } = useSheets()
const { top3, inbox, active: planTasks, routinesToday, routineDone, streakOf, setDone, toggleRoutine, loaded } = useTasks()
const { next: nextReminder, todayCount } = useReminders()
const { focus, remainingMs, start } = useFocus()

const { data: unread } = useLiveQuery(db => db.notifications.filter(n => !n.read).count(), 0)

const upNext = computed(() => top3.value.find(x => x.status !== 'done') || null)
const doneCount = computed(() => top3.value.filter(x => x.status === 'done').length)
const allDone = computed(() => top3.value.length > 0 && doneCount.value === top3.value.length)
const routinesDone = computed(() => routinesToday.value.filter(r => routineDone(r)).length)
const focusOnBreak = computed(() => focus.value?.phase === 'break' || focus.value?.phase === 'break-done')

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

async function startFocus(task: Task) {
  await start(task)
  await navigateTo('/focus')
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

    <h1 class="display m-0 px-[22px] text-[34px] font-bold">{{ t('today.title') }}</h1>

    <NuxtLink v-if="nextReminder" to="/reminders" class="card mx-[22px] mt-3.5 flex min-h-[44px] items-center gap-2.5 !rounded-xl px-3 text-ink" :aria-label="`${t('today.nextReminder')}: ${fmt.time(nextReminder.at)} ${nextReminder.title}`" data-testid="next-reminder">
      <UIcon name="i-lucide-alarm-clock" class="size-[18px] shrink-0 text-rem" />
      <span class="shrink-0 text-[14px] font-bold text-rem-tx">{{ nextReminder.date === runtime.today ? fmt.time(nextReminder.at) : `${fmt.relativeDay(nextReminder.date)} ${fmt.time(nextReminder.at)}` }}</span>
      <span class="min-w-0 grow truncate text-[14px]">{{ nextReminder.title }}</span>
      <span v-if="todayCount > 1" class="shrink-0 text-[12px] text-soft">{{ t('today.moreToday', { n: todayCount - 1 }) }}</span>
    </NuxtLink>

    <!-- A session is running or waiting: always offer the way back -->
    <NuxtLink v-if="focus" to="/focus" class="mx-[22px] mt-3 flex items-center gap-3 rounded-[18px] bg-night p-4 text-white" data-testid="hero-focus">
      <span class="flex min-w-0 grow flex-col gap-0.5">
        <span class="text-[12px] font-semibold text-mint">{{ focusOnBreak ? t('today.onBreak') : t('today.inFocus') }}</span>
        <span class="truncate text-[16px] font-semibold">{{ focus.title }}</span>
      </span>
      <span class="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-accent px-3.5 text-[15px] font-semibold text-night">
        <UIcon name="i-lucide-play" class="size-4" />{{ clock(remainingMs) }}
      </span>
    </NuxtLink>

    <!-- Top tasks -->
    <template v-if="top3.length">
      <div class="flex items-baseline justify-between px-[22px] pb-2.5 pt-6">
        <h2 class="m-0 text-[15px] font-semibold">{{ t('today.top3', { top: topN }) }}</h2>
        <span class="text-[13px] font-semibold" :class="allDone ? 'text-brand' : 'text-soft'" data-testid="top-progress">{{ t('today.routineOf', { done: doneCount, total: top3.length }) }}</span>
      </div>
      <div class="card mx-[22px] flex flex-col overflow-hidden">
        <div v-for="task in top3" :key="task.id" class="flex min-h-[64px] items-center gap-3 border-b border-rule2 px-4 py-2.5 last:border-b-0" data-testid="top3-row">
          <CheckCircle :checked="task.status === 'done'" :label="task.status === 'done' ? t('today.markUndone') : t('today.markDone')" @toggle="setDone(task, task.status !== 'done')" />
          <button type="button" class="flex min-w-0 grow flex-col gap-0.5 text-left" @click="openTask(task.id)">
            <span class="truncate text-[15px]" :class="task.status === 'done' ? 'text-soft line-through' : 'font-medium text-ink'" :title="task.title">{{ task.title }}</span>
            <span v-if="meta(task)" class="truncate text-[12px] text-soft">{{ meta(task) }}</span>
          </button>
          <button
            v-if="task.status !== 'done' && !focus"
            type="button"
            class="flex size-11 shrink-0 items-center justify-center rounded-full"
            :class="task.id === upNext?.id ? 'bg-brand text-white' : 'border border-edge bg-white text-brand'"
            :aria-label="`${task.title}: ${t('today.startFocus', { n: task.sessionMin })}`"
            :data-testid="task.id === upNext?.id ? 'start-focus' : 'row-focus'"
            @click="startFocus(task)"
          >
            <UIcon name="i-lucide-play" class="size-[18px]" />
          </button>
        </div>
      </div>
      <p v-if="allDone" class="m-0 mx-[22px] mt-2.5 flex items-center gap-2 text-[14px] font-medium text-brand-dark" data-testid="hero-done">
        <UIcon name="i-lucide-circle-check" class="size-5 shrink-0" />{{ t('today.allDoneTitle', { top: topN }) }}
      </p>
    </template>

    <!-- No Top tasks yet: one way forward -->
    <div v-else-if="loaded" class="card mx-[22px] mt-4 flex flex-col gap-3 !rounded-[18px] p-4" data-testid="hero-empty">
      <span class="text-[16px] font-semibold">{{ t('today.noTop3Title', { top: topN }) }}</span>
      <UButton v-if="planTasks.length" to="/plan" block size="xl" class="h-[52px] whitespace-nowrap rounded-[14px] text-[15px] font-semibold" icon="i-lucide-layout-grid" :label="t('today.pickFromPlan')" data-testid="pick-from-plan" />
      <UButton v-if="inbox.length" block size="xl" :color="planTasks.length ? 'neutral' : 'primary'" :variant="planTasks.length ? 'outline' : 'solid'" class="h-[52px] whitespace-nowrap rounded-[14px] text-[15px] font-semibold" icon="i-lucide-inbox" :label="t('today.sortInbox', { n: inbox.length })" data-testid="sort-inbox" @click="openSort()" />
      <UButton v-if="!planTasks.length && !inbox.length" block size="xl" class="h-[52px] whitespace-nowrap rounded-[14px] text-[15px] font-semibold" icon="i-lucide-plus" :label="t('today.addTask')" data-testid="add-first" @click="openCapture('task')" />
    </div>

    <!-- Habits: same row as the Top list -->
    <template v-if="routinesToday.length">
      <div class="flex items-baseline justify-between px-[22px] pb-2.5 pt-6">
        <h2 class="m-0 text-[15px] font-semibold">{{ t('today.routine') }}</h2>
        <span class="text-[13px] text-soft">{{ t('today.routineOf', { done: routinesDone, total: routinesToday.length }) }}</span>
      </div>
      <div class="card mx-[22px] flex flex-col overflow-hidden">
        <div v-for="r in routinesToday" :key="r.id" class="flex min-h-[60px] items-center gap-3 border-b border-rule2 px-4 py-2 last:border-b-0" data-testid="routine-tile">
          <CheckCircle :checked="routineDone(r)" :label="`${r.title}: ${routineDone(r) ? t('today.markUndone') : t('today.markDone')}`" data-testid="routine-check" @toggle="toggleRoutine(r)" />
          <button type="button" class="flex min-w-0 grow flex-col gap-0.5 text-left" @click="openTask(r.id)">
            <span class="truncate text-[15px]" :class="routineDone(r) ? 'text-soft line-through' : 'font-medium text-ink'">{{ r.title }}</span>
            <span class="truncate text-[12px] text-soft">{{ routineSub(r) }}</span>
          </button>
          <button
            v-if="!routineDone(r) && !focus"
            type="button"
            class="flex size-11 shrink-0 items-center justify-center rounded-full border border-edge bg-white text-brand"
            :aria-label="`${r.title}: ${t('today.startFocus', { n: r.sessionMin })}`"
            data-testid="routine-focus"
            @click="startFocus(r)"
          >
            <UIcon name="i-lucide-play" class="size-[18px]" />
          </button>
        </div>
      </div>
    </template>

    <TabBar />
  </div>
</template>
