<script setup lang="ts">
import type { BackupFile, NotifSettings } from '~/types'
import type { ThemeChoice } from '~/composables/useTheme'

const { t } = useI18n()
const topN = useTopN()
const fmt = useFmt()
const toast = useToast()
const { sheets } = useSheets()
const { active: profile, profiles, update, setPin, remove } = useProfile()
const { settings, set, setNotif } = useSettings()
const notify = useNotify()

// ---- profile card ----
const nameDraft = ref(profile.value?.name || '')
watch(() => profile.value?.name, (n) => { nameDraft.value = n || '' })
async function saveName() {
  const n = nameDraft.value.trim()
  if (profile.value && n && n !== profile.value.name) await update(profile.value.id, { name: n })
  else nameDraft.value = profile.value?.name || ''
}
const photoInput = ref<HTMLInputElement | null>(null)
async function onPhoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !profile.value) return
  try {
    await update(profile.value.id, { photo: await resizeImage(file, 200) })
  }
  catch {
    toast.add({ title: t('profiles.photoError'), color: 'error' })
  }
  (e.target as HTMLInputElement).value = ''
}

// ---- focus ----
const focusOptions = [15, 20, 25, 30, 45, 50, 60, 90]
const breakOptions = [5, 10, 15, 20, 30]

// ---- notifications ----
interface Row { key: keyof NotifSettings, timeKey?: keyof NotifSettings, label: string, sub: string }
const notifRows = computed<Row[]>(() => [
  { key: 'morning', timeKey: 'morningTime', label: t('settings.morning'), sub: t('settings.morningSub', { top: topN.value }) },
  { key: 'routine', timeKey: 'routineTime', label: t('settings.routine'), sub: t('settings.routineSub') },
  { key: 'evening', timeKey: 'eveningTime', label: t('settings.evening'), sub: t('settings.eveningSub') }
])
async function enableNotifications() {
  await notify.requestPermission()
  await set('notifAsked', true)
}
async function test() {
  if (notify.permission.value === 'default') await notify.requestPermission()
  if (notify.permission.value !== 'granted') {
    toast.add({ title: t('settings.testBlocked'), description: t(`notifyInfo.${notify.permission.value === 'unsupported' ? 'unsupported' : 'denied'}`), color: 'warning' })
    return
  }
  await notify.deliver({ kind: 'test', title: t('notif.testTitle'), body: t('notif.testBody'), url: '/notifications', tag: 'sati-test' })
}

// ---- app ----
async function setLanguage(code: string) {
  if (profile.value) await update(profile.value.id, { locale: code === 'en' ? 'en' : 'km' })
}

// ---- PIN ----
const pinDraft = ref('')
const pinEditing = ref(false)
async function savePin() {
  if (!profile.value) return
  if (!/^\d{4}$/.test(pinDraft.value)) {
    toast.add({ title: t('profiles.pinInvalid'), color: 'warning' })
    return
  }
  await setPin(profile.value.id, pinDraft.value)
  pinDraft.value = ''
  pinEditing.value = false
}

// ---- data ----
const lastBackup = computed(() => settings.value.lastBackupAt ? fmt.date(ymd(settings.value.lastBackupAt), { year: 'numeric', month: 'short', day: 'numeric' }) : t('common.never'))
async function download() {
  if (!profile.value) return
  const ids = profiles.value.map(p => p.id)
  await set('lastBackupAt', Date.now())
  const data = await buildBackup(ids)
  const stamp = runtime.today
  downloadText(`sati-backup-${stamp}.json`, JSON.stringify(data))
  toast.add({ title: t('settings.backupSaved'), color: 'success', icon: 'i-lucide-download' })
}
// ---------------------------------------------------------------- app version / update
const rc = useRuntimeConfig()
const builtAt = Date.parse(String(rc.public.buildTime || '')) || 0
/** "1ac258d · 15 Nov 12:52": the commit first, so it's still readable if a narrow screen cuts the end */
const version = computed(() => [rc.public.buildSha, builtAt ? `${fmt.date(ymd(builtAt), { day: 'numeric', month: 'short' })} ${fmt.time(builtAt)}` : ''].filter(Boolean).join(' · '))
const checking = ref(false)
const theme = useTheme()
const themeOptions = computed(() => (['light', 'dark', 'auto'] as const).map(v => ({ value: v, label: t(`settings.theme.${v}`) })))

