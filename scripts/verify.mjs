// End-to-end smoke test with headless Chrome (playwright-core).
// Usage: node scripts/serve.mjs 4173 &  then  node scripts/verify.mjs
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:4173'
const SHOTS = fileURLToPath(new URL('../screenshots/', import.meta.url)) // decodes spaces in the path
const FONT_DIR = process.env.FONT_DIR || '/tmp/fonts/node_modules/@fontsource'
await mkdir(SHOTS, { recursive: true })
const results = []
const consoleErrors = []
const ok = (name, pass, extra = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
}
const step = async (name, fn) => {
  try {
    const r = await fn()
    ok(name, r !== false, typeof r === 'string' ? r : '')
  }
  catch (e) {
    ok(name, false, String(e.message || e).split('\n')[0])
  }
}

function watch(page, label) {
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${label}] ${m.text()} @ ${m.location().url || ''}`)
  })
  page.on('pageerror', e => consoleErrors.push(`[${label}] pageerror: ${e.message}`))
}

// The sandbox has no access to Google Fonts: serve the same families from local @fontsource files
// so screenshots show the real typefaces (in production the <link> + service worker cache do this).
async function fontRoutes(context) {
  if (!existsSync(FONT_DIR)) return // real Google Fonts are reachable: nothing to stub
  const faces = []
  const add = (family, pkg, subset, weights) => weights.forEach(w => faces.push(
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/local/${pkg}/${pkg}-${subset}-${w}-normal.woff2) format('woff2')}`))
  add('Kantumruy Pro', 'kantumruy-pro', 'khmer', [400, 500, 600, 700])
  add('Space Grotesk', 'space-grotesk', 'latin', [500, 600, 700])
  add('Inter', 'inter', 'latin', [400, 500, 600, 700])
  await context.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: faces.join('\n') }))
  await context.route('https://fonts.gstatic.com/local/**', async (r) => {
    const [, pkg, file] = new URL(r.request().url()).pathname.match(/\/local\/([^/]+)\/(.+)$/)
    try {
      r.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: await readFile(`${FONT_DIR}/${pkg}/files/${file}`) })
    }
    catch {
      r.fulfill({ status: 404, body: '' })
    }
  })
}

// Poll an async in-page check until it returns a truthy value. (page.waitForFunction with an async
// predicate resolves immediately, because the returned Promise itself is truthy.)
const pollPage = async (page, fn, timeout = 10000) => {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const v = await page.evaluate(fn)
    if (v) return v
    await page.waitForTimeout(200)
  }
  throw new Error('timed out after ' + timeout + 'ms')
}

const idbPut = (page, dbPrefix, store, mutate) => page.evaluate(async ({ dbPrefix, store, mutate }) => {
  const dbs = await indexedDB.databases()
  const name = dbs.map(d => d.name).find(n => n.startsWith(dbPrefix))
  const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const tx = db.transaction(store, 'readwrite')
  const st = tx.objectStore(store)
  const all = await new Promise(res => { const r = st.getAll(); r.onsuccess = () => res(r.result) })
  const fn = new Function('row', 'now', mutate)
  for (const row of all) { const out = fn(row, Date.now()); if (out) st.put(out) }
  await new Promise(res => { tx.oncomplete = res })
  db.close()
  return all.length
}, { dbPrefix, store, mutate })

// CHROME=/path/to/chrome overrides; otherwise use the locally installed Google Chrome (macOS, Linux, Windows).
const browser = await chromium.launch({
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }),
  headless: true,
  args: ['--no-sandbox']
})

// ---------------------------------------------------------------- main flow (phone size)
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'km-KH', hasTouch: true, isMobile: true })
await fontRoutes(ctx)
const page = await ctx.newPage()
watch(page, 'main')
const shot = name => page.screenshot({ path: `${SHOTS}${name}.png` })
const tid = id => page.locator(`[data-testid="${id}"]`)
const settle = (ms = 450) => page.waitForTimeout(ms)

await step('load app → splash is shown first', async () => {
  await page.goto(BASE + '/welcome', { waitUntil: 'commit' })
  await page.waitForSelector('#sati-boot, [role="status"][aria-label="Sati"]', { timeout: 8000 })
  await page.waitForTimeout(350)
  await shot('00-splash')
})
await step('first run redirects to the welcome flow (Khmer by default)', async () => {
  await tid('page-welcome').waitFor({ timeout: 10000 })
  await page.waitForFunction(() => !document.querySelector('[role="status"][aria-label="Sati"]'), null, { timeout: 5000 })
  const lang = await page.evaluate(() => document.documentElement.lang)
  const h1 = await page.locator('h1').first().innerText()
  await shot('01-welcome-km')
  return lang === 'km' && /សតិ/.test(h1) ? `lang=${lang}, h1="${h1}"` : false
})
await step('welcome: language picker en ↔ km', async () => {
  await tid('lang-en').click()
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('Welcome to Sati'))
  await tid('lang-km').click()
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('សូមស្វាគមន៍'))
})
await step('welcome: create first profile → notification explainer → Today', async () => {
  await tid('welcome-name').fill('ដារ៉ា')
  await tid('welcome-create').click()
  await tid('perm-status').waitFor()
  await shot('02-welcome-notifications')
  await tid('welcome-skip').click()
  await tid('page-today').waitFor()
  await tid('hero-empty').waitFor()
  await shot('03-today-empty-km')
})

