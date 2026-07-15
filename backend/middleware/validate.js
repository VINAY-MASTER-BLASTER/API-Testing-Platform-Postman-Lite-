/**
 * Validation middleware factory.
 * 
 * WHY a factory pattern?
 * - Different routes need different validation rules (collections need `name`,
 *   requests need `method` + `url`, etc.)
 * - A factory lets us define rules declaratively and reuse the validation logic
 * - Returns 400 with a clear, user-friendly error message on failure
 * 
 * Usage:
 *   router.post('/collections', validate({ required: ['name'] }), controller.create);
 */

/**
 * Creates a validation middleware that checks the request body against the given rules.
 * 
 * @param {Object} rules - Validation rules
 * @param {string[]} rules.required - Array of field names that must be present and non-empty
 * @param {Object} [rules.types] - Optional map of field names to expected types (e.g., { name: 'string' })
 * @returns {Function} Express middleware
 */
function validate(rules) {
  return (req, res, next) => {
    const errors = [];

    // Check required fields exist and are non-empty
    if (rules.required) {
      for (const field of rules.required) {
        const value = req.body[field];
        if (value === undefined || value === null || value === '') {
          errors.push(`Missing required field: "${field}"`);
        }
      }
    }

    // Check types if specified (e.g., name must be a string, variables must be an array)
    if (rules.types) {
      for (const [field, expectedType] of Object.entries(rules.types)) {
        const value = req.body[field];
        if (value !== undefined && value !== null) {
          if (expectedType === 'array' && !Array.isArray(value)) {
            errors.push(`Field "${field}" must be an array`);
          } else if (expectedType !== 'array' && typeof value !== expectedType) {
            errors.push(`Field "${field}" must be of type ${expectedType}`);
          }
        }
      }
    }

    // If any validation errors, reject the request with a 400 and a clear message
    if (errors.length > 0) {
      return res.status(400).json({
        error: {
          message: errors.join('; '),
          code: 'VALIDATION_ERROR',
        },
      });
    }

    next();
  };
}

module.exports = validate;
