<script setup lang="ts">
// First run: language (Khmer first), name → first profile, then the notification explainer.
const { t, locale, setLocale } = useI18n()
const route = useRoute()
const { create, active } = useProfile()
const notify = useNotify()

const name = ref('')
const busy = ref(false)
const step = computed(() => route.query.step === 'notify' && active.value ? 'notify' : 'profile')
const langs = [{ code: 'km' as const, label: 'ខ្មែរ', sub: 'Khmer' }, { code: 'en' as const, label: 'English', sub: 'អង់គ្លេស' }]

async function createFirst() {
  if (!name.value.trim() || busy.value) return
  busy.value = true
  try {
    await create({ name: name.value, color: PROFILE_COLORS[0]!, locale: locale.value as 'km' | 'en' })
    await navigateTo({ path: '/welcome', query: { step: 'notify' } }, { replace: true })
  }
  finally {
    busy.value = false
  }
}

async function done() {
  await requireDb().settings.put({ key: 'notifAsked', value: true })
  await navigateTo('/', { replace: true })
}
async function allow() {
  await notify.requestPermission()
  if (notify.permission.value !== 'granted') return
  await done()
}
</script>

<template>
  <div class="flex min-h-dvh flex-col gap-6 px-[22px] pt-10 pb-safe" data-testid="page-welcome">
    <template v-if="step === 'profile'">
      <div class="flex flex-col items-center gap-4 text-center">
        <span class="flex size-[84px] items-center justify-center rounded-[22px] bg-night"><AppLogo :size="58" /></span>
        <h1 class="display m-0 text-[28px] font-bold">{{ t('welcome.hello') }}</h1>
        <p class="m-0 max-w-[320px] text-[15px] text-soft">{{ t('welcome.intro') }}</p>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold">{{ t('welcome.language') }} · Language</span>
        <div class="grid grid-cols-2 gap-2.5">
          <button
            v-for="l in langs"
            :key="l.code"
            type="button"
            :aria-pressed="locale === l.code"
            class="flex h-[64px] flex-col items-start justify-center rounded-2xl bg-white px-4 text-left"
            :class="locale === l.code ? 'border-2 border-brand' : 'border border-edge'"
            :data-testid="`lang-${l.code}`"
            @click="setLocale(l.code)"
          >
            <span class="text-[16px] font-semibold text-ink">{{ l.label }}</span>
            <span class="text-[12px] text-soft">{{ l.sub }}</span>
          </button>
        </div>
      </div>

      <form class="flex flex-col gap-2" @submit.prevent="createFirst">
        <label for="welcome-name" class="text-[13px] font-semibold">{{ t('welcome.name') }}</label>
        <UInput
          id="welcome-name"
          v-model="name"
          variant="none"
          maxlength="40"
          autocomplete="given-name"
          :placeholder="t('welcome.namePlaceholder')"
          :ui="{ root: 'w-full', base: 'h-[54px] rounded-[14px] border border-edge bg-white px-3.5 text-[17px] text-ink placeholder:text-faint focus:border-brand' }"
          data-testid="welcome-name"
        />
        <UButton type="submit" block size="xl" class="mt-2 h-14 rounded-2xl text-[16px] font-semibold disabled:opacity-50" :disabled="!name.trim() || busy" :label="t('welcome.create')" data-testid="welcome-create" />
      </form>

      <p class="m-0 mt-auto flex items-start gap-2 rounded-2xl bg-brand-tint p-3.5 text-[13px] text-brand-dark">
        <UIcon name="i-lucide-lock" class="mt-0.5 size-4 shrink-0" />{{ t('welcome.privacy') }}
      </p>
    </template>

    <template v-else>
      <div class="flex flex-col items-center gap-4 text-center">
        <span class="flex size-[84px] items-center justify-center rounded-[22px] bg-rem-bg text-rem"><UIcon name="i-lucide-bell-ring" class="size-10" /></span>
        <h1 class="display m-0 text-[26px] font-bold">{{ t('welcome.notifTitle') }}</h1>
        <p class="m-0 max-w-[330px] text-[15px] text-soft">{{ t('welcome.notifBody') }}</p>
      </div>
      <NotifyInfo />
      <div class="mt-auto flex flex-col gap-2.5">
        <UButton v-if="notify.permission.value === 'default'" block size="xl" class="h-14 rounded-2xl text-[16px] font-semibold" icon="i-lucide-bell" :label="t('welcome.allow')" data-testid="welcome-allow" @click="allow" />
        <UButton block size="xl" :color="notify.permission.value === 'default' ? 'neutral' : 'primary'" :variant="notify.permission.value === 'default' ? 'outline' : 'solid'" class="h-[52px] rounded-2xl text-[15px] font-semibold" :class="notify.permission.value === 'default' ? 'bg-white' : ''" :label="notify.permission.value === 'default' ? t('welcome.later') : t('welcome.start')" data-testid="welcome-skip" @click="done" />
      </div>
    </template>
  </div>
</template>
