/**
 * ============================================================================
 *  POSTMAN LITE — Backend Entry Point
 * ============================================================================
 * 
 * ARCHITECTURE OVERVIEW:
 * This is the main entry point for the Postman Lite backend — a lightweight
 * API testing tool built for the Thunder Hackathon 4.0.
 * 
 * The backend serves two purposes:
 * 1. REQUEST PROXY — The core feature. Receives HTTP request configs from the
 *    frontend, executes them server-side (avoiding CORS issues), and returns
 *    normalized responses. Supports all standard methods + QUERY.
 * 2. DATA PERSISTENCE — CRUD endpoints for collections, requests, and
 *    environments, persisted as flat JSON files (no database).
 * 
 * MIDDLEWARE CHAIN (order matters!):
 *   1. Logger         — logs every request for developer visibility
 *   2. CORS           — allows cross-origin requests from the frontend
 *   3. JSON Parser    — parses incoming JSON request bodies
 *   4. Routes         — handles all API endpoints
 *   5. Static Files   — serves the frontend in production
 *   6. Error Handler  — catches all errors, returns consistent JSON
 * 
 * Rate limiting is applied per-route (only on /api/proxy) rather than globally,
 * because the CRUD endpoints are lightweight and don't need throttling.
 * 
 * STORAGE: Flat JSON files in /storage/ — see utils/storageManager.js for
 * the atomic write strategy that prevents data corruption.
 * 
 * QUERY METHOD: Handled by services/httpClient.js using Node's native
 * http.request() which accepts arbitrary method strings. See that file
 * for the full explanation.
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const { initStorage } = require('./utils/storageManager');

// --- Route imports ---
const proxyRoutes = require('./routes/proxy');
const collectionsRoutes = require('./routes/collections');
const requestsRoutes = require('./routes/requests');
const environmentsRoutes = require('./routes/environments');

// --- Initialize Express app ---
const app = express();

// --- Middleware chain (order matters!) ---

// 1. Logger — must be first to capture timing for all requests
app.use(logger);

// 2. CORS — allow the frontend dev server to talk to the backend
app.use(cors(config.CORS_OPTIONS));

// 3. JSON parser — with a generous limit for large request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- API Routes ---

// Proxy — the core feature (rate-limited internally)
app.use('/api/proxy', proxyRoutes);

// Collections CRUD
app.use('/api/collections', collectionsRoutes);

// Requests CRUD (mounted at /api so both nested and top-level routes work)
app.use('/api', requestsRoutes);

// Environments CRUD
app.use('/api/environments', environmentsRoutes);

// --- Serve frontend static files ---
// In production, the frontend is served from the ../frontend directory.
// During development, the frontend runs its own dev server.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Fallback: serve index.html for any non-API route (SPA routing)
app.get('*', (req, res) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  } else {
    res.status(404).json({ error: { message: 'API endpoint not found', code: 'NOT_FOUND' } });
  }
});

// --- Centralized error handler (must be LAST) ---
app.use(errorHandler);

// --- Initialize storage and start server ---
initStorage();

app.listen(config.PORT, () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log('  │                                         │');
  console.log('  │   ⚡ Postman Lite Backend Running       │');
  console.log(`  │   🌐 http://localhost:${config.PORT}              │`);
  console.log(`  │   📁 Storage: /storage/*.json           │`);
  console.log(`  │   ⏱  Proxy timeout: ${config.PROXY_TIMEOUT_MS / 1000}s               │`);
  console.log(`  │   🛡  Rate limit: ${config.RATE_LIMIT.maxRequests} req/${config.RATE_LIMIT.windowMs / 1000}s         │`);
  console.log('  │                                         │');
  console.log('  └─────────────────────────────────────────┘');
  console.log('');
});

module.exports = app;
