/**
 * Requests routes — CRUD for saved requests within collections.
 * 
 * Routes:
 *   GET    /api/collections/:collectionId/requests    → list requests in a collection
 *   POST   /api/collections/:collectionId/requests    → save a new request
 *   PUT    /api/requests/:id                          → update a saved request
 *   DELETE /api/requests/:id                          → delete a saved request
 * 
 * Note: The GET/POST routes are nested under collections because requests belong
 * to a collection. The PUT/DELETE routes are at the top level because we search
 * across all collections by request ID.
 */

const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const {
  listRequests,
  createRequest,
  updateRequest,
  deleteRequest,
} = require('../controllers/requestsController');

// Nested routes (require collectionId)
// These are mounted under /api/collections/:collectionId/requests in app.js
router.get('/collections/:collectionId/requests', listRequests);

router.post(
  '/collections/:collectionId/requests',
  validate({ required: ['method', 'url'], types: { method: 'string', url: 'string' } }),
  createRequest
);

// Top-level routes (search by request ID across all collections)
router.put('/requests/:id', updateRequest);

router.delete('/requests/:id', deleteRequest);

module.exports = router;
