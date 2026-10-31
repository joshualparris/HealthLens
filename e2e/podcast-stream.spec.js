import { test, expect } from '@playwright/test'

// These tests actively play the real publisher audio; no local fixtures or mocks.
test('all three publisher-hosted episodes play in desktop/mobile Chromium', async ({ page }) => {
  test.setTimeout(95_000)
  const failures = []
  page.on('requestfailed', request => {
    if (/omny\.fm|vivarep\.com/i.test(request.url())) failures.push({ url: request.url(), error: request.failure()?.errorText })
  })
  await page.goto('/listen.html')
  const audios = page.locator('main audio')
  await expect(audios).toHaveCount(3)

  for (let i = 0; i < 3; i += 1) {
    const result = await audios.nth(i).evaluate(async audio => {
      audio.muted = true // Headless Chromium permits user-gesture-free muted playback.
      audio.preload = 'auto'
      audio.load()
      let outcome
      try {
        outcome = await Promise.race([
          audio.play().then(() => new Promise(resolve => setTimeout(() => resolve({ status:'played', time:audio.currentTime }), 1700))),
          new Promise(resolve => setTimeout(() => resolve({ status:'network-timeout' }), 20_000))
        ])
      } catch (error) {
        outcome = {status:'play-rejected', error:String(error)}
      }
      audio.pause()
      return {...outcome, readyState:audio.readyState, networkState:audio.networkState, mediaError:audio.error?.code ?? null}
    })
    console.log(`Publisher stream ${i + 1}: ${JSON.stringify(result)}; failed requests: ${JSON.stringify(failures)}`)
    expect(result.status, `Publisher stream ${i + 1} must play`).toBe('played')
    expect(result.time, `Publisher stream ${i + 1} must advance`).toBeGreaterThan(0)
  }
})
