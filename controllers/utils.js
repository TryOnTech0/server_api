const fs = require('fs').promises;
const path = require('path');

// Custom ErrorResponse class
exports.ErrorResponse = class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
};

// Async handler to wrap async/await and handle errors
exports.asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

// Helper function to ensure uploads directory exists
const ensureUploadsDir = async () => {
  const uploadsDir = path.join(__dirname, '../uploads');
  try {
    await fs.access(uploadsDir);
  } catch (error) {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

module.exports = {
  ensureUploadsDir,
  ErrorResponse: exports.ErrorResponse,
  asyncHandler: exports.asyncHandler
};
