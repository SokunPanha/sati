<script setup lang="ts">
// Landing / download page. Sati is a PWA, so "download" = install from the browser:
// one tap where the browser offers it (Android, desktop Chrome/Edge), step-by-step for iPhone.
definePageMeta({ public: true, wide: true })

type Platform = 'android' | 'iphone' | 'desktop'

const { t, locale, setLocale } = useI18n()
const { active } = useProfile()
const pwa = usePWA()

const ua = navigator.userAgent
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const detected: Platform = isIOS ? 'iphone' : /Android/i.test(ua) ? 'android' : 'desktop'
const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true

const tab = ref<Platform>(detected)
const justInstalled = ref(false)
const installed = computed(() => standalone || justInstalled.value)
/** the browser handed us its install prompt (beforeinstallprompt) */
const canPrompt = computed(() => !!pwa?.showInstallPrompt)

const stepCount: Record<Platform, number> = { android: 3, iphone: 4, desktop: 3 }
const platforms: Array<{ value: Platform, icon: string }> = [
  { value: 'android', icon: 'i-lucide-smartphone' },
  { value: 'iphone', icon: 'i-lucide-smartphone' },
  { value: 'desktop', icon: 'i-lucide-monitor' }
]
const features = [
  { key: 'top3', icon: 'i-lucide-star' },
  { key: 'focus', icon: 'i-lucide-timer' },
  { key: 'matrix', icon: 'i-lucide-layout-grid' },
  { key: 'routines', icon: 'i-lucide-repeat' },
  { key: 'reminders', icon: 'i-lucide-bell-ring' },
  { key: 'profiles', icon: 'i-lucide-users' },
  { key: 'offline', icon: 'i-lucide-wifi-off' },
  { key: 'private', icon: 'i-lucide-lock' }
]
const shots = [
  { key: 'today', src: '/landing/today.webp' },
  { key: 'focus', src: '/landing/focus.webp' },
  { key: 'plan', src: '/landing/plan.webp' }
]

