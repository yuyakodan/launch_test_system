import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  ASSETS: R2Bucket
  CACHE: KVNamespace
  JOBS_QUEUE: Queue
  RUN_STATE: DurableObjectNamespace
  ENVIRONMENT: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.json({
    name: 'Launch Test System',
    version: '0.1.0',
    environment: c.env.ENVIRONMENT,
    status: 'ok'
  })
})

app.get('/health', (c) => {
  return c.json({ status: 'healthy' })
})

export default app
