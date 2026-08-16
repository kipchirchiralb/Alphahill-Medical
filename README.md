# Alpha Hill Medical Centre — Website

Express.js + EJS + MySQL site for **Alpha Hill Medical Centre**, Mosoriot, Nandi County.

> **Tagline:** Inspiring Better Healthcare

## Run locally

```bash
npm install
cp .env.example .env   # then fill in database, SESSION_SECRET, and SMTP
mysql -u root -p < schema.sql
npm run migrate
npm start
```

Development with auto-reload: `npm run dev`

The app listens on `PORT` from `.env` (default 3000).

## Deploy checklist

1. Node.js 18 or newer.
2. MySQL database created (`schema.sql`), then `npm run migrate`.
3. `.env` on the server (never commit it). Set `NODE_ENV=production`.
4. `SESSION_SECRET` must be a long random string — not the example placeholder.
5. SMTP must work so staff can receive dashboard sign-in codes (`SMTP_*` and `MAIL_FROM=noreply@alphahillmedical.co.ke`). SMTP was verified against the current local `.env`.
6. Process manager (systemd, PM2, or the host’s Node start command): `npm start`.
7. Reverse proxy (Nginx/Caddy) with HTTPS. The app trusts `X-Forwarded-*` when `NODE_ENV=production`.
8. Uploads directory `public/uploads/` must be writable (news images). It is gitignored.

## Staff dashboard

- URL: `/dashboard` (not indexed; `robots.txt` disallows it).
- Sign-in: one-time 8-character code emailed to an authorised work address. Sessions last two days.
- Allowed emails are listed in `lib/otp.js`.

## Public routes

`/`, `/about`, `/services`, `/insurance`, `/patients`, `/news`, `/news/:slug`, `/careers`, `/contact`, `/reviews`, `/privacy`, `/cookies`

Forms post to `/api/enquiries`, `/api/appointments`, `/api/career-applications`, `/api/subscribe`, `/api/feedback`.
