-- Alpha Hill Medical Centre — full current schema
-- A new database needs only this file. Do not run migrate.js on a fresh install.
--
--   mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS alphahill_medical
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE alphahill_medical;

-- Contact form
CREATE TABLE IF NOT EXISTS enquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  service VARCHAR(100),
  message TEXT NOT NULL,
  status ENUM('new','read','handled') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_phone (phone),
  INDEX idx_enquiries_status (status)
);

-- Appointment requests
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  date_preferred DATE NOT NULL,
  time_preferred TIME NOT NULL,
  service VARCHAR(100) NOT NULL,
  notes TEXT,
  status ENUM('new','read','handled') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_app_email (email),
  INDEX idx_app_date (date_preferred),
  INDEX idx_appointments_status (status)
);

-- Career / attachment applications
CREATE TABLE IF NOT EXISTS career_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  position VARCHAR(100) NOT NULL,
  opportunity_type VARCHAR(50),
  cover_letter TEXT,
  resume_url VARCHAR(255),
  status ENUM('new','read','handled') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_career_email (email),
  INDEX idx_career_status (status)
);

-- Newsletter
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('new','read','handled') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_subscriptions_status (status)
);

-- Reviews. Only rows with moderation = 'approved' appear on /reviews.
-- phone and email are optional and staff-only.
CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  service VARCHAR(100),
  location VARCHAR(100),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  consent TINYINT(1) NOT NULL DEFAULT 0,
  moderation ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  moderated_at DATETIME NULL,
  status ENUM('new','read','handled') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_moderation (moderation),
  INDEX idx_feedback_status (status)
);

-- News & events (dashboard CMS)
CREATE TABLE IF NOT EXISTS news (
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_news_status (status, published_at)
);

-- First-party analytics. No IP address and no User-Agent are stored.
-- One row per visitor who accepted cookies; anonymous pageviews have none.
CREATE TABLE IF NOT EXISTS visitors (
  id CHAR(36) NOT NULL PRIMARY KEY,
  first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- visitor_id is NULL for the cookieless count, which is most rows.
CREATE TABLE IF NOT EXISTS pageviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visitor_id CHAR(36) NULL,
  path VARCHAR(255) NOT NULL,
  viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pageviews_visitor (visitor_id),
  INDEX idx_pageviews_path (path),
  INDEX idx_pageviews_viewed_at (viewed_at)
);

-- Installs created before cookieless counting have visitor_id NOT NULL.
-- Re-running this on an up-to-date database changes nothing.
ALTER TABLE pageviews MODIFY visitor_id CHAR(36) NULL;

-- Dashboard OTP codes. Plaintext is emailed and never stored.
CREATE TABLE IF NOT EXISTS login_otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(120) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_email (email),
  INDEX idx_otp_hash (code_hash),
  INDEX idx_otp_expires (expires_at)
);

-- Staff sessions (also created automatically by express-mysql-session).
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
);
