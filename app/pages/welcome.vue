<script setup lang="ts">
// First run: language (Khmer first), name → first profile, then the notification explainer.
// Dark hero continues the splash screen; the form sits on a cream sheet that rises from the bottom.
const { t, locale, setLocale } = useI18n()
const route = useRoute()
const { create, active } = useProfile()
const notify = useNotify()

const name = ref('')
const busy = ref(false)
const step = computed(() => route.query.step === 'notify' && active.value ? 'notify' : 'profile')
const langs = [{ code: 'km' as const, label: 'ខ្មែរ' }, { code: 'en' as const, label: 'English' }]
const chips = [
  { key: 'top3', icon: 'i-lucide-star' },
  { key: 'focus', icon: 'i-lucide-timer' },
  { key: 'reminders', icon: 'i-lucide-bell-ring' }
]
const preview = computed(() => ({ name: name.value, color: PROFILE_COLORS[0]!, photo: null }))

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
  await navigateTo('/today', { replace: true })
}
async function allow() {
  await notify.requestPermission()
  if (notify.permission.value !== 'granted') return
  await done()
}
</script>

<template>
  <div class="welcome flex min-h-dvh flex-col bg-night" data-testid="page-welcome">
    <!-- Hero (continues the splash) -->
    <section class="relative overflow-hidden px-[22px] pb-10 text-cream" :class="step === 'profile' ? 'pt-4' : 'pt-12'">
      <svg width="520" height="520" viewBox="0 0 520 520" class="rings pointer-events-none absolute left-1/2 top-[-90px] -translate-x-1/2" aria-hidden="true">
        <circle cx="260" cy="260" r="250" fill="none" stroke="#FFFFFF" stroke-opacity="0.04" stroke-width="2" />
        <circle cx="260" cy="260" r="185" fill="none" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="2" />
        <circle cx="260" cy="260" r="120" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2" />
      </svg>

      <template v-if="step === 'profile'">
        <div class="relative flex justify-end">
          <div class="rise flex rounded-full bg-night2 p-[3px]" role="group" :aria-label="`${t('welcome.language')} · Language`">
            <button
              v-for="l in langs"
              :key="l.code"
              type="button"
              :aria-pressed="locale === l.code"
              class="h-9 min-w-[64px] whitespace-nowrap rounded-full px-3.5 text-[13px] transition-colors"
              :class="locale === l.code ? 'bg-cream font-semibold text-night' : 'text-nighttext'"
              :data-testid="`lang-${l.code}`"
              @click="setLocale(l.code)"
            >
              {{ l.label }}
            </button>
          </div>
        </div>

        <div class="relative mt-6 flex flex-col items-center gap-4 text-center">
          <span class="rise glow flex size-[92px] items-center justify-center rounded-[26px] bg-night2 ring-1 ring-nightline" style="animation-delay: 60ms"><AppLogo :size="62" /></span>
          <h1 class="rise display m-0 text-[30px] font-bold" style="animation-delay: 120ms">{{ t('welcome.hello') }}</h1>
          <p class="rise m-0 max-w-[330px] text-[15px] text-nighttext" style="animation-delay: 180ms">{{ t('welcome.intro') }}</p>
          <div class="rise flex flex-wrap justify-center gap-2 pt-1" style="animation-delay: 240ms">
            <span v-for="c in chips" :key="c.key" class="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-nightline bg-night2/60 px-3 text-[12.5px] text-cream">
              <UIcon :name="c.icon" class="size-3.5 text-mint" />{{ t(`landing.f.${c.key}`) }}
            </span>
          </div>
        </div>
      </template>

      <div v-else class="relative flex flex-col items-center gap-4 text-center">
        <span class="rise relative flex size-[92px] items-center justify-center">
          <span class="pulse absolute inset-0 rounded-full bg-accent/25" />
          <span class="relative flex size-[76px] items-center justify-center rounded-full bg-accent text-night"><UIcon name="i-lucide-bell-ring" class="size-9" /></span>
        </span>
        <h1 class="rise display m-0 text-[28px] font-bold" style="animation-delay: 80ms">{{ t('welcome.notifTitle') }}</h1>
        <p class="rise m-0 max-w-[330px] text-[15px] text-nighttext" style="animation-delay: 140ms">{{ t('welcome.notifBody') }}</p>
      </div>
    </section>

    <!-- Sheet -->
    <section class="sheet relative -mt-2 flex flex-1 flex-col gap-5 rounded-t-[28px] bg-cream px-[22px] pt-7 pb-safe">
      <template v-if="step === 'profile'">
        <form class="flex flex-col gap-3" @submit.prevent="createFirst">
          <label for="welcome-name" class="text-[13px] font-semibold text-soft">{{ t('welcome.name') }}</label>
          <div class="flex items-center gap-3">
            <ProfileAvatar v-if="name.trim()" :profile="preview" :size="54" />
            <span v-else class="flex size-[54px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-ringc text-faint"><UIcon name="i-lucide-user" class="size-6" /></span>
            <UInput
              id="welcome-name"
              v-model="name"
              variant="none"
              maxlength="40"
              autocomplete="given-name"
              class="min-w-0 flex-1"
              :placeholder="t('welcome.namePlaceholder')"
              :ui="{ root: 'w-full', base: 'h-[54px] rounded-[14px] border border-edge bg-white px-3.5 text-[17px] text-ink placeholder:text-faint focus:border-brand focus:ring-1 focus:ring-brand' }"
              data-testid="welcome-name"
            />
          </div>
          <UButton
            type="submit"
            block
            size="xl"
            trailing-icon="i-lucide-arrow-right"
            class="mt-2 h-14 whitespace-nowrap rounded-2xl text-[16px] font-semibold shadow-[0_10px_24px_-12px_rgba(15,110,100,0.7)] disabled:opacity-50 disabled:shadow-none"
            :disabled="!name.trim() || busy"
            :loading="busy"
            :label="t('welcome.create')"
            data-testid="welcome-create"
          />
        </form>

        <p class="m-0 mt-auto flex items-center justify-center gap-2 text-center text-[13px] text-soft">
          <UIcon name="i-lucide-lock" class="size-4 shrink-0 text-brand" />{{ t('welcome.privacy') }}
        </p>
      </template>

      <template v-else>
        <NotifyInfo />
        <div class="mt-auto flex flex-col gap-2.5">
          <UButton v-if="notify.permission.value === 'default'" block size="xl" class="h-14 whitespace-nowrap rounded-2xl text-[16px] font-semibold" icon="i-lucide-bell" :label="t('welcome.allow')" data-testid="welcome-allow" @click="allow" />
          <UButton block size="xl" :color="notify.permission.value === 'default' ? 'neutral' : 'primary'" :variant="notify.permission.value === 'default' ? 'outline' : 'solid'" class="h-[52px] whitespace-nowrap rounded-2xl text-[15px] font-semibold" :class="notify.permission.value === 'default' ? 'bg-white' : ''" :label="notify.permission.value === 'default' ? t('welcome.later') : t('welcome.start')" data-testid="welcome-skip" @click="done" />
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
/* The page is dark up to the very top edge (behind the notch), like the splash. */
.welcome {
  margin-top: calc(-1 * env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top);
}
.sheet { box-shadow: 0 -18px 40px -24px rgba(0, 0, 0, 0.5); animation: sheet-up 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.rise { animation: rise 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.glow { box-shadow: 0 0 0 10px rgba(63, 184, 163, 0.06), 0 18px 50px -10px rgba(63, 184, 163, 0.35); }
.rings { animation: breathe 7s ease-in-out infinite; }
.pulse { animation: pulse 2.2s ease-out infinite; }

@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes sheet-up { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@keyframes pulse { 0% { transform: scale(0.85); opacity: 0.9; } 100% { transform: scale(1.35); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .sheet, .rise, .rings, .pulse { animation: none; }
}
</style>
