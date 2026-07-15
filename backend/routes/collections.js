/**
 * Collections routes — CRUD for request collections.
 * 
 * Routes:
 *   GET    /api/collections          → list all collections
 *   POST   /api/collections          → create a new collection (requires name)
 *   PUT    /api/collections/:id      → update a collection
 *   DELETE /api/collections/:id      → delete a collection
 */

const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} = require('../controllers/collectionsController');

router.get('/', listCollections);

// Validation: creating a collection requires a name
router.post('/', validate({ required: ['name'], types: { name: 'string' } }), createCollection);

router.put('/:id', updateCollection);

router.delete('/:id', deleteCollection);

module.exports = router;
