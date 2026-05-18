function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }
  res.status(status).json({ error: status === 500 ? "Internal server error" : err.message });
}

module.exports = { notFound, errorHandler };
