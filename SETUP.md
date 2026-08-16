# Alpha Hill Medical Centre - Express.js + EJS Project

## Project Structure

```
.
├── server.js                 # Main Express server
├── package.json             # Dependencies
├── .env                      # Environment variables
├── .gitignore               # Git ignore file
├── schema.sql               # Database schema
├── config/
│   └── database.js          # Database connection
├── routes/
│   ├── pages.js             # Page routes (renders EJS templates)
│   └── api.js               # API routes (form submissions)
├── views/
│   ├── index.ejs            # Homepage
│   ├── about.ejs            # About page
│   ├── services.ejs         # Services page
│   ├── insurance.ejs        # Insurance page
│   ├── patients.ejs         # Patient info page
│   ├── news.ejs             # News & Events page
│   ├── careers.ejs          # Careers page (with form)
│   ├── contact.ejs          # Contact page (with form)
│   ├── reviews.ejs          # Reviews page (with form)
│   └── partials/
│       ├── header.ejs       # Header partial
│       └── footer.ejs       # Footer partial
├── public/                  # Static files (CSS, JS, images)
│   ├── assets/css/
│   ├── assets/js/
│   └── images/
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Create MySQL Database

```bash
mysql -u root -p < schema.sql
```

### 3. Configure Environment Variables

Edit `.env` file with your database credentials:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=alphahill_medical
PORT=3000
NODE_ENV=development
```

### 4. Start the Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

Server will run on `http://localhost:3000`

## Routes

### Pages (Render EJS Templates)

- `GET /` - Homepage
- `GET /about` - About Us
- `GET /services` - Services
- `GET /insurance` - Insurance Partners
- `GET /patients` - Patient Information
- `GET /news` - News & Events
- `GET /careers` - Careers
- `GET /contact` - Contact Us
- `GET /reviews` - Reviews & Feedback

### API Endpoints (Form Submissions)

- `POST /api/enquiries` - Contact form submission
- `POST /api/appointments` - Appointment booking
- `POST /api/career-applications` - Career application
- `POST /api/subscribe` - Newsletter subscription
- `POST /api/feedback` - Review/feedback submission

## Database Tables

1. **enquiries** - Contact form submissions
2. **appointments** - Appointment bookings
3. **career_applications** - Job applications
4. **subscriptions** - Newsletter subscribers
5. **feedback** - Reviews and feedback

All tables include timestamps and indexed columns for better performance.

## Form Submission Example

Each form submission sends a POST request to the corresponding API endpoint:

```javascript
const response = await fetch("/api/enquiries", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(formData),
});
```

The server validates the data, inserts it into the database, and returns a JSON response.
