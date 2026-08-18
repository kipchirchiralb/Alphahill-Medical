/**
 * First-party analytics helpers.
 *
 * Every public HTML page a real browser loads is counted: one row in
 * `pageviews` holding a path and a timestamp. No cookie, no identifier, no IP
 * address and no User-Agent are involved, so the count needs no consent and
 * covers all traffic.
 *
 * Accepting cookies adds one thing: a random id in `ahmc_vid`, saved against
 * that visitor's pageviews. It is the only way to tell one person's second
 * page from a second person's first, so unique-visitor and visit figures are
 * always a subset of the pageview total — `optInRate` reports how big a
 * subset, which is the honest way to read them.
 */
const db = require("../config/database");

const CONSENT_COOKIE = "ahmc_consent";
const VISITOR_COOKIE = "ahmc_vid";
const CONSENT_ACCEPTED = "accepted";
const CONSENT_DECLINED = "declined";

// An acceptance is worth remembering for a year. A refusal is re-asked sooner,
// so someone who changes their mind is not locked out of the choice.
const ACCEPT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const DECLINE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

// A gap this long between two pageviews starts a new visit.
const VISIT_GAP_MS = 30 * 60 * 1000;

// Windows offered on the statistics page. Values are interpolated into SQL, so
// this list is the only source of them — never a request value.
const REPORT_RANGES = [7, 30, 90, 365];
const DEFAULT_RANGE = 30;

// Bars in the trend chart. Longer windows are bucketed to stay readable.
const MAX_CHART_POINTS = 60;

// Ceiling on rows pulled into memory to group visits. Far above real traffic;
// a guard rather than a limit anyone should reach.
const MAX_VISIT_ROWS = 200000;

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

// Counting without a cookie means crawlers land in the same table as people,
// so they are filtered on the way in. The User-Agent is only ever tested here
// and is never written to the database.
const BOT_PATTERN =
  /bot|crawl|spider|slurp|scrape|archiver|indexer|monitor|uptime|pingdom|lighthouse|headless|phantom|puppeteer|playwright|selenium|curl\/|wget|python-|go-http|java\/|okhttp|axios|node-fetch|libwww|httpclient|facebookexternalhit|whatsapp|telegram|discord|slackbot|embedly|preview|feedfetcher|validator|semrush|ahrefs|mj12|dotbot|petalbot|zgrab|masscan/i;

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

/** True for crawlers, scripts and anything that did not send a real UA. */
function isLikelyBot(userAgent) {
  if (typeof userAgent !== "string") return true;
  const ua = userAgent.trim();
  if (ua.length < 16) return true;
  return BOT_PATTERN.test(ua);
}

