<script setup lang="ts">
import MindElixir from 'mind-elixir'
import 'mind-elixir/style.css'

type MindElixirInstance = InstanceType<typeof MindElixir>
// Mind map (/mindmap). Without ?id: the list of maps and "New map". With ?id: the map editor (Mind Elixir,
// MIT): drag to move, pinch to zoom, tap an idea to select it, then use the bar below to add, edit,
// delete or undo. Every change is saved to the profile's database right away.
const { t } = useI18n()
const fmt = useFmt()
const route = useRoute()
const router = useRouter()
const { maps, loaded, create, save, remove } = useMindMaps()

const mapId = computed(() => (typeof route.query.id === 'string' ? route.query.id : null))
const current = computed(() => maps.value.find(m => m.id === mapId.value) || null)

const el = ref<HTMLElement>()
let mind: MindElixirInstance | null = null
let openedId: string | null = null
const selected = ref(0)
const rootSelected = ref(false)
/** id of the map waiting for "Delete?" confirmation (from the list or the editor menu) */
const deleting = ref<string | null>(null)
const confirmDelete = ref(false)
function askDelete(id: string | null) {
  deleting.value = id
  confirmDelete.value = !!id
}
const deletingTitle = computed(() => maps.value.find(m => m.id === deleting.value)?.title || '')
const exporting = ref(false)
const toast = useToast()

// ---------------------------------------------------------------- saving
let timer: ReturnType<typeof setTimeout> | null = null
function snapshot() {
  return mind && openedId ? { id: openedId, data: JSON.parse(mind.getDataString()) } : null
}
function scheduleSave() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, 300)
}
async function flush() {
  if (timer) clearTimeout(timer)
  timer = null
  const s = snapshot()
  if (s) await save(s.id, s.data)
}

// ---------------------------------------------------------------- editor
const THEME = {
  name: 'Sati',
  type: 'light' as const,
  palette: ['#0F6E64', '#C2510F', '#3FB8A3', '#B08A00', '#5B6CC9', '#A04C8E', '#2F8F5B', '#8E8C85'],
  cssVar: {
    '--main-color': '#1A1A17',
    '--main-bgcolor': '#FFFFFF',
    '--color': '#3A3A35',
    '--bgcolor': '#F5F4EF',
    '--selected': '#3FB8A3',
    '--accent-color': '#0F6E64',
    '--root-color': '#FFFFFF',
    '--root-bgcolor': '#0F6E64',
    '--root-border-color': 'transparent',
    '--root-radius': '16px',
    '--main-radius': '12px',
    '--topic-padding': '6px 10px',
    '--panel-color': '26, 26, 23',
    '--panel-bgcolor': '255, 255, 255',
    '--panel-border-color': '#E4E2DA'
  }
}

function close() {
  if (timer) void flush()
  mind?.destroy()
  mind = null
  openedId = null
  selected.value = 0
  rootSelected.value = false
}

function open(id: string) {
  const map = maps.value.find(m => m.id === id)
  if (!map || !el.value) return
  close()
  const m = new MindElixir({
    el: el.value,
    direction: MindElixir.SIDE,
    toolBar: false,
    contextMenu: false,
    keypress: true,
    allowUndo: true,
    newTopicName: t('mindmap.newIdea'),
    theme: THEME,
    scaleMin: 0.3,
    scaleMax: 2.5
  })
  m.init(structuredClone(toRaw(map.data)))
  m.bus.addListener('operation', scheduleSave)
  const track = () => {
    selected.value = m.currentNodes?.length || 0
    rootSelected.value = !!m.currentNodes?.some(n => n.nodeObj?.id === m.nodeData.id)
  }
  m.bus.addListener('selectNodes', () => nextTick(track))
  m.bus.addListener('unselectNodes', () => nextTick(track))
  mind = m
  openedId = id
  nextTick(() => {
    if (mind === m) m.scaleFit()
  })
}

// Open the editor once the map's row is loaded; close it when leaving ?id.
watch([mapId, () => current.value?.id, el], async ([id]) => {
  if (!id) return close()
  if (openedId === id || !current.value) return
  await nextTick()
  if (openedId !== id && mapId.value === id) open(id)
})
// The map was deleted (or the link is old): back to the list.
watch([loaded, mapId, current], () => {
  if (loaded.value && mapId.value && !current.value) router.replace('/mindmap')
})

