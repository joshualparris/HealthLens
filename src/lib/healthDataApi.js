// Cloud health rows are intentionally not queried directly from the browser.
// The Supabase tables contain private health data and are locked to server-side
// service-role access. Add an authenticated server session/API before re-enabling
// remote dashboard reads.

const protectedError = () => new Error(
  'Cloud health data is protected. Use local data or an authenticated server session.'
)

export const isSupabaseConfigured = false

export async function getDailySummaries() {
  return { data: [], error: protectedError() }
}

export async function getLatestSyncStatus() {
  return { data: null, error: protectedError() }
}

export async function getSyncImports() {
  return { data: [], error: protectedError() }
}

export async function getMetricAvailability() {
  return { data: null, error: protectedError() }
}

export async function getDetailedRecords() {
  return { data: [], error: protectedError() }
}

export async function buildSupabaseDataPack() {
  return '=== CLOUD HEALTH DATA ===\nProtected: authenticated server access is required.\n'
}

export async function getStravaStatus() {
  return { data: null, error: protectedError() }
}