/** True for browser prefetch and prerender hints, which nobody has read yet. */
function isPrefetch(req) {
  const purpose = String(
    req.headers["sec-purpose"] ||
      req.headers.purpose ||
      req.headers["x-purpose"] ||
      req.headers["x-moz"] ||
      ""
  ).toLowerCase();

  return (
    purpose.includes("prefetch") ||
    purpose.includes("prerender") ||
    purpose.includes("preview")
  );
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

function cookieBase(maxAge) {
  return {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

function applyConsentCookies(res, choice, visitorId) {
  const maxAge =
    choice === CONSENT_ACCEPTED ? ACCEPT_MAX_AGE_MS : DECLINE_MAX_AGE_MS;

  res.cookie(CONSENT_COOKIE, choice, { ...cookieBase(maxAge), httpOnly: false });

  if (choice === CONSENT_ACCEPTED && visitorId) {
    res.cookie(VISITOR_COOKIE, visitorId, {
      ...cookieBase(ACCEPT_MAX_AGE_MS),
      httpOnly: true,
    });
  } else {
    res.clearCookie(VISITOR_COOKIE, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
  }
}

/* --------------------------------------------------------------------------
   Recording
   -------------------------------------------------------------------------- */

/** Creates the visitor row on first acceptance, refreshes `last_seen_at` after. */
async function touchVisitor(visitorId) {
  if (!isUuid(visitorId)) return false;

  await db.execute(
    `INSERT INTO visitors (id) VALUES (?)
     ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP`,
    [visitorId]
  );
  return true;
}

/**
 * Records one pageview. `visitorId` is optional: without consent the row is
 * stored with a NULL visitor, which still counts the view.
 */
async function recordPageview(visitorId, rawPath) {
  const path = normalizePath(rawPath);
  if (!isTrackablePath(path)) return false;

  const id = isUuid(visitorId) ? visitorId : null;
  if (id) await touchVisitor(id);

  await db.execute("INSERT INTO pageviews (visitor_id, path) VALUES (?, ?)", [
    id,
    path,
  ]);
  return true;
}

/* --------------------------------------------------------------------------
   Reporting
   -------------------------------------------------------------------------- */

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function normalizeRange(value) {
  const days = Number(value);
  return REPORT_RANGES.includes(days) ? days : DEFAULT_RANGE;
}

/**
 * Groups a visitor's pageviews into visits: consecutive views less than
 * `VISIT_GAP_MS` apart belong to the same visit. Only opted-in visitors have
 * an id, so this covers that subset.
 */
async function countVisits(sinceDays, untilDays = 0) {
  const until =
    untilDays > 0
      ? `AND viewed_at < DATE_SUB(NOW(), INTERVAL ${untilDays} DAY)`
      : "";

  const [rows] = await db.execute(
    `SELECT visitor_id, viewed_at
     FROM pageviews
     WHERE visitor_id IS NOT NULL
       AND viewed_at >= DATE_SUB(NOW(), INTERVAL ${sinceDays} DAY)
       ${until}
     ORDER BY visitor_id, viewed_at
     LIMIT ${MAX_VISIT_ROWS}`
  );

  let visits = 0;
  let lastVisitor = null;
  let lastTime = 0;

  for (const row of rows) {
    const time = new Date(row.viewed_at).getTime();
    if (row.visitor_id !== lastVisitor || time - lastTime > VISIT_GAP_MS) {
      visits += 1;
    }
    lastVisitor = row.visitor_id;
    lastTime = time;
  }

  return visits;
}

/** One entry per day in the window, including days with no traffic at all. */
function buildDailySeries(rows, days) {
  const byDay = new Map();
  for (const row of rows) {
    const key = dayKey(row.day);
    if (key) {
      byDay.set(key, {
        views: toNumber(row.views),
        visitors: toNumber(row.visitors),
      });
    }
  }

  const series = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (days - 1));

  for (let i = 0; i < days; i += 1) {
    const key = dayKey(cursor);
    const entry = byDay.get(key) || { views: 0, visitors: 0 };
    series.push({ day: key, date: new Date(cursor), views: entry.views });
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
}

/**
 * Merges consecutive days so a long window still fits on screen. Views add up
 * across days; unique visitors do not, so the chart plots views only.
 */
function bucketSeries(series, maxPoints) {
  const size = Math.ceil(series.length / maxPoints);
  if (size <= 1) return { points: series, bucketDays: 1 };

  const points = [];
  for (let i = 0; i < series.length; i += size) {
    const chunk = series.slice(i, i + size);
    points.push({
      day: chunk[0].day,
      date: chunk[0].date,
      endDate: chunk[chunk.length - 1].date,
      views: chunk.reduce((total, entry) => total + entry.views, 0),
    });
  }

  return { points, bucketDays: size };
}

/** Compact figures for the overview page. */
async function loadDashboardStats() {
  const [[totals]] = await db.execute(
    `SELECT
       (SELECT COUNT(*) FROM pageviews) AS pageviews,
       (SELECT COUNT(*) FROM visitors) AS unique_visitors`
  );

  const [[week]] = await db.execute(
    `SELECT
       COUNT(*) AS pageviews,
       COUNT(DISTINCT visitor_id) AS unique_visitors,
       SUM(visitor_id IS NOT NULL) AS identified_views
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

  const weekViews = toNumber(week.pageviews);

  return {
    pageviews: toNumber(totals.pageviews),
    uniqueVisitors: toNumber(totals.unique_visitors),
    weekViews,
    weekVisitors: toNumber(week.unique_visitors),
    weekOptInRate: weekViews
      ? Math.round((toNumber(week.identified_views) / weekViews) * 100)
      : null,
    paths,
  };
}

/** Everything the statistics page shows, for one window. */
async function loadAnalyticsReport(requestedDays) {
  const days = normalizeRange(requestedDays);

  const [[range]] = await db.execute(
    `SELECT
       COUNT(*) AS views,
       COUNT(DISTINCT visitor_id) AS visitors,
       SUM(visitor_id IS NOT NULL) AS identified_views,
       COUNT(DISTINCT path) AS paths
     FROM pageviews
     WHERE viewed_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`
  );

  const [[previous]] = await db.execute(
    `SELECT
       COUNT(*) AS views,
       COUNT(DISTINCT visitor_id) AS visitors
     FROM pageviews
     WHERE viewed_at >= DATE_SUB(NOW(), INTERVAL ${days * 2} DAY)
       AND viewed_at < DATE_SUB(NOW(), INTERVAL ${days} DAY)`
  );

  const [[allTime]] = await db.execute(
    `SELECT
       (SELECT COUNT(*) FROM pageviews) AS views,
       (SELECT COUNT(*) FROM visitors) AS visitors,
       (SELECT MIN(viewed_at) FROM pageviews) AS first_view_at`
  );

  const [dailyRows] = await db.execute(
    `SELECT
       DATE(viewed_at) AS day,
       COUNT(*) AS views,
       COUNT(DISTINCT visitor_id) AS visitors
     FROM pageviews
     WHERE viewed_at >= DATE_SUB(CURDATE(), INTERVAL ${days - 1} DAY)
     GROUP BY DATE(viewed_at)
     ORDER BY day ASC`
  );

  const [hourRows] = await db.execute(
    `SELECT HOUR(viewed_at) AS hour, COUNT(*) AS views
     FROM pageviews
     WHERE viewed_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
     GROUP BY HOUR(viewed_at)`
  );

  const [pathRows] = await db.execute(
    `SELECT
       path,
       COUNT(*) AS views,
       COUNT(DISTINCT visitor_id) AS visitors
     FROM pageviews
     WHERE viewed_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
     GROUP BY path
     ORDER BY views DESC, path ASC
     LIMIT 25`
  );

  const visits = await countVisits(days);
  const previousVisits = await countVisits(days * 2, days);

  const views = toNumber(range.views);
  const visitors = toNumber(range.visitors);
  const identifiedViews = toNumber(range.identified_views);
  const previousViews = toNumber(previous.views);
  const previousVisitors = toNumber(previous.visitors);

  const hoursByHour = new Map(
    hourRows.map((row) => [toNumber(row.hour), toNumber(row.views)])
  );
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    views: hoursByHour.get(hour) || 0,
  }));

  const chart = bucketSeries(buildDailySeries(dailyRows, days), MAX_CHART_POINTS);

  return {
    days,
    ranges: REPORT_RANGES,
    range: {
      views,
      visitors,
      visits,
      identifiedViews,
      paths: toNumber(range.paths),
      optInRate: views ? Math.round((identifiedViews / views) * 100) : null,
      viewsPerVisit: visits ? Math.round((identifiedViews / visits) * 10) / 10 : null,
    },
    previous: {
      views: previousViews,
      visitors: previousVisitors,
      visits: previousVisits,
    },
    change: {
      views: percentChange(views, previousViews),
      visitors: percentChange(visitors, previousVisitors),
      visits: percentChange(visits, previousVisits),
    },
    allTime: {
      views: toNumber(allTime.views),
      visitors: toNumber(allTime.visitors),
      firstViewAt: allTime.first_view_at || null,
    },
    chart,
    hours,
    paths: pathRows.map((row) => ({
      path: row.path,
      views: toNumber(row.views),
      visitors: toNumber(row.visitors),
      share: views ? Math.round((toNumber(row.views) / views) * 100) : 0,
    })),
  };
}

module.exports = {
  CONSENT_COOKIE,
  VISITOR_COOKIE,
  CONSENT_ACCEPTED,
  CONSENT_DECLINED,
  REPORT_RANGES,
  DEFAULT_RANGE,
  parseCookies,
  isUuid,
  isLikelyBot,
  isPrefetch,
  normalizePath,
  isTrackablePath,
  normalizeRange,
  applyConsentCookies,
  touchVisitor,
  recordPageview,
  loadDashboardStats,
  loadAnalyticsReport,
};
