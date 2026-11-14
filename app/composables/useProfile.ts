import { liveQuery } from 'dexie'
import type { LocaleCode, Profile } from '~/types'

const profiles = shallowRef<Profile[]>([])
const activeId = ref<string | null>(null)
const ready = ref(false)
let subscribed = false

const active = computed(() => profiles.value.find(p => p.id === activeId.value) || null)

function hashPin(profileId: string, pin: string) {
  return sha256(`sati:${profileId}:${pin}`)
}

/** Load profiles + the active one from the meta DB. Called once before the app renders. */
async function init() {
  if (ready.value) return
  const db = metaDb()
  profiles.value = await db.profiles.toArray()
  const row = await db.kv.get('activeProfileId')
  const id = row?.value as string | undefined
  activeId.value = profiles.value.some(p => p.id === id) ? id! : (profiles.value[0]?.id ?? null)
  activeDb.value = activeId.value ? profileDb(activeId.value) : null
  if (!subscribed) {
    subscribed = true
    liveQuery(() => db.profiles.toArray()).subscribe({ next: (v) => { profiles.value = v } })
  }
  ready.value = true
}

async function activate(id: string) {
  const db = metaDb()
  await db.kv.put({ key: 'activeProfileId', value: id })
  await db.profiles.update(id, { lastUsedAt: Date.now() })
  profiles.value = await db.profiles.toArray()
  activeId.value = id
  activeDb.value = profileDb(id)
}

async function create(input: { name: string, color: string, photo?: string | null, pin?: string | null, locale: LocaleCode }) {
  const id = uid().replace(/-/g, '').slice(0, 12)
  const profile: Profile = {
    id,
    name: input.name.trim(),
    color: input.color,
    photo: input.photo || null,
    pinHash: input.pin ? await hashPin(id, input.pin) : null,
    locale: input.locale,
    createdAt: Date.now(),
    lastUsedAt: Date.now()
  }
  await metaDb().profiles.add(profile)
  // Seed nothing but the default areas (they live in settings defaults).
  await profileDb(id).open()
  await activate(id)
  return profile
}

async function update(id: string, patch: Partial<Profile>) {
  await metaDb().profiles.update(id, patch)
  profiles.value = await metaDb().profiles.toArray()
}

async function setPin(id: string, pin: string | null) {
  await update(id, { pinHash: pin ? await hashPin(id, pin) : null })
}

async function verifyPin(profile: Profile, pin: string) {
  if (!profile.pinHash) return true
  return (await hashPin(profile.id, pin)) === profile.pinHash
}

/** Deletes the profile and its whole database. Returns the next active profile id (or null). */
async function remove(id: string) {
  const db = metaDb()
  await db.profiles.delete(id)
  if (activeId.value === id) activeDb.value = null
  await deleteProfileDb(id)
  profiles.value = await db.profiles.toArray()
  if (activeId.value === id) {
    const next = profiles.value[0]
    if (next) await activate(next.id)
    else {
      activeId.value = null
      await db.kv.delete('activeProfileId')
    }
  }
  return activeId.value
}

export function useProfile() {
  return { profiles, activeId, active, ready, init, activate, create, update, setPin, verifyPin, remove }
}
