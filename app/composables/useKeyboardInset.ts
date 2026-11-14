// The on-screen keyboard shrinks the visual viewport but not the layout viewport, so a sheet pinned to the
// bottom gets pushed up and its top (title, first field) ends up off screen. This tracks the space the keyboard
// takes and the height that is still visible, so a sheet can sit right above the keyboard and fit what is left.
export function useKeyboardInset() {
  const inset = ref(0)
  const visible = ref(0)

  function update() {
    const vv = window.visualViewport
    if (!vv) return
    visible.value = Math.round(vv.height)
    inset.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
  }

  onMounted(() => {
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
  })
  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
  })

  return { inset, visible }
}
