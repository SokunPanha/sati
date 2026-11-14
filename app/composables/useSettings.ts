import type { Settings } from '~/types'

export const DEFAULT_SETTINGS: Settings = {
  focusMin: 45,
  topCount: 3,
  breakMin: 10,
  dailyGoal: 4,
  areas: [...DEFAULT_AREAS],
  weekStart: 1,
  notif: {
    morning: true,
    morningTime: '08:00',
    evening: true,
    eveningTime: '21:00',
    focus: true,
    routine: true,
    routineTime: '19:00',
    box2: true,
    box2Time: '15:00',
    due: false,
    dueTime: '09:00',
    backup: true
  },
  quietOn: true,
  quietFrom: '22:00',
  quietTo: '07:00',
  lastBackupAt: null,
  notifAsked: false
}

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>

export function mergeSettings(rows: Array<{ key: string, value: any }>): Settings {
  const out: any = plain(DEFAULT_SETTINGS)
  for (const row of rows) {
    if (!SETTING_KEYS.includes(row.key as keyof Settings)) continue
    if (row.key === 'notif') out.notif = { ...out.notif, ...(row.value || {}) }
    else out[row.key] = row.value
  }
  return out as Settings
}

export async function readSettings(db = requireDb()): Promise<Settings> {
  return mergeSettings(await db.settings.toArray())
}

/** Per-profile settings, live from IndexedDB. */
export const useSettings = shared(() => {
  const { data, loaded } = useLiveQuery(db => db.settings.toArray(), [] as Array<{ key: string, value: any }>)
  const settings = computed(() => mergeSettings(data.value))

  async function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    await requireDb().settings.put({ key, value: plain(value) })
  }
  async function setNotif(patch: Partial<Settings['notif']>) {
    await set('notif', { ...settings.value.notif, ...patch })
  }
  return { settings, loaded, set, setNotif }
})

/** Size of the daily Top list ("Top 3" by default; set in Settings). */
export function useTopN() {
  const { settings } = useSettings()
  return computed(() => settings.value.topCount || 3)
}
