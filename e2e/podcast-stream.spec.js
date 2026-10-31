import { test, expect } from '@playwright/test'

// Exercise the real third-party MP3 streams, not merely the existence of an iframe.
// Omny Studio and Viva Learning host these URLs; no copies are served by HealthLens.
test('all three publisher-hosted episodes load and advance in desktop/mobile Chromium', async ({page}) => {
  test.setTimeout(90_000)
  await page.goto('/listen.html')
  const audios = page.locator('main audio')
  await expect(audios).toHaveCount(3)

  for (let i = 0; i < 3; i += 1) {
    const result = await audios.nth(i).evaluate(async audio => {
      audio.muted = true // muted playback is permitted by Chromium without a user gesture
      audio.preload = 'auto'
      audio.load()
      const status = await Promise.race([
        new Promise(resolve => audio.addEventListener('loadedmetadata', () => resolve('metadata'), {once: true})),
        new Promise(resolve => audio.addEventListener('error', () => resolve(`media-error-${audio.error?.code}`), {once: true})),
        new Promise(resolve => setTimeout(() => resolve('timeout'), 18_000)),
      ])
      if (status !== 'metadata') return {status, currentTime:audio.currentTime}
      try {
        await audio.play()
        await new Promise(resolve => setTimeout(resolve, 1600))
        const currentTime = audio.currentTime
        audio.pause()
        return {status:'playing',currentTime}
      } catch (error) {
        return {status:'play-rejected',reason:String(error),currentTime:audio.currentTime}
      }
    })
    console.log(`Publisher stream ${i+1}: ${JSON.stringify(result)}`)
    expect(result.status, `Publisher stream ${i+1} must play`).toBe('playing')
    expect(result.currentTime, `Publisher stream ${i+1} must advance`).toBeGreaterThan(0)
  }
})
