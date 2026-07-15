/**
 * Proxy route — the core feature of the backend.
 * All API request execution flows through POST /api/proxy.
 */

const express = require('express');
const router = express.Router();
const { proxyRequest } = require('../controllers/proxyController');
const rateLimiter = require('../middleware/rateLimiter');

// Rate limit the proxy endpoint specifically — this is the most resource-intensive
// endpoint because it makes outbound HTTP requests on behalf of the client.
router.post('/', rateLimiter, proxyRequest);

module.exports = router;
