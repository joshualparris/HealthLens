import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import initSqlJs from 'sql.js';

const require = createRequire(import.meta.url);
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');

async function createSyntheticHealthConnectZip(outputPath) {
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database();
  db.run('CREATE TABLE hrv (id TEXT, timestamp INTEGER, rmssd REAL)');

  const latest = Date.UTC(2026, 4, 31, 0, 0, 0);
  const insert = db.prepare('INSERT INTO hrv (id, timestamp, rmssd) VALUES (?, ?, ?)');
  for (let daysAgo = 0; daysAgo < 35; daysAgo += 1) {
    const timestamp = latest - daysAgo * 86400000;
    const base = daysAgo < 7 ? 62 : 52;
    insert.run([`hrv-${daysAgo}-a`, timestamp, base]);
    insert.run([`hrv-${daysAgo}-b`, timestamp + 60000, base + 2]);
  }
  // Duplicate one source record deliberately so the HRV dedupe path is exercised.
  insert.run(['hrv-1-a', latest - 86400000, 62]);
  insert.free();

  const zip = new JSZip();
  zip.file('health_connect.db', db.export());
  db.close();
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, buffer);
}

test('Test synthetic Health Connect ZIP parsing and HRV baselines', async ({ page }, testInfo) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  const fixturePath = testInfo.outputPath('synthetic_export.zip');
  await createSyntheticHealthConnectZip(fixturePath);

  await page.goto('/');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: 'attached' });
  await fileInput.setInputFiles(fixturePath);

  await expect(page.getByText('Heart Rate Variability (HRV) Analysis')).toBeVisible({ timeout: 15000 });
  const bodyText = await page.locator('body').innerText();

  expect(bodyText).toContain('Latest Daily Median');
  expect(bodyText).toContain('7-Day Rolling Median');
  expect(bodyText).toContain('28-Day Baseline');
  expect(bodyText).toContain('Baseline Difference');
});