const capture = async (text) => {
  await tid('capture-bar').click()
  await tid('capture-text').waitFor()
  await settle()
  await tid('capture-text').fill(text)
  await tid('capture-save').click()
  await tid('capture-text').waitFor({ state: 'detached' })
  await settle(300)
}
await step('capture 4 tasks into the inbox', async () => {
  await capture('កែវីដេអូបង្រៀន k3s deploy')
  await capture('សរសេរស្គ្រីបវីដេអូបន្ទាប់')
  await capture('រៀនភាសាអង់គ្លេស')
  await capture('ឆ្លើយមតិយោបល់')
  await tid('sort-inbox').waitFor()
  return (await tid('sort-inbox').innerText()).includes('4')
})

await step('sort the inbox (box 1, box 2, daily routine, box 3)', async () => {
  await page.goto(BASE + '/plan')
  await tid('inbox-bar').click()
  await tid('sort-sheet').waitFor()
  await settle()
  // 1: Do now, area Dev Hub
  await tid('sort-box-1').click()
  await tid('sort-area').click()
  await tid('area-Dev Hub').click()
  if (await tid('sort-result').getAttribute('data-box') !== '1') throw new Error('expected box 1')
  await shot('04-sort-sheet-km')
  await tid('sort-save').click()
  // 2: Schedule → box 2
  await page.waitForFunction(() => document.querySelector('[data-testid="sort-title"]')?.value?.includes('ស្គ្រីប'))
  await tid('sort-box-2').click()
  if (await tid('sort-result').getAttribute('data-box') !== '2') throw new Error('expected box 2')
  await tid('sort-save').click()
  // 3: Schedule + daily → routine (habit)
  await page.waitForFunction(() => document.querySelector('[data-testid="sort-title"]')?.value?.includes('អង់គ្លេស'))
  await tid('sort-box-2').click()
  await page.locator('[data-testid="sort-sheet"] button[aria-pressed]', { hasText: 'រាល់ថ្ងៃ' }).click()
  await tid('sort-save').click()
  // 4: Limit → box 3
  await page.waitForFunction(() => document.querySelector('[data-testid="sort-title"]')?.value?.includes('មតិ'))
  await tid('sort-box-3').click()
  await tid('sort-save').click()
  await tid('sort-sheet').waitFor({ state: 'detached' })
  const b1 = await page.locator('[data-testid="box-1"] [data-testid="matrix-task"]').count()
  const b2 = await page.locator('[data-testid="box-2"] [data-testid="matrix-task"]').count()
  const b3 = await page.locator('[data-testid="box-3"] [data-testid="matrix-task"]').count()
  const routines = await page.locator('[data-testid="routine-row"]').count()
  return b1 === 1 && b2 === 1 && b3 === 1 && routines === 1 ? `box1=${b1} box2=${b2} box3=${b3} routines=${routines}` : false
})

await step('add tasks to Top 3 from Plan', async () => {
  for (const box of ['box-1', 'box-2']) {
    await settle(500)
    await page.locator(`[data-testid="${box}"] [data-testid="matrix-task"]`).first().click()
    await tid('action-top3').waitFor()
    await settle()
    await tid('action-top3').click()
    await tid('task-actions').waitFor({ state: 'detached' })
  }
  await settle(2800) // let toasts leave
  await shot('05-plan-km')
})

await step('Today shows Up next, rest of Top 3 and the daily routine', async () => {
  await page.goto(BASE + '/')
  await tid('hero').waitFor()
  const title = await tid('hero-title').innerText()
  const rows = await tid('top3-row').count()
  const tiles = await tid('routine-tile').count()
  await settle(900)
  await shot('06-today-km')
  return title.includes('k3s') && rows === 1 && tiles === 1 ? `hero="${title}", rest=${rows}, routines=${tiles}` : false
})

