const crypto = require("crypto");

/**
 * Redirects anonymous visitors to the login screen, remembering where they
 * were headed so they land there after signing in.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  // Only remember dashboard paths, never an attacker-supplied destination.
  if (req.method === "GET" && req.originalUrl.startsWith("/dashboard")) {
    req.session.returnTo = req.originalUrl;
  }

  return res.redirect("/dashboard/login");
}

/**
 * Blocks a login form that has already been signed in, so the back button
 * does not present a stale form.
 */
function redirectIfAuthed(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect("/dashboard");
  }
  return next();
}

/* --------------------------------------------------------------------------
   CSRF protection

   Dashboard writes are cookie-authenticated, so every state-changing form
   carries a token that must match the one held in the session.
   -------------------------------------------------------------------------- */

function csrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

/** Exposes the token to every dashboard template as `csrfToken`. */
function exposeCsrf(req, res, next) {
  res.locals.csrfToken = csrfToken(req);
  next();
}

function verifyCsrf(req, res, next) {
  const expected = req.session && req.session.csrfToken;
  const supplied = req.body && req.body._csrf;

  if (!expected || !supplied) {
    return res.status(403).send("Invalid or expired form token. Please reload the page and try again.");
  }

  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(supplied));

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).send("Invalid or expired form token. Please reload the page and try again.");
  }

  return next();
}

/* --------------------------------------------------------------------------
   Login throttling

   In-memory counter keyed by IP. Enough to blunt password guessing on the
   single-instance deployment this dashboard runs on.
   -------------------------------------------------------------------------- */

const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;
const attempts = new Map();

function attemptKey(req) {
  return req.ip || req.connection.remoteAddress || "unknown";
}

function isLockedOut(req) {
  const record = attempts.get(attemptKey(req));
  if (!record) return false;

  if (Date.now() > record.expires) {
    attempts.delete(attemptKey(req));
    return false;
  }

  return record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(req) {
  const key = attemptKey(req);
  const record = attempts.get(key);

  if (!record || Date.now() > record.expires) {
    attempts.set(key, { count: 1, expires: Date.now() + LOCKOUT_MS });
    return;
  }

  record.count += 1;
}

function clearAttempts(req) {
  attempts.delete(attemptKey(req));
}

module.exports = {
  requireAuth,
  redirectIfAuthed,
  exposeCsrf,
  verifyCsrf,
  isLockedOut,
  recordFailedAttempt,
  clearAttempts,
  LOCKOUT_MINUTES: LOCKOUT_MS / 60000,
};
