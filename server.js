const express = require("express");
const dotenv = require("dotenv");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");

// Load environment variables before anything reads process.env.
dotenv.config();

const { noIndexNoTrack } = require("./middleware/privacy");
const { trackPageview } = require("./middleware/analytics");
const {
  publicSecurityHeaders,
  assertSessionSecret,
  assertDatabaseEnv,
} = require("./middleware/security");
const { SESSION_MS } = require("./lib/otp");
const { isConfigured: isMailConfigured } = require("./lib/mailer");

assertDatabaseEnv();
assertSessionSecret();

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Required for secure cookies and correct req.ip when behind a reverse proxy.
if (isProduction) {
  app.set("trust proxy", 1);
}

// Set view engine to EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Sessions live in MySQL so staff stay signed in across restarts and the
// server does not accumulate sessions in memory.
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
});

app.use(
  session({
    name: "ahmc.sid",
    secret: process.env.SESSION_SECRET || "change-me-in-env",
    store: sessionStore,
    resave: false,
    rolling: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: SESSION_MS,
    },
  }),
);

app.use(publicSecurityHeaders);
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: isProduction ? "7d" : 0,
    etag: true,
  })
);

// First-party pageviews only run after cookie consent, and never on the
// dashboard or static assets.
app.use(trackPageview);

// Routes
// The dashboard is mounted with headers that keep it out of search engines and
// block the outbound requests any tracking script would need.
app.use("/dashboard", noIndexNoTrack, require("./routes/dashboard"));
app.use("/", require("./routes/pages"));
app.use("/api", require("./routes/api"));

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith("/dashboard")) {
    return res.status(404).render("dashboard/404", { title: "Not found" });
  }
  res.status(404).render("404", {
    title: "Page not found | Alpha Hill Medical Centre",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (req.path.startsWith("/api")) {
    return res.status(500).json({ error: "Something went wrong" });
  }

  res.status(500).send("Something went wrong!");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Dashboard available at http://localhost:${PORT}/dashboard`);
  if (!isMailConfigured()) {
    console.warn(
      "SMTP is not configured. Dashboard sign-in codes cannot be emailed until SMTP_HOST, SMTP_USER and SMTP_PASS are set."
    );
  }
});
