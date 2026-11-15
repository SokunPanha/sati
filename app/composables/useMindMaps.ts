import type { MindMap } from '~/types'

/** Mind maps of the active profile (stored in its own database, like tasks). */
export const useMindMaps = shared(() => {
  const { data: maps, loaded } = useLiveQuery(db => db.mindmaps.orderBy('updatedAt').reverse().toArray(), [] as MindMap[])

  /** New map with one root idea. */
  async function create(title: string) {
    const now = Date.now()
    const map: MindMap = {
      id: uid(),
      title,
      data: { nodeData: { id: uid(), topic: title, children: [] } },
      createdAt: now,
      updatedAt: now
    }
    await requireDb().mindmaps.add(map)
    return map
  }

  async function save(id: string, data: any) {
    const title = String(data?.nodeData?.topic || '').trim()
    await requireDb().mindmaps.update(id, { data, title, updatedAt: Date.now() })
  }

  async function remove(id: string) {
    await requireDb().mindmaps.delete(id)
  }

  return { maps, loaded, create, save, remove }
})

/** Number of ideas in a map, root included. */
export function countIdeas(node: any): number {
  if (!node) return 0
  return 1 + (Array.isArray(node.children) ? node.children.reduce((n: number, c: any) => n + countIdeas(c), 0) : 0)
}
