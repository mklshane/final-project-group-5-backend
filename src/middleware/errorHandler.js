import { AppError } from "../utils/errors.js";

export function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  const status = 500;
  const message = process.env.NODE_ENV === "production" ? "Internal server error" : err.message;

  return res.status(status).json({ error: message });
}
