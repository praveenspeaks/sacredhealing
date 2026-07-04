# 6R Ascension — Website Setup Guide

This guide walks you through getting the website live on **Vercel** with your own database. No coding knowledge required — just follow each step in order.

---

## What You Need (all free)

| Account | Purpose | Sign up at |
|---------|---------|------------|
| GitHub | Stores your website code | github.com |
| Vercel | Hosts the website | vercel.com |
| Neon | Your database (PostgreSQL) | neon.tech |

---

## Step 1 — Upload Code to GitHub

1. Go to [github.com](https://github.com) and sign in (or create a free account)
2. Click the **+** button (top right) → **New repository**
3. Name it: `6r-ascension-website`
4. Set it to **Private**
5. Click **Create repository**
6. On the next page, click **uploading an existing file**
7. Drag and drop **all the files from the zip** (unzip first, then select all files inside)
8. Click **Commit changes**

> **Important:** Do NOT upload the `node_modules` folder — it's very large and not needed. Everything else in the zip should be uploaded.

---

## Step 2 — Create Your Database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up with your Google account
2. Click **Create Project**
3. Name it: `6r-ascension`
4. Region: choose **Europe West** (closest to UK)
5. Click **Create Project**
6. On the dashboard, click **Connection Details**
7. Copy the **Connection string** — it looks like:
   ```
   postgresql://username:password@host/dbname?sslmode=require
   ```
   **Save this — you will need it in Step 4**

---

## Step 3 — Import Your Existing Data

Your developer has provided a file called **`data.sql`** in the zip. This contains all your current content (services, reviews, FAQs, bookings, site settings).

To import it into your new Neon database:

1. Go to your Neon project dashboard
2. Click **SQL Editor** (in the left sidebar)
3. Click the **…** menu next to your database → **Import SQL**
4. Upload the `data.sql` file
5. Click **Run** — this loads all your existing data

> Alternatively, if you have a developer helping: give them the `data.sql` file and your Neon connection string, and they can import it for you using one command:
> ```
> psql "your-neon-connection-string" < data.sql
> ```

---

## Step 4 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click **Add New Project**
3. Find your `6r-ascension-website` repository and click **Import**
4. Leave all build settings as-is (Vercel detects Node.js automatically)
5. **Before clicking Deploy**, click **Environment Variables** and add these one by one:

---

### Environment Variables to Add

Click **Add** for each one. The **Name** goes in the left box, the **Value** goes in the right box.

| Name | Value | Notes |
|------|-------|-------|
| `DATABASE_URL` | *(paste your Neon connection string from Step 2)* | Required |
| `ADMIN_PASSWORD` | *(choose a strong password)* | This is your admin login password |
| `BASE_URL` | `https://your-project-name.vercel.app` | Your Vercel URL (you can update after first deploy) |
| `ALLOWED_ORIGIN` | `https://your-project-name.vercel.app` | Same as above |
| `SMTP_HOST` | `smtp.gmail.com` | If using Gmail for emails |
| `SMTP_PORT` | `587` | |
| `SMTP_SECURE` | `false` | |
| `SMTP_USER` | `your@gmail.com` | Your Gmail address |
| `SMTP_PASS` | *(your Gmail App Password — see email setup below)* | NOT your Gmail login password |
| `SMTP_FROM` | `6R Ascension <your@gmail.com>` | Appears as sender name in emails |
| `ADMIN_EMAIL` | `your@gmail.com` | Receives booking alert emails |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Only if taking paid bookings — skip for free sessions |

6. Click **Deploy**
7. Wait 1–2 minutes for the build to complete
8. Click **Visit** to see your live site

---

## Step 5 — Set Up Gmail for Emails (Important)

The site sends booking confirmations, cancellation emails, and contact form replies. You need to allow it to send from your Gmail.

**Do NOT use your regular Gmail password** — use an App Password instead:

1. Go to your Google account: [myaccount.google.com](https://myaccount.google.com)
2. Click **Security** → **2-Step Verification** → turn it ON (if not already)
3. Go back to Security → scroll down → **App passwords**
4. Select **Mail** and **Other (Custom name)** → type `6R Ascension Website`
5. Click **Generate**
6. Copy the 16-character password shown (e.g. `abcd efgh ijkl mnop`)
7. Go back to Vercel → your project → **Settings** → **Environment Variables**
8. Find `SMTP_PASS` and update it with this 16-character password
9. Go to **Deployments** → click the three dots on latest → **Redeploy**

---

## Step 6 — Connect Your Own Domain (Optional)

If you have a domain name (e.g. `6rascension.com`):

1. In Vercel → your project → **Settings** → **Domains**
2. Click **Add Domain** → type your domain name → **Add**
3. Vercel will show you two DNS records to add (an A record and a CNAME)
4. Log into your domain registrar (e.g. GoDaddy, Namecheap, Google Domains)
5. Go to DNS settings and add those two records
6. Wait 10–30 minutes for DNS to update
7. Vercel will automatically add a free HTTPS certificate

Once your domain is live, go back to Vercel → **Environment Variables** and update:
- `BASE_URL` → `https://6rascension.com`
- `ALLOWED_ORIGIN` → `https://6rascension.com`

Then redeploy.

---

## Step 7 — Log Into Your Admin Panel

1. Go to: `https://your-vercel-url.vercel.app/admin`
2. Enter the `ADMIN_PASSWORD` you set in Step 4
3. You're in!

From the admin panel you can:
- Add and manage booking slots
- Edit all website text and images
- Manage services, FAQs, reviews
- View and confirm bookings
- Post free resources
- Control navigation menus

---

## Important Notes for Vercel

| Feature | Status on Vercel |
|---------|-----------------|
| All pages & booking system | ✅ Works fully |
| Emails & calendar invites | ✅ Works (requires SMTP setup) |
| Stripe payments | ✅ Works (requires Stripe key) |
| Image uploads from admin | ⚠️ Images uploaded via admin won't be saved permanently on Vercel (serverless limitation). Use Cloudinary — your developer can set this up. |

> **Tip:** If you only need to update the logo or hero image rarely, your developer can upload them directly to the `assets/` folder in GitHub and redeploy — this is the simplest workaround.

---

## If Something Goes Wrong

**Site shows an error page:**
- Check Vercel → your project → **Deployments** → click the latest → **Build Logs** for error messages

**Admin password doesn't work:**
- Go to Vercel → Settings → Environment Variables → check `ADMIN_PASSWORD` is correct
- After any change: Deployments → Redeploy

**Emails not sending:**
- Check SMTP settings in environment variables
- Make sure you used a Gmail App Password (not your login password)
- Try: Admin panel → Settings → Send Test Email

**No data showing (empty site):**
- The `data.sql` import in Step 3 may not have completed — try re-importing

---

## Checklist Before Sharing the Link

- [ ] Admin login works at `/admin`
- [ ] All services showing on homepage
- [ ] Booking slots visible when clicking "Book Session"
- [ ] Send a test email from Admin → Settings
- [ ] Contact form submits without error
- [ ] Cookie banner appears on first visit in private/incognito window
