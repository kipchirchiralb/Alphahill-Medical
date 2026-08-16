const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../config/database");
const { sendMail } = require("../lib/mailer");
const { escapeHtml } = require("../lib/helpers");
const {
  CONSENT_ACCEPTED,
  CONSENT_DECLINED,
  VISITOR_COOKIE,
  parseCookies,
  isUuid,
  applyConsentCookies,
  recordPageview,
} = require("../lib/analytics");

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims a value and caps its length so oversized input cannot reach the database. */
function clean(value, maxLength) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function isValidEmail(value) {
  return typeof value === "string" && EMAIL_PATTERN.test(value.trim());
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/* --------------------------------------------------------------------------
   Simple rate limiting

   Public forms are unauthenticated, so each IP gets a fixed budget of
   submissions per window to keep casual spam out of the dashboard.
   -------------------------------------------------------------------------- */

const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const record = hits.get(key);

  if (!record || now > record.expires) {
    hits.set(key, { count: 1, expires: now + RATE_WINDOW_MS });
    return next();
  }

  record.count += 1;

  if (record.count > RATE_LIMIT) {
    return res.status(429).json({
      error: "Too many submissions from this device. Please try again shortly.",
    });
  }

  return next();
}

// Drop expired counters so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of hits) {
    if (now > record.expires) hits.delete(key);
  }
}, RATE_WINDOW_MS).unref();

router.use((req, res, next) => {
  if (req.path === "/consent") return next();
  return rateLimit(req, res, next);
});

/* --------------------------------------------------------------------------
   POST - Enquiry Form (Contact Page)
   -------------------------------------------------------------------------- */