await step('start focus: countdown runs, pause/resume, capture during focus', async () => {
  await tid('start-focus').click()
  await tid('page-focus').waitFor()
  const a = await tid('focus-clock').innerText()
  await page.waitForTimeout(2200)
  const b = await tid('focus-clock').innerText()
  await shot('07-focus-km')
  if (a === b) throw new Error(`clock did not move (${a})`)
  await tid('focus-pause').click()
  const p1 = await tid('focus-clock').innerText()
  await page.waitForTimeout(1500)
  const p2 = await tid('focus-clock').innerText()
  if (p1 !== p2) throw new Error('pause did not hold the clock')
  await tid('focus-pause').click()
  await tid('focus-capture').click()
  await tid('capture-text').waitFor()
  await settle()
  await shot('08-capture-during-focus-km')
  await tid('capture-text').fill('សាកពុម្ពអក្សរថ្មីសម្រាប់ thumbnail')
  await tid('capture-save').click()
  await tid('capture-text').waitFor({ state: 'detached' })
  return `${a} → ${b}`
})

await step('focus survives a reload (persisted endAt)', async () => {
  await page.reload()
  await tid('page-focus').waitFor()
  await tid('focus-clock').waitFor()
  return /^4[34]:\d\d$/.test(await tid('focus-clock').innerText())
})

await step('focus completes → session logged, in-app notification, break offered', async () => {
  await idbPut(page, 'sati-p-', 'settings', `if (row.key === 'activeFocus') { row.value.endAt = now + 1500; row.value.startAt = now - 45 * 60000 + 1500; return row }`)
  await page.reload()
  await tid('focus-finished').waitFor({ timeout: 10000 })
  await shot('09-focus-done-km')
  await tid('take-break').waitFor()
  await tid('focus-back').click()
  await tid('page-today').waitFor()
  await tid('unread-dot').waitFor()
  const sessions = await page.evaluate(() => document.querySelector('[data-testid="page-today"]').innerText)
  return /1 នៃ 4 វគ្គ/.test(sessions) ? 'Today shows "1 នៃ 4 វគ្គ"' : false
})

await step('End early from the capture sheet shows minutes left and ends the session', async () => {
  await tid('start-focus').click()
  await tid('page-focus').waitFor()
  await tid('focus-end').click()
  await tid('end-session').waitFor()
  await settle()
  const txt = await page.locator('[role="dialog"]').innerText()
  await tid('end-session').click()
  await tid('page-today').waitFor()
  return /45 នាទី|44 នាទី/.test(txt)
})

await step('add a reminder (tomorrow) → listed, shown on Today; it is a task too (no Task/Reminder tabs)', async () => {
  await page.goto(BASE + '/reminders')
  await tid('new-reminder').click()
  await tid('capture-text').waitFor()
  await settle()
  if (await tid('capture-mode').count()) throw new Error('Task/Reminder tabs still shown')
  if ((await tid('capture-remind').getAttribute('aria-checked')) !== 'true') throw new Error('Remind me is not on')
  await tid('capture-text').fill('ប្រជុំក្រុម')
  await tid('reminder-tomorrow').click()
  await tid('reminder-time').fill('10:00')
  await tid('reminder-alert').selectOption('15')
  await tid('capture-box-2').click()
  await shot('10-reminder-sheet-km')
  await tid('capture-save').click()
  await tid('reminder-row').waitFor()
  await settle(2800)
  await shot('11-reminders-km')
  const linked = await page.evaluate(async () => {
    const name = (await indexedDB.databases()).map(d => d.name).find(n => n?.startsWith('sati-p-'))
    const db = await new Promise(r => { const q = indexedDB.open(name); q.onsuccess = () => r(q.result) })
    const all = store => new Promise(r => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => r(q.result) })
    const rem = (await all('reminders')).find(x => x.title === 'ប្រជុំក្រុម')
    const task = (await all('tasks')).find(x => x.title === 'ប្រជុំក្រុម')
    return !!rem && !!task && rem.taskId === task.id && task.box === 2
  })
  if (!linked) throw new Error('reminder not saved as a task in box 2')
  await page.goto(BASE + '/')
  await tid('next-reminder').waitFor()
  return (await tid('next-reminder').innerText()).includes('ប្រជុំក្រុម') ? 'reminder + task (Schedule box), linked' : false
})

await step('a due reminder fires once (scheduler catch-up, no duplicates)', async () => {
  await idbPut(page, 'sati-p-', 'reminders', `row.repeat = 'none'; row.at = now - 60000; row.alertBefore = 0; return row`)
  await page.reload()
  await tid('page-today').waitFor()
  await page.waitForTimeout(2500)
  await page.reload()
  await page.waitForTimeout(2500)
  await page.goto(BASE + '/notifications')
  await tid('page-notifications').waitFor()
  await settle(600)
  const n = await page.locator('[data-testid="notif-new"]', { hasText: 'ប្រជុំក្រុម' }).count()
  await shot('12-notifications-km')
  return n === 1 ? 'exactly 1 reminder notification after 2 reloads' : `count=${n}`
})

