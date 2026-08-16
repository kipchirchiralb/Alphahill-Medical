const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const { issueAndSend, verifyCode, normalizeEmail } = require("../lib/otp");

const db = require("../config/database");
const {
  requireAuth,
  redirectIfAuthed,
  exposeCsrf,
  verifyCsrf,
  isLockedOut,
  recordFailedAttempt,
  clearAttempts,
  LOCKOUT_MINUTES,
} = require("../middleware/auth");
const {
  slugify,
  uniqueSlug,
  deriveExcerpt,
  formatDate,
  formatDateTime,
  toDateInput,
  initials,
  publicName,
  toCsv,
} = require("../lib/helpers");
const { loadDashboardStats } = require("../lib/analytics");

const router = express.Router();

/* --------------------------------------------------------------------------
   Submission types

   One definition per table drives the list view, the status controls and the
   CSV export, so adding a new form later only means adding an entry here.
   -------------------------------------------------------------------------- */

const SUBMISSION_TYPES = {
  enquiries: {
    table: "enquiries",
    label: "Enquiries",
    singular: "enquiry",
    description: "Messages sent through the contact page enquiry form.",
    columns: [
      { key: "full_name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "service", label: "Service" },
      { key: "message", label: "Message", wide: true },
    ],
  },
  appointments: {
    table: "appointments",
    label: "Appointments",
    singular: "appointment",
    description: "Appointment requests submitted from the patient information page.",
    columns: [
      { key: "patient_name", label: "Patient" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "date_preferred", label: "Preferred date", type: "date" },
      { key: "time_preferred", label: "Time" },
      { key: "service", label: "Service" },
      { key: "notes", label: "Notes", wide: true },
    ],
  },
  careers: {
    table: "career_applications",
    label: "Career applications",
    singular: "application",
    description: "Applications for vacancies, internships, attachments and volunteering.",
    columns: [
      { key: "full_name", label: "Applicant" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "position", label: "Position" },
      { key: "opportunity_type", label: "Type" },
      { key: "cover_letter", label: "Cover letter", wide: true },
    ],
  },
  subscriptions: {
    table: "subscriptions",
    label: "Newsletter subscribers",
    singular: "subscriber",
    description: "Email addresses collected from the newsletter sign-up in the footer.",
    columns: [{ key: "email", label: "Email" }],
  },
};

const STATUSES = ["new", "read", "handled"];
const MODERATIONS = ["pending", "approved", "rejected"];

const NEWS_CATEGORIES = [
  "Announcement",
  "Medical Camp",
  "Blood Donation",
  "Vaccination Campaign",
  "Community Outreach",
  "New Equipment",
  "Training / CME",
  "Event",
];

/* --------------------------------------------------------------------------
   Image uploads
   -------------------------------------------------------------------------- */

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    // Generated names only: an attacker-supplied filename never touches disk.
    filename: (req, file, cb) => {
      const extension = ALLOWED_IMAGE_TYPES.get(file.mimetype) || ".bin";
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPG, PNG, WebP or GIF images can be uploaded."));
  },
});

/** Runs multer but turns rejections into a flash message instead of a crash. */
function uploadImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "That image is larger than 5 MB. Please upload a smaller file."
        : error.message;

    req.session.flash = { type: "error", message };

    // Send the author back to the form they were filling in, not the list.
    const back = req.params.id
      ? `/dashboard/news/${req.params.id}/edit`
      : "/dashboard/news/new";

    return res.redirect(back);
  });
}

function removeUpload(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/")) return;

  const target = path.join(UPLOAD_DIR, path.basename(imageUrl));
  fs.promises.unlink(target).catch(() => {
    /* The file may already be gone; nothing to recover from. */
  });
}

/* --------------------------------------------------------------------------
   Shared view state
   -------------------------------------------------------------------------- */

