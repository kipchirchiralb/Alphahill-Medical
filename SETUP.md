# Setup

Full instructions live in [README.md](README.md) (install, `.env`, database, dashboard, deploy).

Short version:

```bash
npm install
cp .env.example .env    # fill database, SESSION_SECRET, SMTP
mysql -u root -p < schema.sql
npm start
```