await step('Review + History render with logged data', async () => {
  await page.goto(BASE + '/review')
  await tid('review-today').waitFor()
  await settle(600)
  await shot('13-review-km')
  const sug = await tid('tomorrow-suggestion').count()
  await tid('to-history').click()
  await tid('history-day').first().waitFor()
  await settle(600)
  await page.screenshot({ path: `${SHOTS}14-history-km.png`, fullPage: true })
  const entries = await tid('history-entry').count()
  return sug >= 1 && entries >= 1 ? `suggestions=${sug}, history entries=${entries}` : false
})

await step('Settings: switch language to English and back to Khmer', async () => {
  await page.goto(BASE + '/settings')
  await tid('page-settings').waitFor()
  await settle(600)
  await page.screenshot({ path: `${SHOTS}15-settings-km.png`, fullPage: true })
  await shot('15-settings-km-top')
  await tid('set-language-en').click()
  await page.waitForFunction(() => document.documentElement.lang === 'en' && document.querySelector('h1')?.textContent?.includes('Profile & settings'))
  await page.goto(BASE + '/')
  await tid('page-today').waitFor()
  await settle(700)
  await shot('16-today-en')
  const en = (await page.locator('h1').first().innerText()) === 'Today'
  await page.goto(BASE + '/settings')
  await tid('set-language-km').click()
  await page.waitForFunction(() => document.documentElement.lang === 'km')
  await page.reload()
  await tid('page-settings').waitFor()
  const stillKm = await page.evaluate(() => document.documentElement.lang) === 'km'
  return en && stillKm ? 'en applied, km restored and persisted across reload' : false
})

await step('profiles: create a second profile with a PIN, data is separate, PIN asked on switch back', async () => {
  await page.goto(BASE + '/')
  await tid('avatar').click()
  await tid('new-profile').waitFor()
  await settle()
  await shot('17-profiles-km')
  await tid('new-profile').click()
  await tid('new-profile-name').fill('Study')
  await tid('create-profile').click()
  await tid('hero-empty').waitFor()
  const emptyToday = await tid('routine-tile').count() === 0
  // lock the FIRST profile with a PIN by switching back and setting it in settings
  await tid('avatar').click()
  await tid('profile-ដារ៉ា').waitFor()
  await settle()
  await tid('profile-ដារ៉ា').click()
  await tid('hero').waitFor()
  await page.goto(BASE + '/settings')
  await page.locator('button', { hasText: 'កំណត់លេខ PIN' }).click()
  await page.locator('[data-testid="page-settings"] input[type="password"]').fill('2468')
  await page.locator('[data-testid="page-settings"] input[type="password"]').press('Enter')
  await page.locator('button', { hasText: 'ដកលេខ PIN' }).waitFor()
  // switch to Study, then back → PIN prompt
  await tid('settings-switch').click()
  await tid('profile-Study').waitFor()
  await settle()
  await tid('profile-Study').click()
  await tid('hero-empty').waitFor()
  await tid('avatar').click()
  await tid('profile-ដារ៉ា').waitFor()
  await settle()
  await tid('profile-ដារ៉ា').click()
  await tid('pin-input').waitFor()
  await tid('pin-input').fill('0000')
  await tid('pin-input').press('Enter')
  await page.locator('[role="alert"]').waitFor()
  await tid('pin-input').fill('2468')
  await tid('pin-input').press('Enter')
  await tid('hero').waitFor()
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name).sort())
  return emptyToday && dbs.filter(n => n.startsWith('sati-p-')).length === 2 && dbs.includes('sati-meta') ? dbs.join(', ') : false
})

await step('backup download (all profiles) is valid JSON with both profiles', async () => {
  await page.goto(BASE + '/settings')
  const [dl] = await Promise.all([page.waitForEvent('download'), tid('backup-all').click()])
  const path = await dl.path()
  const data = JSON.parse(await readFile(path, 'utf8'))
  globalThis.backupPath = join(tmpdir(), 'sati-backup-test.json')
  await dl.saveAs(globalThis.backupPath)
  return data.app === 'sati' && data.profiles.length === 2 && data.profiles.some(p => p.data.tasks.length >= 4) ? `${dl.suggestedFilename()} · ${data.profiles.length} profiles` : false
})

