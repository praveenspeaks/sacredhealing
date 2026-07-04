# 6R Ascension — Website & Booking System

A full-featured spiritual healing practice website built with **vanilla HTML/CSS/JS** on the frontend and **Node.js + Express + PostgreSQL** on the backend. No build step required — all files are served statically by Express.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Local Development Setup](#local-development-setup)
4. [Environment Variables](#environment-variables)
5. [Database Setup (PostgreSQL)](#database-setup-postgresql)
6. [SQL Script — Fresh Database](#sql-script--fresh-database)
7. [SMTP Email Setup](#smtp-email-setup)
8. [Vercel Deployment](#vercel-deployment)
9. [EasyPanel / Docker Deployment](#easypanel--docker-deployment)
10. [Admin Panel](#admin-panel)
11. [Stripe Payments](#stripe-payments)
12. [File Upload & Persistent Storage](#file-upload--persistent-storage)
13. [SEO & Sitemap](#seo--sitemap)
14. [Security Checklist](#security-checklist)
15. [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Backend | Node.js 18+, Express 4 |
| Database | PostgreSQL (via `pg` Pool) |
| Payments | Stripe Checkout |
| Email | Nodemailer (SMTP) with iCal calendar invites |
| Hosting | EasyPanel (Docker) or Vercel + Neon/Supabase |
| File uploads | Multer — stored to `/data/uploads` |

---

## Project Structure

```
6rascension/
├── server.js          # Express server — all API routes, Stripe, admin auth
├── cms.js             # CMS module — DB tables, content/services/reviews/FAQs API
├── db.js              # PostgreSQL pool (reads DATABASE_URL from env)
├── mailer.js          # Email sending — booking confirmations, cancellations, enquiries
├── cms_frontend.js    # Frontend JS — fetches /api/content, populates DOM
├── cms_admin.js       # Admin panel JS — all dashboard logic
├── booking-widget.js  # Booking flow JS — slot picker, form, Stripe redirect
├── script.js          # Particles animation, navbar, misc frontend
├── cookie-banner.js   # Cookie consent banner (also served in-memory from server.js)
├── style.css          # All public styles (CSS custom properties, dark theme)
├── index.html         # Main public page
├── admin.html         # Admin SPA (login + full dashboard)
├── about.html         # About Reena page
├── faq.html           # FAQ page
├── service.html       # Individual service detail page (loaded via /services/:slug)
├── services.html      # All services listing page
├── philosophy.html    # Our Philosophy page
├── story.html         # Our Story page
├── process.html       # How It Works page
├── testimonials.html  # Testimonials page
├── contact.html       # Contact page
├── resources.html     # Free Resources page (blog-style posts)
├── cancellation.html  # Cancellation Policy page
├── disclaimer.html    # Legal Disclaimer page
├── Dockerfile         # Docker image (node:18-alpine)
├── .env               # Environment variables (create this — never commit)
└── assets/            # Images, logo, etc.
```

---

## Local Development Setup

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **PostgreSQL 14+** — [postgresql.org](https://www.postgresql.org/download/) or use a free cloud DB (see below)
- **Git**

### Steps

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd sacredhealing

# 2. Install dependencies
npm install

# 3. Create your .env file (see Environment Variables section below)
cp .env.example .env
# Edit .env with your values

# 4. Set up the database
#    Create a PostgreSQL database, then set DATABASE_URL in .env
#    Tables are created automatically on first run (see initDatabase in server.js)

# 5. Start development server (auto-restarts on file changes)
npm run dev

# 6. Visit the site
#    Frontend:   http://localhost:3000/
#    Admin:      http://localhost:3000/admin
#    FAQ:        http://localhost:3000/faq.html
```

### Install PostgreSQL locally (macOS / Linux / Windows)

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb 6rascension
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb 6rascension
```

**Windows:** Download the installer from [postgresql.org](https://www.postgresql.org/download/windows/) and use pgAdmin or psql to create the database.

---

## Environment Variables

Create a `.env` file in the project root. **Never commit this file** (it is already in `.gitignore`).

```dotenv
# ── Server ─────────────────────────────────────────────────────
PORT=3000

# ── Database ────────────────────────────────────────────────────
# Local example:
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/6rascension
# Cloud example (Neon / Supabase / Railway):
# DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# ── Admin ───────────────────────────────────────────────────────
ADMIN_PASSWORD=change-me-before-deploying
# Used as the single admin login password. Change this immediately.

# ── CORS ────────────────────────────────────────────────────────
ALLOWED_ORIGIN=https://yourdomain.com
# Restrict API access to your domain. Leave empty to allow all (dev only).

# ── Base URL (required for Stripe redirects) ────────────────────
BASE_URL=https://yourdomain.com

# ── Stripe (omit if not using paid sessions) ───────────────────
STRIPE_SECRET_KEY=sk_live_...
# Use sk_test_... for testing. Paid sessions only activate when this
# key starts with "sk_" AND the slot price > 0.

# ── Email (SMTP) ─────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false               # true for port 465 (SSL), false for 587 (STARTTLS)
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password     # Gmail: use App Password, not your account password
SMTP_FROM="6R Ascension" <you@gmail.com>
ADMIN_EMAIL=admin@yourdomain.com  # receives new booking alerts

# ── File Uploads ─────────────────────────────────────────────────
UPLOAD_DIR=/data/uploads         # where uploaded images are stored (Docker volume)
# For local dev, you can omit this — defaults to ./uploads
```

### Variable reference table

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PORT` | No | `3000` | HTTP port |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `ADMIN_PASSWORD` | **Yes** | `sacred2024` (insecure!) | Admin panel login |
| `BASE_URL` | For Stripe | — | Domain for Stripe success/cancel redirect URLs |
| `ALLOWED_ORIGIN` | No | All origins | CORS restriction |
| `STRIPE_SECRET_KEY` | For paid sessions | — | Stripe API key |
| `SMTP_HOST` | For email | — | SMTP server hostname |
| `SMTP_PORT` | For email | — | SMTP port (587 or 465) |
| `SMTP_SECURE` | For email | `false` | TLS mode |
| `SMTP_USER` | For email | — | SMTP login username |
| `SMTP_PASS` | For email | — | SMTP login password / app password |
| `SMTP_FROM` | For email | `noreply@6rascension.com` | From address in emails |
| `ADMIN_EMAIL` | For email | — | Receives booking alert emails |
| `UPLOAD_DIR` | No | `./uploads` | Image upload directory |

---

## Database Setup (PostgreSQL)

The app **automatically creates all tables on startup** via `initDatabase()` in `server.js`. You only need to:

1. Create an empty PostgreSQL database
2. Set `DATABASE_URL` in your `.env`
3. Run `npm start` — tables are created on first boot

### Free cloud PostgreSQL options

| Provider | Free tier | URL format |
|----------|-----------|------------|
| [Neon](https://neon.tech) | 0.5 GB, always free | `postgresql://user:pass@host/db?sslmode=require` |
| [Supabase](https://supabase.com) | 500 MB, pauses after 1 week inactivity | `postgresql://postgres:pass@host:5432/postgres` |
| [Railway](https://railway.app) | $5 credit/month free | `postgresql://user:pass@host:5432/db` |
| [Render](https://render.com) | 90-day free PostgreSQL | `postgresql://user:pass@host/db` |

> **Tip for Neon/Supabase:** Add `?sslmode=require` to your connection string. The app's `db.js` auto-detects `sslmode=disable` and adjusts SSL accordingly.

---

## SQL Script — Fresh Database

If you need to recreate the database from scratch (e.g., migrating to a new server), run this script **after** the app has started once (which creates all tables), then re-import your data.

### Step 1 — Export existing data

```bash
# Export all tables from your current database
pg_dump \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  -t slots \
  -t bookings \
  -t bulk_bookings \
  -t site_content \
  -t services \
  -t reviews \
  -t faqs \
  -t resources \
  "$DATABASE_URL" \
  > 6rascension_backup.sql
```

### Step 2 — Create new database & schema

Start the app against the new database once — it runs `initDatabase()` automatically, creating all tables. Then stop it.

```bash
# On the new server / environment
DATABASE_URL=postgresql://user:pass@newhost/newdb node -e "
const pool = require('./db');
require('./server'); // triggers initDatabase
setTimeout(() => process.exit(0), 5000);
"
```

Or simply `npm start` and let it connect — tables are created on startup.

### Step 3 — Import your data

```bash
psql "$NEW_DATABASE_URL" < 6rascension_backup.sql
```

### Complete table reference

| Table | Purpose |
|-------|---------|
| `slots` | Available booking time slots |
| `bookings` | Individual customer bookings (linked to a slot) |
| `bulk_bookings` | Multi-session package bookings |
| `site_content` | CMS key-value store (all editable text, images, nav config) |
| `services` | Healing service listings with pricing variants |
| `reviews` | Customer testimonials (pending / approved) |
| `faqs` | FAQ entries |
| `resources` | Free Resources posts (text, links, YouTube embeds) |

### Column overview — key tables

```sql
-- slots
id, date (TEXT 'YYYY-MM-DD'), time (TEXT 'HH:MM'), duration (min),
price (NUMERIC), currency (TEXT), note, is_booked (0/1), created_at

-- bookings
id, slot_id (FK → slots), service, customer_name, customer_email,
customer_phone, message, status (pending/confirmed/cancelled),
cancel_token, timezone, session_reason, pre_session_notes,
referral_source, prior_healing, session_type,
bulk_booking_id (FK → bulk_bookings), created_at

-- bulk_bookings
id, service, customer_name, customer_email, customer_phone,
session_count, price_per_session, total_price, currency,
status (pending_payment/confirmed/cancelled),
stripe_session_id, booking_ref, created_at

-- site_content
key (PRIMARY KEY TEXT), value (TEXT)
-- Key examples: logo_main_text, hero_title, contact_email,
--               footer_copyright, nav_config (JSON), ...

-- services
id, title, description, features (JSON array), duration, price,
package_price, order_num, extra_details (JSON), image_url

-- resources
id, title, body, link_url, link_label, youtube_url,
published (BOOLEAN), sort_order, created_at
```

---

## SMTP Email Setup

The site sends emails for:
- **Booking confirmation** — sent to customer when booking is confirmed
- **Admin alert** — sent to `ADMIN_EMAIL` when a new booking arrives
- **Cancellation** — sent to customer when admin cancels a booking
- **Contact enquiry** — sent to admin when someone submits the contact form
- **Calendar invites** — `.ics` attachment included in all booking emails

### Option 1 — Gmail (simplest)

1. Enable **2-Step Verification** on your Google account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Create an App Password (select "Mail" + "Other")
4. Use the 16-character app password as `SMTP_PASS`

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=abcd efgh ijkl mnop   # the 16-char app password (spaces optional)
SMTP_FROM="6R Ascension" <your@gmail.com>
ADMIN_EMAIL=your@gmail.com
```

### Option 2 — Outlook / Microsoft 365

```dotenv
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@outlook.com
SMTP_PASS=your-password
```

### Option 3 — SendGrid (high volume)

1. Create a [SendGrid](https://sendgrid.com) account (free: 100 emails/day)
2. Get an API key from Settings → API Keys
3. Use SMTP relay:

```dotenv
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey          # literally the word "apikey"
SMTP_PASS=SG.your-api-key-here
```

### Option 4 — Amazon SES

```dotenv
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

### Test email

In the Admin panel → **Settings** → click **Send Test Email**. This sends a test message to `ADMIN_EMAIL` to confirm your SMTP settings work.

---

## Vercel Deployment

> **Important:** Vercel is a serverless platform. This Express app works on Vercel via serverless functions, but with limitations: file uploads won't persist between requests (use Cloudinary or S3 instead), and you need an external PostgreSQL database (Neon recommended).

### Step 1 — Set up external PostgreSQL

Use [Neon](https://neon.tech) (free, Vercel-integrated):

1. Create a Neon project at neon.tech
2. Copy your connection string: `postgresql://user:pass@host/db?sslmode=require`

### Step 2 — Create `vercel.json`

Create this file in the project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ]
}
```

### Step 3 — Deploy

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Step 4 — Set environment variables on Vercel

```bash
vercel env add DATABASE_URL
vercel env add ADMIN_PASSWORD
vercel env add BASE_URL
vercel env add ALLOWED_ORIGIN
vercel env add STRIPE_SECRET_KEY    # if using paid sessions
vercel env add SMTP_HOST
vercel env add SMTP_PORT
vercel env add SMTP_SECURE
vercel env add SMTP_USER
vercel env add SMTP_PASS
vercel env add SMTP_FROM
vercel env add ADMIN_EMAIL
```

Or set them all in the [Vercel Dashboard](https://vercel.com/dashboard) → your project → Settings → Environment Variables.

### Step 5 — Redeploy after setting env vars

```bash
vercel --prod
```

### Vercel limitations to be aware of

| Feature | Vercel behaviour |
|---------|-----------------|
| File uploads | Use Cloudinary/S3 — filesystem is read-only in serverless |
| Persistent processes | None — each request is stateless |
| Background jobs | Not supported natively — use Vercel Cron Jobs or an external scheduler |
| WebSockets | Not supported |

---

## EasyPanel / Docker Deployment

This is the **recommended production setup** — full filesystem support, persistent uploads, background processes.

### Step 1 — Create the service in EasyPanel

1. In EasyPanel, create a new **App** from this Git repository
2. EasyPanel will detect the `Dockerfile` automatically
3. Set the **Port** to `3000`

### Step 2 — Add a PostgreSQL service

In EasyPanel, add a **PostgreSQL** service. EasyPanel generates the connection string — copy it as `DATABASE_URL`.

### Step 3 — Set environment variables in EasyPanel

In your app settings → **Environment**:

```
DATABASE_URL=postgresql://...
ADMIN_PASSWORD=your-secure-password
BASE_URL=https://yourdomain.com
ALLOWED_ORIGIN=https://yourdomain.com
STRIPE_SECRET_KEY=sk_live_...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=6R Ascension <you@gmail.com>
ADMIN_EMAIL=admin@yourdomain.com
UPLOAD_DIR=/data/uploads
```

### Step 4 — Attach a persistent volume

In EasyPanel → your app → **Mounts**:

- Mount path: `/data/uploads`
- Size: 1–5 GB (images)

This ensures uploaded images survive redeployments.

### Step 5 — Set up a custom domain

In EasyPanel → your app → **Domains** → add your domain and enable HTTPS.

### Step 6 — Deploy

Click **Deploy** in EasyPanel. The app will build the Docker image and start. Tables are created automatically on first boot.

---

## Admin Panel

Access: `https://yourdomain.com/admin`

**Login:** Use the `ADMIN_PASSWORD` value from your `.env`.

### Admin features

| Section | What you can do |
|---------|----------------|
| Dashboard | View booking stats, recent bookings, quick actions |
| Manage Slots | Create/edit/delete booking time slots; set price, duration, currency |
| Bookings | View all bookings, confirm/cancel, send emails |
| Bulk Bookings | View/manage multi-session package bookings |
| Site Content | Edit all text (hero, about, philosophy, 6R's, footer, etc.), upload images |
| FAQ | Add/edit/delete FAQ entries |
| Services | Add/edit/delete healing service listings with pricing variants |
| Reviews | Approve or reject customer testimonials |
| Navigation | Control which sections appear on home/own page/hidden; set nav labels |
| Free Resources | Create posts with text, links, and YouTube videos (public-facing blog) |
| Theme & Fonts | Toggle dark/light theme, change fonts |
| Settings | Test email, view system info |
| Help & Guide | In-app documentation |

### How admin authentication works

The admin uses a simple **password header** scheme: `x-admin-password: <ADMIN_PASSWORD>`. The login page sends `POST /api/admin/login` and stores the password in `sessionStorage`. There is no JWT or session cookie — keep `ADMIN_PASSWORD` strong and change the default before deploying.

---

## Stripe Payments

Stripe activates **only when**:
1. `STRIPE_SECRET_KEY` starts with `sk_` (real key provided)
2. The booked slot has `price > 0`

Free slots skip Stripe entirely.

### Test mode setup

1. Create a [Stripe account](https://stripe.com)
2. Get test keys from Dashboard → Developers → API keys
3. Set `STRIPE_SECRET_KEY=sk_test_...` in `.env`
4. Test card: `4242 4242 4242 4242`, any future expiry, any CVC

### Live mode

Replace `sk_test_` key with `sk_live_` key. Set `BASE_URL` to your production domain.

### Payment flow

```
Customer selects paid slot
  → POST /api/bookings (creates pending booking)
  → Stripe Checkout session created
  → Customer redirected to Stripe
  → On success → GET /api/bookings/success?session_id=...
                → Booking marked confirmed, email sent
  → On cancel  → GET /api/bookings/cancel?session_id=...
                → Booking marked cancelled, slot released
```

---

## File Upload & Persistent Storage

Admin-uploaded images (logo, hero background, healer photo, service images) are stored at `UPLOAD_DIR` (default: `./uploads`).

### Docker / EasyPanel

Mount a named volume at `/data/uploads` so images persist across deployments (see EasyPanel setup above).

### Vercel

The serverless filesystem is **read-only**. Use [Cloudinary](https://cloudinary.com) (free tier: 25 GB):

1. Create a Cloudinary account
2. Add a Cloudinary upload route in `server.js` using `cloudinary` npm package
3. Store the returned URL in `site_content` instead of a local path

---

## SEO & Sitemap

### Sitemap

`/sitemap.xml` is generated dynamically by `server.js` — it includes all service pages and main pages. No static file to maintain.

### robots.txt

`/robots.txt` is also generated dynamically:
```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: https://yourdomain.com/sitemap.xml
```

### Improving SEO

1. **Update `BASE_URL`** in `.env` so sitemap URLs are correct
2. **Edit meta tags** in each HTML file (`<title>`, `<meta name="description">`)
3. **Update JSON-LD** in `index.html` with your real name, address, social profiles
4. **Submit sitemap** to Google Search Console: `https://search.google.com/search-console`
5. **OG images** — set `hero_bg_img` in Site Content to a 1200×630px image for social sharing

---

## Security Checklist

Before going live, verify:

- [ ] `ADMIN_PASSWORD` is a strong, unique password (not `sacred2024`)
- [ ] `.env` is in `.gitignore` and never committed
- [ ] `ALLOWED_ORIGIN` is set to your domain (not empty/open)
- [ ] `STRIPE_SECRET_KEY` uses `sk_live_` (not test key in production)
- [ ] HTTPS is enabled (EasyPanel auto-provisions Let's Encrypt)
- [ ] Run `npm audit` to check for dependency vulnerabilities
- [ ] Check [securityheaders.com](https://securityheaders.com) for HTTP header score
- [ ] Check [SSL Labs](https://www.ssllabs.com/ssltest/) for TLS certificate grade

### Security tools

| Tool | URL | What it checks |
|------|-----|----------------|
| Security Headers | securityheaders.com | HTTP headers (CSP, HSTS, etc.) |
| SSL Labs | ssllabs.com/ssltest | TLS certificate & config |
| Mozilla Observatory | observatory.mozilla.org | Overall security posture |
| npm audit | `npm audit` in terminal | Known vulnerabilities in dependencies |

---

## Troubleshooting

### App won't start

```bash
# Check Node version (needs 18+)
node --version

# Check if DATABASE_URL is set
echo $DATABASE_URL   # Linux/Mac
$env:DATABASE_URL    # PowerShell

# Check for port conflicts
lsof -i :3000        # Linux/Mac
netstat -ano | findstr :3000  # Windows
```

### Database connection errors

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
→ PostgreSQL is not running. Start it: `brew services start postgresql` (Mac) or `sudo service postgresql start` (Linux).

```
Error: password authentication failed
```
→ Wrong password in `DATABASE_URL`. Check with `psql "$DATABASE_URL"`.

```
SSL SYSCALL error / certificate verify
```
→ Add `?sslmode=require` (cloud DB) or `?sslmode=disable` (local DB) to `DATABASE_URL`.

### Emails not sending

1. Check Admin → Settings → Send Test Email
2. Check `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` in `.env`
3. Gmail: make sure you're using an **App Password**, not your account password
4. Gmail: 2-Step Verification must be enabled
5. Check your spam folder

### Admin password doesn't work

- The default is `sacred2024` — set `ADMIN_PASSWORD` in `.env` to change it
- After changing, restart the server

### Images not showing after upload

- Ensure `UPLOAD_DIR=/data/uploads` is set and the Docker volume is mounted
- Check file permissions: the `node` process must be able to write to `UPLOAD_DIR`

### Cookie banner not appearing

The banner is served from memory in `server.js` at `/cookie-banner.js` — it bypasses static file caching. If it still doesn't show, clear `localStorage`:

```javascript
// In browser console (incognito):
localStorage.removeItem('sh_cookie_consent')
```

### Stripe redirect not working

- Ensure `BASE_URL` is set to your **public** domain (not localhost)
- Check Stripe Dashboard → Events for payment intent errors

---

## Quick Start Cheatsheet

```bash
# 1. Clone & install
git clone <repo> && cd sacredhealing && npm install

# 2. Set up .env (copy example and fill in values)
cp .env.example .env

# 3. Create PostgreSQL database
createdb 6rascension

# 4. Start dev server
npm run dev

# 5. Open site
open http://localhost:3000

# 6. Open admin
open http://localhost:3000/admin
# Default password: sacred2024 (change via ADMIN_PASSWORD in .env)
```

---

## Support

For questions about the codebase, check the **Help & Guide** section inside the admin panel — it documents every feature with step-by-step instructions.
