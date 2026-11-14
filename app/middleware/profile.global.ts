// No profile yet → welcome flow. Has a profile → never show welcome again (except its notification step).
// Public pages (the landing / download page) open for everyone.
export default defineNuxtRouteMiddleware((to) => {
  if (to.meta.public) return
  const { active } = useProfile()
  if (!active.value && to.path !== '/welcome') return navigateTo('/welcome', { replace: true })
  if (active.value && to.path === '/welcome' && to.query.step !== 'notify') return navigateTo('/', { replace: true })
})
