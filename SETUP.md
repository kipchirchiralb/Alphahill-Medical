# Setup

## Environment

Copy `.env.example` to `.env` and fill in:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=alphahill_medical
PORT=3000
NODE_ENV=production
SESSION_SECRET=
MAIL_FROM=noreply@alphahillmedical.co.ke
MAIL_FROM_NAME=Alpha Hill Medical Centre
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
```

`SESSION_SECRET` must be a long random string in production. All system email is sent from `noreply@alphahillmedical.co.ke`.

## Database

```bash
mysql -u root -p < schema.sql
npm run migrate
```

`npm run migrate` is safe to re-run. It adds tables and columns that older databases may be missing.

## Start

```bash
npm install
npm start
```

Dashboard: `/dashboard`. Request a sign-in code with an authorised `@alphahillmedical.co.ke` address.
