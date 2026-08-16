/**
 * Records a pageview for consented visitors on public HTML navigations.
 * Dashboard, APIs and static assets are ignored. Failures never affect the
 * response — analytics must not take the site down.
 */
const {
  CONSENT_COOKIE,
  CONSENT_ACCEPTED,
  VISITOR_COOKIE,
  parseCookies,
  isUuid,
  isTrackablePath,
  recordPageview,
} = require("../lib/analytics");

function trackPageview(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  const path = req.path || "";
  if (!isTrackablePath(path)) return next();

  const cookies = parseCookies(req);
  if (cookies[CONSENT_COOKIE] !== CONSENT_ACCEPTED) return next();

  const visitorId = cookies[VISITOR_COOKIE];
  if (!isUuid(visitorId)) return next();

  recordPageview(visitorId, path).catch((error) => {
    console.error("analytics pageview:", error.message);
  });

  return next();
}

module.exports = { trackPageview };
