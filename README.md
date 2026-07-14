# ⚡ Postman Lite

> A lightweight, browser-based API testing tool — a mini Postman built for Thunder Hackathon 4.0.

![Tech Stack](https://img.shields.io/badge/Stack-Node.js%20%2B%20Express%20%2B%20Vanilla%20JS-blueviolet)
![Database](https://img.shields.io/badge/Database-None%20(Flat%20Files)-green)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📋 Overview

Postman Lite lets developers construct HTTP requests, send them through a server-side proxy (avoiding CORS issues), and view formatted responses — all in the browser with zero database dependencies.

### Key Features

- **HTTP Request Builder** — GET, POST, PUT, PATCH, DELETE, and the non-standard QUERY method
- **Server-Side Proxy** — All requests executed server-side to bypass CORS; supports arbitrary HTTP methods
- **Response Viewer** — Pretty-printed JSON with collapsible tree, raw text, response headers table, HTML/image preview
- **Collections** — Organize requests into named groups, fully persisted as JSON files
- **Environment Variables** — Define `{{VARIABLE}}` placeholders resolved before sending
- **Authentication Helpers** — Bearer Token, Basic Auth, API Key (auto-populates headers)
- **Request History** — One-click replay of recent requests (localStorage)
- **Code Snippets** — Auto-generated cURL and JavaScript fetch() commands
- **Dark/Light Mode** — Toggle between themes
- **Keyboard Shortcuts** — `Ctrl+Enter` to send, `Ctrl+N` for new tab, `Escape` to close modals
- **Rate Limiting** — Protects the proxy from abuse (100 req/min per IP)
- **Atomic File Writes** — Crash-safe persistence (write to temp file → rename)

---

## 🚀 Install & Run

### Prerequisites
- **Node.js** v16+ and **npm**

### Steps

```bash
# 1. Clone or download the project
cd postman-lite

# 2. Install backend dependencies
cd backend
npm install

# 3. Start the server
npm start
# or: node app.js

# 4. Open in browser
# Navigate to http://localhost:3000
```

The Express server serves both the API and the frontend static files. No separate frontend server needed.

---

## 📁 Folder Structure

```
postman-lite/
├── backend/
│   ├── app.js                        # Express entry point (architecture overview at top)
│   ├── config/
│   │   └── index.js                  # Centralized config (port, timeout, rate limit)
│   ├── controllers/
│   │   ├── proxyController.js        # Core proxy logic (env interpolation, auth injection)
│   │   ├── collectionsController.js  # Collections CRUD
│   │   ├── requestsController.js     # Saved requests CRUD
│   │   └── environmentsController.js # Environments CRUD
│   ├── routes/
│   │   ├── proxy.js                  # POST /api/proxy (rate-limited)
│   │   ├── collections.js            # /api/collections (validated)
│   │   ├── requests.js               # /api/collections/:id/requests + /api/requests/:id
│   │   └── environments.js           # /api/environments (validated)
│   ├── middleware/
│   │   ├── logger.js                 # Custom morgan-style request logger
│   │   ├── validate.js               # Request body validation factory
│   │   ├── rateLimiter.js            # In-memory sliding-window rate limiter
│   │   └── errorHandler.js           # Centralized error handler
│   ├── services/
│   │   └── httpClient.js             # Core HTTP engine (native http/https, QUERY support)
│   ├── utils/
│   │   ├── responseFormatter.js      # Response normalization
│   │   └── storageManager.js         # Atomic JSON file read/write
│   ├── storage/
│   │   ├── collections.json          # Persisted collections (auto-created)
│   │   └── environments.json         # Persisted environments (auto-created)
│   └── package.json
├── frontend/
│   ├── index.html                    # SPA shell (semantic HTML, ARIA labels)
│   ├── app.js                        # Frontend entry point (architecture overview at top)
│   ├── components/
│   │   ├── Sidebar/sidebar.js        # Collections tree, history, environment tabs
│   │   ├── TabsBar/tabsBar.js        # Open request tabs, env selector, theme toggle
│   │   ├── RequestBuilder/requestBuilder.js  # Method + URL + Params/Headers/Auth/Body
│   │   ├── ResponseViewer/responseViewer.js  # Pretty/Raw/Headers/Preview tabs
│   │   ├── EnvironmentManager/environmentManager.js  # Variable editor modal
│   │   └── Toast/toast.js            # Notification system
│   ├── services/
│   │   ├── apiClient.js              # Backend API wrapper
│   │   └── stateManager.js           # Pub/sub state management
│   ├── utils/
│   │   └── helpers.js                # Interpolation, JSON validation, cURL gen, etc.
│   └── styles/
│       ├── theme.css                 # Design tokens, dark/light themes
│       ├── layout.css                # Three-column responsive layout
│       └── components.css            # Button, input, badge, modal styles
├── package.json                      # Root scripts
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend | **Node.js + Express.js** | Lightweight, widely understood, perfect for a proxy server |
| Frontend | **Vanilla JavaScript** (ES Modules) | No framework overhead, fully explainable line-by-line |
| Styling | **Vanilla CSS** (Custom Properties) | Full control, no build tools needed |
| Persistence | **Flat JSON files** + **localStorage** | No database — hackathon requirement |
| HTTP Client | **Node native http/https** | Supports arbitrary method strings (critical for QUERY) |

---

## 🔄 Workflow

1. **User builds a request** in the browser (selects method, enters URL, adds headers/params/body/auth)
2. **Frontend sends config** to `POST /api/proxy` on the backend
3. **Backend proxy** (httpClient.js):
   - Validates the URL and method
   - Resolves `{{VARIABLE}}` placeholders from the active environment
   - Applies auth (Bearer/Basic/API Key) to headers
   - Executes the real HTTP request using Node's native `http.request()`
   - Measures response time with `process.hrtime.bigint()`
   - Captures status, headers, body, and byte size
4. **Backend returns** a normalized response: `{ status, statusText, headers, body, timeMs, sizeBytes }`
5. **Frontend displays** the response with syntax highlighting, status badge, timing, and size

---

## 🔑 QUERY Method — End-to-End Explanation

**What is QUERY?** A proposed HTTP method (per RFC 9110 discussion) that's like GET but allows a request body. It's safe and idempotent — useful for complex search queries that don't fit in a URL.

**Why is it special?** Most HTTP libraries (axios, node-fetch, browser fetch) either reject non-standard methods or silently drop the body for GET-like methods.

**How we handle it:**
1. **Frontend**: The method dropdown includes `QUERY` as an option. When selected, the body editor is available (same as POST).
2. **Proxy config**: Frontend sends `{ method: "QUERY", body: "...", ... }` to `POST /api/proxy`.
3. **Backend httpClient.js**: Uses Node's **native `http.request()`** with `method: 'QUERY'`. Node's HTTP module accepts *any string* as the method — it writes the method directly into the HTTP start line.
4. **Wire format**: The outbound request looks like:
   ```
   QUERY /search HTTP/1.1
   Host: api.example.com
   Content-Type: application/json

   {"query": "search term"}
   ```
5. **Response**: Handled identically to any other method — captured, normalized, returned.

---

## ⏱ Timeout/Abort Logic

- Every outbound proxy request gets a **15-second timeout** (configurable in `config/index.js`)
- Implemented via `req.setTimeout()` on the native Node request object
- If the timeout fires, `req.destroy()` kills the socket immediately
- The error is caught and returned as: `{ error: { message: "Request timed out after 15000ms", code: "TIMEOUT" } }`
- **The Express connection is never left hanging** — we always respond to the frontend

---

## 🛡 Rate Limiting

- Applied **only to `/api/proxy`** (the resource-intensive endpoint)
- **100 requests per 60-second window** per IP address
- Sliding window: we track an array of timestamps per IP and filter out expired ones
- When limit exceeded, returns `429 Too Many Requests` with a `Retry-After` header
- Stale entries cleaned up every 5 minutes to prevent memory leaks
- Resets on server restart (in-memory only — appropriate for a dev tool)

---

## 🎨 UI/UX Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Visibility of system status** | Loading spinner during requests, toast notifications on save/delete |
| **Match between system and real world** | Postman-like layout (method + URL + Send in one row) |
| **User control & freedom** | Confirmation dialogs for destructive actions, easy tab close |
| **Consistency** | Color-coded methods (GET=green, POST=blue, etc.) used everywhere |
| **Error prevention** | Inline JSON validation before sending, clear error messages |
| **Recognition over recall** | Request history with one-click replay, header autocomplete |
| **Aesthetic & minimal design** | Dark theme, glassmorphism, generous spacing |
| **Responsive layout** | Collapsible sidebar, adapts to tablet/mobile |
| **Accessibility** | Semantic HTML, ARIA labels, keyboard navigation, focus management |

---

## 📡 Backend API Reference

### Proxy (Core Feature)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/proxy` | Execute an HTTP request server-side |

### Collections
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/collections` | List all collections |
| POST | `/api/collections` | Create a collection |
| PUT | `/api/collections/:id` | Update a collection |
| DELETE | `/api/collections/:id` | Delete a collection |

### Requests
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/collections/:id/requests` | List requests in a collection |
| POST | `/api/collections/:id/requests` | Save a new request |
| PUT | `/api/requests/:id` | Update a saved request |
| DELETE | `/api/requests/:id` | Delete a saved request |

### Environments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/environments` | List all environments |
| POST | `/api/environments` | Create an environment |
| PUT | `/api/environments/:id` | Update an environment |
| DELETE | `/api/environments/:id` | Delete an environment |

---

## 📄 License

MIT — Built for Thunder Hackathon 4.0
