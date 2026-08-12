export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Find all GROQ keys in the environment
  const keys = Object.keys(process.env)
    .filter(k => k.startsWith('GROQ_API_KEY'))
    .sort()
    .map(k => process.env[k])

  if (keys.length === 0) {
    return res.status(500).json({ error: 'No Groq API keys configured on server' })
  }

  let lastError = null

  for (const key of keys) {
    try {
      const fetchOpts = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(req.body)
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', fetchOpts)

      if (response.status === 429) {
        lastError = new Error('Key returned 429 Rate Limit')
        continue
      }
      
      if (!response.ok) {
        const text = await response.text()
        if (response.status === 402 || response.status === 403 || text.toLowerCase().includes('quota')) {
          lastError = new Error(`Quota or auth error: ${response.status}`)
          continue
        }
        return res.status(response.status).send(text)
      }

      res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/json')
      
      if (req.body.stream && response.body) {
        const reader = response.body.getReader()
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                res.end()
                break
              }
              res.write(value)
            }
          } catch (err) {
            console.error('Error pumping stream:', err)
            res.end()
          }
        }
        pump()
        return // handled async
      } else {
        const data = await response.json()
        return res.status(200).json(data)
      }
    } catch (err) {
      lastError = err
      continue
    }
  }

  return res.status(429).json({ error: 'All Groq API keys exhausted or failed', details: lastError?.message })
}
