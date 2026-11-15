export type ThemeChoice = 'auto' | 'light' | 'dark'

const KEY = 'sati-theme'
const choice = ref<ThemeChoice>('auto')
/** true while the app is drawn dark */
const isDark = ref(false)
let started = false

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  }
  catch {
    return 'auto'
  }
}

function apply() {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  isDark.value = choice.value === 'dark' || (choice.value === 'auto' && !!media?.matches)
  document.documentElement.classList.toggle('dark', isDark.value)
}

/** Light / dark / auto (follows the phone). Kept on this device, like the language of the browser. */
export function useTheme() {
  if (!started && import.meta.client) {
    started = true
    choice.value = read()
    apply()
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', apply)
  }
  function set(v: ThemeChoice) {
    choice.value = v
    try {
      localStorage.setItem(KEY, v)
    }
    catch { /* storage unavailable: this session only */ }
    apply()
  }
  return { choice, isDark, set }
}
