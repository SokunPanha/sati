import type { AppNotification, NotifKind } from '~/types'

const supported = typeof window !== 'undefined' && 'Notification' in window
const permission = ref<NotificationPermission | 'unsupported'>(supported ? Notification.permission : 'unsupported')
/** Notification Triggers (TimestampTrigger): lets the OS show a notification later even if the app is closed. */
const supportsTriggers = supported && 'showTrigger' in Notification.prototype && 'TimestampTrigger' in window
const isStandalone = typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true)
const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const VIBRATE = [200, 100, 200, 100, 300]
const ICON = '/icons/pwa-192.png'
const BADGE = '/icons/badge-96.png'

interface Hooks {
  toast?: (n: { title: string, body: string, url: string, kind: NotifKind }) => void
}
const hooks: Hooks = {}

let audio: AudioContext | null = null
function audioCtx(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    if (!audio) audio = new Ctor()
    return audio
  }
  catch {
    return null
  }
}

/** Browsers only allow sound after a user gesture: unlock the audio context on first touch. */
function unlockAudio() {
  const ctx = audioCtx()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}

/** Short three-note chime (WebAudio, no audio file needed). */
function chime() {
  const ctx = audioCtx()
  if (!ctx || ctx.state !== 'running') return
  const start = ctx.currentTime + 0.02
  const notes = [659.25, 880, 1174.66]
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t0 = start + i * 0.16
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.6)
  })
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return null
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>(resolve => setTimeout(() => resolve(null), 3000))
    ])
  }
  catch {
    return null
  }
}

/** Must be called from a tap/click (browsers ignore it otherwise). */
async function requestPermission() {
  if (!supported) return 'unsupported' as const
  unlockAudio()
  try {
    permission.value = await Notification.requestPermission()
  }
  catch {
    permission.value = Notification.permission
  }
  return permission.value
}

interface SystemOptions {
  body: string
  tag: string
  url: string
  notifId?: string
  requireInteraction?: boolean
  showAt?: number
}

/** A real system notification (lock screen / notification shade) with sound + vibration. */
async function showSystem(title: string, o: SystemOptions): Promise<boolean> {
  if (!supported) return false
  permission.value = Notification.permission
  if (Notification.permission !== 'granted') return false
  const options: any = {
    body: o.body,
    icon: ICON,
    badge: BADGE,
    tag: o.tag,
    renotify: true,
    vibrate: VIBRATE,
    silent: false,
    requireInteraction: !!o.requireInteraction,
    timestamp: o.showAt ?? Date.now(),
    lang: document.documentElement.lang || 'km',
    data: { url: o.url, notifId: o.notifId || null }
  }
  if (o.showAt && supportsTriggers) options.showTrigger = new (window as any).TimestampTrigger(o.showAt)
  try {
    const reg = await registration()
    if (reg) {
      await reg.showNotification(title, options)
      return true
    }
    if (o.showAt) return false
    // No service worker (e.g. `nuxt dev`): fall back to a page notification.
    const n = new Notification(title, options)
    n.onclick = () => {
      window.focus()
      window.postMessage({ type: 'sati-navigate', url: o.url }, location.origin)
      n.close()
    }
    return true
  }
  catch (e) {
    console.warn('[sati] showNotification failed', e)
    return false
  }
}

/** Bonus: hand a future reminder to the OS when Notification Triggers exist. */
async function scheduleTrigger(tag: string, at: number, title: string, body: string, url: string) {
  if (!supportsTriggers || at <= Date.now()) return false
  return showSystem(title, { body, tag, url, requireInteraction: true, showAt: at })
}

async function cancelTrigger(tagPrefix: string) {
  if (!supportsTriggers) return
  const reg = await registration()
  if (!reg) return
  const list = await (reg as any).getNotifications({ includeTriggered: true })
  for (const n of list) if (n.tag && n.tag.startsWith(tagPrefix)) n.close()
}

function vibrate() {
  try {
    navigator.vibrate?.(VIBRATE)
  }
  catch { /* not supported */ }
}

export interface DeliverInput {
  kind: NotifKind
  title: string
  body: string
  url?: string
  action?: 'focus' | null
  taskId?: string | null
  focusMin?: number
  at?: number
  /** keep it in the in-app list only (missed long ago, or already scheduled with a trigger) */
  inAppOnly?: boolean
  tag?: string
}

/**
 * Deliver one alert:
 *  - always saved to the in-app notifications list;
 *  - shown as a system notification with sound + vibration, unless a focus session is running
 *    or it is quiet hours (reminders and the focus timer always come through).
 */
async function deliver(input: DeliverInput) {
  const db = requireDb()
  const settings = await readSettings(db)
  const now = Date.now()
  const always = input.kind === 'reminder' || input.kind === 'focus' || input.kind === 'break' || input.kind === 'test'
  const held = !always && (runtime.focusing || (settings.quietOn && inQuietHours(now, settings.quietFrom, settings.quietTo)))
  const note: AppNotification = {
    id: uid(),
    kind: input.kind,
    title: input.title,
    body: input.body,
    at: input.at ?? now,
    read: false,
    url: input.url || '/notifications',
    action: input.action ?? null,
    taskId: input.taskId ?? null,
    ...(input.focusMin ? { focusMin: input.focusMin } : {})
  }
  await db.notifications.add(note)
  if (held || input.inAppOnly) return { note, system: false }

  const system = await showSystem(input.title, {
    body: input.body,
    tag: input.tag || `${input.kind}-${note.id}`,
    url: note.url,
    notifId: note.id,
    requireInteraction: input.kind === 'reminder'
  })
  if (document.visibilityState === 'visible') {
    chime()
    vibrate()
    hooks.toast?.({ title: note.title, body: note.body, url: note.url, kind: note.kind })
  }
  return { note, system }
}

export function useNotify() {
  return {
    supported, permission, supportsTriggers, isStandalone, isIOS, hooks,
    requestPermission, showSystem, scheduleTrigger, cancelTrigger, deliver, chime, unlockAudio
  }
}
