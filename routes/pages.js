const express = require("express");
const router = express.Router();
const db = require("../config/database");
const {
  bodyToHtml,
  formatDate,
  initials,
  publicName,
} = require("../lib/helpers");

const SITE = "https://alphahillmedical.co.ke";

/** Values shared by every public template. */
function publicLocals(extra = {}) {
  return {
    site: SITE,
    formatDate,
    initials,
    publicName,
    current: extra.current || "",
    ...extra,
  };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// Render pages (EJS templates)
router.get("/", (req, res) => {
  res.render(
    "index",
    publicLocals({ title: "Home | Alpha Hill Medical Centre", current: "home" })
  );
});

router.get("/about", (req, res) => {
  res.render(
    "about",
    publicLocals({ title: "About Us | Alpha Hill Medical Centre", current: "about" })
  );
});

router.get("/services", (req, res) => {
  res.render(
    "services",
    publicLocals({ title: "Services | Alpha Hill Medical Centre", current: "services" })
  );
});

router.get("/insurance", (req, res) => {
  res.render(
    "insurance",
    publicLocals({
      title: "Insurance Partners | Alpha Hill Medical Centre",
      current: "insurance",
    })
  );
});

router.get("/patients", (req, res) => {
  res.render(
    "patients",
    publicLocals({
      title: "Patient Information | Alpha Hill Medical Centre",
      current: "patients",
    })
  );
});

router.get("/careers", (req, res) => {
  res.render(
    "careers",
    publicLocals({ title: "Careers | Alpha Hill Medical Centre", current: "careers" })
  );
});

router.get("/contact", (req, res) => {
  res.render(
    "contact",
    publicLocals({ title: "Contact Us | Alpha Hill Medical Centre", current: "contact" })
  );
});

router.get("/privacy", (req, res) => {
  res.render(
    "privacy",
    publicLocals({ title: "Privacy Policy | Alpha Hill Medical Centre" })
  );
});

router.get("/cookies", (req, res) => {
  res.render(
    "cookies",
    publicLocals({ title: "Cookies Policy | Alpha Hill Medical Centre" })
  );
});

/* --------------------------------------------------------------------------
   News & events — published straight from the dashboard
   -------------------------------------------------------------------------- */

router.get(
  "/news",
  asyncRoute(async (req, res) => {
    const [posts] = await db.execute(
      `SELECT title, slug, category, excerpt, image_url, image_alt, event_date, location, published_at
       FROM news
       WHERE status = 'published'
       ORDER BY COALESCE(event_date, published_at) DESC, id DESC`
    );

    res.render(
      "news",
      publicLocals({
        title: "News & Events | Alpha Hill Medical Centre",
        posts,
        current: "news",
      })
    );
  })
);

router.get(
  "/news/:slug",
  asyncRoute(async (req, res, next) => {
    const [rows] = await db.execute(
      "SELECT * FROM news WHERE slug = ? AND status = 'published' LIMIT 1",
      [req.params.slug]
    );

    if (rows.length === 0) return next();

    const post = rows[0];

    const [related] = await db.execute(
      `SELECT title, slug, category, excerpt, image_url, image_alt, event_date, published_at
       FROM news
       WHERE status = 'published' AND id <> ?
       ORDER BY COALESCE(event_date, published_at) DESC
       LIMIT 3`,
      [post.id]
    );

    res.render(
      "news-post",
      publicLocals({
        title: `${post.title} | Alpha Hill Medical Centre`,
        post,
        bodyHtml: bodyToHtml(post.body),
        related,
        current: "news",
      })
    );
  })
);

/* --------------------------------------------------------------------------
   Reviews — only approved feedback is shown
   -------------------------------------------------------------------------- */

router.get(
  "/reviews",
  asyncRoute(async (req, res) => {
    const [reviews] = await db.execute(
      `SELECT name, rating, message, service, location, created_at
       FROM feedback
       WHERE moderation = 'approved'
       ORDER BY moderated_at DESC, created_at DESC
       LIMIT 24`
    );

    const [[summary]] = await db.execute(
      `SELECT COUNT(*) AS total, ROUND(AVG(rating), 1) AS average
       FROM feedback
       WHERE moderation = 'approved' AND rating IS NOT NULL`
    );

    res.render(
      "reviews",
      publicLocals({
        title: "Reviews & Feedback | Alpha Hill Medical Centre",
        reviews,
        summary,
      })
    );
  })
);

module.exports = router;
