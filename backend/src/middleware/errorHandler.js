const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  // Log error stack in development or for 500s
  if (statusCode === 500) {
    console.error('Unhandled Application Error:', err);
  }

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${field}. A record with this ${field} already exists.`;
  }

  // Handle MongoDB WriteConflict or TransientTransactionError on concurrent updates
  if (
    err.code === 112 ||
    (err.hasErrorLabel && err.hasErrorLabel('TransientTransactionError')) ||
    (err.message && err.message.includes('WriteConflict'))
  ) {
    statusCode = 409;
    message = 'Concurrent modification conflict on resource. Please retry.';
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found with id of ${err.value}`;
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
  }

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Receipt file is too large. Maximum size allowed is 5MB.';
    } else {
      message = `Upload Error: ${err.message}`;
    }
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    details: details,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
