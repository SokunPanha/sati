// "/" → /today with a profile; without one, the landing page in a browser tab, or the welcome flow in the
// installed app. No profile yet → welcome flow. Has a profile → never show welcome again (except its
// notification step). Public pages (/download) open for everyone.
export default defineNuxtRouteMiddleware((to) => {
  if (to.meta.public) return
  const { active } = useProfile()
  if (to.path === '/') {
    if (active.value) return navigateTo({ path: '/today', query: to.query, hash: to.hash }, { replace: true })
    if (!useNotify().isStandalone) return
    return navigateTo('/welcome', { replace: true })
  }
  if (!active.value && to.path !== '/welcome') return navigateTo('/welcome', { replace: true })
  if (active.value && to.path === '/welcome' && to.query.step !== 'notify') return navigateTo('/today', { replace: true })
})
