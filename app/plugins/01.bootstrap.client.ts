// Load the profile list before the first render, so routing knows whether to show the welcome flow.
export default defineNuxtPlugin(async () => {
  const started = Date.now()
  const { init } = useProfile()
  try {
    await init()
  }
  catch (e) {
    console.error('[sati] could not open IndexedDB', e)
  }
  return { provide: { bootStartedAt: started } }
})
