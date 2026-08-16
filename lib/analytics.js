/**
 * First-party analytics helpers.
 *
 * Unique visits are distinct visitor-id cookies. Pageviews are rows in
 * `pageviews`. Nothing is recorded until the visitor has accepted cookies.
 * IP addresses and User-Agent strings are not stored.
 */
const db = require("../config/database");

const CONSENT_COOKIE = "ahmc_consent";
const VISITOR_COOKIE = "ahmc_vid";
const CONSENT_ACCEPTED = "accepted";
const CONSENT_DECLINED = "declined";
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SKIP_PREFIXES = ["/dashboard", "/api", "/assets", "/images", "/uploads"];
const SKIP_EXACT = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
]);

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};

  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[key] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function normalizePath(value) {
  if (typeof value !== "string") return null;

  let path = value.trim();
  if (!path) return null;

  // Allow a full URL but only keep the pathname.
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  }

  path = path.split("?")[0].split("#")[0];
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path.length > 255) path = path.slice(0, 255);

  return path;
}

function isTrackablePath(path) {
  if (!path || path[0] !== "/") return false;
  if (SKIP_EXACT.has(path)) return false;
  for (const prefix of SKIP_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return false;
  }
  // Logos and other files served from the public root.
  if (/\.[a-zA-Z0-9]{2,5}$/.test(path)) return false;
  return true;
}

function cookieBase() {
  return {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

function applyConsentCookies(res, choice, visitorId) {
  res.cookie(CONSENT_COOKIE, choice, { ...cookieBase(), httpOnly: false });

  if (choice === CONSENT_ACCEPTED && visitorId) {
    res.cookie(VISITOR_COOKIE, visitorId, { ...cookieBase(), httpOnly: true });
  } else {
    res.clearCookie(VISITOR_COOKIE, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
  }
}

async function recordPageview(visitorId, rawPath) {
  const path = normalizePath(rawPath);
  if (!isTrackablePath(path) || !isUuid(visitorId)) return false;

  await db.execute(
    `INSERT INTO visitors (id) VALUES (?)
     ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP`,
    [visitorId]
  );
  await db.execute("INSERT INTO pageviews (visitor_id, path) VALUES (?, ?)", [
    visitorId,
    path,
  ]);
  return true;
}

async function loadDashboardStats() {
  const [[totals]] = await db.execute(
    `SELECT
       (SELECT COUNT(*) FROM visitors) AS unique_visits,
       (SELECT COUNT(*) FROM pageviews) AS pageviews`
  );

  const [[week]] = await db.execute(
    `SELECT
       COUNT(*) AS pageviews,
       COUNT(DISTINCT visitor_id) AS unique_visits
     FROM pageviews
     WHERE viewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
  );

  const [paths] = await db.execute(
    `SELECT
       path,
       COUNT(*) AS views,
       COUNT(DISTINCT visitor_id) AS unique_visitors
     FROM pageviews
     GROUP BY path
     ORDER BY views DESC, path ASC
     LIMIT 20`
  );

  return {
    uniqueVisits: Number(totals.unique_visits) || 0,
    pageviews: Number(totals.pageviews) || 0,
    weekVisits: Number(week.unique_visits) || 0,
    weekViews: Number(week.pageviews) || 0,
    paths,
  };
}

module.exports = {
  CONSENT_COOKIE,
  VISITOR_COOKIE,
  CONSENT_ACCEPTED,
  CONSENT_DECLINED,
  parseCookies,
  isUuid,
  normalizePath,
  isTrackablePath,
  applyConsentCookies,
  recordPageview,
  loadDashboardStats,
};
