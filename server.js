const express = require('express')
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const http = require('http')
const https = require('https')
const { URL } = require('url')
const socketIO = require('socket.io')

const app = express()
const httpServer = http.createServer(app)
const io = socketIO(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

const PORT = process.env.PORT || 3000
const DATA_DIR = path.join(__dirname, 'data')
const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

app.use(cors())
app.use(express.json())

// Serve static site files
app.use(express.static(path.join(__dirname)))

// Ensure data dir and files exist
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
if(!fs.existsSync(READINGS_FILE)) fs.writeFileSync(READINGS_FILE, '[]')
if(!fs.existsSync(DEVICES_FILE)) fs.writeFileSync(DEVICES_FILE, '[]')
if(!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
  warning_temp: 25.0,
  alert_temp: 30.0
}, null, 2))

// Device tracking
const connectedDevices = new Map() // device_id -> { name, last_reading, connected_at, socket_id }

function readReadings(){
  try{ return JSON.parse(fs.readFileSync(READINGS_FILE,'utf8')||'[]') }catch(e){ return [] }
}

function writeReadings(data){
  fs.writeFileSync(READINGS_FILE, JSON.stringify(data, null, 2))
}

function readDevices(){
  try{ return JSON.parse(fs.readFileSync(DEVICES_FILE,'utf8')||'[]') }catch(e){ return [] }
}

function writeDevices(data){
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(data, null, 2))
}

function readSettings(){
  try{ return JSON.parse(fs.readFileSync(SETTINGS_FILE,'utf8')||'{}') }catch(e){ return {} }
}

function writeSettings(data){
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2))
}

// WebSocket: device connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  
  socket.on('register_device', (data) => {
    const device_id = data.device_id || socket.id
    const device_name = data.name || `Device ${device_id.substring(0,8)}`
    connectedDevices.set(device_id, {
      name: device_name,
      last_reading: null,
      connected_at: Date.now(),
      socket_id: socket.id
    })
    socket.join(`device_${device_id}`)
    console.log(`Device registered: ${device_name} (${device_id})`)
    
    // Broadcast device list to all connected clients
    io.emit('devices_update', Array.from(connectedDevices.values()))
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
    for(const [device_id, device] of connectedDevices.entries()){
      if(device.socket_id === socket.id){
        connectedDevices.delete(device_id)
      }
    }
    io.emit('devices_update', Array.from(connectedDevices.values()))
  })
})

// GET /api/readings  -> returns stored readings
app.get('/api/readings', (req, res) => {
  const data = readReadings()
  res.json(data)
})

// GET /api/readings/:device_id -> filter readings by device
app.get('/api/readings/:device_id', (req, res) => {
  const data = readReadings()
  const filtered = data.filter(r => r.device_id === req.params.device_id)
  res.json(filtered)
})

// POST /api/readings -> append readings (accept single object or array)
app.post('/api/readings', (req, res) => {
  const body = req.body
  if(!body) return res.status(400).json({error:'missing body'})
  const current = readReadings()
  const items = Array.isArray(body) ? body : [body]
  
  // Add timestamp if missing, ensure ts and value
  const valid = items.map(i => ({
    ...i,
    ts: i.ts || Date.now(),
    device_id: i.device_id || 'default'
  })).filter(i => typeof i.value === 'number' || typeof i.value === 'string')
  
  const appended = current.concat(valid)
  writeReadings(appended)
  
  // Broadcast new readings to all connected clients
  io.emit('new_readings', valid)
  
  // Broadcast to specific device room if device_id is present
  if(valid.length > 0 && valid[0].device_id){
    io.to(`device_${valid[0].device_id}`).emit('device_readings', valid)
  }
  
  res.json({ok:true, added: valid.length})
})

// GET /api/devices -> list all devices
app.get('/api/devices', (req, res) => {
  const devices = Array.from(connectedDevices.values())
  res.json(devices)
})

// GET /api/settings -> get current alert thresholds
app.get('/api/settings', (req, res) => {
  const settings = readSettings()
  res.json(settings)
})

// POST /api/settings -> update alert thresholds
app.post('/api/settings', (req, res) => {
  const body = req.body || {}
  const current = readSettings()
  const updated = { ...current, ...body }
  writeSettings(updated)
  
  // Broadcast new settings to all connected clients
  io.emit('settings_update', updated)
  
  res.json({ok: true, settings: updated})
})

// Simple health check
app.get('/api/health', (req,res)=> res.json({ok:true, time: Date.now()}))

// Helper: allow only RFC1918 private IP ranges and localhost to limit SSRF risk
function isPrivateHost(hostname){
  if(!hostname) return false
  if(hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
  const ipv4 = hostname.match(/^((?:\d{1,3}\.){3}\d{1,3})$/)
  if(ipv4){
    const parts = ipv4[1].split('.').map(n=>parseInt(n,10))
    if(parts[0]===10) return true
    if(parts[0]===172 && parts[1]>=16 && parts[1]<=31) return true
    if(parts[0]===192 && parts[1]===168) return true
    if(parts[0]===127) return true
    return false
  }
  if(hostname.endsWith('.local')) return true
  return false
}

// POST /api/proxy
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

  const opts = { method: 'GET', timeout: 5000 }
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
  request.on('timeout', ()=> request.abort())
})

httpServer.listen(PORT, ()=>{
  console.log(`AF Meter backend listening on http://localhost:${PORT}`)
})
