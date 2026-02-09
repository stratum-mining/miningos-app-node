'use strict'

const Fastify = require('fastify')
const { TranslatorSv2Service } = require('./service')

const service = new TranslatorSv2Service()

const app = Fastify({ logger: true })

// Allow POST with Content-Type: application/json but no body (Fastify's
// default JSON parser rejects empty payloads).
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  if (!body || body.length === 0) return done(null, undefined)
  try { done(null, JSON.parse(body)) } catch (err) { err.statusCode = 400; done(err, undefined) }
})

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get('/api/tproxy/config', async () => {
  return service.loadConfig()
})

app.put('/api/tproxy/config', {
  schema: {
    body: {
      type: 'object',
      required: ['config'],
      properties: { config: { type: 'object' } }
    }
  }
}, async (req) => {
  const config = service.saveConfig(req.body.config)
  return { success: true, config }
})

app.get('/api/tproxy/status', async () => {
  return service.getStatus()
})

app.post('/api/tproxy/start', async (req) => {
  const overrides = req.body && req.body.config ? req.body.config : null
  return service.start(overrides)
})

app.post('/api/tproxy/stop', async (req) => {
  return service.stop()
})

app.get('/api/tproxy/logs', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        tail: { type: 'integer', minimum: 1, default: 100 },
        since: { type: 'integer' }
      }
    }
  }
}, async (req) => {
  return service.getLogs({
    tail: req.query.tail,
    since: req.query.since
  })
})

// ─── Boot ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000

app.listen({ port: PORT, host: '0.0.0.0' }).then((addr) => {
  console.log(`sv2-translator-proxy listening on ${addr}`)
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
