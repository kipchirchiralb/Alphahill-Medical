const FINGERPRINT_HEADERS = new Set([
  "server",
  "x-powered-by",
  "x-aspnet-version",
  "x-aspnetmvc-version",
  "x-generator",
]);

/**
 * Stops the app advertising Express (or any other stack) in HTTP headers.
 * Intercepts later writes so a library cannot put `X-Powered-By` back.
 */
function hideServerIdentity(req, res, next) {
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");

  const originalSetHeader = res.setHeader;
  res.setHeader = function setHeader(name, value) {
    if (typeof name === "string" && FINGERPRINT_HEADERS.has(name.toLowerCase())) {
      return this;
    }
    return originalSetHeader.apply(this, arguments);
  };

  const originalWriteHead = res.writeHead;
  res.writeHead = function writeHead() {
    this.removeHeader("X-Powered-By");
    this.removeHeader("Server");
    return originalWriteHead.apply(this, arguments);
  };

  next();
}

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
  hideServerIdentity,
  publicSecurityHeaders,
  assertSessionSecret,
  assertDatabaseEnv,
};
