export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const code = err.code || "SERVER_ERROR";

  if (status >= 500) {
    console.error("[SAC API]", err.message);
  }

  res.status(status).json({
    error: code,
    message:
      status >= 500
        ? "Erreur serveur. Réessayez plus tard."
        : err.message || "Requête invalide",
  });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