await step('delete a profile removes its database; restore brings it back', async () => {
  // switch to Study and delete it
  await tid('settings-switch').click()
  await tid('profile-Study').waitFor()
  await settle()
  await tid('profile-Study').click()
  await tid('hero-empty').waitFor()
  await page.goto(BASE + '/settings')
  await tid('delete-profile').click()
  await tid('confirm-yes').click()
  await tid('page-today').waitFor()
  await settle(800)
  const after = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name).filter(n => n.startsWith('sati-p-')).length)
  if (after !== 1) throw new Error(`expected 1 profile DB after delete, got ${after}`)
  await page.goto(BASE + '/settings')
  await tid('restore-input').setInputFiles(globalThis.backupPath)
  await tid('confirm-yes').click()
  await pollPage(page, async () => (await indexedDB.databases()).filter(d => d.name.startsWith('sati-p-')).length === 2, 8000)
  return 'DB count 2 → 1 → 2'
})

await step('every page opens (/, /plan, /review, /history, /reminders, /notifications, /settings, /focus)', async () => {
  const pages = { '/': 'page-today', '/plan': 'page-plan', '/review': 'page-review', '/history': 'page-history', '/reminders': 'page-reminders', '/notifications': 'page-notifications', '/settings': 'page-settings', '/focus': 'page-focus' }
  for (const [path, id] of Object.entries(pages)) {
    await page.goto(BASE + path)
    await tid(id).waitFor({ timeout: 8000 })
    await settle(350)
  }
})

const inboxCount = async () => {
  await page.goto(BASE + '/plan')
  await tid('page-plan').waitFor()
  await settle(500)
  return (await tid('inbox-bar').count()) ? Number((await tid('inbox-bar').innerText()).match(/\d+/)?.[0] || 0) : 0
}
const openCapture = async (text) => {
  await tid('capture-bar').click()
  await tid('capture-text').waitFor()
  await settle()
  await tid('capture-text').fill(text)
}

await step('one form: picking box 1 (Do now) saves straight into box 1 (skips the inbox)', async () => {
  const before = await inboxCount()
  await openCapture('ជួសជុល server')
  await tid('capture-box-1').click()
  if (await tid('capture-result').getAttribute('data-box') !== '1') throw new Error('expected box 1 preview')
  await tid('capture-save').click()
  await tid('capture-text').waitFor({ state: 'detached' })
  const after = await inboxCount()
  const inBox1 = await page.locator('[data-testid="box-1"] [data-testid="matrix-task"]', { hasText: 'ជួសជុល server' }).count()
  if (inBox1 !== 1 || after !== before) throw new Error(`box1=${inBox1}, inbox ${before} → ${after}`)
  return `in box 1, inbox unchanged (${before})`
})

await step('one form: Repeat = every day saves a habit (shown in routines on Plan and Today)', async () => {
  const before = await inboxCount()
  await openCapture('ហាត់ប្រាណ ៣០ នាទី')
  await page.locator('[data-testid="capture-text"]').locator('xpath=ancestor::*[@role="dialog"][1]').locator('button[aria-pressed]', { hasText: 'រាល់ថ្ងៃ' }).click()
  await tid('capture-save').click()
  await tid('capture-text').waitFor({ state: 'detached' })
  const after = await inboxCount()
  const onPlan = await page.locator('[data-testid="routine-row"]', { hasText: 'ហាត់ប្រាណ' }).count()
  await page.goto(BASE + '/')
  await tid('page-today').waitFor()
  await settle(500)
  const onToday = await page.locator('[data-testid="routine-tile"]', { hasText: 'ហាត់' }).count()
  if (onPlan !== 1 || onToday !== 1 || after !== before) throw new Error(`plan=${onPlan} today=${onToday} inbox ${before} → ${after}`)
  return 'habit listed on Plan and Today, inbox unchanged'
})

await step('task description: saved from the capture sheet, shown on the task, editable in the sort sheet', async () => {
  await page.goto(BASE + '/plan')
  await tid('page-plan').waitFor()
  await openCapture('ថតវីដេអូ Docker')
  await tid('capture-description').fill('ជំពូក ១–៣\nប្រើ k3s')
  await tid('capture-box-2').click()
  await tid('capture-save').click()
  await tid('capture-text').waitFor({ state: 'detached' })
  await settle(500)
  await page.locator('[data-testid="box-2"] [data-testid="matrix-task"]', { hasText: 'ថតវីដេអូ Docker' }).click()
  const shown = await tid('task-description').innerText()
  await page.locator('[data-testid="task-actions"] button', { hasText: 'កែ' }).first().click()
  await tid('sort-sheet').waitFor()
  await settle()
  const inForm = await tid('sort-description').inputValue()
  await tid('sort-description').fill('ជំពូក ១–៤')
  await tid('sort-save').click()
  await tid('sort-sheet').waitFor({ state: 'detached' })
  await settle(500)
  await page.locator('[data-testid="box-2"] [data-testid="matrix-task"]', { hasText: 'ថតវីដេអូ Docker' }).click()
  const edited = await tid('task-description').innerText()
  await page.keyboard.press('Escape')
  if (!shown.includes('ប្រើ k3s') || !inForm.includes('ជំពូក ១–៣') || edited !== 'ជំពូក ១–៤') throw new Error(`shown=${shown} form=${inForm} edited=${edited}`)
  return 'shown, prefilled in edit form, edit saved'
})