/** Moves a one-shot flash message from the session onto the response. */
function withFlash(req, res, next) {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

/** Values every dashboard template expects. */
function withViewDefaults(req, res, next) {
  res.locals.user = req.session.user || null;
  res.locals.submissionTypes = SUBMISSION_TYPES;
  res.locals.formatDate = formatDate;
  res.locals.formatDateTime = formatDateTime;
  res.locals.initials = initials;
  res.locals.publicName = publicName;
  res.locals.active = "";
  next();
}

/** Counts of unread items, shown as badges in the sidebar. */
async function loadUnreadCounts() {
  const counts = {};

  for (const [slug, type] of Object.entries(SUBMISSION_TYPES)) {
    const [rows] = await db.execute(
      `SELECT COUNT(*) AS total FROM ${type.table} WHERE status = 'new'`
    );
    counts[slug] = rows[0].total;
  }

  const [pending] = await db.execute(
    "SELECT COUNT(*) AS total FROM feedback WHERE moderation = 'pending'"
  );
  counts.reviews = pending[0].total;

  return counts;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * Only ever redirect back into the dashboard. A `redirect_to` field arrives
 * from the browser, so without this an attacker could use it to bounce a
 * signed-in user to an external site.
 */
function safeRedirect(value, fallback) {
  if (typeof value !== "string") return fallback;
  // Reject protocol-relative ("//evil.com") and absolute URLs.
  if (!value.startsWith("/dashboard") || value.startsWith("//")) return fallback;
  return value;
}

router.use(withFlash);
router.use(exposeCsrf);
router.use(withViewDefaults);

/* --------------------------------------------------------------------------
   Authentication
   -------------------------------------------------------------------------- */

function renderLogin(res, extras = {}) {
  const status = extras.status || 200;
  res.status(status).render("dashboard/login", {
    title: "Sign in | Alpha Hill Dashboard",
    error: extras.error || null,
    notice: extras.notice || null,
    pendingEmail: extras.pendingEmail || null,
  });
}

router.get("/login", redirectIfAuthed, (req, res) => {
  if (req.query.reset === "1") {
    delete req.session.pendingEmail;
    return req.session.save(() => res.redirect("/dashboard/login"));
  }

  renderLogin(res, { pendingEmail: req.session.pendingEmail || null });
});

router.post("/login", redirectIfAuthed, verifyCsrf, async (req, res) => {
  if (isLockedOut(req)) {
    return renderLogin(res, {
      status: 429,
      error: `Too many attempts. Please try again in ${LOCKOUT_MINUTES} minutes.`,
      pendingEmail: req.session.pendingEmail || null,
    });
  }

  const email = normalizeEmail(req.body.email);

  if (!email) {
    return renderLogin(res, {
      status: 400,
      error: "Enter the work email address you use at Alpha Hill.",
    });
  }

  try {
    await issueAndSend(email);
  } catch (error) {
    console.error("OTP email:", error.message);
    if (error.code === "SMTP_NOT_CONFIGURED") {
      return renderLogin(res, {
        status: 500,
        error:
          "Sign-in email is not configured yet. Add SMTP_HOST, SMTP_USER and SMTP_PASS to .env.",
      });
    }
    return renderLogin(res, {
      status: 500,
      error: "We could not send the sign-in email. Please try again shortly.",
    });
  }

  req.session.pendingEmail = email;
  return req.session.save(() =>
    renderLogin(res, {
      pendingEmail: email,
      notice:
        "If this address is authorised, we have sent an 8-character code. It expires in 10 minutes.",
    })
  );
});

router.post("/login/verify", redirectIfAuthed, verifyCsrf, async (req, res) => {
  const pendingEmail = req.session.pendingEmail;

  const fail = (error) =>
    renderLogin(res, {
      status: 401,
      error,
      pendingEmail: pendingEmail || null,
    });

  if (isLockedOut(req)) {
    return fail(
      `Too many attempts. Please try again in ${LOCKOUT_MINUTES} minutes.`
    );
  }

  if (!pendingEmail) {
    return renderLogin(res, {
      status: 400,
      error: "Start by requesting a sign-in code.",
    });
  }

  let user;
  try {
    user = await verifyCode(pendingEmail, req.body.code);
  } catch (error) {
    console.error("OTP verify:", error.message);
    return fail("We could not check that code. Please try again.");
  }

  if (!user) {
    recordFailedAttempt(req);
    return fail("That code is incorrect or has expired. Request a new one.");
  }

  clearAttempts(req);

  const returnTo = req.session.returnTo;

  return req.session.regenerate((error) => {
    if (error) return fail("Could not start a session. Please try again.");

    req.session.user = {
      email: user.email,
      name: user.name,
      signedInAt: new Date().toISOString(),
    };

    return req.session.save(() =>
      res.redirect(safeRedirect(returnTo, "/dashboard"))
    );
  });
});

router.post("/logout", verifyCsrf, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("ahmc.sid");
    res.redirect("/dashboard/login");
  });
});

// Everything below this point requires a signed-in user.
router.use(requireAuth);

