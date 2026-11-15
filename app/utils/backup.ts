import type { BackupFile, Profile } from '~/types'

async function dumpProfile(profile: Profile) {
  const db = profileDb(profile.id)
  const data: Record<string, any[]> = {}
  for (const name of PROFILE_TABLES) data[name] = await db.table(name).toArray()
  return { profile, data }
}

/** Build a backup of one profile or of every profile on this device. */
export async function buildBackup(profileIds: string[]): Promise<BackupFile> {
  const all = await metaDb().profiles.toArray()
  const picked = all.filter(p => profileIds.includes(p.id))
  return {
    app: 'sati',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles: await Promise.all(picked.map(dumpProfile))
  }
}

export function parseBackup(text: string): BackupFile {
  const data = JSON.parse(text)
  if (!data || data.app !== 'sati' || !Array.isArray(data.profiles)) throw new Error('not-a-sati-backup')
  for (const p of data.profiles) {
    if (!p?.profile?.id || typeof p.profile.name !== 'string' || !p.data) throw new Error('not-a-sati-backup')
  }
  return data as BackupFile
}

/** Restore: profiles in the file replace profiles with the same id; others are added. */
export async function restoreBackup(file: BackupFile): Promise<number> {
  for (const entry of file.profiles) {
    const id = String(entry.profile.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
    if (!id) continue
    const profile: Profile = {
      id,
      name: String(entry.profile.name).slice(0, 60),
      color: entry.profile.color || PROFILE_COLORS[0]!,
      photo: typeof entry.profile.photo === 'string' && entry.profile.photo.startsWith('data:image/') ? entry.profile.photo : null,
      pinHash: entry.profile.pinHash || null,
      locale: entry.profile.locale === 'en' ? 'en' : 'km',
      createdAt: entry.profile.createdAt || Date.now(),
      lastUsedAt: entry.profile.lastUsedAt || Date.now()
    }
    await metaDb().profiles.put(profile)
    const db = profileDb(id)
    await db.transaction('rw', db.tables, async () => {
      for (const name of PROFILE_TABLES) {
        // an older backup has no table added later (e.g. mindmaps): keep what is on the device
        if (!(name in entry.data)) continue
        const table = db.table(name)
        await table.clear()
        const rows = entry.data[name]
        if (Array.isArray(rows) && rows.length) await table.bulkPut(rows)
      }
    })
  }
  return file.profiles.length
}
