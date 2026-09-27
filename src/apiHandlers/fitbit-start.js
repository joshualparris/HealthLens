import { beginOAuthState } from '../apiLib/oauthState.js'

export default function handler(req, res) {
  const { FITBIT_CLIENT_ID, BASE_URL } = process.env
  if (!FITBIT_CLIENT_ID || !BASE_URL) {
    res.status(500).send('Missing Fitbit configuration')
    return
  }

  const redirectUri = `${BASE_URL.replace(/\/$/, '')}/api/fitbit/callback`
  const state = beginOAuthState('fitbit', req, res)
  const url = new URL('https://www.fitbit.com/oauth2/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', FITBIT_CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'activity heartrate sleep profile')
  url.searchParams.set('state', state)

  res.writeHead(302, { Location: url.toString() })
  res.end()
}
