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

test('publisher-hosted direct audio streams are present for all three episodes', () => {
  const sources = [
  "https://traffic.omny.fm/d/clips/d12fa6a5-bad6-4025-9d74-ac600024ef6b/98ece318-818d-44e5-8da2-ac6000259d49/baae3daa-a318-4b33-ae21-b0180009f752/audio.mp3",
  "https://traffic.omny.fm/d/clips/d12fa6a5-bad6-4025-9d74-ac600024ef6b/98ece318-818d-44e5-8da2-ac6000259d49/e4c415e8-233b-4e89-a626-b01800128ba7/audio.mp3",
  "https://cdn.vivarep.com/contrib/va/podcast/podcast_703_clark_navig_oral_ulcers_voco_shining3d_t_ek.20250519032956493.mp3"
]
  assert.equal((html.match(/<audio\b[^>]*controls/g) ?? []).length, 3)
  for (const source of sources) assert.ok(html.includes(`<source src="${source}" type="audio/mpeg">`))
  assert.equal((html.match(/<details class="publisher-player">/g) ?? []).length, 3)
})
