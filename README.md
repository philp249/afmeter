<<<<<<< HEAD
# AF Meter — Prototype

This repository contains a small prototype front-end and a minimal Node/Express backend to help integrate with local smart meters.

What’s included
- `index.html` — landing page with inline login/logout controls and links to `connect.html` and `analytics.html` after sign-in.
- `connect.html`, `analytics.html` — UI pages (access to these is shown in the header only after sign-in).
- `assets/` — shared `styles.css` and `main.js` helpers.
- `server.js` — minimal Express backend that serves static files and provides a small API.
- `data/readings.json` — backend-persisted readings store.

Quick start (Windows PowerShell)
1. Install Node.js (v14+). 2. From repository root:

```powershell
npm install
npm start
```

3. Open the app in your browser:

```powershell
ii http://localhost:3000/index.html
```

Notes
- Web Bluetooth only works from secure contexts (HTTPS) or `localhost` in supported browsers. Run the local server (`npm start`) and open `http://localhost:3000` to allow Bluetooth testing.
- The backend exposes:
  - `GET /api/readings` — returns stored readings (JSON array)
  - `POST /api/readings` — append readings (send a single object or array)
  - `POST /api/proxy` — proxy a GET request to a LAN device. Body: `{ "host": "192.168.1.100", "path": "/status" }` or `{ "url": "http://192.168.1.100/status" }`. The server restricts targets to private IP ranges, `localhost`, and `.local` hostnames to reduce SSRF risk.

Example proxy usage (curl):

```powershell
curl -X POST http://localhost:3000/api/proxy -H "Content-Type: application/json" -d '{"host":"192.168.1.100","path":"/status"}'
```

Security
- This is a prototype. The backend persists to a JSON file and has no authentication. Do not expose this server publicly without adding proper auth and input validation.

Next steps
- Add a backend proxy to reach LAN meters that require special protocols.
- Replace local JSON persistence with a small DB (SQLite).
- Add authentication (JWT/OAuth) to protect API endpoints.
=======
# afmeter
>>>>>>> origin/main
