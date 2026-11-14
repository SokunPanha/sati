// Takes the phone screenshots used on the landing page (/download) from the real app.
// Usage: npm run build && node scripts/serve.mjs 4173 &  then  node scripts/landing-shots.mjs
// Writes PNGs to screenshots/landing/, then convert: cwebp -q 82 -resize 585 0 in.png -o public/landing/x.webp
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:4173'
const OUT = fileURLToPath(new URL('../screenshots/landing/', import.meta.url))
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }), headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'km-KH', hasTouch: true, isMobile: true })
const page = await ctx.newPage()
const tid = id => page.locator(`[data-testid="${id}"]`)
const settle = (ms = 450) => page.waitForTimeout(ms)
const ready = async (id) => {
  await tid(id).waitFor()
  await page.waitForFunction(() => !document.querySelector('[role="status"][aria-label="Sati"]'))
  await document_fonts()
  await settle(700)
}
const document_fonts = () => page.evaluate(() => document.fonts.ready)

await page.goto(BASE + '/')
await tid('welcome-name').fill('ដារ៉ា')
await tid('welcome-create').click()
await tid('welcome-skip').click()
await tid('page-today').waitFor()

// One-step capture: text + box in the same sheet.
async function capture(text, box = null) {
  await tid('capture-bar').click()
  await tid('capture-text').waitFor()
  await settle()
  await tid('capture-text').fill(text)
  if (box) await tid(`capture-box-${box}`).click()
  await tid('capture-save').click()
  await tid('capture-text').waitFor({ state: 'detached' })
  await settle(300)
}
await capture('កែវីដេអូបង្រៀន k3s deploy', 1)
await capture('សរសេរស្គ្រីបវីដេអូបន្ទាប់', 2)
await capture('ឆ្លើយមតិយោបល់', 3)
await capture('រៀបចំស្លាយសម្រាប់ថ្នាក់', 2)
await capture('រៀនភាសាអង់គ្លេស') // → inbox, sorted below as a daily routine

await page.goto(BASE + '/plan')
await tid('inbox-bar').click()
await tid('sort-sheet').waitFor()
await settle()
await tid('sort-box-2').click()
await page.locator('[data-testid="sort-sheet"] button[aria-pressed]', { hasText: 'រាល់ថ្ងៃ' }).click()
await tid('sort-save').click()
await tid('sort-sheet').waitFor({ state: 'detached' })

for (const box of ['box-1', 'box-2']) {
  await settle(500)
  await page.locator(`[data-testid="${box}"] [data-testid="matrix-task"]`).first().click()
  await tid('action-top3').waitFor()
  await settle()
  await tid('action-top3').click()
  await tid('task-actions').waitFor({ state: 'detached' })
}

await page.goto(BASE + '/plan')
await ready('page-plan')
await page.screenshot({ path: OUT + 'plan.png' })

await page.goto(BASE + '/')
await ready('page-today')
await page.screenshot({ path: OUT + 'today.png' })

await tid('start-focus').click()
await tid('page-focus').waitFor()
await page.waitForTimeout(3200)
await page.reload()
await ready('page-focus')
await page.waitForTimeout(1200)
await page.screenshot({ path: OUT + 'focus.png' })

await browser.close()
console.log('saved to', OUT)
