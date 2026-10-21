import { ApiError } from '../utils/http.js';

/**
 * Validate and coerce request data with a zod schema. Replaces req[source] with the parsed,
 * whitelisted value so unknown fields (e.g. `role`, `owner`) never reach controllers.
 */
export const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(ApiError.badRequest(details[0]?.message ? `${details[0].field || 'input'}: ${details[0].message}` : 'Invalid input', details));
    }
    if (source === 'query') {
      req.validatedQuery = result.data;
    } else {
      req[source] = result.data;
    }
    next();
  };
