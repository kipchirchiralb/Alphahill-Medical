/**
 * Brings an existing alphahill_medical database up to the current schema.
 * Safe to re-run: every statement is skipped when the change already exists.
 *
 *   node scripts/migrate.js
 */
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

// Errors that simply mean "this change was already applied".
const ALREADY_APPLIED = new Set([
  "ER_DUP_FIELDNAME",
  "ER_DUP_KEYNAME",
  "ER_TABLE_EXISTS_ERROR",
]);

const statements = [
  [
    "enquiries.status",
    "ALTER TABLE enquiries ADD COLUMN status ENUM('new','read','handled') NOT NULL DEFAULT 'new'",
  ],
  [
    "appointments.status",
    "ALTER TABLE appointments ADD COLUMN status ENUM('new','read','handled') NOT NULL DEFAULT 'new'",
  ],
  [
    "career_applications.opportunity_type",
    "ALTER TABLE career_applications ADD COLUMN opportunity_type VARCHAR(50)",
  ],
  [
    "career_applications.status",
    "ALTER TABLE career_applications ADD COLUMN status ENUM('new','read','handled') NOT NULL DEFAULT 'new'",
  ],
  [
    "subscriptions.status",
    "ALTER TABLE subscriptions ADD COLUMN status ENUM('new','read','handled') NOT NULL DEFAULT 'new'",
  ],
  ["feedback.service", "ALTER TABLE feedback ADD COLUMN service VARCHAR(100)"],
  ["feedback.location", "ALTER TABLE feedback ADD COLUMN location VARCHAR(100)"],
  [
    "feedback.moderation",
    "ALTER TABLE feedback ADD COLUMN moderation ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'",
  ],
  [
    "feedback.moderated_at",
    "ALTER TABLE feedback ADD COLUMN moderated_at DATETIME NULL",
  ],
  [
    "feedback.status",
    "ALTER TABLE feedback ADD COLUMN status ENUM('new','read','handled') NOT NULL DEFAULT 'new'",
  ],
  [
    "feedback.consent",
    "ALTER TABLE feedback ADD COLUMN consent TINYINT(1) NOT NULL DEFAULT 0",
  ],
  ["feedback.phone", "ALTER TABLE feedback ADD COLUMN phone VARCHAR(20) NULL"],
  [
    "news table",
    `CREATE TABLE IF NOT EXISTS news (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      slug VARCHAR(220) NOT NULL UNIQUE,
      category VARCHAR(60) NOT NULL DEFAULT 'Announcement',
      excerpt VARCHAR(300),
      body MEDIUMTEXT NOT NULL,
      image_url VARCHAR(255),
      image_alt VARCHAR(200),
      event_date DATE NULL,
      location VARCHAR(120),
      status ENUM('draft','published') NOT NULL DEFAULT 'draft',
      published_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  ],
  [
    "idx_feedback_moderation",
    "CREATE INDEX idx_feedback_moderation ON feedback(moderation)",
  ],
  [
    "idx_news_status",
    "CREATE INDEX idx_news_status ON news(status, published_at)",
  ],
  [
    "visitors table",
    `CREATE TABLE IF NOT EXISTS visitors (
      id CHAR(36) NOT NULL PRIMARY KEY,
      first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  ],
  [
    "pageviews table",
    `CREATE TABLE IF NOT EXISTS pageviews (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      visitor_id CHAR(36) NOT NULL,
      path VARCHAR(255) NOT NULL,
      viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pageviews_visitor (visitor_id),
      INDEX idx_pageviews_path (path),
      INDEX idx_pageviews_viewed_at (viewed_at)
    )`,
  ],
];

(async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: false,
    });
  } catch (error) {
    console.error(`Could not connect to the database: ${error.message}`);
    process.exit(1);
  }

  let applied = 0;
  let skipped = 0;

  for (const [label, sql] of statements) {
    try {
      await connection.query(sql);
      console.log(`  applied  ${label}`);
      applied += 1;
    } catch (error) {
      if (ALREADY_APPLIED.has(error.code)) {
        console.log(`  skipped  ${label} (already present)`);
        skipped += 1;
      } else {
        console.error(`  FAILED   ${label}: ${error.message}`);
        await connection.end();
        process.exit(1);
      }
    }
  }

  await connection.end();
  console.log(`\nMigration complete — ${applied} applied, ${skipped} skipped.`);
})();
