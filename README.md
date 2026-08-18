# Alpha Hill Medical Centre

Website and staff dashboard for **Alpha Hill Medical Centre**, a hospital in Mosoriot, Nandi County, Kenya.

> Inspiring Better Healthcare · Open 24 / 7

Live domain: [alphahillmedical.co.ke](https://alphahillmedical.co.ke)

---

## What this is

A Node.js app that serves the public marketing site and a private `/dashboard` for staff.

Visitors can read about the hospital, book an appointment, send an enquiry, subscribe, apply for work, and leave a review. Staff sign in with a one-time email code to publish news, approve reviews, and follow up on submissions.

There is no static HTML site anymore. Pages are EJS templates rendered by Express. Data lives in MySQL.

---

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 18+ |
| Server | Express 4 |
| Templates | EJS |
| Database | MySQL (`mysql2`) |
| Sessions | `express-session` stored in MySQL |
| Mail | Nodemailer (OTP sign-in codes) |
| Front end | Custom CSS + vanilla JS (no React, no CSS framework) |

---

## Features

**Public site**
- Pages for home, about, services, insurance, patients, news, careers, contact, reviews, privacy, and cookies
- Mobile nav (hamburger becomes an X when open)
- Floating WhatsApp button on every public page
- Cookie banner (slides in; Accept starts first-party visit counts, Decline does not)
- Forms show a popup on success or error
- Reviews appear on `/reviews` only after staff approval
- News & events are written in the dashboard and published to `/news`

**Staff dashboard** (`/dashboard`)
- Not indexed (`noindex`, `robots.txt` Disallow)
- Email OTP sign-in (8-character code, 10 minutes, one use)
- Sessions last two days
- News CRUD with image upload
- Review moderation (pending → approved / rejected)
- Submissions inbox (enquiries, appointments, applications, newsletter) with status and CSV export
- Statistics page: cookieless pageview counts, trend chart, top pages, time of day (never counts dashboard pages)
- Responsive: sidebar drawer + hamburger below 960px

---

## Requirements

- Node.js 18 or newer
- MySQL 8 (or MariaDB with the same SQL)
- SMTP account that can send as `noreply@alphahillmedical.co.ke`

---

## Quick start

```bash
npm install
cp .env.example .env
```

Edit `.env` (database, `SESSION_SECRET`, SMTP). Then:

```bash
mysql -u root -p < schema.sql
npm start
```

Open [http://localhost:3000](http://localhost:3000). Dashboard: [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

| Script | What it does |
| --- | --- |
| `npm start` | Run `server.js` |
| `npm run dev` | Same, with `node --watch` |

---

## Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`.**

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection (`alphahill_medical`) |
| `PORT` | HTTP port (default `3000`) |
| `NODE_ENV` | `development` or `production` |
| `SESSION_SECRET` | Long random string. Production **will not start** if this is missing or still a placeholder |
| `MAIL_FROM` | From-address for system mail (`noreply@alphahillmedical.co.ke`) |
| `MAIL_FROM_NAME` | From-name (`Alpha Hill Medical Centre`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Mail server (`587` + `false`, or `465` + `true`) |
| `SMTP_USER`, `SMTP_PASS` | SMTP login |

In production the app sets `trust proxy` so secure cookies work behind Nginx/Caddy/HTTPS.

---

## Project layout

```
.
├── server.js                 # Express entry: sessions, static files, routes
├── schema.sql                # Full schema for a new database
├── package.json
├── .env.example
├── config/database.js        # mysql2 pool
├── routes/
│   ├── pages.js              # Public page renders
│   ├── api.js                # Public form POST endpoints
│   └── dashboard.js          # Staff UI + writes
├── middleware/
│   ├── auth.js               # Session, CSRF, login throttle
│   ├── privacy.js            # Dashboard noindex + strict CSP
│   ├── security.js           # Public security headers
│   └── analytics.js          # Cookieless pageview recording, bot filter
├── lib/
│   ├── otp.js                # Allowed emails, codes, 2-day session length
│   ├── mailer.js             # Nodemailer
│   ├── analytics.js          # Consent cookies + stats and report queries
│   └── helpers.js            # Slugs, dates, CSV, HTML escape
├── views/                    # EJS (public pages + views/dashboard/)
├── public/                   # CSS, JS, images, robots.txt, sitemap.xml
│   └── uploads/              # News images (gitignored, must be writable)
└── docs/                     # Design notes and original content sitemap
```

---

## Public pages

| Path | Template | Notes |
| --- | --- | --- |
| `/` | `views/index.ejs` | Home |
| `/about` | `views/about.ejs` | Mission, values, training |
| `/services` | `views/services.ejs` | Departments |
| `/insurance` | `views/insurance.ejs` | Partners |
| `/patients` | `views/patients.ejs` | FAQs + appointment form |
| `/news` | `views/news.ejs` | Published posts |
| `/news/:slug` | `views/news-post.ejs` | Single post |
| `/careers` | `views/careers.ejs` | Applications |
| `/contact` | `views/contact.ejs` | Enquiry form + map |
| `/reviews` | `views/reviews.ejs` | Form + approved quotes |
| `/privacy` | `views/privacy.ejs` | Draft for legal review |
| `/cookies` | `views/cookies.ejs` | Draft for legal review |

Shared chrome: `views/partials/public-header.ejs` and `public-footer.ejs` (WhatsApp button and cookie banner live in the footer).

### Form APIs

All public POSTs are JSON, rate-limited, and land in the dashboard.

| Endpoint | Form | Stored in |
| --- | --- | --- |
| `POST /api/enquiries` | Contact | `enquiries` |
| `POST /api/appointments` | Patients | `appointments` |
| `POST /api/career-applications` | Careers | `career_applications` |
| `POST /api/subscribe` | Footer newsletter | `subscriptions` |
| `POST /api/feedback` | Reviews | `feedback` (`moderation = pending`) |
| `POST /api/consent` | Cookie banner | Cookies only (`ahmc_consent`, optional `ahmc_vid`) |

Review phone and email are optional. Approved reviews show name (shortened), rating, and message — never phone or email.

---

## Staff dashboard

URL: `/dashboard`. Search engines are told not to index it.

### Sign-in

1. Enter an authorised work email.
2. Receive an 8-character code (hashed in `login_otps`, valid 10 minutes, one use).
3. Stay signed in for **two days**.

Authorised addresses (edit `lib/otp.js` to change the list):

- `info@alphahillmedical.co.ke`
- `enos@alphahillmedical.co.ke`
- `doreen@alphahillmedical.co.ke`
- `kiprotich@alphahillmedical.co.ke`
- `janet@alphahillmedical.co.ke`
- `albert@alphahillmedical.co.ke`

Unlisted addresses get the same “if this address is authorised, we sent a code” message so the list is not leaked. There is no password login.

### What staff can do

| Area | Path |
| --- | --- |
| Overview (headline figures, recent activity) | `/dashboard` |
| Statistics (trend chart, top pages, time of day; `?days=7\|30\|90\|365`) | `/dashboard/analytics` |
| News & events (draft / publish, image upload) | `/dashboard/news` |
| Reviews (approve or reject) | `/dashboard/reviews` |
| Enquiries, appointments, applications, subscribers | `/dashboard/submissions/:type` |

Dashboard writes use CSRF tokens. Login attempts are throttled by IP.

---

## Database

`schema.sql` is the full current schema. For a **new** database that is the only SQL you need:

```bash
mysql -u root -p < schema.sql
```

| Table | Role |
| --- | --- |
| `enquiries` | Contact form |
| `appointments` | Appointment requests |
| `career_applications` | Job / attachment applications |
| `subscriptions` | Newsletter |
| `feedback` | Reviews (`moderation`: pending / approved / rejected) |
| `news` | Posts from the dashboard |
| `visitors`, `pageviews` | First-party analytics (`pageviews.visitor_id` is NULL unless the visitor opted in) |
| `login_otps` | Hashed sign-in codes |
| `sessions` | Staff login sessions |

Databases created before cookieless counting have `pageviews.visitor_id NOT NULL`. Re-running `schema.sql` fixes it, or apply the one statement directly:

```sql
ALTER TABLE pageviews MODIFY visitor_id CHAR(36) NULL;
```

---

## Privacy and tracking

- No Google Analytics, Facebook Pixel, Hotjar, or similar.
- Pageviews are counted for everyone with no cookie: each row is a path and a timestamp, nothing else. No consent needed, and nothing that identifies a person is stored.
- Optional first-party cookies: `ahmc_consent` (choice; 12 months on accept, 3 months on decline) and `ahmc_vid` (random visitor id, only after Accept).
- Decline: no visitor id, so no unique-visitor or visit figures for that browser. The anonymous page count continues.
- Never counted: the dashboard, `/api`, static files, non-HTML and non-2xx responses, known crawlers and scripted clients, and browser prefetches.
- IP addresses and User-Agent strings are not stored. The User-Agent is only tested in memory to filter bots.
- Unique visitors and visits cover the opted-in subset only. The statistics page shows the opt-in rate beside them so they are not mistaken for whole-site totals.

---

## Deploy

1. Node 18+ and MySQL.
2. `npm install --omit=dev`
3. `.env` on the server with `NODE_ENV=production` and a real `SESSION_SECRET`.
4. Import `schema.sql` into an empty MySQL database.
5. SMTP working (dashboard login depends on it).
6. `public/uploads/` writable.
7. `npm start` under systemd, PM2, or the host’s Node runner.
8. HTTPS reverse proxy. The app listens on `0.0.0.0:$PORT`.

Static files are cached for 7 days when `NODE_ENV=production`.

---

## Design tokens

Public site (do not change without a brand decision):

- Navy `#001F5D`
- Red `#D60015`
- White / grey surfaces
- Type: Manrope (Google Fonts) on public pages only — the dashboard uses system fonts and makes no outbound requests.
