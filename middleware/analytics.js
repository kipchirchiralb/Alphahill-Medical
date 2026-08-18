/**
 * Records a pageview for every public HTML page a real browser loads.
 *
 * No cookie is required: an anonymous row (path + timestamp) is written for
 * everyone. Visitors who accepted cookies also have their `ahmc_vid` saved
 * with the row, which is what makes unique-visitor counts possible.
 *
 * Recording happens on `finish` so only successful HTML responses count —
 * redirects, 404s, downloads and API replies are left out. Crawlers, scripted
 * clients and browser prefetches are filtered before that. Failures never
 * affect the response: analytics must not take the site down.
 */
const {
  CONSENT_COOKIE,
  CONSENT_ACCEPTED,
  VISITOR_COOKIE,
  parseCookies,
  isUuid,
  isLikelyBot,
  isPrefetch,
  isTrackablePath,
  recordPageview,
} = require("../lib/analytics");

function isHtmlResponse(res) {
  const type = res.getHeader("Content-Type");
  if (!type) return false;
  return String(type).toLowerCase().includes("text/html");
}

function trackPageview(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  const path = req.path || "";
  if (!isTrackablePath(path)) return next();
  if (isPrefetch(req)) return next();
  if (isLikelyBot(req.headers["user-agent"])) return next();

  const cookies = parseCookies(req);
  const visitorId =
    cookies[CONSENT_COOKIE] === CONSENT_ACCEPTED && isUuid(cookies[VISITOR_COOKIE])
      ? cookies[VISITOR_COOKIE]
      : null;

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    if (!isHtmlResponse(res)) return;

    recordPageview(visitorId, path).catch((error) => {
      console.error("analytics pageview:", error.message);
    });
  });

  return next();
}

module.exports = { trackPageview };
