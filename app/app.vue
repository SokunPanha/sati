<script setup lang="ts">
const { t, locale, setLocale } = useI18n()
const { active } = useProfile()
const router = useRouter()
const toast = useToast()
const notify = useNotify()
const focus = useFocus()
const scheduler = useScheduler()
const fmt = useFmt()
const route = useRoute()
/** Full-width pages (the landing page) skip the phone column and the app splash. */
const wide = computed(() => !!route.meta.wide)

const splash = ref(true)

useHead({
  htmlAttrs: { lang: locale },
  title: 'Sati · សតិ'
})

// The language is stored per profile.
watch(() => active.value?.locale, (l) => {
  if (l && l !== locale.value) setLocale(l)
}, { immediate: true })

// In-app banner for alerts that arrive while the app is open.
notify.hooks.toast = n => toast.add({
  title: n.title,
  description: n.body,
  icon: n.kind === 'reminder' ? 'i-lucide-alarm-clock' : 'i-lucide-bell-ring',
  color: n.kind === 'reminder' ? 'info' : 'primary',
  duration: 8000,
  onClick: () => { router.push(n.url) }
} as any)

focus.setTexts({
  doneTitle: title => t('notif.focusDoneTitle', { title }),
  doneBody: n => t('notif.focusDoneBody', { n }),
  breakTitle: () => t('notif.breakOverTitle'),
  breakBody: title => t('notif.breakOverBody', { title })
})

function onSwMessage(e: MessageEvent) {
  if (e.data?.type === 'sati-navigate' && typeof e.data.url === 'string' && e.data.url.startsWith('/')) router.push(e.data.url)
}

onMounted(async () => {
  window.addEventListener('pointerdown', notify.unlockAudio, { passive: true })
  navigator.serviceWorker?.addEventListener('message', onSwMessage)
  // Phones pause timers while the installed app is in the background, so the hourly update check rarely runs:
  // also look for a new version each time the app comes back to the front. Only the service worker and its
  // file caches are replaced; tasks live in IndexedDB, which an update never touches.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine)
      navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => {})
  })
  window.addEventListener('message', (e) => {
    if (e.origin === location.origin) onSwMessage(e)
  })
  await focus.load()
  scheduler.start((key, params) => t(key, params ?? {}), ts => fmt.time(ts))

  // Keep the splash for at least ~800 ms from first paint, then fade it out.
  const started = (useNuxtApp().$bootStartedAt as number) || Date.now()
  setTimeout(() => {
    splash.value = false
    runtime.booted = true
  }, Math.max(0, 800 - (Date.now() - started)))
})
</script>

<template>
  <UApp :toaster="{ position: 'top-center', duration: 2600 }" :tooltip="{ delayDuration: 300 }">
    <NuxtPwaManifest />
    <main :class="wide ? 'relative' : 'app-col screen relative'">
      <NuxtPage />
    </main>
    <template v-if="active">
      <CaptureSheet />
      <SortSheet />
      <TaskActionsSheet />
    </template>
    <ProfilesSheet />
    <Transition name="fade">
      <SplashScreen v-if="splash && !wide" />
    </Transition>
  </UApp>
</template>
