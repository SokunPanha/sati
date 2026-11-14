<script setup lang="ts">
import type { AppNotification, NotifKind } from '~/types'

const { t } = useI18n()
const fmt = useFmt()
const { tasks } = useTasks()
const { start, startBatch } = useFocus()

const { data: all } = useLiveQuery(db => db.notifications.orderBy('at').reverse().limit(80).toArray(), [] as AppNotification[])
const fresh = computed(() => all.value.filter(n => !n.read))
const earlier = computed(() => all.value.filter(n => n.read))

const ICONS: Record<NotifKind, string> = {
  reminder: 'i-lucide-alarm-clock',
  focus: 'i-lucide-timer',
  break: 'i-lucide-coffee',
  morning: 'i-lucide-sun',
  evening: 'i-lucide-moon',
  box2: 'i-lucide-layout-grid',
  routine: 'i-lucide-flame',
  due: 'i-lucide-calendar-clock',
  backup: 'i-lucide-download',
  test: 'i-lucide-bell-ring'
}
function tone(kind: NotifKind) {
  if (kind === 'routine' || kind === 'due') return { bg: '#FBE9DF', fg: '#8A3409' }
  return { bg: '#E3F0EC', fg: '#0F6E64' }
}
const when = (n: AppNotification) => ymd(n.at) === runtime.today ? fmt.time(n.at) : `${fmt.shortDate(ymd(n.at))} ${fmt.time(n.at)}`
const taskFor = (n: AppNotification) => n.action === 'focus' && n.taskId ? tasks.value.find(x => x.id === n.taskId && x.status === 'active') : undefined

async function read(n: AppNotification) {
  await requireDb().notifications.update(n.id, { read: true })
}
async function open(n: AppNotification) {
  await read(n)
  if (n.url && n.url !== '/notifications') await navigateTo(n.url)
}
async function focusOn(n: AppNotification) {
  const task = taskFor(n)
  await read(n)
  if (!task) return
  await start(task)
  await navigateTo('/focus')
}
/** A reminder with a focus time: start a session for it (no task attached). */
async function focusReminder(n: AppNotification) {
  await read(n)
  if (!n.focusMin) return
  await startBatch([], n.title, n.focusMin)
  await navigateTo('/focus')
}
async function markAll() {
  await requireDb().notifications.filter(n => !n.read).modify({ read: true })
}
async function clearEarlier() {
  const ids = await requireDb().notifications.filter(n => n.read).primaryKeys()
  await requireDb().notifications.bulkDelete(ids)
}
</script>

<template>
  <div class="flex min-h-dvh flex-col gap-[18px] px-[22px] pt-4 pb-safe" data-testid="page-notifications">
    <PageHeader :title="t('notifs.title')" back="/">
      <NuxtLink to="/settings#notifications" class="tap -mr-2.5 text-ink" :aria-label="t('notifs.settings')">
        <UIcon name="i-lucide-sliders-horizontal" class="size-5" />
      </NuxtLink>
    </PageHeader>

    <div v-if="!all.length" class="card flex flex-col items-center gap-2 p-6 text-center" data-testid="notifs-empty">
      <UIcon name="i-lucide-bell" class="size-7 text-soft" />
      <span class="text-[15px] font-semibold">{{ t('notifs.emptyTitle') }}</span>
      <span class="text-[13px] text-soft">{{ t('notifs.emptyBody') }}</span>
    </div>

    <section v-if="fresh.length" class="flex flex-col gap-2.5">
      <div class="flex items-center justify-between">
        <h2 class="section-label caps">{{ t('notifs.new') }}</h2>
        <button type="button" class="flex min-h-[44px] items-center text-[13px] font-medium text-brand" @click="markAll">{{ t('notifs.markAll') }}</button>
      </div>
      <template v-for="n in fresh" :key="n.id">
        <div v-if="n.kind === 'reminder'" class="flex gap-3 rounded-2xl bg-rem-bg p-3.5" :class="n.focusMin ? '' : 'items-center'" data-testid="notif-new">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-rem"><UIcon name="i-lucide-alarm-clock" class="size-5" /></span>
          <div class="flex min-w-0 grow flex-col gap-2">
            <div class="flex flex-col gap-0.5">
              <span class="text-[15px] font-semibold text-rem-tx">{{ n.title }}</span>
              <span class="text-[12px] text-rem-tx">{{ n.body }}</span>
            </div>
            <div v-if="n.focusMin" class="flex flex-wrap gap-2">
              <button type="button" class="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-rem px-3.5 text-[13px] font-semibold text-white" data-testid="notif-reminder-focus" @click="focusReminder(n)">
                <UIcon name="i-lucide-play" class="size-4" />{{ t('notifs.startFocusMin', { n: n.focusMin }) }}
              </button>
              <button type="button" class="flex h-11 items-center whitespace-nowrap rounded-[10px] bg-white px-3.5 text-[13px] font-medium text-rem-tx" @click="read(n)">{{ t('notifs.gotIt') }}</button>
            </div>
          </div>
          <button v-if="!n.focusMin" type="button" class="h-11 shrink-0 rounded-[10px] bg-white px-3 text-[12px] font-semibold text-rem-tx" @click="read(n)">{{ t('notifs.gotIt') }}</button>
        </div>
        <div v-else class="card flex gap-3 p-3.5" data-testid="notif-new">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl" :style="{ background: tone(n.kind).bg, color: tone(n.kind).fg }"><UIcon :name="ICONS[n.kind]" class="size-5" /></span>
          <div class="flex min-w-0 grow flex-col gap-2">
            <div class="flex flex-col gap-0.5">
              <div class="flex justify-between gap-2"><span class="text-[15px] font-semibold">{{ n.title }}</span><span class="shrink-0 text-[12px] text-soft">{{ when(n) }}</span></div>
              <span class="text-[13px] text-soft">{{ n.body }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button v-if="taskFor(n)" type="button" class="flex h-11 items-center rounded-[10px] bg-brand px-3.5 text-[13px] font-semibold text-white" @click="focusOn(n)">{{ t('notifs.startFocus') }}</button>
              <button v-else-if="n.url !== '/notifications'" type="button" class="flex h-11 items-center rounded-[10px] bg-ink px-3.5 text-[13px] font-semibold text-white" @click="open(n)">{{ t('notifs.open') }}</button>
              <button type="button" class="flex h-11 items-center rounded-[10px] border border-edge bg-white px-3.5 text-[13px] font-medium text-ink" @click="read(n)">{{ t('notifs.gotIt') }}</button>
            </div>
          </div>
        </div>
      </template>
    </section>

    <section v-if="earlier.length" class="flex flex-col gap-2.5">
      <div class="flex items-center justify-between">
        <h2 class="section-label caps">{{ t('notifs.earlier') }}</h2>
        <button type="button" class="flex min-h-[44px] items-center text-[13px] font-medium text-soft" @click="clearEarlier">{{ t('notifs.clear') }}</button>
      </div>
      <div class="card flex flex-col overflow-hidden">
        <div v-for="n in earlier" :key="n.id" class="flex items-center gap-3 border-b border-rule2 p-3.5 last:border-b-0" data-testid="notif-earlier">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-cream text-soft"><UIcon :name="ICONS[n.kind]" class="size-4" /></span>
          <div class="flex min-w-0 grow flex-col gap-0.5"><span class="text-[14px] font-medium">{{ n.title }}</span><span class="text-[12px] text-soft">{{ when(n) }}</span></div>
        </div>
      </div>
    </section>

    <span class="mt-auto text-center text-[12px] text-soft">{{ t('notifs.foot') }}</span>
  </div>
</template>
