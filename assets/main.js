// Shared helpers for AF Meter prototype
const Session = {
  key: 'af_session',
  get(){ try{ return JSON.parse(localStorage.getItem(this.key) || 'null') }catch(e){return null} },
  set(u){ localStorage.setItem(this.key, JSON.stringify(u)) },
  clear(){ localStorage.removeItem(this.key) }
}

const DataStore = {
  key: 'af_data',
  store(points){
    const all = JSON.parse(localStorage.getItem(this.key) || '[]')
    localStorage.setItem(this.key, JSON.stringify(all.concat(points)))
  },
  load(){ return JSON.parse(localStorage.getItem(this.key) || '[]') },
  clear(){ localStorage.removeItem(this.key) }
}

function simulateFetchData(source){
  const now = Date.now()
  const points = []
  for(let i=0;i<24;i++){
    points.push({ts: now - (23-i)*3600*1000, value: Math.round(100 + Math.random()*900)})
  }
  DataStore.store(points)
  return points
}

function downloadCSV(data, filename = 'afmeter-data.csv'){
  if(!data || data.length===0) return
  const csv = ['timestamp,value'].concat(data.map(d=>[new Date(d.ts).toISOString(),d.value].join(','))).join('\n')
  const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

// Minimal line chart renderer using Canvas
function drawLineChart(canvas, data){
  if(!canvas) return
  const ctx = canvas.getContext && canvas.getContext('2d')
  if(!ctx) return
  canvas.width = canvas.clientWidth; canvas.height = 320
  ctx.clearRect(0,0,canvas.width,canvas.height)
  if(!data || data.length===0){ ctx.fillStyle='#666'; ctx.fillText('No data',10,20); return }
  data.sort((a,b)=>a.ts-b.ts)
  const values = data.map(d=>d.value)
  const times = data.map(d=>new Date(d.ts))
  const pad = 40
  const ymin = Math.min(...values), ymax = Math.max(...values)
  const len = values.length
  // grid
  ctx.strokeStyle='#eee'; ctx.lineWidth=1
  for(let i=0;i<4;i++){ const y = pad + i*(canvas.height-2*pad)/3; ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(canvas.width-pad,y); ctx.stroke() }
  // line
  ctx.beginPath();
  values.forEach((v,i)=>{
    const x = pad + (i/(len-1 || 1))*(canvas.width-2*pad)
    const y = pad + (1 - (v - ymin)/(ymax - ymin || 1))*(canvas.height-2*pad)
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
  })
  ctx.strokeStyle='rgba(11,92,255,0.95)'; ctx.lineWidth=2; ctx.stroke()
  // dots
  ctx.fillStyle='white'; ctx.strokeStyle='rgba(11,92,255,0.95)';
  values.forEach((v,i)=>{
    const x = pad + (i/(len-1 || 1))*(canvas.width-2*pad)
    const y = pad + (1 - (v - ymin)/(ymax - ymin || 1))*(canvas.height-2*pad)
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); ctx.stroke()
  })
  // labels
  ctx.fillStyle='#333'; ctx.font='12px sans-serif'
  ctx.fillText('Value', 8, pad-8)
  const last = times[times.length-1]; ctx.fillText(last.toLocaleString(), canvas.width-160, canvas.height-8)
}

// Expose helpers to window for inline handlers
window.AF = { Session, DataStore, simulateFetchData, downloadCSV, drawLineChart }
