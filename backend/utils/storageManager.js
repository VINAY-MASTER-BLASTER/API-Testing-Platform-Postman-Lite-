/**
 * Storage Manager — Atomic flat-file JSON persistence.
 * 
 * WHY flat files instead of a database?
 * - Hackathon rules explicitly forbid any database engine
 * - JSON files are human-readable, easy to debug, and survive server restarts
 * - For a developer tool with low write frequency, file I/O is perfectly adequate
 * 
 * WHY atomic writes?
 * - If the server crashes mid-write, a partially written file would corrupt the data
 * - Atomic write = write to a temp file first, then rename (rename is atomic on most OS)
 * - If the crash happens during write → temp file is garbage, original is untouched
 * - If the crash happens during rename → rename either completes or doesn't (atomic)
 * 
 * PATTERN:
 *   read()  → parse JSON from file → return data (or empty array if file missing/corrupt)
 *   write() → stringify → write to .tmp file → rename .tmp to actual file
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Ensures the storage directory and seed files exist.
 * Called once at server startup.
 */
function initStorage() {
  const storageDir = config.STORAGE.dir;

  // Create storage directory if it doesn't exist
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
    console.log(`[Storage] Created storage directory: ${storageDir}`);
  }

  // Create seed files with empty arrays if they don't exist
  const seedFiles = [config.STORAGE.collections, config.STORAGE.environments];
  for (const filePath of seedFiles) {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
      console.log(`[Storage] Created seed file: ${path.basename(filePath)}`);
    }
  }
}

/**
 * Reads and parses a JSON file.
 * Returns an empty array if the file doesn't exist or is corrupt.
 * 
 * @param {string} filePath - Absolute path to the JSON file
 * @returns {Array|Object} Parsed data
 */
function read(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    // File doesn't exist or is corrupt — return empty array as safe default
    // This prevents the server from crashing on first run or after a corrupted write
    console.warn(`[Storage] Could not read ${path.basename(filePath)}: ${err.message}. Returning empty array.`);
    return [];
  }
}

/**
 * Writes data to a JSON file using atomic write (temp file + rename).
 * 
 * @param {string} filePath - Absolute path to the JSON file
 * @param {Array|Object} data - Data to write (will be JSON.stringified)
 */
function write(filePath, data) {
  // Atomic write: write to a temp file first, then rename
  const tempPath = filePath + '.tmp';

  try {
    // Pretty-print with 2-space indentation for human readability
    const json = JSON.stringify(data, null, 2);

    // Step 1: Write to temp file
    fs.writeFileSync(tempPath, json, 'utf-8');

    // Step 2: Atomic rename — replaces the original file
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    // Clean up the temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupErr) {
      // Ignore cleanup errors — the important error is the write failure
    }

    console.error(`[Storage] Failed to write ${path.basename(filePath)}: ${err.message}`);
    throw createStorageError(`Failed to save data: ${err.message}`);
  }
}

/**
 * Helper to create a storage error with a 500 status.
 */
function createStorageError(message) {
  const err = new Error(message);
  err.status = 500;
  err.code = 'STORAGE_ERROR';
  return err;
}

module.exports = { initStorage, read, write };
