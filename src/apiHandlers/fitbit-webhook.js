import { fetchDailySummary } from '../apiLib/fitbitClient.js'
import supabaseAdmin from '../apiLib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).send('ok')
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Fitbit subscription POST authentication is not implemented in this app.
  // Keep the endpoint disabled by default rather than trusting arbitrary internet traffic.
  if (process.env.FITBIT_WEBHOOK_ENABLED !== 'true') {
    res.status(503).json({ error: 'Fitbit webhook processing is disabled' })
    return
  }
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Secure storage is unavailable' })
    return
  }

  const payload = req.body
  const notifications = Array.isArray(payload) ? payload : [payload]
  if (!notifications.length || notifications.length > 100) {
    res.status(400).json({ error: 'Invalid webhook payload' })
    return
  }

  try {
    for (const note of notifications) {
      const ownerId = note?.ownerId || note?.userId
      const collectionType = note?.collectionType || null
      if (!ownerId) continue

      // Only accept notifications for an account that has already completed
      // the protected OAuth flow for this HealthLens instance.
      const { data: tokenRows, error: tokenError } = await supabaseAdmin
        .from('oauth_tokens')
        .select('account_id')
        .eq('provider', 'fitbit')
        .eq('account_id', String(ownerId))
        .limit(1)
      if (tokenError || !tokenRows?.length) continue

      const date = new Date().toISOString().slice(0, 10)
      const summary = await fetchDailySummary(String(ownerId), date)
      const row = {
        user_id: process.env.DEFAULT_USER_ID || 'local-user',
        date,
        timezone: 'Australia/Sydney',
        steps: summary.summary?.steps ?? null,
        calories_total: summary.summary?.caloriesOut ?? null,
        sources_json: { provider: 'fitbit', collectionType },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const { error: insertError } = await supabaseAdmin.from('daily_health_summary').insert(row)
      if (insertError) throw insertError
    }

    res.status(204).end()
  } catch (error) {
    console.error('Fitbit webhook processing failed:', error?.message || 'unknown error')
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}
