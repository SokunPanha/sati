<script setup lang="ts">
import type { Profile } from '~/types'

// Switch / create profile. Every profile has its own IndexedDB database.
const { t, locale } = useI18n()
const toast = useToast()
const { sheets } = useSheets()
const { profiles, active, activate, create, verifyPin } = useProfile()

const summaries = ref<Record<string, { routines: number, streak: number }>>({})
async function loadSummaries() {
  const out: Record<string, { routines: number, streak: number }> = {}
  for (const p of profiles.value) {
    try {
      out[p.id] = await profileSummary(profileDb(p.id), runtime.today)
    }
    catch { /* ignore a broken profile DB */ }
  }
  summaries.value = out
}

const showNew = ref(false)
const form = reactive({ name: '', color: PROFILE_COLORS[3]!, photo: null as string | null, lock: false, pin: '' })
const fileInput = ref<HTMLInputElement | null>(null)

watch(() => sheets.profiles, (open) => {
  if (!open) return
  showNew.value = false
  Object.assign(form, { name: '', color: PROFILE_COLORS[profiles.value.length % PROFILE_COLORS.length], photo: null, lock: false, pin: '' })
  loadSummaries()
})

async function onPhoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    form.photo = await resizeImage(file, 200)
  }
  catch {
    toast.add({ title: t('profiles.photoError'), color: 'error' })
  }
  (e.target as HTMLInputElement).value = ''
}

async function createProfile() {
  if (!form.name.trim()) {
    toast.add({ title: t('profiles.nameRequired'), color: 'warning' })
    return
  }
  if (form.lock && !/^\d{4}$/.test(form.pin)) {
    toast.add({ title: t('profiles.pinInvalid'), color: 'warning' })
    return
  }
  const p = await create({ name: form.name, color: form.color, photo: form.photo, pin: form.lock ? form.pin : null, locale: locale.value as 'km' | 'en' })
  sheets.profiles = false
  toast.add({ title: t('profiles.switched', { name: p.name }), color: 'success' })
  await navigateTo('/')
}

// PIN prompt when switching to a locked profile
const pinOpen = ref(false)
const pinTarget = ref<Profile | null>(null)
const pinValue = ref('')
const pinError = ref(false)

async function doSwitch(p: Profile) {
  await activate(p.id)
  sheets.profiles = false
  toast.add({ title: t('profiles.switched', { name: p.name }), color: 'success' })
  await navigateTo('/')
}
function pick(p: Profile) {
  if (p.id === active.value?.id) {
    sheets.profiles = false
    return
  }
  if (p.pinHash) {
    pinTarget.value = p
    pinValue.value = ''
    pinError.value = false
    pinOpen.value = true
  }
  else doSwitch(p)
}
async function unlock() {
  if (!pinTarget.value) return
  if (await verifyPin(pinTarget.value, pinValue.value)) {
    pinOpen.value = false
    await doSwitch(pinTarget.value)
  }
  else {
    pinError.value = true
    pinValue.value = ''
  }
}
function openSettings() {
  sheets.profiles = false
  navigateTo('/settings')
}
</script>