await step('Settings: number of top tasks per day is configurable (Review shows /5, back to 3)', async () => {
  await page.goto(BASE + '/settings')
  await tid('set-top-count').selectOption('5')
  await settle(300)
  await page.goto(BASE + '/review')
  await tid('review-today').waitFor()
  await settle(500)
  const txt = await page.locator('[data-testid="page-review"]').innerText()
  await page.goto(BASE + '/settings')
  await tid('set-top-count').selectOption('3')
  await settle(300)
  if (!/\/5\b/.test(txt) || !txt.includes('ទាំង 5')) throw new Error('review did not use 5: ' + txt.slice(0, 300))
  return 'Review counter /5 and "ទាំង 5", reset to 3'
})

await step('Plan: list view by default, box sections collapse and stay collapsed after reload', async () => {
  await page.goto(BASE + '/plan')
  await tid('plan-list').waitFor()
  await page.locator('[data-testid="box-2"] [data-testid="matrix-task"]').first().waitFor()
  const before = await page.locator('[data-testid="box-2"] [data-testid="matrix-task"]').count()
  await tid('list-toggle-2').click()
  const hidden = await page.locator('[data-testid="box-2"] [data-testid="matrix-task"]').count()
  await page.reload()
  await tid('plan-list').waitFor()
  await settle(400)
  const afterReload = await page.locator('[data-testid="box-2"] [data-testid="matrix-task"]').count()
  const expanded = await tid('list-toggle-2').getAttribute('aria-expanded')
  await tid('list-toggle-2').click()
  const back = await page.locator('[data-testid="box-2"] [data-testid="matrix-task"]').count()
  if (!(before > 0 && hidden === 0 && afterReload === 0 && expanded === 'false' && back === before)) throw new Error(`before=${before} hidden=${hidden} reload=${afterReload} expanded=${expanded} back=${back}`)
  return `box 2: ${before} → collapsed (kept after reload) → ${back}`
})

await step('one form: "Add to today\'s Top" puts the new task on Today right away', async () => {
  await page.goto(BASE + '/settings')
  await tid('set-top-count').selectOption('7')
  await page.goto(BASE + '/')
  await tid('page-today').waitFor()
  await openCapture('ផ្ញើអ៊ីមែលទៅម្ចាស់ផ្ទះ')
  await tid('capture-top').click()
  if (await tid('capture-result').getAttribute('data-box') !== '1') throw new Error('Top task without a box should default to Do now')
  await tid('capture-save').click()
  await tid('capture-text').waitFor({ state: 'detached' })
  await settle(600)
  const onToday = await page.locator('[data-testid="page-today"]', { hasText: 'ផ្ញើអ៊ីមែលទៅម្ចាស់ផ្ទះ' }).count()
  await page.goto(BASE + '/settings')
  await tid('set-top-count').selectOption('3')
  if (onToday !== 1) throw new Error('not shown on Today')
  return 'shown on Today, filed in Do now'
})

await step('Plan list: one tap on the star adds to / removes from the Top list', async () => {
  await page.goto(BASE + '/plan')
  await tid('plan-list').waitFor()
  const row = page.locator('[data-testid="box-3"] [data-testid="list-row"]').first()
  await row.waitFor()
  const star = row.locator('[data-testid="top-toggle"]')
  const was = await star.getAttribute('aria-pressed')
  await star.click()
  await settle(300)
  const now = await star.getAttribute('aria-pressed')
  await star.click()
  await settle(300)
  const back = await star.getAttribute('aria-pressed')
  const full = await page.locator('[role="alert"], li[role="status"], [data-state="open"]', { hasText: 'ពេញ' }).count()
  if (was === now && !full) throw new Error(`star did not toggle (was=${was} now=${now})`)
  if (back !== was) throw new Error(`second tap did not restore (was=${was} back=${back})`)
  return was === now ? 'Top list full → warning shown' : `aria-pressed ${was} → ${now} → ${back}`
})

