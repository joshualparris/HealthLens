import fetch from 'node-fetch'
import supabaseAdmin from '../apiLib/supabaseServer.js'
import { consumeOAuthState } from '../apiLib/oauthState.js'

function appRedirect(baseUrl, status) {
  const url = new URL(baseUrl)
  url.searchParams.set('withings', status)
  return url.toString()
}

export default async function handler(req, res) {
  const { WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET, BASE_URL } = process.env
  const { code, state } = req.query || req.body || {}
  const oauth = consumeOAuthState('withings', req, res, state)

  if (!oauth.valid) {
    res.status(400).send('Invalid OAuth state')
    return
  }
  if (!code) {
    res.status(400).send('Missing code')
    return
  }
  if (!WITHINGS_CLIENT_ID || !WITHINGS_CLIENT_SECRET || !BASE_URL) {
    res.status(500).send('Missing Withings configuration')
    return
  }
  if (!supabaseAdmin) {
    res.status(500).send('Secure token storage is unavailable')
    return
  }

  const params = new URLSearchParams({
    action: 'requesttoken',
    client_id: WITHINGS_CLIENT_ID,
    client_secret: WITHINGS_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: `${BASE_URL.replace(/\/$/, '')}/api/withings/callback`,
  })

  try {
    const response = await fetch('https://wbsapi.withings.net/v2/oauth2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await response.json()
    const body = data?.body || data

    if (!response.ok || Number(data?.status || 0) !== 0 || !body?.access_token) {
      console.warn('Withings token exchange failed', { status: response.status, providerStatus: data?.status })
      res.writeHead(302, { Location: appRedirect(BASE_URL, 'error') })
      res.end()
      return
    }

    const row = {
      user_id: process.env.DEFAULT_USER_ID || 'local-user',
      provider: 'withings',
      account_id: body.userid ? String(body.userid) : 'withings-default',
      access_token: body.access_token,
      refresh_token: body.refresh_token || null,
      expires_at: body.expires_in ? new Date(Date.now() + Number(body.expires_in) * 1000).toISOString() : null,
      scope: body.scope || null,
      raw_response: {
        token_type: body.token_type || null,
        expires_in: body.expires_in || null,
        scope: body.scope || null,
        userid: body.userid || null,
      },
    }

    const { error } = await supabaseAdmin
      .from('oauth_tokens')
      .upsert(row, { onConflict: 'provider,account_id,user_id' })
    if (error) throw error

    res.writeHead(302, { Location: appRedirect(BASE_URL, 'connected') })
    res.end()
  } catch (error) {
    console.error('Withings OAuth callback failed:', error?.message || 'unknown error')
    res.writeHead(302, { Location: appRedirect(BASE_URL, 'error') })
    res.end()
  }
}
