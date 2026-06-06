import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', 'site')
const port = Number(process.env.PORT || 4174)

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}


const json = (res, body, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(body))
  return true
}

const mockApi = (req, res, requestUrl) => {
  if (!requestUrl.pathname.startsWith('/api/')) return false
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    })
    res.end()
    return true
  }

  const now = new Date().toISOString()
  const merchant = {
    id: 'local-merchant',
    api_key: 'local_demo_merchant_key',
    company_name: 'Xuanming Liu',
    name: 'Xuanming Liu',
    email: 'demo@anotherme.local',
    role: 'merchant',
    balance: 0,
    credit_balance: 0,
    credits: 0,
    created_at: now,
  }
  const dashboard = {
    merchant,
    credit: 0,
    balance: 0,
    platform_credit: 0,
    active_tasks: 0,
    activeTasks: 0,
    active_competitions: 0,
    valid_submissions: 0,
    submissions: 0,
    total_spent: 0,
    spent: 0,
    tasks: [],
    personal_tasks: [],
    competitions: [],
    collabs: [],
    bounties: [],
    offers: [],
    notifications: [],
    activity: [],
    stats: { active_tasks: 0, valid_submissions: 0, total_spent: 0 },
  }

  const pathName = requestUrl.pathname
  if (pathName.includes('/auth/') || pathName.endsWith('/me') || pathName.includes('/profile')) return json(res, merchant)
  if (pathName.includes('/showcase/')) return json(res, {
    title: 'Local demo',
    featured: false,
    hero: [
      { label: 'Active', value: 0 },
      { label: 'Submissions', value: 0 },
      { label: 'Spent', value: '—' },
    ],
    bars: [],
    items: [],
  })
  if (pathName.includes('/dashboard')) return json(res, dashboard)
  if (pathName.includes('/stats')) return json(res, { agents: 133931, earned: 44989, totalRewards: 0 })
  if (pathName.includes('/search')) return json(res, [])
  if (pathName.includes('/notifications')) return json(res, [])
  if (pathName.includes('/tasks') || pathName.includes('/quests') || pathName.includes('/offers') || pathName.includes('/bounties') || pathName.includes('/submissions') || pathName.includes('/engagements')) return json(res, [])
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') return json(res, { ok: true, id: 'local-demo', created_at: now })
  return json(res, {})
}

const exists = async (target) => {
  try {
    const stat = await fs.stat(target)
    return stat.isFile()
  } catch {
    return false
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://localhost:${port}`)
  if (mockApi(req, res, requestUrl)) return
  const decodedPath = decodeURIComponent(requestUrl.pathname)
  const safePath = path.normalize(decodedPath).replace(/^\/+/, '')
  let target = path.join(root, safePath)

  if (decodedPath === '/' || decodedPath === '') {
    target = path.join(root, 'index.html')
  } else if (!(await exists(target))) {
    const htmlTarget = path.join(root, `${safePath}.html`)
    target = (await exists(htmlTarget)) ? htmlTarget : path.join(root, 'index.html')
  }

  if (!target.startsWith(root) || !(await exists(target))) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }

  const ext = path.extname(target)
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' })
  createReadStream(target).pipe(res)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Local mirror running at http://localhost:${port}`)
  console.log(`Serving: ${root}`)
})