function rootTopic() {
  return mind ? mind.findEle(mind.nodeData.id) : null
}
function ensureSelection() {
  if (!mind) return false
  if (!mind.currentNodes?.length) {
    const root = rootTopic()
    if (root) mind.selectNode(root)
  }
  return !!mind.currentNodes?.length
}
async function addChild() {
  if (ensureSelection()) await mind!.addChild()
}
async function addSibling() {
  if (!ensureSelection()) return
  if (rootSelected.value || mind!.currentNodes[0]?.nodeObj?.id === mind!.nodeData.id) await mind!.addChild()
  else await mind!.insertSibling('after')
}
async function edit() {
  if (ensureSelection()) await mind!.beginEdit()
}
async function removeIdeas() {
  if (!mind?.currentNodes?.length) return
  const nodes = mind.currentNodes.filter(n => n.nodeObj?.id !== mind!.nodeData.id)
  if (nodes.length) await mind.removeNodes(nodes)
}
function undo() {
  mind?.undo()
  scheduleSave()
}
function fit() {
  mind?.scaleFit()
  mind?.toCenter()
}

// ---------------------------------------------------------------- list
async function newMap() {
  const map = await create(t('mindmap.newMap'))
  await router.push({ path: '/mindmap', query: { id: map.id } })
}
async function deleteMap() {
  const id = deleting.value
  deleting.value = null
  if (!id) return
  if (id === openedId) {
    close()
    await router.replace('/mindmap')
  }
  await remove(id)
}

// ---------------------------------------------------------------- export
/** PDF of the whole map: drawn as a picture (so Khmer text looks exactly as on screen), on a page its size. */
async function exportPdf() {
  if (!mind || exporting.value) return
  exporting.value = true
  try {
    await flush()
    const [{ exportImageBlob }, { jsPDF }] = await Promise.all([import('@mind-elixir/export-mindmap'), import('jspdf')])
    const SCALE = 2
    const png = await exportImageBlob(mind, 'png', { scale: SCALE, watermarkEnabled: false })
    const url = URL.createObjectURL(png)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    // CSS px → pt (×0.75), plus a margin around the map
    const M = 24
    const w = (img.naturalWidth / SCALE) * 0.75
    const h = (img.naturalHeight / SCALE) * 0.75
    const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'pt', format: [w + M * 2, h + M * 2], compress: true })
    pdf.setFillColor('#F5F4EF')
    pdf.rect(0, 0, w + M * 2, h + M * 2, 'F')
    pdf.addImage(img, 'PNG', M, M, w, h)
    URL.revokeObjectURL(url)
    const name = `${(current.value?.title || 'mind-map').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'mind-map'}.pdf`
    await saveFile(new File([pdf.output('blob')], name, { type: 'application/pdf' }))
  }
  catch (e) {
    console.error('[sati] export pdf', e)
    toast.add({ title: t('mindmap.exportFailed'), color: 'error' })
  }
  finally {
    exporting.value = false
  }
}

/** Phones: the share sheet (Save to Files, send to an app). Computers: a normal download. */
async function saveFile(file: File) {
  const touch = window.matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return
    }
    catch (e: any) {
      if (e?.name === 'AbortError') return
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

const menu = computed(() => [[
  { label: t('mindmap.exportPdf'), icon: 'i-lucide-file-down', onSelect: exportPdf },
  { label: t('mindmap.deleteMap'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => askDelete(openedId) }
]])

// Save before the app goes to the background (a phone may close it there) and when leaving the page.
function onHide() {
  if (document.visibilityState === 'hidden') void flush()
}
onMounted(() => document.addEventListener('visibilitychange', onHide))
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onHide)
  close()
})

const actions = computed(() => [
  { key: 'child', icon: 'i-lucide-git-branch-plus', label: t('mindmap.addChild'), run: addChild, disabled: false },
  { key: 'sibling', icon: 'i-lucide-list-plus', label: t('mindmap.addSibling'), run: addSibling, disabled: false },
  { key: 'edit', icon: 'i-lucide-pencil', label: t('mindmap.edit'), run: edit, disabled: false },
  { key: 'delete', icon: 'i-lucide-trash-2', label: t('mindmap.delete'), run: removeIdeas, disabled: !selected.value || (rootSelected.value && selected.value === 1) },
  { key: 'undo', icon: 'i-lucide-undo-2', label: t('mindmap.undo'), run: undo, disabled: false }
])
</script>

