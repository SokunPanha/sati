// No profile yet → welcome flow. Has a profile → never show welcome again (except its notification step).
// Public pages (/download) open for everyone. "/" without a profile shows the landing page in a browser tab,
// but the installed app skips it and goes straight to the welcome flow.
export default defineNuxtRouteMiddleware((to) => {
  if (to.meta.public) return
  const { active } = useProfile()
  const { isStandalone } = useNotify()
  if (!active.value && to.path === '/' && !isStandalone) return
  if (!active.value && to.path !== '/welcome') return navigateTo('/welcome', { replace: true })
  if (active.value && to.path === '/welcome' && to.query.step !== 'notify') return navigateTo('/', { replace: true })
})
