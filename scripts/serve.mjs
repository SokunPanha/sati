// Tiny static server for .output/public with SPA fallback (used for local checks).
// Usage: node scripts/serve.mjs [port]
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../.output/public', import.meta.url)))
const port = Number(process.argv[2] || 4173)
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2'
}

async function find(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  for (const candidate of [clean, join(clean, 'index.html')]) {
    const file = join(root, candidate)
    if (!file.startsWith(root)) continue
    try {
      if ((await stat(file)).isFile()) return file
    }
    catch { /* try next */ }
  }
  return extname(clean) ? null : join(root, 'index.html')
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const file = await find(url.pathname)
  if (!file) {
    res.writeHead(404).end('Not found')
    return
  }
  const noCache = file.endsWith('sw.js') || file.endsWith('.html') || file.endsWith('.webmanifest')
  res.writeHead(200, {
    'Content-Type': types[extname(file)] || 'application/octet-stream',
    'Cache-Control': noCache ? 'no-cache' : 'public, max-age=31536000, immutable'
  })
  res.end(await readFile(file))
}).listen(port, () => console.log(`Sati preview: http://localhost:${port}`))