/* --------------------------------------------------------------------------
   Overview
   -------------------------------------------------------------------------- */

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const counts = await loadUnreadCounts();

    const totals = {};
    for (const [slug, type] of Object.entries(SUBMISSION_TYPES)) {
      const [rows] = await db.execute(
        `SELECT COUNT(*) AS total FROM ${type.table}`
      );
      totals[slug] = rows[0].total;
    }

    const [[reviewTotals]] = await db.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(moderation = 'pending') AS pending,
         SUM(moderation = 'approved') AS approved
       FROM feedback`
    );

    const [[newsTotals]] = await db.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'published') AS published,
         SUM(status = 'draft') AS drafts
       FROM news`
    );

    const [recentPosts] = await db.execute(
      "SELECT id, title, status, category, published_at, updated_at FROM news ORDER BY updated_at DESC LIMIT 5"
    );

    // A single feed of the newest items across every form.
    const recentActivity = [];
    for (const [slug, type] of Object.entries(SUBMISSION_TYPES)) {
      const nameColumn = type.columns[0].key;
      const [rows] = await db.execute(
        `SELECT id, ${nameColumn} AS who, status, created_at FROM ${type.table} ORDER BY created_at DESC LIMIT 5`
      );
      rows.forEach((row) =>
        recentActivity.push({ ...row, kind: type.label, href: `/dashboard/submissions/${slug}` })
      );
    }

    const [recentReviews] = await db.execute(
      "SELECT id, name AS who, moderation, created_at FROM feedback ORDER BY created_at DESC LIMIT 5"
    );
    recentReviews.forEach((row) =>
      recentActivity.push({
        ...row,
        status: row.moderation,
        kind: "Review",
        href: "/dashboard/reviews",
      })
    );

    recentActivity.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let analytics = {
      uniqueVisits: 0,
      pageviews: 0,
      weekVisits: 0,
      weekViews: 0,
      paths: [],
    };
    try {
      analytics = await loadDashboardStats();
    } catch (error) {
      console.error("analytics stats:", error.message);
    }

    res.render("dashboard/index", {
      title: "Overview | Alpha Hill Dashboard",
      active: "overview",
      counts,
      totals,
      reviewTotals,
      newsTotals,
      recentPosts,
      recentActivity: recentActivity.slice(0, 12),
      analytics,
    });
  })
);

/* --------------------------------------------------------------------------
   News & events
   -------------------------------------------------------------------------- */

router.get(
  "/news",
  asyncRoute(async (req, res) => {
    const filter = ["draft", "published"].includes(req.query.status)
      ? req.query.status
      : "all";

    const [posts] = await db.execute(
      filter === "all"
        ? "SELECT * FROM news ORDER BY COALESCE(published_at, updated_at) DESC"
        : `SELECT * FROM news WHERE status = '${filter}' ORDER BY COALESCE(published_at, updated_at) DESC`
    );

    res.render("dashboard/news-list", {
      title: "News & events | Alpha Hill Dashboard",
      active: "news",
      counts: await loadUnreadCounts(),
      posts,
      filter,
    });
  })
);

router.get(
  "/news/new",
  asyncRoute(async (req, res) => {
    res.render("dashboard/news-form", {
      title: "New post | Alpha Hill Dashboard",
      active: "news",
      counts: await loadUnreadCounts(),
      post: {
        id: null,
        title: "",
        category: "Announcement",
        excerpt: "",
        body: "",
        image_url: "",
        image_alt: "",
        event_date: null,
        location: "",
        status: "draft",
      },
      categories: NEWS_CATEGORIES,
      toDateInput,
      isNew: true,
    });
  })
);

