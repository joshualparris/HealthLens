import { test, expect } from '@playwright/test'

const days = Array.from({ length: 60 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, 14 + i)).toISOString().slice(0, 10),
  sleep_h: 6.5 + i / 100,
  steps: 9000 + i * 10,
  rhr: 61,
  sleeping_hr_mean: 58,
  hrv: 38 + i / 20,
  sleep_efficiency: 92,
  rr: i % 5 === 0 ? null : 12,
  exercise_min: i % 3 === 0 ? 30 : null,
}))

test('longitudinal dashboard imports only local synthetic daily summaries', async ({ page }) => {
  const requests = []
  await page.goto('/longitudinal.html')
  page.on('request', request => requests.push(request.url()))
  await expect(page.getByText('Choose a private JSON file')).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic-longitudinal.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schema: 'healthlens-longitudinal-v1',
      summary: { caveats: ['Synthetic data only'] },
      days
    })),
  })
  await expect(page.getByText(/Loaded 60 days locally/)).toBeVisible()
  await expect(page.locator('.plot')).toHaveCount(8)
  await expect(page.locator('.kpi')).toHaveCount(5)
  await expect(page.getByText('Synthetic data only')).toBeVisible()
  await page.getByRole('button', { name: '14 days' }).click()
  await expect(page.getByRole('button', { name: '14 days' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#period')).toContainText('2026-11-12')
  await page.getByRole('button', { name: 'Clear data' }).click()
  await expect(page.locator('#view')).toHaveClass(/hidden/)
  expect(requests).toEqual([])
})

test('rejects invalid JSON without exposing stale data', async ({ page }) => {
  await page.goto('/longitudinal.html')
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.json', mimeType: 'application/json',
    buffer: Buffer.from('{"schema":"wrong","days":[{"date":"2026-11-12"}]}')
  })
  await expect(page.getByRole('status')).toContainText('Could not read this file')
  await expect(page.locator('#view')).toHaveClass(/hidden/)
})