<template>
  <!-- Editor -->
  <div v-if="mapId" class="flex flex-col" style="height: calc(100dvh - env(safe-area-inset-top)); padding-bottom: calc(64px + max(12px, env(safe-area-inset-bottom)))" data-testid="page-mindmap-editor">
    <header class="flex items-center gap-1 px-2 pt-2">
      <button type="button" class="tap text-ink" :aria-label="t('common.back')" data-testid="mindmap-back" @click="flush(); router.push('/mindmap')">
        <UIcon name="i-lucide-chevron-left" class="size-[22px]" />
      </button>
      <h1 class="display m-0 min-w-0 grow truncate text-[20px] font-semibold">{{ current?.title || '' }}</h1>
      <button type="button" class="tap text-ink" :aria-label="t('mindmap.fit')" data-testid="mindmap-fit" @click="fit">
        <UIcon name="i-lucide-scan" class="size-[20px]" />
      </button>
      <UDropdownMenu :items="menu" :content="{ align: 'end' }" :ui="{ content: 'min-w-[200px]', item: 'min-h-[44px] text-[15px]' }">
        <button type="button" class="tap text-ink" :aria-label="t('mindmap.more')" :disabled="exporting" data-testid="mindmap-menu">
          <UIcon :name="exporting ? 'i-lucide-loader-circle' : 'i-lucide-ellipsis-vertical'" class="size-[20px]" :class="exporting ? 'animate-spin' : ''" />
        </button>
      </UDropdownMenu>
    </header>

    <div ref="el" class="map min-h-0 grow" data-testid="mindmap-canvas" />

    <div class="grid grid-cols-5 border-t border-rule bg-white px-1 pb-6" role="toolbar" :aria-label="t('tabs.mindmap')">
      <button
        v-for="a in actions"
        :key="a.key"
        type="button"
        class="flex h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium disabled:opacity-35"
        :class="a.key === 'delete' ? 'text-b1' : 'text-ink'"
        :disabled="a.disabled"
        :data-testid="`mindmap-${a.key}`"
        @click="a.run()"
      >
        <UIcon :name="a.icon" class="size-5 shrink-0" />
        <span class="max-w-full truncate px-0.5">{{ a.label }}</span>
      </button>
    </div>

    <ConfirmModal v-model:open="confirmDelete" :title="t('mindmap.deleteMapTitle')" :body="deletingTitle" :confirm-label="t('mindmap.delete')" danger @confirm="deleteMap" />
    <TabBar />
  </div>

  <!-- List -->
  <div v-else class="flex flex-col gap-3 px-[22px] pt-7" style="padding-bottom: calc(120px + env(safe-area-inset-bottom))" data-testid="page-mindmap">
    <header class="flex items-end justify-between gap-3">
      <h1 class="display m-0 min-w-0 truncate text-[34px] font-bold">{{ t('mindmap.title') }}</h1>
      <UButton v-if="maps.length" size="lg" class="h-11 shrink-0 whitespace-nowrap rounded-xl px-3.5 text-[14px] font-semibold" icon="i-lucide-plus" :label="t('mindmap.new')" data-testid="mindmap-new" @click="newMap" />
    </header>

    <div v-if="maps.length" class="card flex flex-col overflow-hidden !rounded-[18px]">
      <div v-for="m in maps" :key="m.id" class="flex min-h-[64px] items-center gap-1 border-b border-rule2 pr-1 last:border-b-0" data-testid="mindmap-row">
        <NuxtLink :to="{ path: '/mindmap', query: { id: m.id } }" class="flex min-w-0 grow items-center gap-3 py-2 pl-4" data-testid="mindmap-open">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand"><UIcon name="i-lucide-network" class="size-5" /></span>
          <span class="flex min-w-0 grow flex-col gap-0.5">
            <span class="truncate text-[15px] font-medium text-ink">{{ m.title }}</span>
            <span class="truncate text-[12px] text-soft">{{ t('mindmap.ideas', { n: countIdeas(m.data?.nodeData) }) }} · {{ fmt.relativeDay(ymd(m.updatedAt)) }}</span>
          </span>
        </NuxtLink>
        <button type="button" class="tap shrink-0 text-soft" :aria-label="`${m.title}: ${t('mindmap.deleteMap')}`" data-testid="mindmap-row-delete" @click="askDelete(m.id)">
          <UIcon name="i-lucide-trash-2" class="size-[19px]" />
        </button>
      </div>
    </div>

    <div v-else-if="loaded" class="flex flex-col items-center gap-3 rounded-[22px] bg-white p-6 text-center" data-testid="mindmap-empty">
      <span class="flex size-14 items-center justify-center rounded-full bg-brand-tint text-brand"><UIcon name="i-lucide-network" class="size-7" /></span>
      <UButton block size="xl" class="h-[52px] whitespace-nowrap rounded-[14px] text-[15px] font-semibold" icon="i-lucide-plus" :label="t('mindmap.newMap')" data-testid="mindmap-new" @click="newMap" />
    </div>

    <ConfirmModal v-model:open="confirmDelete" :title="t('mindmap.deleteMapTitle')" :body="deletingTitle" :confirm-label="t('mindmap.delete')" danger @confirm="deleteMap" />
    <TabBar />
  </div>
</template>

<style scoped>
/* The map fills the space between the header and the action bar; topics use the app's fonts. */
.map :deep(.map-container) { height: 100%; font-family: inherit; }
.map :deep(.me-tpc) { font-family: inherit; }
html:lang(km) .map :deep(.me-tpc) { line-height: 1.5; }
</style>