router.post(
  "/news",
  uploadImage,
  verifyCsrf,
  asyncRoute(async (req, res) => {
    const { title, category, excerpt, body, image_alt, event_date, location, status } =
      req.body;

    if (!title || !title.trim() || !body || !body.trim()) {
      if (req.file) removeUpload(`/uploads/${req.file.filename}`);
      req.session.flash = {
        type: "error",
        message: "A post needs both a title and a body.",
      };
      return res.redirect("/dashboard/news/new");
    }

    const slug = await uniqueSlug(db, slugify(title));
    const publishNow = status === "published";
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    await db.execute(
      `INSERT INTO news
         (title, slug, category, excerpt, body, image_url, image_alt, event_date, location, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        slug,
        NEWS_CATEGORIES.includes(category) ? category : "Announcement",
        (excerpt && excerpt.trim()) || deriveExcerpt(body),
        body.trim(),
        imageUrl,
        (image_alt && image_alt.trim()) || null,
        event_date || null,
        (location && location.trim()) || null,
        publishNow ? "published" : "draft",
        publishNow ? new Date() : null,
      ]
    );

    req.session.flash = {
      type: "success",
      message: publishNow
        ? "Post published — it is now live on the News & Events page."
        : "Draft saved. Publish it when you are ready.",
    };
    res.redirect("/dashboard/news");
  })
);

router.get(
  "/news/:id/edit",
  asyncRoute(async (req, res) => {
    const [rows] = await db.execute("SELECT * FROM news WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      req.session.flash = { type: "error", message: "That post no longer exists." };
      return res.redirect("/dashboard/news");
    }

    res.render("dashboard/news-form", {
      title: "Edit post | Alpha Hill Dashboard",
      active: "news",
      counts: await loadUnreadCounts(),
      post: rows[0],
      categories: NEWS_CATEGORIES,
      toDateInput,
      isNew: false,
    });
  })
);

router.post(
  "/news/:id",
  uploadImage,
  verifyCsrf,
  asyncRoute(async (req, res) => {
    const {
      title,
      category,
      excerpt,
      body,
      image_alt,
      event_date,
      location,
      status,
      remove_image,
    } = req.body;

    const [rows] = await db.execute("SELECT * FROM news WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      if (req.file) removeUpload(`/uploads/${req.file.filename}`);
      req.session.flash = { type: "error", message: "That post no longer exists." };
      return res.redirect("/dashboard/news");
    }

    const existing = rows[0];

    if (!title || !title.trim() || !body || !body.trim()) {
      if (req.file) removeUpload(`/uploads/${req.file.filename}`);
      req.session.flash = {
        type: "error",
        message: "A post needs both a title and a body.",
      };
      return res.redirect(`/dashboard/news/${existing.id}/edit`);
    }

    let imageUrl = existing.image_url;
    if (req.file) {
      removeUpload(existing.image_url);
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (remove_image === "1") {
      removeUpload(existing.image_url);
      imageUrl = null;
    }

    const slug =
      title.trim() === existing.title
        ? existing.slug
        : await uniqueSlug(db, slugify(title), existing.id);

    const publishNow = status === "published";
    // Keep the original publish date when a post is edited after going live.
    const publishedAt = publishNow ? existing.published_at || new Date() : null;

    await db.execute(
      `UPDATE news SET
         title = ?, slug = ?, category = ?, excerpt = ?, body = ?,
         image_url = ?, image_alt = ?, event_date = ?, location = ?,
         status = ?, published_at = ?
       WHERE id = ?`,
      [
        title.trim(),
        slug,
        NEWS_CATEGORIES.includes(category) ? category : "Announcement",
        (excerpt && excerpt.trim()) || deriveExcerpt(body),
        body.trim(),
        imageUrl,
        (image_alt && image_alt.trim()) || null,
        event_date || null,
        (location && location.trim()) || null,
        publishNow ? "published" : "draft",
        publishedAt,
        existing.id,
      ]
    );

    req.session.flash = { type: "success", message: "Post updated." };
    res.redirect("/dashboard/news");
  })
);

router.post(
  "/news/:id/status",
  verifyCsrf,
  asyncRoute(async (req, res) => {
    const publish = req.body.status === "published";

    await db.execute(
      `UPDATE news SET status = ?, published_at = ${publish ? "COALESCE(published_at, NOW())" : "NULL"} WHERE id = ?`,
      [publish ? "published" : "draft", req.params.id]
    );

    req.session.flash = {
      type: "success",
      message: publish ? "Post is now live." : "Post moved back to drafts.",
    };
    res.redirect("/dashboard/news");
  })
);

router.post(
  "/news/:id/delete",
  verifyCsrf,
  asyncRoute(async (req, res) => {
    const [rows] = await db.execute("SELECT image_url FROM news WHERE id = ?", [
      req.params.id,
    ]);

    await db.execute("DELETE FROM news WHERE id = ?", [req.params.id]);
    if (rows.length > 0) removeUpload(rows[0].image_url);

    req.session.flash = { type: "success", message: "Post deleted." };
    res.redirect("/dashboard/news");
  })
);

/* --------------------------------------------------------------------------
   Reviews moderation
   -------------------------------------------------------------------------- */

router.get(
  "/reviews",
  asyncRoute(async (req, res) => {
    const filter = MODERATIONS.includes(req.query.state) ? req.query.state : "pending";

    const [reviews] = await db.execute(
      `SELECT * FROM feedback WHERE moderation = '${filter}' ORDER BY created_at DESC`
    );

    const [[tally]] = await db.execute(
      `SELECT
         SUM(moderation = 'pending') AS pending,
         SUM(moderation = 'approved') AS approved,
         SUM(moderation = 'rejected') AS rejected
       FROM feedback`
    );

    res.render("dashboard/reviews", {
      title: "Reviews | Alpha Hill Dashboard",
      active: "reviews",
      counts: await loadUnreadCounts(),
      reviews,
      filter,
      tally,
    });
  })
);

router.post(
  "/reviews/:id/moderation",
  verifyCsrf,
  asyncRoute(async (req, res) => {
    const { decision, service, location, redirect_to } = req.body;

    if (!MODERATIONS.includes(decision)) {
      req.session.flash = { type: "error", message: "Unknown moderation action." };
      return res.redirect("/dashboard/reviews");
    }

    // The optional caption ("Maternity patient · Mosoriot") is editable here
    // because reviewers often leave those fields blank.
    await db.execute(
      `UPDATE feedback
       SET moderation = ?, moderated_at = ?, status = 'handled', service = ?, location = ?
       WHERE id = ?`,
      [
        decision,
        decision === "pending" ? null : new Date(),
        (service && service.trim()) || null,
        (location && location.trim()) || null,
        req.params.id,
      ]
    );

    const messages = {
      approved: "Review approved — it is now visible on the public Reviews page.",
      rejected: "Review rejected. It stays in the dashboard but will not be published.",
      pending: "Review moved back to the pending queue.",
    };

    req.session.flash = { type: "success", message: messages[decision] };
    res.redirect(safeRedirect(redirect_to, "/dashboard/reviews"));
  })
);

router.get(
  "/reviews/export.csv",
  asyncRoute(async (req, res) => {
    const [rows] = await db.execute(
      "SELECT id, name, email, phone, rating, service, location, message, moderation, created_at FROM feedback ORDER BY created_at DESC"
    );

    const csv = toCsv(
      [
        { key: "id", label: "ID" },
        { key: "created_at", label: "Received" },
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "rating", label: "Rating" },
        { key: "service", label: "Service" },
        { key: "location", label: "Location" },
        { key: "message", label: "Review" },
        { key: "moderation", label: "Moderation" },
      ],
      rows
    );

    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="reviews.csv"');
    res.send(`\uFEFF${csv}`);
  })
);

/* --------------------------------------------------------------------------
   Submissions
   -------------------------------------------------------------------------- */

router.get(
  "/submissions/:type",
  asyncRoute(async (req, res) => {
    const type = SUBMISSION_TYPES[req.params.type];
    if (!type) return res.status(404).render("dashboard/404", { title: "Not found" });

    const filter = STATUSES.includes(req.query.status) ? req.query.status : "all";

    const [rows] = await db.execute(
      filter === "all"
        ? `SELECT * FROM ${type.table} ORDER BY created_at DESC`
        : `SELECT * FROM ${type.table} WHERE status = '${filter}' ORDER BY created_at DESC`
    );

    const [[tally]] = await db.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'new') AS new_count,
         SUM(status = 'read') AS read_count,
         SUM(status = 'handled') AS handled_count
       FROM ${type.table}`
    );

    res.render("dashboard/submissions", {
      title: `${type.label} | Alpha Hill Dashboard`,
      active: `submissions:${req.params.type}`,
      counts: await loadUnreadCounts(),
      type,
      typeSlug: req.params.type,
      rows,
      filter,
      tally,
      statuses: STATUSES,
    });
  })
);

