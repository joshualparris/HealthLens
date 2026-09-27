import {
  exchangeStravaCode,
  fetchStravaActivities,
  getValidStravaAccessToken,
  storeStravaToken,
  upsertStravaActivityToSupabase,
} from '../apiLib/stravaClient.js'
import { consumeOAuthState } from '../apiLib/oauthState.js'

function appRedirect(status, details = {}) {
  const base = (process.env.BASE_URL || process.env.HEALTHLENS_APP_URL || 'https://health-lens-rust.vercel.app').replace(/\/$/, '')
  const url = new URL(base)
  url.searchParams.set('strava', status)
  Object.entries(details).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  })
  return url.toString()
}

async function backfillLast90Days(accountId) {
  const accessToken = await getValidStravaAccessToken(process.env.DEFAULT_USER_ID || 'local-user', { accountId })
  const after = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)
  let page = 1
  let synced = 0

  while (page <= 10) {
    const activities = await fetchStravaActivities({ after, page, perPage: 50, accessToken })
    if (!Array.isArray(activities) || activities.length === 0) break
    for (const activity of activities) {
      await upsertStravaActivityToSupabase(activity)
      synced += 1
    }
    if (activities.length < 50) break
    page += 1
  }

  return synced
}

export default async function handler(req, res) {
  const { code, error, scope, state } = req.query || {}
  const oauth = consumeOAuthState('strava', req, res, state)

  if (!oauth.valid) {
    res.status(400).send('Invalid OAuth state')
    return
  }
  if (error) {
    res.writeHead(302, { Location: appRedirect('denied') })
    res.end()
    return
  }
  if (!code) {
    res.status(400).send('Missing Strava code')
    return
  }

  try {
    const tokenData = await exchangeStravaCode(code, { env: process.env })
    const tokenRow = await storeStravaToken(tokenData, { env: process.env, scope })
    let backfilled = null

    if (oauth.intent === 'backfill90') {
      backfilled = await backfillLast90Days(tokenRow.account_id)
    }

    res.writeHead(302, {
      Location: appRedirect('connected', { backfilled }),
    })
    res.end()
  } catch (err) {
    console.error('Strava OAuth callback failed:', err?.message || 'unknown error')
    res.writeHead(302, { Location: appRedirect('error') })
    res.end()
  }
}
