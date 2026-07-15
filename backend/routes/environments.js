/**
 * Environments routes — CRUD for environment variable sets.
 * 
 * Routes:
 *   GET    /api/environments          → list all environments
 *   POST   /api/environments          → create a new environment (requires name)
 *   PUT    /api/environments/:id      → update variables in an environment
 *   DELETE /api/environments/:id      → delete an environment
 */

const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const {
  listEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
} = require('../controllers/environmentsController');

router.get('/', listEnvironments);

// Validation: creating an environment requires a name
router.post('/', validate({ required: ['name'], types: { name: 'string' } }), createEnvironment);

router.put('/:id', updateEnvironment);

router.delete('/:id', deleteEnvironment);

module.exports = router;
