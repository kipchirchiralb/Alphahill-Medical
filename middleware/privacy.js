/**
 * Keeps the dashboard out of search engines and analytics.
 *
 * The templates also carry a `noindex` meta tag, but headers cover assets and
 * any response that never reaches a template. `Referrer-Policy: no-referrer`
 * stops dashboard URLs (which contain record ids) leaking to third parties,
 * and the CSP forbids the outbound connections an analytics snippet would need.
 */
function noIndexNoTrack(req, res, next) {
  res.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive, nosnippet, noimageindex"
  );
  res.set("Referrer-Policy", "no-referrer");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("X-Frame-Options", "DENY");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Permissions-Policy", "interest-cohort=(), browsing-topics=()");
  res.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; ")
  );

  next();
}

module.exports = { noIndexNoTrack };
