const crypto = require("crypto");
const { SESSION_MS } = require("../lib/otp");

function sessionIsFresh(user) {
  if (!user || !user.signedInAt) return false;
  const issued = new Date(user.signedInAt).getTime();
  return Number.isFinite(issued) && Date.now() - issued < SESSION_MS;
}

/**
 * Redirects anonymous or expired sessions to the login screen.
 */
function requireAuth(req, res, next) {
  if (req.session && sessionIsFresh(req.session.user)) {
    return next();
  }

  if (req.session && req.session.user) {
    return req.session.destroy(() => {
      res.clearCookie("ahmc.sid");
      res.redirect("/dashboard/login");
    });
  }

  if (req.method === "GET") {
    const nextPath = safeDashboardPath(req.originalUrl);
    if (nextPath) req.session.returnTo = nextPath;
  }

  return res.redirect("/dashboard/login");
}

/** Only paths inside the staff area — never an external or protocol-relative URL. */
function safeDashboardPath(value) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/dashboard") || value.startsWith("//")) return null;
  if (value.includes("://") || value.includes("\\")) return null;
  return value;
}

function redirectIfAuthed(req, res, next) {
  if (req.session && sessionIsFresh(req.session.user)) {
    return res.redirect("/dashboard");
  }
  return next();
}

function csrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

function exposeCsrf(req, res, next) {
  res.locals.csrfToken = csrfToken(req);
  next();
}

function verifyCsrf(req, res, next) {
  const expected = req.session && req.session.csrfToken;
  const supplied = req.body && req.body._csrf;

  if (!expected || !supplied) {
    return res
      .status(403)
      .send("Invalid or expired form token. Please reload the page and try again.");
  }

  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(supplied));

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res
      .status(403)
      .send("Invalid or expired form token. Please reload the page and try again.");
  }

  return next();
}

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

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now > record.expires) attempts.delete(key);
  }
}, LOCKOUT_MS).unref();

module.exports = {
  requireAuth,
  redirectIfAuthed,
  exposeCsrf,
  verifyCsrf,
  isLockedOut,
  recordFailedAttempt,
  clearAttempts,
  sessionIsFresh,
  safeDashboardPath,
  LOCKOUT_MINUTES: LOCKOUT_MS / 60000,
};
