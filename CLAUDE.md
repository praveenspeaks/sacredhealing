# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Project

```bash
npm start          # production — node server.js on port 3000
npm run dev        # development — nodemon server.js (auto-restart on changes)
```

Requires a `.env` file for optional configuration:

```dotenv
PORT=3000
ADMIN_PASSWORD=sacred2024        # default fallback; override in production
STRIPE_SECRET_KEY=sk_live_...    # required for paid sessions; omit for free-only
BASE_URL=https://yourdomain.com        # required for Stripe redirect URLs in production
ALLOWED_ORIGIN=https://yourdomain.com  # restricts CORS; omit to allow all origins (dev only)
DB_PATH=data/sacredhealing.db          # default path
SMTP_HOST=smtp.gmail.com               # email notifications (all SMTP_* required to enable)
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Sacred Healing" <you@gmail.com>
ADMIN_EMAIL=reena@example.com          # receives new booking alerts
```

Access points:

- Frontend: `http://localhost:3000/`
- Admin panel: `http://localhost:3000/admin`
- FAQ page: `http://localhost:3000/faq.html`
- Service detail page: `http://localhost:3000/services/<slug>`

## Architecture

**Stack:** Vanilla HTML/CSS/JS frontend + Express.js backend + SQLite (better-sqlite3) database. No build step — all files are served statically by Express itself (`express.static(__dirname)`).

### File roles

| File | Role |
| ---- | ---- |
| `server.js` | Express server, booking API, Stripe integration, admin API |
| `cms.js` | CMS module — `init(db, app, requireAdmin)` registers DB tables & API routes for content/services/reviews/FAQs |
| `index.html` | Main public page (single-page with anchor sections) |
| `admin.html` | Admin SPA (self-contained, all styles/scripts inline) |
| `faq.html` | FAQ page populated dynamically via CMS API |
| `service.html` | Service detail page, loaded by `/services/:slug` route |
| `script.js` | Frontend JS: particles animation, navbar, booking modal, slot rendering |
| `cms_frontend.js` | Fetches `/api/content` on load and populates the DOM — services grid, testimonials slider, FAQ container |
| `cms_admin.js` | Admin panel JS: dashboard stats, slot/booking/content/service/review management |
| `style.css` | All public-facing styles (CSS custom properties, dark theme) |

### Database tables (SQLite)

- `slots` — available time slots (date, time, duration, price, currency, is_booked)
- `bookings` — customer bookings linked to slots (status: pending / confirmed / cancelled)
- `site_content` — key-value CMS content (hero text, images, contact info)
- `services` — healing service listings (title, description, features JSON, price, duration, extra_details JSON)
- `reviews` — customer reviews (status: pending / approved)
- `faqs` — FAQ entries

### Admin authentication

Simple password header: `x-admin-password: <ADMIN_PASSWORD>`. The login endpoint (`POST /api/admin/login`) returns the password itself as the token — stored in `sessionStorage` on the admin panel.

### CMS content binding

`cms_frontend.js` maps `site_content` keys directly to DOM element IDs. Elements with `id="hero_title"` etc. are auto-populated. Image elements use `.src`, background images use `.style.backgroundImage`, everything else uses `.innerHTML`.

### Stripe flow

Only activates when `slot.price > 0` AND `STRIPE_SECRET_KEY` starts with `sk_`. On success/cancel, Stripe redirects to `/api/bookings/success?session_id=...` or `/api/bookings/cancel?session_id=...` which update booking status and redirect to `/?booking=success` or `/?booking=cancel`. The frontend detects these URL params on `DOMContentLoaded`.
