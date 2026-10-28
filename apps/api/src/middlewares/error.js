import httpStatus from "http-status";
import config from "../config/index.js";
import logger from "../utils/logger.js";

/**
 * Fallback 404 handler for unmatched routes.
 */
export const notFoundHandler = (req, res, next) => {
  res.status(httpStatus.NOT_FOUND).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

/**
 * Centralized error handling middleware.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;

  // Log 5xx errors
  if (statusCode >= 500) {
    logger.error({
      err,
      reqId: req.id,
      url: req.originalUrl,
      method: req.method,
      msg: err.message,
    });
  }

  const response = {
    message: err.message || "Internal server error",
    ...(err.errors ? { errors: err.errors } : {}),
    ...(config.NODE_ENV !== "production" && err.stack ? { stack: err.stack } : {}),
  };

  res.status(statusCode).json(response);
};
