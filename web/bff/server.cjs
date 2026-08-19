/**
 * bff/server.cjs — generic Vercel-Function → Node http adapter.
 *
 * Purpose:     Run web/ntask's api/*.ts handlers (Vercel Functions) outside of
 *              Vercel, for non-Vercel (nginx-only) hosting of task.nself.org.
 *              This is the SAME cookie-session BFF Vercel serves — just running
 *              as a long-lived Node process behind nginx instead of as serverless
 *              functions. nginx proxies /api/* here (see deploy docs).
 * Inputs:      HTTP requests matching the routes under api/ (e.g. /api/auth/login,
 *              /api/graphql). Handlers are bundled to ./dist/<route>.js by the
 *              Dockerfile (esbuild over the real api/*.ts — never a hand snapshot).
 * Outputs:     JSON responses + Set-Cookie, identical to the Vercel handlers.
 * Constraints: Node core only (http, fs, path, url). Reproduces the subset of the
 *              VercelRequest/VercelResponse shape the handlers use: req.method,
 *              req.headers, req.body (parsed JSON), req.query, res.status(),
 *              res.json(), res.setHeader(). Routes are resolved DYNAMICALLY from
 *              the bundled tree, so a new api/*.ts is served with no edit here.
 */
const http = require('http')
const path = require('path')
const fs = require('fs')
const { URL } = require('url')

const PORT = process.env.PORT || 3080
const DIST = path.join(__dirname, 'dist')

/**
 * Map a request pathname (/api/auth/login) to a bundled handler default export.
 * Returns null for anything outside api/, path-traversal attempts, or missing files.
 */
function resolveHandler(pathname) {
  if (!pathname.startsWith('/api/')) return null
  const rel = pathname.slice('/api/'.length).replace(/\/+$/, '')
  if (!rel || !/^[A-Za-z0-9/_-]+$/.test(rel) || rel.includes('..')) return null
  const file = path.join(DIST, rel + '.js')
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return null
  if (!fs.existsSync(file)) return null
  const mod = require(file)
  return typeof mod === 'function' ? mod : mod.default
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      if (!data) return resolve(undefined)
      try { resolve(JSON.parse(data)) } catch { resolve(undefined) }
    })
  })
}

function wrapResponse(res) {
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
    return res
  }
  return res
}

const server = http.createServer(async (req, res) => {
  wrapResponse(res)
  let url
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  } catch {
    return res.status(400).json({ error: 'Bad request' })
  }

  const handler = resolveHandler(url.pathname)
  if (!handler) {
    console.log(`${req.method} ${url.pathname} -> 404`)
    return res.status(404).json({ error: 'Not found' })
  }

  try {
    req.body = await readBody(req)
    req.query = Object.fromEntries(url.searchParams)
    await handler(req, res)
    if (!res.writableEnded) res.end()
  } catch (err) {
    console.error('handler error:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' })
    else if (!res.writableEnded) res.end()
  }
})

server.listen(PORT, () => {
  console.log(`ntask BFF listening on :${PORT}`)
})
