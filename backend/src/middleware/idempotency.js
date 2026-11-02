const IdempotencyKey = require('../models/IdempotencyKey');

const idempotency = async (req, res, next) => {
  const key = req.headers['idempotency-key'];

  // If no idempotency key header is provided, proceed normally
  if (!key) {
    return next();
  }

  // Ensure user is authenticated
  if (!req.user) {
    return next();
  }

  try {
    const existing = await IdempotencyKey.findOne({ key, userId: req.user._id });
    if (existing) {
      return res.status(existing.responseStatus).json(existing.responseBody);
    }

    // Intercept response to store result
    const originalJson = res.json.bind(res);
    res.json = async function (body) {
      // Restore original function first
      res.json = originalJson;

      // Only cache successful or client error responses (don't cache 500 server crashes)
      if (res.statusCode < 500) {
        try {
          await IdempotencyKey.create({
            key,
            path: req.originalUrl,
            userId: req.user._id,
            responseStatus: res.statusCode,
            responseBody: body,
          });
        } catch (err) {
          // If already exists due to concurrent request, ignore duplicate key error
          if (err.code !== 11000) {
            console.error('Failed to cache idempotency key:', err.message);
          }
        }
      }

      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = idempotency;
