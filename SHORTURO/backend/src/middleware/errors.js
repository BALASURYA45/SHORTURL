function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

function errorHandler(err, req, res, next) {
  let status = err.statusCode || err.status || 500;
  let message = err.message || "Internal server error";
  let details = undefined;

  if (err?.name === "ZodError") {
    status = 400;
    message = err.errors?.[0]?.message || "Invalid input";
    details = err.errors;
  }

  // Mongoose common errors
  if (err?.name === "CastError") {
    status = 400;
    message = "Invalid id";
  }
  if (err?.name === "ValidationError") {
    status = 400;
    message = "Invalid input";
    details = err.errors;
  }

  // Mongo duplicate key
  if (err?.code === 11000 || err?.code === 11001) {
    status = 409;
    message = "Duplicate key";
    details = err.keyValue || undefined;
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }

  const payload = { error: status === 500 ? "Internal server error" : message };
  if (details && process.env.NODE_ENV !== "production") payload.details = details;
  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
