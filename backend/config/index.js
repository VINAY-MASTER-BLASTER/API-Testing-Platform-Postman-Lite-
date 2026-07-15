/**
 * Centralized configuration for the Postman Lite backend.
 * 
 * All magic numbers and tunables live here so they're easy to find and change.
 * Nothing here is a secret — secrets would go in env vars (not needed for this project).
 */

const path = require('path');

module.exports = {
  // Server
  PORT: process.env.PORT || 3000,

  // Outbound proxy timeout — if the target server doesn't respond within this
  // window, the request is aborted and the user gets a clean timeout error.
  // 15 seconds is generous enough for most APIs but prevents the server from
  // hanging indefinitely on a dead endpoint.
  PROXY_TIMEOUT_MS: 15_000,

  // Rate limiting — protects the proxy from abuse.
  // 100 requests per 60-second sliding window, per IP.
  RATE_LIMIT: {
    windowMs: 60_000,
    maxRequests: 100,
  },

  // Flat-file storage paths — these are NOT databases, just simple JSON files
  // that get read/written atomically. Data is lost if the files are deleted,
  // but survives server restarts.
  STORAGE: {
    dir: path.join(__dirname, '..', 'storage'),
    collections: path.join(__dirname, '..', 'storage', 'collections.json'),
    environments: path.join(__dirname, '..', 'storage', 'environments.json'),
  },

  // CORS — allow the frontend dev server to talk to the backend
  CORS_OPTIONS: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
};
