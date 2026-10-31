import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../public/listen.html', import.meta.url), 'utf8')
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const header = readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8')

test('mouth-ulcer library contains exactly three individually accessible official players', () => {
  const iframeTags = [...html.matchAll(/<iframe\b[^>]*>/g)].map(match => match[0])
  assert.equal(iframeTags.length, 3)
  for (const iframe of iframeTags) {
    assert.match(iframe, /title="Play [^"]+"/)
    assert.match(iframe, /loading="lazy"/)
    assert.match(iframe, /allow="[^"]*autoplay/)
    assert.match(iframe, /referrerpolicy="strict-origin-when-cross-origin"/)
  }
  assert.match(iframeTags[0], /omny\.fm\/shows\/spot-diagnosis\/s04-e06-oral-mucosal-diseases-part-one\/embed/)
  assert.match(iframeTags[1], /omny\.fm\/shows\/spot-diagnosis\/s04-e07-oral-mucosal-diseases-part-two\/embed/)
  assert.match(iframeTags[2], /youtube-nocookie\.com\/embed\/x2rUpHx0Lr4/)
  assert.equal(new Set(iframeTags.map(tag => /src="([^"]+)"/.exec(tag)?.[1])).size, 3)
})

test('mobile layout, publisher fallbacks and HealthLens navigation', () => {
  assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/)
  assert.match(html, /@media\(max-width:520px\)/)
  assert.equal((html.match(/class="fallback"/g) ?? []).length, 3)
  assert.match(html, /Back to HealthLens/)
  assert.match(header, /href="\/listen\.html"/)
})

test('public media route exempts only itself from cross-origin isolation', () => {
  const global = vercel.headers.find(rule => rule.source === '/(.*)')
  const listen = vercel.headers.find(rule => rule.source === '/listen.html')
  assert.ok(global)
  assert.ok(listen)
  assert.equal(global.headers.find(h => h.key === 'Cross-Origin-Embedder-Policy').value, 'require-corp')
  assert.equal(listen.headers.find(h => h.key === 'Cross-Origin-Embedder-Policy').value, 'unsafe-none')
})