/** Ask the server for its newest build (past the offline cache). Same build: say so. Newer: install it and reload. */
async function checkUpdate() {
  if (checking.value) return
  if (!navigator.onLine) {
    toast.add({ title: t('settings.updateOffline'), color: 'warning' })
    return
  }
  checking.value = true
  try {
    const res = await fetch(`/_nuxt/builds/latest.json?t=${Date.now()}`, { cache: 'no-store' })
    const latest = (await res.json())?.id
    if (latest && latest === rc.app.buildId) {
      toast.add({ title: t('settings.upToDate'), color: 'success', icon: 'i-lucide-circle-check' })
      return
    }
    toast.add({ title: t('settings.updating'), icon: 'i-lucide-refresh-cw' })
    const reg = await navigator.serviceWorker?.getRegistration()
    await reg?.update()
    reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    // the new service worker reloads the app when it takes over; reload anyway if that hasn't happened
    setTimeout(() => location.reload(), reg ? 8000 : 300)
  }
  catch {
    toast.add({ title: t('settings.updateFailed'), color: 'error' })
  }
  finally {
    checking.value = false
  }
}

const restoreInput = ref<HTMLInputElement | null>(null)
const pending = shallowRef<BackupFile | null>(null)
const restoreOpen = ref(false)
async function onRestoreFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = ''
  if (!file) return
  try {
    pending.value = parseBackup(await file.text())
    restoreOpen.value = true
  }
  catch {
    toast.add({ title: t('settings.restoreError'), color: 'error' })
  }
}
async function doRestore() {
  if (!pending.value) return
  try {
    await restoreBackup(pending.value)
    await useFocus().load()
    toast.add({ title: t('settings.restored'), color: 'success' })
  }
  catch (e) {
    console.error(e)
    toast.add({ title: t('settings.restoreError'), color: 'error' })
  }
  pending.value = null
}

const deleteOpen = ref(false)
async function doDelete() {
  if (!profile.value) return
  const next = await remove(profile.value.id)
  toast.add({ title: t('settings.deleted') })
  await navigateTo(next ? '/' : '/welcome', { replace: true })
}

const route = useRoute()
onMounted(() => {
  if (route.hash) setTimeout(() => document.querySelector(route.hash)?.scrollIntoView({ block: 'start' }), 60)
})

/** state of the system notification permission → banner at the top of Notifications */
const perm = computed(() => notify.permission.value)
const notifTones: Partial<Record<keyof NotifSettings, 'b3' | 'brand' | 'violet' | 'rem' | 'b1' | 'ink'>> = {
  morning: 'b3', routine: 'violet', evening: 'rem'
}
const notifIcons: Partial<Record<keyof NotifSettings, string>> = {
  morning: 'i-lucide-sunrise', routine: 'i-lucide-repeat', evening: 'i-lucide-moon'
}
const langOptions = [{ value: 'km' as const, label: 'ខ្មែរ' }, { value: 'en' as const, label: 'English' }]
</script>

