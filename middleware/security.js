/**
 * Baseline HTTP security headers for the public site.
 * Dashboard routes apply a stricter CSP in middleware/privacy.js instead.
 */
function publicSecurityHeaders(req, res, next) {
  if (req.path.startsWith("/dashboard")) return next();

  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "SAMEORIGIN");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()"
  );
  res.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "frame-src https://www.google.com https://maps.google.com",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; ")
  );

  next();
}

function assertSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";
  const placeholders = new Set([
    "",
    "change-me-in-env",
    "replace-with-a-long-random-string",
  ]);

  if (!secret || placeholders.has(secret)) {
    if (isProduction) {
      throw new Error(
        "SESSION_SECRET must be set to a long random value in production."
      );
    }
    console.warn(
      "Warning: SESSION_SECRET is missing or still a placeholder. Set it before deploying."
    );
  }
}

function assertDatabaseEnv() {
  const required = ["DB_HOST", "DB_USER", "DB_NAME"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing database settings in .env: ${missing.join(", ")}`
    );
  }
}

module.exports = {
  publicSecurityHeaders,
  assertSessionSecret,
  assertDatabaseEnv,
};
