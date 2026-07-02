# Alpha Hill Medical Centre — Website

A fast, fully responsive, multi-page marketing website for **Alpha Hill Medical Centre**,
a modern hospital along the Mosoriot – Kabiyet Road in Nandi County, Kenya.

> **Tagline:** Inspiring Better Healthcare

Built as a static site with plain **semantic HTML5, CSS3 and a small amount of vanilla
JavaScript** — no build step, no framework, no dependencies to install. Just open it in a
browser or drop it on any static host.

---

## ✨ Features

- **Multi-page structure** generated from the project sitemap (`stiematandcontent.md`).
- **Fully responsive** — mobile-first layouts using CSS Grid, Flexbox and fluid `clamp()`
  typography; a hamburger menu on small screens.
- **60-30-10 colour design system**
  - **60% White** (`#FFFFFF`) — page backgrounds, cards and generous white space.
  - **30% Navy Blue** (`#001F5D`) — header, footer, hero overlays, banners, headings.
  - **10% Alpha Hill Red** (`#D60015`) — buttons, links and accents only, so calls to
    action always draw the eye.
- **SEO & AIO (AI-optimised) compliant**
  - Semantic landmarks: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`,
    `<footer>`, `<address>`, `<blockquote>`.
  - Unique `<title>`, meta description, canonical URL and Open Graph tags per page.
  - **JSON-LD structured data** — `Hospital` schema on the home page and `FAQPage`
    schema on the Patients page, so search engines and AI answer engines can parse the
    facts directly.
  - `sitemap.xml` and `robots.txt` included.
  - Descriptive `alt` text on every image and an accessible skip-link.
- **Accessibility** — keyboard focus styles, `aria-current`, `aria-expanded`,
  `aria-live` form status, and `prefers-reduced-motion` support.
- **Ethical tone** — copy avoids superlatives ("best") and fear/urgency framing, and
  calls-to-action are kept minimal (one appointment action in the header, calm
  information elsewhere) in keeping with medical advertising ethics. Patient
  testimonials are intentionally omitted for the same reason.
- **Performance** — lazy-loaded images, preconnected fonts, no JS framework payload.

---

## 🗂️ Pages

| Page | File | Purpose |
|------|------|---------|
| Home | `index.html` | Hero, welcome, why-choose-us, featured services, our care team, health awareness & community, values, commitment to quality, 24-hour emergency, insurance, visit-us |
| About Us | `about.html` | Mission, vision, core values, stats, accreditations |
| Our Services | `services.html` | Directory grid + 14 detailed, anchor-linked service sections |
| Insurance | `insurance.html` | Accepted insurance partners + cash-rate information |
| Patient Information | `patients.html` | What to bring + FAQ accordion (with FAQ schema) |
| Contact Us | `contact.html` | Contact details, enquiry form and embedded map |

The 14 services on `services.html` use `id` anchors matching the sitemap
(e.g. `services.html#icu`, `services.html#maternity`, `services.html#ct-scan`, …) so they
are deep-linkable from anywhere on the site.

---

## 📁 Project structure

```
Alphahill Medical/
├── index.html
├── about.html
├── services.html
├── insurance.html
├── patients.html
├── contact.html
├── robots.txt
├── sitemap.xml
├── README.md
├── stiematandcontent.md              # source sitemap + copy
├── alphahill_logo_white_transparent.png   # header/footer logo (white, on navy)
├── alphahillmedicallogo.png               # favicon / colour logo
├── assets/
│   ├── css/
│   │   └── styles.css                 # single shared stylesheet (design system)
│   └── js/
│       └── main.js                    # mobile menu, scroll reveal, form, footer year
└── images/                            # all photography (JPEG)
```

---

## 🚀 Running locally

No build tools are required.

**Option 1 — open directly**
Double-click `index.html`.

**Option 2 — local web server** (recommended, so the embedded map and relative paths
behave exactly as in production):

```bash
# Python 3
python -m http.server 8000
# then visit http://localhost:8000
```

```bash
# Node (if you have it)
npx serve .
```

---

## 🎨 Customising the design

All colours, spacing, radii and shadows are defined as CSS custom properties at the top of
`assets/css/styles.css`:

```css
:root {
  --navy: #001f5d;   /* 30% — structure */
  --red:  #d60015;   /* 10% — accents/CTAs */
  --white:#ffffff;   /* 60% — backgrounds */
  /* … */
}
```

Change a value once and it updates everywhere. The 60-30-10 balance is maintained by using
white as the default page background, navy only for the header/footer/banner blocks
(`.section--navy`) and red exclusively for `.btn--primary`, links and accent rules.

---

## 📝 Notes

- The **enquiry form** is front-end only — on submit it shows a confirmation message and
  resets. Wire the `#enquiry-form` handler in `assets/js/main.js` to your backend, a form
  service (e.g. Formspree) or an email endpoint to receive real submissions.
- Update the domain in the canonical/Open Graph tags and `sitemap.xml` if the live site
  uses a different URL than `https://www.alphahillmedical.or.ke/`.
- Image filenames contain spaces; these are referenced as-is in the HTML and are handled
  correctly by browsers. Renaming them to hyphenated slugs is optional but tidier.

---

## 📄 Content source

All copy is drawn from **`stiematandcontent.md`**, the single source of truth for the site
map, page content and colour palette.

© Alpha Hill Medical Centre. Accredited by **SHA · KMPDC · NCK · PPB**.
