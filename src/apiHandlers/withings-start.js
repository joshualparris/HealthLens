import { beginOAuthState } from '../apiLib/oauthState.js'

export default function handler(req, res) {
  const { WITHINGS_CLIENT_ID, BASE_URL } = process.env
  if (!WITHINGS_CLIENT_ID || !BASE_URL) {
    res.status(500).send('Missing Withings configuration')
    return
  }

  const redirectUri = `${BASE_URL.replace(/\/$/, '')}/api/withings/callback`
  const state = beginOAuthState('withings', req, res)
  const url = new URL('https://account.withings.com/oauth2_user/authorize2')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', WITHINGS_CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'user.info,user.metrics')
  url.searchParams.set('state', state)

  res.writeHead(302, { Location: url.toString() })
  res.end()
}
