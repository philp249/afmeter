// AF Meter Dashboard - Enhanced with Socket.IO, Toast Notifications, Real-time Updates

// ===== TOAST NOTIFICATIONS =====
const ToastNotification = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 3000) {
    this.init();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close">×</button>
    `;
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });
    
    this.container.appendChild(toast);
    
    if (duration > 0) {
      setTimeout(() => toast.remove(), duration);
    }
    
    return toast;
  },

  success(msg, dur) { return this.show(msg, 'success', dur); },
  error(msg, dur) { return this.show(msg, 'error', dur); },
  warning(msg, dur) { return this.show(msg, 'warning', dur); },
  info(msg, dur) { return this.show(msg, 'info', dur); }
};

// ===== THEME TOGGLE (Dark/Light Mode) =====
const ThemeManager = {
  STORAGE_KEY: 'af-meter-theme',
  LIGHT_THEME: 'light',
  DARK_THEME: 'dark',

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY) || this.DARK_THEME;
    this.setTheme(saved);
    
    // Create and add theme toggle button
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.textContent = saved === this.DARK_THEME ? '☀️' : '🌙';
    btn.title = 'Toggle theme';
    btn.addEventListener('click', () => this.toggle());
    document.body.appendChild(btn);
  },

  setTheme(theme) {
    if (theme === this.LIGHT_THEME) {
      document.documentElement.style.setProperty('--background', 'hsl(0 0% 95%)');
      document.documentElement.style.setProperty('--foreground', 'hsl(0 0% 10%)');
      document.documentElement.style.setProperty('--card', 'hsl(0 0% 100%)');
      document.documentElement.style.setProperty('--card-foreground', 'hsl(0 0% 10%)');
      document.documentElement.style.setProperty('--muted', 'hsl(0 0% 60%)');
      document.documentElement.style.setProperty('--muted-foreground', 'hsl(0 0% 40%)');
      document.documentElement.style.setProperty('--border', 'hsl(0 0% 85%)');
      document.documentElement.style.setProperty('--input', 'hsl(0 0% 95%)');
    } else {
      // Restore dark theme
      document.documentElement.style.setProperty('--background', 'hsl(185, 65%, 10%)');
      document.documentElement.style.setProperty('--foreground', 'hsl(210 40% 98%)');
      document.documentElement.style.setProperty('--card', 'hsl(180, 74%, 12%)');
      document.documentElement.style.setProperty('--card-foreground', 'hsl(210 40% 98%)');
      document.documentElement.style.setProperty('--muted', 'hsl(222 47% 14%)');
      document.documentElement.style.setProperty('--muted-foreground', 'hsl(215 20% 55%)');
      document.documentElement.style.setProperty('--border', 'hsl(222 47% 18%)');
      document.documentElement.style.setProperty('--input', 'hsl(222 47% 14%)');
    }
    localStorage.setItem(this.STORAGE_KEY, theme);
  },

  toggle() {
    const current = localStorage.getItem(this.STORAGE_KEY) || this.DARK_THEME;
    const next = current === this.DARK_THEME ? this.LIGHT_THEME : this.DARK_THEME;
    this.setTheme(next);
    document.querySelector('.theme-toggle').textContent = next === this.DARK_THEME ? '☀️' : '🌙';
    ToastNotification.info(`Switched to ${next} mode`);
  }
};

// ===== SOCKET.IO CLIENT INITIALIZATION =====
let socket = null;
function initSocket() {
  if (socket) return socket;
  try {
    socket = io();
    
    socket.on('connect', () => {
      console.log('Connected to server via Socket.IO');
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
    
    socket.on('new_readings', (data) => {
      console.log('New readings received:', data);
      AF.DataStore.store(Array.isArray(data) ? data : [data]);
      // Trigger chart update if callback registered
      if (window.onRealtimeUpdate) {
        window.onRealtimeUpdate(data);
      }
    });
    
    socket.on('settings_update', (settings) => {
      console.log('Settings updated:', settings);
      // Trigger settings refresh if callback registered
      if (window.onSettingsUpdate) {
        window.onSettingsUpdate(settings);
      }
    });
    
    socket.on('devices_update', (devices) => {
      console.log('Devices updated:', devices);
      // Trigger device list refresh if callback registered
      if (window.onDevicesUpdate) {
        window.onDevicesUpdate(devices);
      }
    });
    
    return socket;
  } catch (e) {
    console.error('Socket.IO error:', e);
    return null;
  }
}

// Initialize socket when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initSocket();
});

// ===== EXISTING SESSION & DATASTORE (PRESERVED) =====
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
  if(!data || data.length===0) {
    ToastNotification.warning('No data to export');
    return;
  }
  
  const headers = ['Timestamp', 'Value', 'Unit', 'Device ID'];
  const rows = data.map(d => [
    new Date(d.ts).toISOString(),
    d.value,
    d.unit || '°C',
    d.device_id || 'default'
  ]);
  
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `af-meter-data-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  ToastNotification.success(`Downloaded ${data.length} readings`);
}

function downloadJSON(data, filename = 'afmeter-data.json'){
  if(!data || data.length===0) {
    ToastNotification.warning('No data to export');
    return;
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `af-meter-data-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  ToastNotification.success(`Downloaded ${data.length} readings`);
}

// Enhanced line chart renderer using Canvas
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
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1
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
  ctx.fillStyle='#64ffda'; ctx.strokeStyle='rgba(11,92,255,0.95)';
  values.forEach((v,i)=>{
    const x = pad + (i/(len-1 || 1))*(canvas.width-2*pad)
    const y = pad + (1 - (v - ymin)/(ymax - ymin || 1))*(canvas.height-2*pad)
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); ctx.stroke()
  })
  // labels
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='12px sans-serif'
  ctx.fillText('Value', 8, pad-8)
  const last = times[times.length-1]; ctx.fillText(last.toLocaleString(), canvas.width-160, canvas.height-8)
}

// Initialize theme and toast on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  ToastNotification.init();
});

// Expose helpers to window for inline handlers
window.AF = { Session, DataStore, simulateFetchData, downloadCSV, downloadJSON, drawLineChart, ToastNotification }
window.initSocket = initSocket