await step('tab bar: Settings is the last tab, + in the centre opens the capture sheet', async () => {
  await page.goto(BASE + '/')
  await tid('page-today').waitFor()
  const order = await page.evaluate(() => [...document.querySelector('nav').children].map(el => el.getAttribute('data-testid') || el.querySelector('[data-testid]')?.getAttribute('data-testid')))
  if (order.join(',') !== 'tab-today,tab-plan,capture-bar,tab-review,tab-settings') throw new Error(order.join(','))
  await tid('tab-settings').click()
  await tid('page-settings').waitFor()
  await tid('capture-bar').click()
  await tid('capture-text').waitFor()
  await page.keyboard.press('Escape')
  await tid('capture-text').waitFor({ state: 'detached' })
  return order.join(' · ')
})

await step('landing page /download: opens, switches language, shows install steps, returns to the app', async () => {
  await page.goto(BASE + '/download')
  await tid('page-download').waitFor()
  await tid('landing-install').waitFor()
  await tid('landing-lang-en').click()
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('One thing at a time'))
  await tid('how-iphone').click()
  const iphoneSteps = await page.locator('[data-testid="how-steps"] li').count()
  await tid('how-android').click()
  const androidSteps = await page.locator('[data-testid="how-steps"] li').count()
  const imgs = await page.evaluate(async () => {
    const list = [...document.images]
    list.forEach(i => { i.loading = 'eager' })
    await Promise.all(list.map(i => i.decode().catch(() => null)))
    return list.filter(i => i.naturalWidth > 0).length + '/' + list.length
  })
  await page.screenshot({ path: `${SHOTS}18-landing-en.png` })
  await tid('landing-browser').click()
  await tid('page-today').waitFor()
  const lang = await page.evaluate(() => document.documentElement.lang)
  if (!(iphoneSteps === 4 && androidSteps === 3 && lang === 'km' && imgs.split('/')[0] === imgs.split('/')[1])) throw new Error(`iphone=${iphoneSteps} android=${androidSteps} lang=${lang} imgs=${imgs}`)
  return `steps iphone=${iphoneSteps} android=${androidSteps}, images ${imgs}, back on Today in profile language (${lang})`
})

await step('landing page opens without a profile (no redirect to welcome)', async () => {
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
  await fontRoutes(fresh)
  const lp = await fresh.newPage()
  watch(lp, 'landing')
  await lp.goto(BASE + '/download')
  await lp.locator('[data-testid="page-download"]').waitFor()
  await lp.waitForTimeout(600)
  const url = lp.url()
  const overflow = await lp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  await lp.screenshot({ path: `${SHOTS}19-landing-desktop-km.png`, fullPage: true })
  await lp.goto(BASE + '/')
  await lp.locator('[data-testid="page-download"]').waitFor()
  const rootUrl = new URL(lp.url()).pathname
  await lp.locator('[data-testid="landing-browser"]').click()
  await lp.locator('[data-testid="page-welcome"]').waitFor()
  await fresh.close()
  if (!url.endsWith('/download') || overflow) throw new Error(`url=${url} overflow=${overflow}`)
  if (rootUrl !== '/') throw new Error(`/ redirected to ${rootUrl}`)
  return 'stays on /download, no horizontal scroll; / shows the landing page, "use in browser" → welcome'
})

await step('icons render from the client bundle (no network)', async () => {
  await page.goto(BASE + '/')
  await tid('page-today').waitFor()
  await settle(500)
  const info = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.iconify, svg.iconify, span[class*="i-lucide"], [class*="iconify"]'))
    const good = els.filter((el) => {
      const cs = getComputedStyle(el)
      return el.tagName.toLowerCase() === 'svg' ? el.innerHTML.length > 10 : (cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none') || (cs.backgroundImage && cs.backgroundImage !== 'none')
    })
    return { total: els.length, good: good.length }
  })
  return info.total > 3 && info.good === info.total ? `${info.good}/${info.total} icons have artwork` : `only ${info.good}/${info.total}`
})

await step('Khmer text uses a real Khmer font (not tofu)', async () => {
  const r = await page.evaluate(async () => {
    await document.fonts.ready
    return { kantumruy: document.fonts.check('16px "Kantumruy Pro"', 'សតិ'), grotesk: document.fonts.check('600 16px "Space Grotesk"', 'Sati') }
  })
  return r.kantumruy ? `Kantumruy Pro loaded=${r.kantumruy}, Space Grotesk loaded=${r.grotesk}` : false
})
await ctx.close()

// ---------------------------------------------------------------- PWA: service worker, system notifications, offline
const pwa = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'km-KH', permissions: ['notifications'] })
const p2 = await pwa.newPage()
const pwaErrors = []
p2.on('console', (m) => { if (m.type() === 'error') pwaErrors.push(`${m.text()} @ ${m.location().url || ''}`) })
p2.on('pageerror', e => pwaErrors.push(`pageerror: ${e.message}`))
const t2 = id => p2.locator(`[data-testid="${id}"]`)

