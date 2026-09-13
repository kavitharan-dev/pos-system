export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(entity, id) {
  return new AppError(404, "NOT_FOUND", `${entity} not found`, { id });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.code,
      message: err.message,
      details: err.details ?? null,
    });
  }

  if (err?.code === "23505") {
    return res.status(409).json({
      error: "DUPLICATE_SUBMISSION",
      message: "This cart has already been submitted as an order",
    });
  }

  console.error(err);
  return res.status(500).json({
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
