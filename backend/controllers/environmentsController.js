/**
 * Environments Controller — CRUD operations for environment variable sets.
 * 
 * Environments let users define named sets of key-value variables (e.g., "Local"
 * with BASE_URL=http://localhost:3000, "Staging" with BASE_URL=https://staging.api.com).
 * 
 * The active environment's variables are resolved client-side using {{VARIABLE}} syntax
 * before sending to the proxy, or passed along with the request for server-side resolution.
 * 
 * Data shape in environments.json:
 * [
 *   {
 *     id: "uuid",
 *     name: "Local",
 *     variables: [
 *       { key: "BASE_URL", value: "http://localhost:3000", enabled: true },
 *       { key: "TOKEN", value: "abc123", enabled: true }
 *     ],
 *     createdAt: "ISO",
 *     updatedAt: "ISO"
 *   }
 * ]
 */

const { v4: uuidv4 } = require('uuid');
const storage = require('../utils/storageManager');
const config = require('../config');

/**
 * GET /api/environments
 * Returns all environments.
 */
function listEnvironments(req, res) {
  const environments = storage.read(config.STORAGE.environments);
  res.json(environments);
}

/**
 * POST /api/environments
 * Creates a new environment. Body must include { name: "..." }.
 * Variables can be provided at creation or added later via PUT.
 */
function createEnvironment(req, res) {
  const { name, variables = [] } = req.body;

  const environments = storage.read(config.STORAGE.environments);

  const newEnvironment = {
    id: uuidv4(),
    name: name.trim(),
    variables: variables.map(v => ({
      key: v.key || '',
      value: v.value || '',
      enabled: v.enabled !== false, // default to enabled
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  environments.push(newEnvironment);
  storage.write(config.STORAGE.environments, environments);

  res.status(201).json(newEnvironment);
}

/**
 * PUT /api/environments/:id
 * Updates an environment (rename and/or update variables).
 */
function updateEnvironment(req, res, next) {
  const { id } = req.params;
  const updates = req.body;

  const environments = storage.read(config.STORAGE.environments);
  const index = environments.findIndex(e => e.id === id);

  if (index === -1) {
    const err = new Error(`Environment with id "${id}" not found`);
    err.status = 404;
    return next(err);
  }

  // Apply updates
  if (updates.name !== undefined) {
    environments[index].name = updates.name.trim();
  }
  if (updates.variables !== undefined) {
    environments[index].variables = updates.variables.map(v => ({
      key: v.key || '',
      value: v.value || '',
      enabled: v.enabled !== false,
    }));
  }

  environments[index].updatedAt = new Date().toISOString();

  storage.write(config.STORAGE.environments, environments);

  res.json(environments[index]);
}

/**
 * DELETE /api/environments/:id
 * Deletes an environment.
 */
function deleteEnvironment(req, res, next) {
  const { id } = req.params;

  const environments = storage.read(config.STORAGE.environments);
  const index = environments.findIndex(e => e.id === id);

  if (index === -1) {
    const err = new Error(`Environment with id "${id}" not found`);
    err.status = 404;
    return next(err);
  }

  const [deleted] = environments.splice(index, 1);
  storage.write(config.STORAGE.environments, environments);

  res.json({ message: `Environment "${deleted.name}" deleted`, id: deleted.id });
}

module.exports = { listEnvironments, createEnvironment, updateEnvironment, deleteEnvironment };