router.post(
  "/enquiries",
  asyncRoute(async (req, res) => {
    const full_name = clean(req.body.full_name || req.body.name, 100);
    const email = clean(req.body.email, 100);
    const phone = clean(req.body.phone, 20);
    const service = clean(req.body.service, 100);
    const message = clean(req.body.message, 5000);

    if (!full_name || !message) {
      return res.status(400).json({ error: "Please provide your name and a message." });
    }

    if (!email && !phone) {
      return res
        .status(400)
        .json({ error: "Please provide a phone number or an email address." });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const [result] = await db.execute(
      "INSERT INTO enquiries (full_name, email, phone, service, message) VALUES (?, ?, ?, ?, ?)",
      [full_name, email || "", phone, service, message]
    );

    res.status(201).json({
      success: true,
      message: "Enquiry submitted successfully",
      id: result.insertId,
    });
  })
);

/* --------------------------------------------------------------------------
   POST - Appointment Form
   -------------------------------------------------------------------------- */

router.post(
  "/appointments",
  asyncRoute(async (req, res) => {
    const patient_name = clean(req.body.patient_name, 100);
    const email = clean(req.body.email, 100);
    const phone = clean(req.body.phone, 20);
    const date_preferred = clean(req.body.date_preferred, 10);
    const time_preferred = clean(req.body.time_preferred, 8);
    const service = clean(req.body.service, 100);
    const notes = clean(req.body.notes, 5000);

    if (!patient_name || !phone || !date_preferred || !time_preferred || !service) {
      return res.status(400).json({ error: "Please fill in all required fields." });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const [result] = await db.execute(
      `INSERT INTO appointments
         (patient_name, email, phone, date_preferred, time_preferred, service, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [patient_name, email || "", phone, date_preferred, time_preferred, service, notes]
    );

    const dash = "https://alphahillmedical.co.ke/dashboard/submissions/appointments";
    const rows = [
      ["Patient", patient_name],
      ["Phone", phone],
      ["Email", email || "—"],
      ["Preferred date", date_preferred],
      ["Preferred time", time_preferred],
      ["Service", service],
      ["Notes", notes || "—"],
    ];
    const textBody = [
      "A new appointment request was submitted on the website.",
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      `Open in the dashboard: ${dash}`,
    ].join("\n");
    const htmlBody = `
      <p style="font-family:Georgia,serif;font-size:16px;color:#1a1a2e">
        A new appointment request was submitted on the Alpha Hill Medical Centre website.
      </p>
      <table style="font-family:Georgia,serif;font-size:15px;color:#1a1a2e;border-collapse:collapse">
        ${rows
          .map(
            ([label, value]) =>
              `<tr>
                <td style="padding:6px 16px 6px 0;color:#5a6076;vertical-align:top">${escapeHtml(label)}</td>
                <td style="padding:6px 0;vertical-align:top">${escapeHtml(value)}</td>
              </tr>`
          )
          .join("")}
      </table>
      <p style="font-family:Georgia,serif;font-size:14px;color:#5a6076">
        <a href="${dash}">View in the staff dashboard</a>
      </p>
    `;

    try {
      await sendMail({
        to: "info@alphahillmedical.co.ke",
        replyTo: email || undefined,
        subject: `Appointment request: ${patient_name} — ${date_preferred} ${time_preferred}`,
        text: textBody,
        html: htmlBody,
      });
    } catch (error) {
      console.error("Appointment notification email:", error.message);
    }

    res.status(201).json({
      success: true,
      message: "Appointment request received",
      id: result.insertId,
    });
  })
);

/* --------------------------------------------------------------------------
   POST - Career Application Form
   -------------------------------------------------------------------------- */

router.post(
  "/career-applications",
  asyncRoute(async (req, res) => {
    const full_name = clean(req.body.full_name, 100);
    const email = clean(req.body.email, 100);
    const phone = clean(req.body.phone, 20);
    const position = clean(req.body.position, 100);
    const opportunity_type = clean(req.body.opportunity_type, 50);
    const cover_letter = clean(req.body.cover_letter, 8000);
    const resume_url = clean(req.body.resume_url, 255);

    if (!full_name || !email || !phone || !position) {
      return res.status(400).json({ error: "Please fill in all required fields." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const [result] = await db.execute(
      `INSERT INTO career_applications
         (full_name, email, phone, position, opportunity_type, cover_letter, resume_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [full_name, email, phone, position, opportunity_type, cover_letter, resume_url]
    );

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      id: result.insertId,
    });
  })
);

/* --------------------------------------------------------------------------
   POST - Newsletter Subscription
   -------------------------------------------------------------------------- */

router.post(
  "/subscribe",
  asyncRoute(async (req, res) => {
    const email = clean(req.body.email, 100);

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    try {
      const [result] = await db.execute(
        "INSERT INTO subscriptions (email) VALUES (?)",
        [email]
      );

      return res.status(201).json({
        success: true,
        message: "Subscribed successfully",
        id: result.insertId,
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        // Already on the list is a success from the subscriber's point of view.
        return res
          .status(200)
          .json({ success: true, message: "You are already subscribed." });
      }
      throw error;
    }
  })
);

/* --------------------------------------------------------------------------
   POST - Feedback / Review Form

   Reviews are stored as `pending` and stay invisible to the public until a
   member of staff approves them in the dashboard.
   -------------------------------------------------------------------------- */

router.post(
  "/feedback",
  asyncRoute(async (req, res) => {
    const name = clean(req.body.name, 100);
    const email = clean(req.body.email, 100);
    const phone = clean(req.body.phone, 20);
    const service = clean(req.body.service, 100);
    const location = clean(req.body.location, 100);
    const message = clean(req.body.message, 5000);

    const rating = Number.parseInt(req.body.rating, 10);
    const validRating = Number.isInteger(rating) && rating >= 1 && rating <= 5;

    // Checkboxes arrive as "on"/true when ticked and are absent otherwise.
    const consent =
      req.body.consent === "on" ||
      req.body.consent === true ||
      req.body.consent === "true" ||
      req.body.consent === "1";

    if (!name || !message) {
      return res
        .status(400)
        .json({ error: "Please provide your name and your review." });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const [result] = await db.execute(
      `INSERT INTO feedback (name, email, phone, service, location, rating, message, consent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        phone,
        service,
        location,
        validRating ? rating : null,
        message,
        consent ? 1 : 0,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      id: result.insertId,
    });
  })
);

/* --------------------------------------------------------------------------
   POST - Cookie consent

   Stores the choice in first-party cookies. Analytics cookies and pageviews
   are only created when the visitor accepts.
   -------------------------------------------------------------------------- */

function wantsJson(req) {
  const accept = String(req.headers.accept || "");
  const type = String(req.headers["content-type"] || "");
  return type.includes("application/json") || accept.includes("application/json");
}

function safeReturnPath(req) {
  const candidate = req.body && (req.body.path || req.body.return_to);
  if (typeof candidate === "string" && candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate.split("?")[0];
  }

  const referer = req.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.pathname && !url.pathname.startsWith("/dashboard")) {
        return url.pathname;
      }
    } catch {
      /* ignore malformed referers */
    }
  }

  return "/";
}

router.post(
  "/consent",
  asyncRoute(async (req, res) => {
    const choiceRaw = String(req.body.choice || "").toLowerCase();
    const choice =
      choiceRaw === CONSENT_ACCEPTED || choiceRaw === "accept"
        ? CONSENT_ACCEPTED
        : choiceRaw === CONSENT_DECLINED || choiceRaw === "decline"
          ? CONSENT_DECLINED
          : null;

    if (!choice) {
      if (wantsJson(req)) {
        return res.status(400).json({ error: "Please choose Accept or Decline." });
      }
      return res.redirect(safeReturnPath(req));
    }

    const cookies = parseCookies(req);
    let visitorId = null;

    if (choice === CONSENT_ACCEPTED) {
      visitorId = isUuid(cookies[VISITOR_COOKIE])
        ? cookies[VISITOR_COOKIE]
        : crypto.randomUUID();
    }

    applyConsentCookies(res, choice, visitorId);

    if (choice === CONSENT_ACCEPTED && visitorId) {
      recordPageview(visitorId, req.body.path || safeReturnPath(req)).catch((error) => {
        console.error("analytics pageview:", error.message);
      });
    }

    if (wantsJson(req)) {
      return res.json({ success: true, choice });
    }

    return res.redirect(safeReturnPath(req));
  })
);

module.exports = router;
