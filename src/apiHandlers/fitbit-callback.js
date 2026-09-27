import fetch from 'node-fetch'
import supabaseAdmin from '../apiLib/supabaseServer.js'
import { consumeOAuthState } from '../apiLib/oauthState.js'

function appRedirect(baseUrl, status) {
  const url = new URL(baseUrl)
  url.searchParams.set('fitbit', status)
  return url.toString()
}

export default async function handler(req, res) {
  const { FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET, BASE_URL } = process.env
  const { code, state } = req.query || req.body || {}
  const oauth = consumeOAuthState('fitbit', req, res, state)

  if (!oauth.valid) {
    res.status(400).send('Invalid OAuth state')
    return
  }
  if (!code) {
    res.status(400).send('Missing code')
    return
  }
  if (!FITBIT_CLIENT_ID || !FITBIT_CLIENT_SECRET || !BASE_URL) {
    res.status(500).send('Missing Fitbit configuration')
    return
  }
  if (!supabaseAdmin) {
    res.status(500).send('Secure token storage is unavailable')
    return
  }

  const tokenUrl = 'https://api.fitbit.com/oauth2/token'
  const redirectUri = `${BASE_URL.replace(/\/$/, '')}/api/fitbit/callback`
  const params = new URLSearchParams({
    client_id: FITBIT_CLIENT_ID,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })
  const auth = Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64')

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    const data = await response.json()

    if (!response.ok || !data?.access_token) {
      console.warn('Fitbit token exchange failed', { status: response.status })
      res.writeHead(302, { Location: appRedirect(BASE_URL, 'error') })
      res.end()
      return
    }

    const userId = process.env.DEFAULT_USER_ID || 'local-user'
    const accountId = data.user_id ? String(data.user_id) : 'fitbit-default'
    const row = {
      user_id: userId,
      provider: 'fitbit',
      account_id: accountId,
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      scope: data.scope || null,
      raw_response: {
        token_type: data.token_type || null,
        expires_in: data.expires_in || null,
        scope: data.scope || null,
        user_id: data.user_id || null,
      },
    }

    const { error } = await supabaseAdmin
      .from('oauth_tokens')
      .upsert(row, { onConflict: 'provider,account_id,user_id' })
    if (error) throw error

    res.writeHead(302, { Location: appRedirect(BASE_URL, 'connected') })
    res.end()
  } catch (error) {
    console.error('Fitbit OAuth callback failed:', error?.message || 'unknown error')
    res.writeHead(302, { Location: appRedirect(BASE_URL, 'error') })
    res.end()
  }
}
