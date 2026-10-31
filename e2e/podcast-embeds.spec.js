import { expect, test } from '@playwright/test'

const podcastTitles = [
  'Oral Mucosal Diseases: Part One',
  'Oral Mucosal Diseases: Part Two',
  'Navigating Oral Ulcerative Conditions: When to Treat, Refer, or Reassure',
]
const officialPlayers = [
  'https://omny.fm/shows/spot-diagnosis/s04-e06-oral-mucosal-diseases-part-one/embed',
  'https://omny.fm/shows/spot-diagnosis/s04-e07-oral-mucosal-diseases-part-two/embed',
  'https://www.youtube-nocookie.com/embed/x2rUpHx0Lr4',
]

test('health educational podcast library works on desktop and mobile layouts', async ({ page }) => {
  await page.goto('/listen.html')
  await expect(page).toHaveTitle('Mouth ulcer podcasts | HealthLens')
  await expect(page.getByRole('heading', { name: 'Mouth ulcer podcasts', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to HealthLens' })).toHaveAttribute('href', '/')

  const players = page.locator('main iframe')
  await expect(players).toHaveCount(3)
  for (let i = 0; i < podcastTitles.length; i += 1) {
    await expect(page.getByRole('heading', { name: podcastTitles[i], exact: true })).toBeVisible()
    await expect(players.nth(i)).toHaveAttribute('title', `Play ${podcastTitles[i]}`)
    await expect(players.nth(i)).toHaveAttribute('src', officialPlayers[i])
    await expect(players.nth(i)).toHaveAttribute('allow', /autoplay/)
    await players.nth(i).scrollIntoViewIfNeeded()
    await expect(players.nth(i)).toBeVisible()
  }
  const tooWide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(tooWide, 'Podcasts must not force horizontal overflow on mobile').toBe(false)
})

test('HealthLens homepage has an accessible podcast link', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Listen to mouth ulcer podcasts' })).toBeVisible()
  await page.getByRole('link', { name: 'Listen to mouth ulcer podcasts' }).click()
  await expect(page.getByRole('heading', { name: 'Mouth ulcer podcasts', exact: true })).toBeVisible()
})