<template>
  <div v-if="profile" class="flex flex-col gap-6 px-[18px] pt-5" style="padding-bottom: calc(120px + env(safe-area-inset-bottom))" data-testid="page-settings">
    <h1 class="display m-0 px-1 text-[30px] font-bold">{{ t('settings.title') }}</h1>

    <!-- Profile hero -->
    <section class="relative -mt-2 overflow-hidden rounded-[26px] bg-night p-5 text-paper">
      <svg width="320" height="320" viewBox="0 0 320 320" class="pointer-events-none absolute -top-24 -right-24" aria-hidden="true">
        <circle cx="160" cy="160" r="150" fill="none" stroke="#FFFFFF" stroke-opacity="0.05" stroke-width="2" />
        <circle cx="160" cy="160" r="105" fill="none" stroke="#FFFFFF" stroke-opacity="0.07" stroke-width="2" />
        <circle cx="160" cy="160" r="60" fill="none" stroke="#3FB8A3" stroke-opacity="0.18" stroke-width="2" />
      </svg>
      <div class="relative flex items-center gap-4">
        <button type="button" class="relative shrink-0 rounded-full ring-4 ring-night2" :aria-label="t('settings.changePhoto')" @click="photoInput?.click()">
          <ProfileAvatar :profile="profile" :size="68" />
          <span class="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-[3px] border-night bg-accent text-night"><UIcon name="i-lucide-camera" class="size-3.5" /></span>
        </button>
        <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="onPhoto">
        <div class="flex min-w-0 grow flex-col">
          <UInput v-model="nameDraft" variant="none" maxlength="40" :aria-label="t('settings.nameLabel')" :ui="{ root: 'w-full', base: 'display h-10 rounded-lg px-0 text-[22px] font-semibold text-paper focus:bg-night2 focus:px-2' }" data-testid="settings-name" @blur="saveName" @keydown.enter="($event.target as HTMLInputElement).blur()" />
          <span v-if="!profile.photo" class="truncate text-[13px] text-nighttext">{{ t('settings.tapPhoto') }}</span>
          <button v-else type="button" class="flex min-h-[28px] items-center gap-1.5 self-start text-[13px] text-nighttext hover:text-paper" @click="update(profile.id, { photo: null })">
            <UIcon name="i-lucide-image-off" class="size-3.5 shrink-0" /><span class="truncate">{{ t('settings.removePhoto') }}</span>
          </button>
        </div>
        <button
          type="button"
          class="flex size-11 shrink-0 items-center justify-center self-start rounded-full bg-night2 text-paper ring-1 ring-nightline hover:bg-nightline"
          :aria-label="t('settings.switch')"
          :title="t('settings.switch')"
          data-testid="settings-switch"
          @click="sheets.profiles = true"
        >
          <UIcon name="i-lucide-arrow-left-right" class="size-5" />
        </button>
      </div>

    </section>

    <!-- Focus -->
    <section class="flex flex-col gap-2">
      <h2 class="section-label caps">{{ t('settings.focus') }}</h2>
      <div class="card flex flex-col overflow-hidden !rounded-[20px]">
        <SettingRow icon="i-lucide-timer" :label="t('settings.sessionLength')">
          <SelectPill :model-value="settings.focusMin" :options="focusOptions.map(n => ({ value: n, label: t('common.min', { n }) }))" :label="t('settings.sessionLength')" testid="set-focus-min" @update:model-value="v => set('focusMin', v)" />
        </SettingRow>
        <SettingRow icon="i-lucide-coffee" tone="b3" :label="t('settings.breakLength')">
          <SelectPill :model-value="settings.breakMin" :options="breakOptions.map(n => ({ value: n, label: t('common.min', { n }) }))" :label="t('settings.breakLength')" @update:model-value="v => set('breakMin', v)" />
        </SettingRow>
        <SettingRow icon="i-lucide-star" tone="b1" :label="t('settings.topCount')">
          <SelectPill :model-value="settings.topCount" :options="[1, 2, 3, 4, 5, 6, 7].map(n => ({ value: n, label: t('settings.topCountN', { n }) }))" :label="t('settings.topCount')" testid="set-top-count" @update:model-value="v => set('topCount', v)" />
        </SettingRow>
      </div>
    </section>

    <!-- Notifications -->
    <section id="notifications" class="flex scroll-mt-4 flex-col gap-2">
      <h2 class="section-label caps">{{ t('settings.notifications') }}</h2>
      <div class="card flex flex-col overflow-hidden !rounded-[20px]">
        <div
          class="m-2 flex items-center gap-3 rounded-2xl px-3.5 py-3"
          :class="perm === 'granted' ? 'bg-brand-tint text-brand-dark' : perm === 'default' ? 'bg-night text-paper' : 'bg-b1-bg text-b1-tx'"
        >
          <UIcon :name="perm === 'granted' ? 'i-lucide-bell-ring' : perm === 'default' ? 'i-lucide-bell' : 'i-lucide-bell-off'" class="size-5 shrink-0" />
          <span class="flex min-w-0 grow flex-col">
            <span class="truncate text-[14px] font-semibold">{{ t('settings.system') }}</span>
            <span class="text-[12px] opacity-80" data-testid="settings-perm">{{ t(`notifyInfo.${perm}`) }}</span>
          </span>
          <button v-if="perm === 'default'" type="button" class="flex h-10 shrink-0 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-night" @click="enableNotifications">{{ t('settings.enable') }}</button>
        </div>

        <SettingRow v-for="r in notifRows" :key="r.key" :icon="notifIcons[r.key] || 'i-lucide-bell'" :tone="notifTones[r.key]" :label="r.label" :sub="r.sub">
          <USwitch :model-value="!!settings.notif[r.key]" size="lg" :aria-label="r.label" :data-testid="`notif-${r.key}`" @update:model-value="setNotif({ [r.key]: $event })" />
          <template v-if="r.timeKey && settings.notif[r.key]" #below>
            <TimePill :model-value="String(settings.notif[r.timeKey])" :label="`${r.label}: ${t('reminder.time')}`" @update:model-value="v => setNotif({ [r.timeKey!]: v })" />
          </template>
        </SettingRow>

        <div class="p-3">
          <button type="button" class="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-soft bg-card text-[14px] font-semibold text-brand" data-testid="test-notification" @click="test">
            <UIcon name="i-lucide-send" class="size-4 shrink-0" /><span class="truncate">{{ t('settings.test') }}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- App -->
    <section class="flex flex-col gap-2">
      <h2 class="section-label caps">{{ t('settings.app') }}</h2>
      <div class="card flex flex-col overflow-hidden !rounded-[20px]">
        <SettingRow icon="i-lucide-languages" tone="rem" :label="t('settings.language')">
          <template #below>
            <SegmentedControl :model-value="profile.locale" :options="langOptions" tone="dark" :label="t('settings.language')" testid="set-language" class="w-full max-w-[280px]" @update:model-value="v => setLanguage(v)" />
          </template>
        </SettingRow>
        <SettingRow icon="i-lucide-lock-keyhole" tone="ink" :label="t('settings.pin')" :sub="profile.pinHash ? t('settings.pinOn') : t('settings.pinOff')">
          <button v-if="profile.pinHash" type="button" class="flex h-9 shrink-0 items-center rounded-full bg-b1-bg px-3.5 text-[13px] font-semibold text-b1-tx" @click="setPin(profile.id, null)">{{ t('settings.pinRemove') }}</button>
          <button v-else-if="!pinEditing" type="button" class="flex h-9 shrink-0 items-center rounded-full bg-brand-tint px-3.5 text-[13px] font-semibold text-brand-dark" @click="pinEditing = true">{{ t('settings.pinSet') }}</button>
          <template v-if="pinEditing && !profile.pinHash" #below>
            <form class="flex w-full gap-2" @submit.prevent="savePin">
              <input v-model="pinDraft" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" class="field h-11 min-w-0 grow !rounded-xl text-center tracking-[0.5em]" :placeholder="t('profiles.pinPlaceholder')" :aria-label="t('profiles.pinPlaceholder')">
              <UButton type="submit" size="lg" class="h-11 shrink-0 rounded-xl px-4" :label="t('common.save')" />
            </form>
          </template>
        </SettingRow>
      </div>
    </section>

    <!-- Data -->
    <section class="flex flex-col gap-2">
      <h2 class="section-label caps">{{ t('settings.data') }}</h2>
      <div class="card flex flex-col overflow-hidden !rounded-[20px]">
        <div class="m-2 flex items-start gap-3 rounded-2xl bg-brand-tint px-3.5 py-3 text-brand-dark">
          <UIcon name="i-lucide-shield-check" class="mt-0.5 size-5 shrink-0" />
          <span class="text-[13px]"><strong>{{ t('settings.dataBold') }}</strong> {{ t('settings.dataNotice') }}</span>
        </div>
        <SettingRow icon="i-lucide-download" :label="t('settings.download')" :sub="t('settings.downloadSub', { when: lastBackup })" button data-testid="backup-all" @click="download()" />
        <SettingRow icon="i-lucide-upload" tone="rem" :label="t('settings.restore')" :sub="t('settings.restoreSub')" button @click="restoreInput?.click()" />
        <input ref="restoreInput" type="file" accept="application/json,.json" class="hidden" data-testid="restore-input" @change="onRestoreFile">
        <SettingRow icon="i-lucide-calendar-sync" tone="violet" :label="t('settings.backupReminder')" :sub="t('settings.backupReminderSub')">
          <USwitch :model-value="settings.notif.backup" size="lg" :aria-label="t('settings.backupReminder')" @update:model-value="setNotif({ backup: $event })" />
        </SettingRow>
      </div>
    </section>

    <!-- App -->
    <section class="flex flex-col gap-2">
      <h2 class="section-label caps">{{ t('settings.app') }}</h2>
      <div class="card flex flex-col overflow-hidden !rounded-[20px]">
        <SettingRow icon="i-lucide-moon" tone="violet" :label="t('settings.theme.label')">
          <template #below>
            <SegmentedControl :model-value="theme.choice.value" :options="themeOptions" :label="t('settings.theme.label')" testid="set-theme" @update:model-value="theme.set($event as ThemeChoice)" />
          </template>
        </SettingRow>
        <SettingRow :icon="checking ? 'i-lucide-loader-circle' : 'i-lucide-refresh-cw'" tone="ink" :label="t('settings.checkUpdate')" :sub="checking ? t('settings.checking') : version" button data-testid="check-update" @click="checkUpdate()" />
      </div>
    </section>

    <button type="button" class="flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-b1-tx hover:bg-b1-bg" data-testid="delete-profile" @click="deleteOpen = true">
      <UIcon name="i-lucide-trash-2" class="size-4" />{{ t('settings.deleteProfile') }}
    </button>

    <ConfirmModal v-model:open="restoreOpen" :title="t('settings.restoreTitle')" :body="t('settings.restoreBody', pending?.profiles.length || 1)" :confirm-label="t('settings.restoreDo')" @confirm="doRestore" />
    <ConfirmModal v-model:open="deleteOpen" :title="t('settings.deleteTitle', { name: profile.name })" :body="t('settings.deleteBody')" :confirm-label="t('common.delete')" danger @confirm="doDelete" />
    <TabBar />
  </div>
</template>