router.post(
  "/submissions/:type/:id/status",
  verifyCsrf,
  asyncRoute(async (req, res) => {
    const type = SUBMISSION_TYPES[req.params.type];
    if (!type) return res.status(404).render("dashboard/404", { title: "Not found" });

    if (!STATUSES.includes(req.body.status)) {
      req.session.flash = { type: "error", message: "Unknown status." };
      return res.redirect(`/dashboard/submissions/${req.params.type}`);
    }

    await db.execute(`UPDATE ${type.table} SET status = ? WHERE id = ?`, [
      req.body.status,
      req.params.id,
    ]);

    res.redirect(
      safeRedirect(
        req.body.redirect_to,
        `/dashboard/submissions/${req.params.type}`
      )
    );
  })
);

router.get(
  "/submissions/:type/export.csv",
  asyncRoute(async (req, res) => {
    const type = SUBMISSION_TYPES[req.params.type];
    if (!type) return res.status(404).render("dashboard/404", { title: "Not found" });

    const [rows] = await db.execute(
      `SELECT * FROM ${type.table} ORDER BY created_at DESC`
    );

    const csv = toCsv(
      [
        { key: "id", label: "ID" },
        { key: "created_at", label: "Received" },
        ...type.columns.map((column) => ({ key: column.key, label: column.label })),
        { key: "status", label: "Status" },
      ],
      rows
    );

    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="${req.params.type}.csv"`);
    res.send(`\uFEFF${csv}`);
  })
);

router.use((req, res) => {
  res.status(404).render("dashboard/404", { title: "Not found" });
});

module.exports = router;
