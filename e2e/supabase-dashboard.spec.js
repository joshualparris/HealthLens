import { expect, test } from '@playwright/test'

// Privacy regression: browser-side cloud reads were intentionally disabled.
// Supabase health tables contain private records. Until authenticated server
// sessions are implemented, the UI must not fetch them from the browser.
// The previous chart fixture expected an intentionally retired direct-read path.
test('private cloud health dashboard stays unavailable without a server session', async ({ page }) => {
  const privateRequests = []
  page.on('request', request => {
    if (/\\.supabase\\.co\\/rest\\/v1\\/(daily_health_summary|health_sync_imports)/.test(request.url())) {
      privateRequests.push(request.url())
    }
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome to HealthLens' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Configure AI Provider' })).toBeVisible()
  await expect(page.getByText('Supabase Dashboard')).toHaveCount(0)
  expect(privateRequests, 'Private health tables must not be queried by a public browser').toEqual([])
})