function showHow() {
  tab.value = detected
  document.getElementById('how')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function install() {
  if (pwa && canPrompt.value) {
    const choice = await pwa.install()
    if (choice?.outcome === 'accepted') justInstalled.value = true
    return
  }
  showHow()
}

function onInstalled() {
  justInstalled.value = true
}

onMounted(() => window.addEventListener('appinstalled', onInstalled))
onBeforeUnmount(() => {
  window.removeEventListener('appinstalled', onInstalled)
  // The language is stored per profile: leaving the landing page restores the profile's choice.
  const l = active.value?.locale
  if (l && l !== locale.value) setLocale(l)
})

useHead(() => ({
  title: t('landing.title'),
  meta: [{ name: 'description', content: t('landing.description') }]
}))

const langs = [{ code: 'km' as const, label: 'ខ្មែរ' }, { code: 'en' as const, label: 'EN' }]
</script>

<template>
  <div class="landing min-h-dvh bg-cream text-ink" data-testid="page-download">
    <!-- Hero -->
    <section class="relative overflow-hidden bg-night text-cream" style="padding-top: env(safe-area-inset-top)">
      <svg width="900" height="900" viewBox="0 0 900 900" class="pointer-events-none absolute -right-[260px] -top-[180px] md:-right-[120px]" aria-hidden="true">
        <circle cx="450" cy="450" r="440" fill="none" stroke="#FFFFFF" stroke-opacity="0.04" stroke-width="2" />
        <circle cx="450" cy="450" r="340" fill="none" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="2" />
        <circle cx="450" cy="450" r="240" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2" />
      </svg>

      <nav class="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <span class="flex items-center gap-2.5">
          <AppLogo :size="34" />
          <span class="display text-[20px] font-bold">Sati</span>
          <span class="text-[15px] text-mint">សតិ</span>
        </span>
        <div class="flex items-center gap-2">
          <div class="flex rounded-full bg-night2 p-[3px]" role="group" aria-label="Language">
            <button
              v-for="l in langs"
              :key="l.code"
              type="button"
              :aria-pressed="locale === l.code"
              class="h-9 min-w-[48px] rounded-full px-3 text-[13px]"
              :class="locale === l.code ? 'bg-cream font-semibold text-night' : 'text-nighttext'"
              :data-testid="`landing-lang-${l.code}`"
              @click="setLocale(l.code)"
            >
              {{ l.label }}
            </button>
          </div>
          <a href="#how" class="hidden h-10 items-center rounded-full border border-nightline px-4 text-[14px] font-medium text-cream hover:bg-night2 sm:inline-flex" @click.prevent="showHow">
            {{ t('landing.nav') }}
          </a>
        </div>
      </nav>

      <div class="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-6 pb-0 md:grid-cols-[1.1fr_1fr] md:px-8 md:pt-12">
        <div class="flex flex-col gap-5 pb-2 md:pb-20">
          <span class="text-[13px] font-medium text-mint">{{ t('landing.kicker') }}</span>
          <h1 class="display m-0 text-[36px] font-bold whitespace-pre-line md:text-[52px]">{{ t('landing.heroTitle') }}</h1>
          <p class="m-0 max-w-[520px] text-[16px] text-nighttext md:text-[18px]">{{ t('landing.heroBody') }}</p>

          <div class="flex flex-col gap-3 pt-2 sm:flex-row" data-testid="install-area">
            <NuxtLink
              v-if="installed"
              to="/"
              class="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-7 text-[16px] font-semibold text-night hover:bg-mint"
              data-testid="landing-open"
            >
              <UIcon name="i-lucide-arrow-right" class="size-5" />{{ t('landing.open') }}
            </NuxtLink>
            <button
              v-else
              type="button"
              class="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-7 text-[16px] font-semibold text-night hover:bg-mint"
              :data-can-prompt="canPrompt"
              data-testid="landing-install"
              @click="install"
            >
              <UIcon name="i-lucide-download" class="size-5" />{{ t('landing.install') }}
            </button>
            <NuxtLink
              v-if="!installed"
              to="/"
              class="inline-flex h-14 items-center justify-center rounded-2xl border border-nightline px-6 text-[15px] font-medium text-cream hover:bg-night2"
              data-testid="landing-browser"
            >
              {{ t('landing.browser') }}
            </NuxtLink>
          </div>
          <p v-if="installed" class="m-0 flex items-center gap-2 text-[14px] text-mint">
            <UIcon name="i-lucide-circle-check" class="size-4" />{{ t('landing.installed') }}
          </p>
          <p v-else-if="isIOS" class="m-0 flex items-center gap-2 text-[14px] text-nighttext">
            <UIcon name="i-lucide-share" class="size-4 shrink-0 text-mint" />{{ t('landing.iosHint') }}
          </p>
          <p v-else class="m-0 text-[13px] text-nighttext">{{ t('landing.meta') }}</p>
        </div>

        <div class="relative mx-auto flex w-full max-w-[420px] justify-center self-end" aria-hidden="true">
          <div class="phone relative z-10 w-[62%] translate-y-6 sm:-translate-x-[18%]">
            <img src="/landing/today.webp" alt="" width="390" height="844" class="block w-full" decoding="async">
          </div>
          <div class="phone absolute right-0 bottom-0 w-[46%] -rotate-[4deg] opacity-90 max-sm:hidden" style="transform-origin: bottom right">
            <img src="/landing/focus.webp" alt="" width="390" height="844" class="block w-full" decoding="async">
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="mx-auto max-w-6xl px-4 pt-20 pb-14 md:px-8">
      <h2 class="display m-0 mb-8 max-w-[640px] text-[26px] font-bold md:text-[34px]">{{ t('landing.featuresTitle') }}</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="f in features" :key="f.key" class="card flex flex-col gap-2 p-5">
          <span class="flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand"><UIcon :name="f.icon" class="size-5" /></span>
          <span class="text-[16px] font-semibold">{{ t(`landing.f.${f.key}`) }}</span>
          <span class="text-[14px] text-soft">{{ t(`landing.f.${f.key}Body`) }}</span>
        </div>
      </div>
    </section>

    <!-- Screens -->
    <section class="mx-auto max-w-6xl px-4 pb-16 md:px-8">
      <div class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible">
        <figure v-for="s in shots" :key="s.key" class="m-0 flex w-[62%] shrink-0 snap-center flex-col items-center gap-3 sm:w-auto">
          <div class="phone w-full max-w-[280px]">
            <img :src="s.src" :alt="t(`landing.shots.${s.key}`)" width="390" height="844" class="block w-full" loading="lazy" decoding="async">
          </div>
          <figcaption class="text-[14px] font-semibold text-soft">{{ t(`landing.shots.${s.key}`) }}</figcaption>
        </figure>
      </div>
    </section>

    <!-- How to install -->
    <section id="how" class="scroll-mt-4 bg-brand-tint">
      <div class="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-[1fr_1.3fr] md:px-8">
        <div class="flex flex-col gap-3">
          <h2 class="display m-0 text-[26px] font-bold md:text-[34px]">{{ t('landing.howTitle') }}</h2>
          <p class="m-0 max-w-[420px] text-[15px] text-soft">{{ t('landing.howBody') }}</p>
          <button
            v-if="!installed && canPrompt"
            type="button"
            class="mt-2 inline-flex h-12 w-fit items-center gap-2 rounded-2xl bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-dark"
            @click="install"
          >
            <UIcon name="i-lucide-download" class="size-5" />{{ t('landing.install') }}
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-3 rounded-xl bg-white/70 p-[3px]" role="tablist" :aria-label="t('landing.howTitle')">
            <button
              v-for="p in platforms"
              :key="p.value"
              type="button"
              role="tab"
              :aria-selected="tab === p.value"
              class="flex min-h-[44px] items-center justify-center gap-1.5 rounded-[9px] text-[14px]"
              :class="tab === p.value ? 'bg-ink font-semibold text-white' : 'text-soft'"
              :data-testid="`how-${p.value}`"
              @click="tab = p.value"
            >
              <UIcon :name="p.icon" class="size-4" />{{ t(`landing.tabs.${p.value}`) }}
            </button>
          </div>
          <ol class="m-0 flex list-none flex-col gap-2.5 p-0" role="tabpanel" data-testid="how-steps">
            <li v-for="i in stepCount[tab]" :key="`${tab}-${i}`" class="card flex items-start gap-3.5 p-4">
              <span class="display flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-[15px] font-semibold text-white">{{ i }}</span>
              <span class="pt-1 text-[15px]">{{ t(`landing.steps.${tab}.s${i}`) }}</span>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="mx-auto max-w-3xl px-4 py-16 md:px-8">
      <h2 class="display m-0 mb-6 text-[26px] font-bold md:text-[34px]">{{ t('landing.faqTitle') }}</h2>
      <div class="flex flex-col gap-2.5">
        <details v-for="i in 4" :key="i" class="faq card group px-5">
          <summary class="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold sm:text-[16px]">
            <span class="min-w-0 truncate">{{ t(`landing.faq.q${i}`) }}</span>
            <UIcon name="i-lucide-chevron-down" class="size-5 shrink-0 text-soft transition-transform group-open:rotate-180" />
          </summary>
          <p class="m-0 pb-4 text-[15px] text-soft">{{ t(`landing.faq.a${i}`) }}</p>
        </details>
      </div>
    </section>

    <!-- Footer -->
    <footer class="bg-night text-cream" style="padding-bottom: env(safe-area-inset-bottom)">
      <div class="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-12 md:flex-row md:items-center md:justify-between md:px-8">
        <div class="flex items-center gap-3">
          <AppLogo :size="44" />
          <div class="flex flex-col">
            <span class="display text-[18px] font-bold">Sati · <span class="text-mint">សតិ</span></span>
            <span class="text-[13px] text-nighttext">{{ t('landing.footer') }}</span>
          </div>
        </div>
        <button
          v-if="!installed"
          type="button"
          class="inline-flex h-12 items-center gap-2 rounded-2xl bg-accent px-6 text-[15px] font-semibold text-night hover:bg-mint"
          @click="install"
        >
          <UIcon name="i-lucide-download" class="size-5" />{{ t('landing.install') }}
        </button>
        <NuxtLink v-else to="/" class="inline-flex h-12 items-center gap-2 rounded-2xl bg-accent px-6 text-[15px] font-semibold text-night">
          {{ t('landing.open') }}
        </NuxtLink>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.phone {
  aspect-ratio: 390 / 844;
  overflow: hidden;
  border-radius: 34px;
  border: 7px solid #1C3330;
  background: #F5F4EF;
  box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.45);
}
.faq summary::-webkit-details-marker { display: none; }
</style>
