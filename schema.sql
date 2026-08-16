-- Create Database
CREATE DATABASE IF NOT EXISTS alphahill_medical;
USE alphahill_medical;

-- Enquiries Table (Contact Form)
CREATE TABLE IF NOT EXISTS enquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  service VARCHAR(100),
  message TEXT NOT NULL,
  status ENUM('new','read','handled') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments Table
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Career Applications Table
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Newsletter Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('new','read','handled') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedback/Reviews Table
-- `moderation` gates public display: only 'approved' rows appear on /reviews.
-- `phone` is optional and staff-only — never shown on the public reviews page.
CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  service VARCHAR(100),
  location VARCHAR(100),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  -- Set when the reviewer ticks the box agreeing to publication.
  consent TINYINT(1) NOT NULL DEFAULT 0,
  moderation ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  moderated_at DATETIME NULL,
  status ENUM('new','read','handled') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- News & Events Table (authored from the dashboard)
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- First-party analytics. A row in `visitors` is one unique visit (cookie id).
-- Pageviews are stored only after cookie consent. IP and User-Agent are not stored.
CREATE TABLE IF NOT EXISTS visitors (
  id CHAR(36) NOT NULL PRIMARY KEY,
  first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pageviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visitor_id CHAR(36) NOT NULL,
  path VARCHAR(255) NOT NULL,
  viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pageviews_visitor (visitor_id),
  INDEX idx_pageviews_path (path),
  INDEX idx_pageviews_viewed_at (viewed_at)
);

-- Create indexes for better query performance
CREATE INDEX idx_email ON enquiries(email);
CREATE INDEX idx_phone ON enquiries(phone);
CREATE INDEX idx_app_email ON appointments(email);
CREATE INDEX idx_app_date ON appointments(date_preferred);
CREATE INDEX idx_career_email ON career_applications(email);
CREATE INDEX idx_subscription_email ON subscriptions(email);
CREATE INDEX idx_feedback_moderation ON feedback(moderation);
CREATE INDEX idx_news_status ON news(status, published_at);