await step('manifest + service worker are served; sw.js has the notificationclick handler', async () => {
  const man = await (await p2.request.get(BASE + '/manifest.webmanifest')).json()
  const sw = await (await p2.request.get(BASE + '/sw.js')).text()
  const icons = await Promise.all(['/icons/pwa-192.png', '/icons/pwa-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon-180.png'].map(async u => (await p2.request.get(BASE + u)).status()))
  return man.name === 'Sati' && man.lang === 'km' && man.display === 'standalone' && man.theme_color === '#0E1C1A' && sw.includes('notificationclick') && icons.every(s => s === 200)
    ? `manifest ok, ${man.icons.length} icons, sw.js ${Math.round(sw.length / 1024)} KB` : false
})

await step('service worker registers and controls the page; manifest link + apple meta present', async () => {
  await p2.goto(BASE + '/welcome')
  await t2('page-welcome').waitFor()
  await p2.evaluate(() => navigator.serviceWorker.ready)
  const head = await p2.evaluate(() => ({
    manifest: !!document.querySelector('link[rel="manifest"]'),
    apple: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    touch: !!document.querySelector('link[rel="apple-touch-icon"]'),
    theme: document.querySelector('meta[name="theme-color"]')?.content
  }))
  return head.manifest && head.apple === 'yes' && head.touch && head.theme === '#0E1C1A' ? JSON.stringify(head) : JSON.stringify(head) && false
})

await step('permission granted → test button shows a real system notification (vibrate, icon, badge, data.url)', async () => {
  await t2('welcome-name').fill('PWA')
  await t2('welcome-create').click()
  await t2('welcome-skip').click()
  await t2('page-today').waitFor()
  await p2.goto(BASE + '/settings')
  await t2('test-notification').click()
  const n = await pollPage(p2, async () => {
    const [x] = await (await navigator.serviceWorker.ready).getNotifications()
    return x ? { title: x.title, body: x.body, icon: x.icon, badge: x.badge, tag: x.tag, silent: x.silent, vibrate: x.vibrate, data: x.data, perm: Notification.permission } : null
  }, 8000)
  if (!(n?.perm === 'granted' && n.data?.url === '/notifications' && /pwa-192/.test(n.icon) && n.silent === false)) throw new Error(JSON.stringify(n))
  return JSON.stringify(n)
})

await step('due reminder → system notification with requireInteraction via the scheduler', async () => {
  await p2.goto(BASE + '/reminders')
  await t2('new-reminder').click()
  await t2('capture-text').waitFor()
  await p2.waitForTimeout(500)
  await t2('capture-text').fill('Call mom')
  await t2('reminder-tomorrow').click()
  await t2('capture-save').click()
  await t2('reminder-row').waitFor()
  await idbPut(p2, 'sati-p-', 'reminders', `row.at = now - 30000; return row`)
  await p2.reload()
  const n = await pollPage(p2, async () => {
    const x = (await (await navigator.serviceWorker.ready).getNotifications()).find(n => n.title === 'Call mom')
    return x ? { title: x.title, body: x.body, requireInteraction: x.requireInteraction, url: x.data?.url } : null
  })
  if (!(n?.requireInteraction === true && n.url === '/reminders')) throw new Error(JSON.stringify(n))
  return JSON.stringify(n)
})

await step('offline: the app shell and a deep link still load from the service worker', async () => {
  await p2.goto(BASE + '/')
  await t2('page-today').waitFor()
  await p2.waitForTimeout(1500)
  await pwa.setOffline(true)
  await p2.goto(BASE + '/plan')
  await t2('page-plan').waitFor({ timeout: 10000 })
  await p2.reload()
  await t2('page-plan').waitFor({ timeout: 10000 })
  await pwa.setOffline(false)
})
await pwa.close()
await browser.close()

const fontNoise = e => /fonts\.(googleapis|gstatic)\.com/.test(e) || /ERR_(INTERNET_DISCONNECTED|FAILED|TUNNEL|CONNECTION|NAME_NOT_RESOLVED|BLOCKED)/.test(e)
console.log('\n---- console errors: main flow (service worker blocked, fonts served locally) ----')
console.log(consoleErrors.length ? consoleErrors.join('\n') : 'none')
console.log('\n---- console errors: PWA context (real service worker; Google Fonts is unreachable in this sandbox) ----')
const real = pwaErrors.filter(e => !fontNoise(e))
console.log(`network/font-related (expected here): ${pwaErrors.length - real.length}`)
console.log(real.length ? real.join('\n') : 'other errors: none')
const failed = results.filter(r => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length || consoleErrors.length || real.length ? 1 : 0)