<template>
  <BottomSheet v-model:open="sheets.profiles" :title="t('profiles.title')" :description="t('profiles.sub')">
    <div class="card flex flex-col overflow-hidden !rounded-[18px]" data-testid="profile-list">
      <button
        v-for="p in profiles"
        :key="p.id"
        type="button"
        :aria-current="p.id === active?.id ? 'true' : undefined"
        class="flex min-h-[72px] items-center gap-3 border-b border-rule2 px-4 py-3 text-left text-ink last:border-b-0"
        :data-testid="`profile-${p.name}`"
        @click="pick(p)"
      >
        <ProfileAvatar :profile="p" :size="44" />
        <span class="flex min-w-0 grow flex-col gap-0.5">
          <span class="flex items-center gap-1.5 text-[16px] font-semibold">
            <span class="truncate">{{ p.name }}</span>
            <UIcon v-if="p.pinHash" name="i-lucide-lock" class="size-[13px] shrink-0 text-soft" :aria-label="t('profiles.locked')" />
          </span>
          <span class="text-[12px] text-soft">{{ t('profiles.summary', { r: summaries[p.id]?.routines ?? 0, s: summaries[p.id]?.streak ?? 0 }) }}</span>
        </span>
        <span v-if="p.id === active?.id" class="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand"><UIcon name="i-lucide-check" class="size-3.5 text-white" /></span>
        <UIcon v-else name="i-lucide-chevron-right" class="size-4 shrink-0 text-soft" />
      </button>
    </div>

    <button v-if="!showNew" type="button" class="flex h-[50px] items-center justify-center gap-2 rounded-[14px] border border-dashed border-ringc text-[15px] font-semibold text-ink" data-testid="new-profile" @click="showNew = true">
      <UIcon name="i-lucide-plus" class="size-[18px]" />{{ t('profiles.newProfile') }}
    </button>

    <form v-else class="flex flex-col gap-3 rounded-[18px] border-2 border-brand bg-white px-4 py-3.5" @submit.prevent="createProfile">
      <span class="text-[14px] font-semibold">{{ t('profiles.newProfile') }}</span>
      <div class="flex items-center gap-3">
        <button type="button" :aria-label="t('profiles.uploadPhoto')" class="relative flex size-14 shrink-0 flex-col items-center justify-center overflow-hidden rounded-full text-soft" :class="form.photo ? '' : 'border-2 border-dashed border-faint bg-cream'" @click="fileInput?.click()">
          <img v-if="form.photo" :src="form.photo" alt="" class="size-full object-cover">
          <template v-else>
            <UIcon name="i-lucide-camera" class="size-5" />
            <span class="text-[9px] font-semibold leading-tight">{{ t('profiles.photo') }}</span>
          </template>
        </button>
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPhoto">
        <input v-model="form.name" class="field h-[46px] min-w-0 grow !rounded-xl !bg-cream !text-[15px]" :placeholder="t('profiles.namePlaceholder')" :aria-label="t('profiles.namePlaceholder')" maxlength="40" data-testid="new-profile-name">
      </div>
      <div class="flex items-center gap-2">
        <span class="grow text-[13px] text-soft">{{ t('profiles.pickColor') }}</span>
        <button
          v-for="c in PROFILE_COLORS"
          :key="c"
          type="button"
          :aria-label="c"
          :aria-pressed="form.color === c"
          class="flex size-11 items-center justify-center"
          @click="form.color = c"
        >
          <span class="size-[30px] rounded-full" :style="{ background: c, border: form.color === c ? '3px solid #fff' : 'none', boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none' }" />
        </button>
      </div>
      <div class="flex items-center gap-3">
        <span class="flex grow flex-col gap-0.5"><span class="text-[14px]">{{ t('profiles.lockPin') }}</span><span class="text-[12px] text-soft">{{ t('profiles.lockPinSub') }}</span></span>
        <USwitch v-model="form.lock" size="xl" :aria-label="t('profiles.lockPin')" />
      </div>
      <input v-if="form.lock" v-model="form.pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" class="field h-[46px] !rounded-xl !bg-cream text-center tracking-[0.5em]" :placeholder="t('profiles.pinPlaceholder')" :aria-label="t('profiles.pinPlaceholder')">
      <UButton type="submit" block size="xl" class="h-[50px] rounded-[14px] text-[15px] font-semibold" :label="t('profiles.create')" data-testid="create-profile" />
    </form>

    <button v-if="active" type="button" class="flex h-11 items-center justify-center gap-2 text-[14px] font-medium text-ink" data-testid="open-settings" @click="openSettings">
      <UIcon name="i-lucide-settings" class="size-[18px]" />{{ t('profiles.settingsFor', { name: active.name }) }}
    </button>

    <UModal v-model:open="pinOpen" :title="t('profiles.enterPin', { name: pinTarget?.name || '' })" :description="t('profiles.lockPinSub')" :ui="{ content: 'max-w-[360px] rounded-[20px] bg-cream', title: 'display text-[18px] text-ink', description: 'sr-only' }">
      <template #body>
        <form class="flex flex-col gap-3" @submit.prevent="unlock">
          <input v-model="pinValue" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" autofocus class="field h-[52px] text-center text-[22px] tracking-[0.5em]" :aria-label="t('profiles.pinPlaceholder')" data-testid="pin-input">
          <span v-if="pinError" class="text-[13px] text-b1-tx" role="alert">{{ t('profiles.wrongPin') }}</span>
          <UButton type="submit" block size="xl" class="h-[50px] rounded-[14px] font-semibold" :label="t('profiles.unlock')" />
        </form>
      </template>
    </UModal>
  </BottomSheet>
</template>
