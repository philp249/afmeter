const express = require('express')
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const http = require('http')
const https = require('https')
const { URL } = require('url')

const app = express()
const PORT = process.env.PORT || 3000
const DATA_DIR = path.join(__dirname, 'data')
const READINGS_FILE = path.join(DATA_DIR, 'readings.json')

app.use(cors())
app.use(express.json())

// Serve static site files
app.use(express.static(path.join(__dirname)))

// Ensure data dir and file exist
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
if(!fs.existsSync(READINGS_FILE)) fs.writeFileSync(READINGS_FILE, '[]')

function readReadings(){
  try{ return JSON.parse(fs.readFileSync(READINGS_FILE,'utf8')||'[]') }catch(e){ return [] }
}

function writeReadings(data){
  fs.writeFileSync(READINGS_FILE, JSON.stringify(data, null, 2))
}

// GET /api/readings  -> returns stored readings
app.get('/api/readings', (req, res) => {
  const data = readReadings()
  res.json(data)
})

// POST /api/readings -> append readings (accept single object or array)
app.post('/api/readings', (req, res) => {
  const body = req.body
  if(!body) return res.status(400).json({error:'missing body'})
  const current = readReadings()
  const items = Array.isArray(body) ? body : [body]
  // Basic validation: ensure ts and value
  const valid = items.filter(i => typeof i.ts === 'number' && (typeof i.value === 'number' || typeof i.value === 'string'))
  const appended = current.concat(valid)
  writeReadings(appended)
  res.json({ok:true, added: valid.length})
})

// Simple health
app.get('/api/health', (req,res)=> res.json({ok:true, time: Date.now()}))

// Helper: allow only RFC1918 private IP ranges and localhost to limit SSRF risk
function isPrivateHost(hostname){
  if(!hostname) return false
  if(hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
  // IPv4 private ranges
  const ipv4 = hostname.match(/^((?:\d{1,3}\.){3}\d{1,3})$/)
  if(ipv4){
    const parts = ipv4[1].split('.').map(n=>parseInt(n,10))
    if(parts[0]===10) return true
    if(parts[0]===172 && parts[1]>=16 && parts[1]<=31) return true
    if(parts[0]===192 && parts[1]===168) return true
    if(parts[0]===127) return true
    return false
  }
  // Basic hostname check: do not allow public hostnames by default
  // Allow simple local hostnames like "meter.local"
  if(hostname.endsWith('.local')) return true
  return false
}

// POST /api/proxy
// body: { url }  OR { protocol, host, port, path }
// Only allows requests to private LAN hosts (RFC1918) or .local or localhost
app.post('/api/proxy', (req, res) => {
  const body = req.body || {}
  let target
  try{
    if(body.url){
      target = new URL(body.url)
    }else if(body.host){
      const proto = (body.protocol === 'https') ? 'https:' : 'http:'
      const port = body.port ? `:${body.port}` : ''
      target = new URL(`${proto}//${body.host}${port}${body.path||'/'} `)
    }else{
      return res.status(400).json({error:'missing target (url or host)'})
    }
  }catch(e){
    return res.status(400).json({error:'invalid URL'})
  }

  if(!isPrivateHost(target.hostname)){
    return res.status(403).json({error:'target host not allowed'})
  }

  const opts = {
    method: 'GET',
    timeout: 5000
  }

  const client = target.protocol === 'https:' ? https : http
  const request = client.get(target, opts, (proxRes) => {
    let chunks = []
    proxRes.on('data', c=>chunks.push(c))
    proxRes.on('end', ()=>{
      const buf = Buffer.concat(chunks)
      const text = buf.toString('utf8')
      const contentType = proxRes.headers['content-type'] || ''
      let parsed = null
      if(contentType.includes('application/json')){
        try{ parsed = JSON.parse(text) }catch(e){ parsed = null }
      }
      res.json({status: proxRes.statusCode, headers: proxRes.headers, body: parsed || text })
    })
  })

  request.on('error', (err)=>{
    res.status(502).json({error:'proxy error', message: err.message})
  })
  request.on('timeout', ()=>{
    request.abort()
  })
})

app.listen(PORT, ()=>{
  console.log(`AF Meter backend listening on http://localhost:${PORT}`)
})
