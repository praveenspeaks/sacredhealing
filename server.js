const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const { sendBookingConfirmation, sendAdminAlert, sendContactEnquiry } = require('./mailer');

const crypto    = require('crypto');
const pool      = require('./db');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
const corsOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin } : {}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Rate limiters ───────────────────────────────────────────
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking attempts. Please wait 15 minutes and try again.' },
});

const slotsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please wait an hour before trying again.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});

const confirmLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many confirmation attempts. Please wait.' },
});

// ── Admin config ────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sacred2024';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  ADMIN_PASSWORD not set in environment — using insecure default. Set it in .env before deploying.');
}

function requireAdmin(req, res, next) {
  const auth = req.headers['x-admin-password'];
  if (!auth || auth !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Currency helpers ────────────────────────────────────────
const CURRENCY_SYMBOLS = { GBP: '£', USD: '$', EUR: '€', INR: '₹', AUD: 'A$' };

// ── Booking reference generator ─────────────────────────────
function generateBookingRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable chars (0/O, 1/I)
  return 'SH-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Database initialisation ─────────────────────────────────
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS slots (
      id          SERIAL PRIMARY KEY,
      date        TEXT    NOT NULL,
      time        TEXT    NOT NULL,
      duration    INTEGER DEFAULT 60,
      price       NUMERIC(10,2) DEFAULT 0,
      currency    TEXT    DEFAULT 'GBP',
      note        TEXT    DEFAULT '',
      is_booked   INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id             SERIAL PRIMARY KEY,
      slot_id        INTEGER NOT NULL,
      service        TEXT    NOT NULL,
      customer_name  TEXT    NOT NULL,
      customer_email TEXT    NOT NULL,
      customer_phone TEXT    DEFAULT '',
      message        TEXT    DEFAULT '',
      status         TEXT    DEFAULT 'pending',
      cancel_token   TEXT    DEFAULT NULL,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      FOREIGN KEY (slot_id) REFERENCES slots(id)
    )
  `);

  // Migration-safe: add cancel_token for existing databases
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancel_token TEXT DEFAULT NULL`);
  // Unique constraint so ON CONFLICT (date,time) works in bulk insert
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS slots_date_time_idx ON slots(date, time)`);
  // Booking reference column (human-readable unique ID sent in confirmation emails)
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_ref TEXT`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS bookings_ref_idx ON bookings(booking_ref) WHERE booking_ref IS NOT NULL`);

  // ── Bulk bookings ────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bulk_bookings (
      id              SERIAL PRIMARY KEY,
      booking_ref     TEXT UNIQUE,
      customer_name   TEXT NOT NULL,
      customer_email  TEXT NOT NULL,
      customer_phone  TEXT DEFAULT '',
      service         TEXT NOT NULL,
      session_count   INTEGER NOT NULL,
      session_price   NUMERIC(10,2) NOT NULL,
      currency        TEXT DEFAULT 'GBP',
      total_amount    NUMERIC(10,2) NOT NULL,
      message         TEXT DEFAULT '',
      status          TEXT DEFAULT 'pending',
      stripe_payment_intent TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bulk_booking_id INTEGER REFERENCES bulk_bookings(id)`);
  // Package pricing: optional discounted per-session price for bulk bookings
  await pool.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS package_price NUMERIC(10,2) DEFAULT NULL`);
}

// ════════════════════════════════════════════════════════════
// CLEAN SEO URLS FOR SERVICES
// ════════════════════════════════════════════════════════════

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Resolve the price for a booking's "service" string, which may be either a
// plain service title or "<Service Title> — <Variant Label>" when the
// customer picked a pricing variant (e.g. Phone vs Remote).
async function getServicePrice(serviceName) {
  const svcResult = await pool.query('SELECT price FROM services WHERE title = $1', [serviceName]);
  if (svcResult.rows[0]) return parseFloat(svcResult.rows[0].price) || 0;

  const sepIdx = serviceName.lastIndexOf(' — ');
  if (sepIdx > -1) {
    const baseTitle = serviceName.slice(0, sepIdx);
    const variantLabel = serviceName.slice(sepIdx + 3);
    const baseResult = await pool.query('SELECT extra_details FROM services WHERE title = $1', [baseTitle]);
    if (baseResult.rows[0]) {
      try {
        const detail = JSON.parse(baseResult.rows[0].extra_details || '{}');
        const variant = (detail.variants || []).find(v => (v.label || (v.duration === 0 ? 'Variable' : v.duration + ' min')) === variantLabel);
        if (variant) return parseFloat(variant.price) || 0;
      } catch (e) {}
    }
  }
  return 0;
}

// For bulk/package bookings: returns package_price if configured, else regular price.
async function getServiceBulkPrice(serviceName) {
  const svcResult = await pool.query('SELECT price, package_price FROM services WHERE title = $1', [serviceName]);
  if (svcResult.rows[0]) {
    const pkgPrice = svcResult.rows[0].package_price;
    if (pkgPrice !== null && pkgPrice !== undefined && parseFloat(pkgPrice) > 0) {
      return parseFloat(pkgPrice);
    }
    return parseFloat(svcResult.rows[0].price) || 0;
  }
  return 0;
}

// Multi-page section routes (must be before /services/:slug)
app.get('/about',        (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/philosophy',   (req, res) => res.sendFile(path.join(__dirname, 'philosophy.html')));
app.get('/story',        (req, res) => res.sendFile(path.join(__dirname, 'story.html')));
app.get('/services',     (req, res) => res.sendFile(path.join(__dirname, 'services.html')));
app.get('/process',      (req, res) => res.sendFile(path.join(__dirname, 'process.html')));
app.get('/testimonials', (req, res) => res.sendFile(path.join(__dirname, 'testimonials.html')));
app.get('/faq',          (req, res) => res.sendFile(path.join(__dirname, 'faq.html')));
app.get('/contact',      (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/disclaimer',   (req, res) => res.sendFile(path.join(__dirname, 'disclaimer.html')));
app.get('/cancellation', (req, res) => res.sendFile(path.join(__dirname, 'cancellation.html')));

// Route: /services/spiritual-healing  →  serves service.html
app.get('/services/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'service.html'));
});

// Route: /admin  →  serves admin.html
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Route: /cancel?token=xxx  →  customer self-cancellation
app.get('/cancel', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/');

  const result = await pool.query(`
    SELECT b.*, s.date, s.time, s.duration FROM bookings b
    JOIN slots s ON s.id = b.slot_id
    WHERE b.cancel_token = $1 AND b.status != 'cancelled'
  `, [token]);

  const booking = result.rows[0];
  if (!booking) {
    return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sacred Healing</title>
      <style>body{font-family:Georgia,serif;background:#0a0a0a;color:#FDFCF8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
      .box{text-align:center;padding:3rem;max-width:480px;}h1{color:#DAB467;}a{color:#DAB467;}</style></head>
      <body><div class="box"><h1>✦ Sacred Healing</h1><p>This cancellation link is invalid or has already been used.</p>
      <p><a href="/">Return to Sacred Healing →</a></p></div></body></html>`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE bookings SET status = 'cancelled', cancel_token = NULL WHERE id = $1", [booking.id]);
    await client.query('UPDATE slots SET is_booked = 0 WHERE id = $1', [booking.slot_id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Booking Cancelled — Sacred Healing</title>
    <style>body{font-family:Georgia,serif;background:#0a0a0a;color:#FDFCF8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
    .box{text-align:center;padding:3rem;max-width:520px;}h1{color:#DAB467;margin-bottom:0.5rem;}
    p{color:#A1A1AA;line-height:1.7;}a{color:#DAB467;}</style></head>
    <body><div class="box">
      <h1>✦ Sacred Healing</h1>
      <h2 style="margin-bottom:1.5rem;">Booking Cancelled</h2>
      <p>Your <strong>${booking.service}</strong> session on
         <strong>${new Date(booking.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
         at <strong>${booking.time}</strong> has been cancelled.</p>
      <p style="margin-top:1.5rem;">We hope to see you again soon.</p>
      <p style="margin-top:2rem;"><a href="/">Return to Sacred Healing →</a></p>
    </div></body></html>`);
});

// API: /api/services/:slug  →  returns JSON for that service
app.get('/api/services/:slug', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services ORDER BY order_num ASC, id ASC');
    const services = result.rows;
    const match = services.find(s => slugify(s.title) === req.params.slug);
    if (!match) return res.status(404).json({ error: 'Service not found' });
    try { match.features = JSON.parse(match.features); } catch(e) { match.features = [match.features]; }
    const all = services.map(s => {
      try { s.features = JSON.parse(s.features); } catch(e) {}
      return { ...s, slug: slugify(s.title) };
    });
    res.json({ service: { ...match, slug: slugify(match.title) }, all });
  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// ════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════════════════

// POST /api/contact — Contact form submission
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'All fields are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
  if (name.length > 120 || email.length > 200 || message.length > 3000) return res.status(400).json({ error: 'Input too long.' });
  try {
    await sendContactEnquiry({ name, email, message });
    res.json({ ok: true });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// GET /api/slots/calendar?month=YYYY-MM — per-date availability summary
app.get('/api/slots/calendar', slotsLimiter, async (req, res) => {
  const { month, duration } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month parameter required (YYYY-MM)' });
  }
  const [y, m] = month.split('-');
  const startDate = `${y}-${m}-01`;
  const nextM = new Date(parseInt(y), parseInt(m), 1); // JS months 0-indexed, so parseInt(m) is already next month
  const endDate = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}-01`;
  try {
    const params = [startDate, endDate];
    let durationClause = '';
    if (duration && /^\d+$/.test(duration)) {
      params.push(parseInt(duration));
      durationClause = ` AND duration = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT date::text,
              COUNT(*) AS total,
              COUNT(CASE WHEN is_booked != 0 THEN 1 END) AS booked
       FROM   slots
       WHERE  date >= $1 AND date < $2${durationClause}
       GROUP  BY date ORDER BY date`,
      params
    );
    const byDate = {};
    result.rows.forEach(r => { byDate[r.date] = { total: parseInt(r.total), booked: parseInt(r.booked) }; });
    res.json(byDate);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch calendar data' }); }
});

// GET /api/slots/date/:date — all slots for a date (available + booked) for calendar time display
app.get('/api/slots/date/:date', slotsLimiter, async (req, res) => {
  const { date } = req.params;
  const { duration } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format' });
  try {
    const params = [date];
    let durationClause = '';
    if (duration && /^\d+$/.test(duration)) {
      params.push(parseInt(duration));
      durationClause = ` AND duration = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT id, date::text, time::text, duration, price, currency, is_booked, note
       FROM   slots WHERE date = $1${durationClause} ORDER BY time ASC`,
      params
    );
    res.json({ slots: result.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch slots' }); }
});

// GET /api/slots  — Available future slots (unbooked only)
app.get('/api/slots', slotsLimiter, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { duration } = req.query;

    let query = `
      SELECT id, date, time, duration, price, currency, note
      FROM   slots
      WHERE  is_booked = 0
        AND  date >= $1
    `;
    const params = [today];

    if (duration === '90+') {
      query += ' AND duration >= 90';
    } else if (duration) {
      query += ` AND duration = $${params.length + 1}`;
      params.push(parseInt(duration));
    }

    query += ' ORDER BY date ASC, time ASC';

    const result = await pool.query(query, params);
    res.json({ slots: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// POST /api/bookings  — Customer books a slot
app.post('/api/bookings', bookingLimiter, async (req, res) => {
  try {
    const { slot_id, service, customer_name, customer_email, customer_phone, message } = req.body;

    if (!slot_id || !service || !customer_name || !customer_email) {
      return res.status(400).json({ error: 'slot_id, service, customer_name, and customer_email are required.' });
    }

    const slotResult = await pool.query('SELECT * FROM slots WHERE id = $1 AND is_booked = 0', [slot_id]);
    const slot = slotResult.rows[0];
    if (!slot) {
      return res.status(409).json({ error: 'This slot is no longer available. Please choose another time.' });
    }

    // Block double-booking: reject if a confirmed or pending_payment booking already exists for this slot
    const existingBooking = await pool.query(
      "SELECT id FROM bookings WHERE slot_id = $1 AND status IN ('confirmed', 'pending_payment')",
      [slot_id]
    );
    if (existingBooking.rows.length > 0) {
      return res.status(409).json({ error: 'This slot is no longer available. Please choose another time.' });
    }

    const cancelToken = crypto.randomBytes(32).toString('hex');
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const cancelUrl = `${baseUrl}/cancel?token=${cancelToken}`;

    // Look up service price — fall back to slot price if service has no price set
    const svcPrice = await getServicePrice(service.trim());
    const servicePrice = svcPrice > 0 ? svcPrice : parseFloat(slot.price || 0);

    const stripeKey = process.env.STRIPE_SECRET_KEY || '';
    const stripeActive = stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_');

    // ── PAID SESSION: create PaymentIntent for embedded payment. Slot stays
    //    unlocked until /api/bookings/confirm is called after payment succeeds.
    if (servicePrice > 0 && stripeActive) {
      let bookingId;
      const bookingRef = generateBookingRef();
      try {
        const bookingResult = await pool.query(`
          INSERT INTO bookings (slot_id, service, customer_name, customer_email, customer_phone, message, status, cancel_token, booking_ref)
          VALUES ($1, $2, $3, $4, $5, $6, 'pending_payment', $7, $8)
          RETURNING id
        `, [
          slot_id,
          service.trim(),
          customer_name.trim(),
          customer_email.trim().toLowerCase(),
          (customer_phone || '').trim(),
          (message || '').trim(),
          cancelToken,
          bookingRef
        ]);
        bookingId = bookingResult.rows[0].id;

        const paymentIntent = await stripe.paymentIntents.create({
          amount:      Math.round(servicePrice * 100),
          currency:    'gbp',
          description: `${service.trim()} — ${slot.date} at ${slot.time}`,
          metadata:    { booking_id: bookingId, booking_ref: bookingRef },
        });
        return res.status(201).json({
          payment_required: true,
          client_secret:    paymentIntent.client_secret,
          booking_id:       bookingId,
          booking_ref:      bookingRef,
          amount:           servicePrice,
          service:          service.trim(),
          slot:             { date: slot.date, time: slot.time, duration: slot.duration },
        });
      } catch (err) {
        console.error('Stripe error:', err);
        if (bookingId) await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
        return res.status(500).json({ error: 'Failed to initialize payment. Please try again or contact support.' });
      }
    }

    // ── FREE SESSION: lock slot and confirm booking atomically, then send emails
    const client = await pool.connect();
    let bookingId;
    const bookingRef = generateBookingRef();
    try {
      await client.query('BEGIN');
      const bookingResult = await client.query(`
        INSERT INTO bookings (slot_id, service, customer_name, customer_email, customer_phone, message, cancel_token, booking_ref)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        slot_id,
        service.trim(),
        customer_name.trim(),
        customer_email.trim().toLowerCase(),
        (customer_phone || '').trim(),
        (message || '').trim(),
        cancelToken,
        bookingRef
      ]);
      bookingId = bookingResult.rows[0].id;
      await client.query('UPDATE slots SET is_booked = 1 WHERE id = $1', [slot_id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    sendBookingConfirmation({ customerName: customer_name, customerEmail: customer_email, service, slot, servicePrice, cancelUrl, bookingRef })
      .catch(err => console.error('Confirmation email error:', err));
    sendAdminAlert({ customerName: customer_name, customerEmail: customer_email, customerPhone: customer_phone, service, slot, servicePrice, message, cancelUrl, bookingRef })
      .catch(err => console.error('Admin alert email error:', err));

    res.status(201).json({
      success:    true,
      message:    'Your session has been booked! We will confirm shortly.',
      booking_id: bookingId,
      booking_ref: bookingRef,
      slot: {
        date:     slot.date,
        time:     slot.time,
        duration: slot.duration,
        price:    slot.price,
        currency: slot.currency
      },
      service
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// GET /api/stripe-key — returns Stripe publishable key (safe to expose)
app.get('/api/stripe-key', (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const active = stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_');
  const pubKey = active ? (process.env.STRIPE_PUBLISHABLE_KEY || '') : '';
  res.json({ publishableKey: pubKey || null });
});

// POST /api/bookings/confirm — verify PaymentIntent, lock slot, confirm booking
app.post('/api/bookings/confirm', async (req, res) => {
  const { booking_id, payment_intent_id } = req.body;
  if (!booking_id || !payment_intent_id) {
    return res.status(400).json({ error: 'booking_id and payment_intent_id are required.' });
  }
  try {
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== 'succeeded') {
      return res.status(402).json({ error: 'Payment has not been completed.' });
    }
    if (String(pi.metadata.booking_id) !== String(booking_id)) {
      return res.status(400).json({ error: 'Payment does not match this booking.' });
    }

    const bookingResult = await pool.query(`
      SELECT b.*, s.date, s.time, s.duration, s.is_booked
      FROM bookings b JOIN slots s ON s.id = b.slot_id
      WHERE b.id = $1
    `, [booking_id]);
    const booking = bookingResult.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    if (booking.status === 'confirmed') {
      // Idempotent resend: email may have failed on first delivery
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const cancelUrl = booking.cancel_token ? `${baseUrl}/cancel?token=${booking.cancel_token}` : null;
      const servicePrice = await getServicePrice(booking.service);
      sendBookingConfirmation({
        customerName: booking.customer_name, customerEmail: booking.customer_email,
        service: booking.service, slot: booking, servicePrice, cancelUrl, bookingRef: booking.booking_ref,
      }).catch(err => console.error('Idempotent confirmation email error:', err));
      return res.json({ success: true, booking_ref: booking.booking_ref, already_confirmed: true,
        service: booking.service, slot: { date: booking.date, time: booking.time, duration: booking.duration } });
    }

    const client = await pool.connect();
    let confirmed = false;
    try {
      await client.query('BEGIN');
      const slotLock = await client.query(
        'UPDATE slots SET is_booked = 1 WHERE id = $1 AND is_booked = 0 RETURNING id',
        [booking.slot_id]
      );
      confirmed = slotLock.rowCount > 0;
      await client.query('UPDATE bookings SET status = $1 WHERE id = $2',
        [confirmed ? 'confirmed' : 'cancelled', booking_id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    if (!confirmed) {
      return res.status(409).json({ error: 'This slot was just taken by another booking. Please contact us for assistance.' });
    }

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const cancelUrl = booking.cancel_token ? `${baseUrl}/cancel?token=${booking.cancel_token}` : null;
    const servicePrice = await getServicePrice(booking.service);

    sendBookingConfirmation({
      customerName: booking.customer_name, customerEmail: booking.customer_email,
      service: booking.service, slot: booking, servicePrice, cancelUrl, bookingRef: booking.booking_ref,
    }).catch(err => console.error('Confirmation email error:', err));
    sendAdminAlert({
      customerName: booking.customer_name, customerEmail: booking.customer_email,
      customerPhone: booking.customer_phone, service: booking.service,
      slot: booking, servicePrice, message: booking.message, cancelUrl, bookingRef: booking.booking_ref,
    }).catch(err => console.error('Admin alert email error:', err));

    res.json({
      success:     true,
      booking_ref: booking.booking_ref,
      service:     booking.service,
      slot:        { date: booking.date, time: booking.time, duration: booking.duration },
    });
  } catch (err) {
    console.error('Confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm booking. Please contact us if payment was taken.' });
  }
});

// GET /api/bookings/success — Stripe success redirect endpoint
app.get('/api/bookings/success', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.redirect('/');
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const bookingId = session.metadata.booking_id;
    if (!bookingId) return res.redirect('/');

    const bookingResult = await pool.query(`
      SELECT b.*, s.date, s.time, s.duration, s.price, s.currency
      FROM bookings b JOIN slots s ON s.id = b.slot_id
      WHERE b.id = $1
    `, [bookingId]);
    const booking = bookingResult.rows[0];
    if (!booking) return res.redirect('/');

    let confirmed = false;
    if (session.payment_status === 'paid') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Lock the slot atomically — prevents race if two people paid for same slot
        const slotLock = await client.query(
          'UPDATE slots SET is_booked = 1 WHERE id = $1 AND is_booked = 0 RETURNING id',
          [booking.slot_id]
        );
        confirmed = slotLock.rowCount > 0;
        await client.query('UPDATE bookings SET status = $1 WHERE id = $2',
          [confirmed ? 'confirmed' : 'cancelled', bookingId]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    if (confirmed) {
      const servicePrice = await getServicePrice(booking.service);
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const cancelUrl = booking.cancel_token ? `${baseUrl}/cancel?token=${booking.cancel_token}` : null;

      sendBookingConfirmation({
        customerName: booking.customer_name, customerEmail: booking.customer_email,
        service: booking.service, slot: booking, servicePrice, cancelUrl
      }).catch(err => console.error('Confirmation email error:', err));
      sendAdminAlert({
        customerName: booking.customer_name, customerEmail: booking.customer_email,
        customerPhone: booking.customer_phone, service: booking.service,
        slot: booking, servicePrice, message: booking.message, cancelUrl
      }).catch(err => console.error('Admin alert email error:', err));
    }

    res.redirect(`/?booking=success&booking_id=${bookingId}`);
  } catch (err) {
    console.error('Stripe success error:', err);
    res.redirect('/');
  }
});

// GET /api/bookings/cancel — Stripe cancel redirect endpoint
app.get('/api/bookings/cancel', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.redirect('/');
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const bookingId = session.metadata.booking_id;
    if (bookingId) {
      // Slot was never locked for pending_payment bookings — just cancel the record
      await pool.query(
        "UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status = 'pending_payment'",
        [bookingId]
      );
    }
    res.redirect('/?booking=cancel');
  } catch (err) {
    console.error('Stripe cancel error:', err);
    res.redirect('/');
  }
});

// ════════════════════════════════════════════════════════════
// ADMIN ROUTES (protected)
// ════════════════════════════════════════════════════════════

// POST /api/admin/login
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) res.json({ success: true, token: ADMIN_PASSWORD });
  else res.status(401).json({ error: 'Invalid password' });
});

// GET /api/admin/slots  — All slots with booking info
app.get('/api/admin/slots', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, b.service, b.customer_name, b.customer_email, b.customer_phone, b.status as booking_status
      FROM   slots s
      LEFT   JOIN bookings b ON b.slot_id = s.id
      ORDER  BY s.date DESC, s.time ASC
    `);
    res.json({ slots: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// POST /api/admin/slots  — Add single slot
app.post('/api/admin/slots', requireAdmin, async (req, res) => {
  try {
    const { date, time, duration, note } = req.body;
    if (!date || !time) return res.status(400).json({ error: 'date and time are required.' });

    const result = await pool.query(`
      INSERT INTO slots (date, time, duration, note)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (date, time) DO NOTHING
      RETURNING id
    `, [date, time, duration || 60, note || '']);

    if (!result.rows.length) return res.status(409).json({ error: 'A slot already exists for this date and time.' });
    res.status(201).json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add slot' });
  }
});

// POST /api/admin/slots/bulk  — Bulk add slots
app.post('/api/admin/slots/bulk', requireAdmin, async (req, res) => {
  try {
    const { slots } = req.body;
    if (!Array.isArray(slots) || !slots.length) return res.status(400).json({ error: 'slots array required.' });

    const client = await pool.connect();
    let count = 0;
    try {
      await client.query('BEGIN');
      for (const s of slots) {
        if (s.date && s.time) {
          await client.query(`
            INSERT INTO slots (date, time, duration, note)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (date, time) DO NOTHING
          `, [s.date, s.time, s.duration || 60, s.note || '']);
          count++;
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.status(201).json({ success: true, added: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to bulk add slots' });
  }
});

// PATCH /api/admin/slots/:id  — Update duration/note of available slot
app.patch('/api/admin/slots/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { duration, note } = req.body;
    const slotResult = await pool.query('SELECT * FROM slots WHERE id = $1', [id]);
    const slot = slotResult.rows[0];
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.is_booked) return res.status(409).json({ error: 'Cannot edit a booked slot.' });

    await pool.query(`
      UPDATE slots SET
        duration = COALESCE($1, duration),
        note     = COALESCE($2, note)
      WHERE id = $3
    `, [
      duration !== undefined ? duration : null,
      note     !== undefined ? note     : null,
      id
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update slot' });
  }
});

// DELETE /api/admin/slots/:id
app.delete('/api/admin/slots/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const slotResult = await pool.query('SELECT * FROM slots WHERE id = $1', [id]);
    const slot = slotResult.rows[0];
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.is_booked) return res.status(409).json({ error: 'Cannot delete a booked slot. Cancel the booking first.' });
    // Remove cancelled booking records referencing this slot before deleting (FK constraint)
    await pool.query("DELETE FROM bookings WHERE slot_id = $1 AND status = 'cancelled'", [id]);
    await pool.query('DELETE FROM slots WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

// GET /api/admin/bookings
app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, s.date, s.time, s.duration, s.price, s.currency
      FROM   bookings b
      JOIN   slots s ON s.id = b.slot_id
      ORDER  BY b.created_at DESC
    `);
    res.json({ bookings: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// PATCH /api/admin/bookings/:id  — Update booking status
app.patch('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'pending_payment', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const result = await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Booking not found' });

    if (status === 'cancelled') {
      const bookingResult = await pool.query('SELECT slot_id FROM bookings WHERE id = $1', [id]);
      const booking = bookingResult.rows[0];
      if (booking) await pool.query('UPDATE slots SET is_booked = 0 WHERE id = $1', [booking.slot_id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [
      totalSlotsR, availableSlotsR, totalBookingsR,
      pendingR, confirmedR, todayR, revenueR
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as c FROM slots'),
      pool.query('SELECT COUNT(*) as c FROM slots WHERE is_booked = 0 AND date >= $1', [today]),
      pool.query('SELECT COUNT(*) as c FROM bookings'),
      pool.query("SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) as c FROM bookings WHERE status = 'confirmed'"),
      pool.query("SELECT COUNT(*) as c FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE s.date = $1", [today]),
      pool.query("SELECT COALESCE(SUM(s.price),0) as r FROM bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status != 'cancelled'")
    ]);
    res.json({
      totalSlots:        parseInt(totalSlotsR.rows[0].c),
      availableSlots:    parseInt(availableSlotsR.rows[0].c),
      totalBookings:     parseInt(totalBookingsR.rows[0].c),
      pendingBookings:   parseInt(pendingR.rows[0].c),
      confirmedBookings: parseInt(confirmedR.rows[0].c),
      todayBookings:     parseInt(todayR.rows[0].c),
      revenue:           parseFloat(revenueR.rows[0].r),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ════════════════════════════════════════════════════════════
// BULK BOOKING — CUSTOMER ENDPOINTS
// ════════════════════════════════════════════════════════════

// POST /api/bookings/bulk/preview
// Returns the next N available slots starting from (and including) slot_id
app.post('/api/bookings/bulk/preview', slotsLimiter, async (req, res) => {
  try {
    const { slot_id, count, service } = req.body;
    if (!slot_id || !count || count < 2 || count > 50) {
      return res.status(400).json({ error: 'slot_id and count (2–50) are required.' });
    }

    const startSlot = await pool.query(
      'SELECT * FROM slots WHERE id = $1 AND is_booked = 0', [slot_id]
    );
    if (!startSlot.rows[0]) {
      return res.status(409).json({ error: 'Selected slot is no longer available.' });
    }
    const s = startSlot.rows[0];

    // Find the next `count` available slots starting from the selected one (same duration)
    const result = await pool.query(`
      SELECT id, date::text, time::text, duration, price, currency, note
      FROM   slots
      WHERE  is_booked = 0
        AND  duration = $1
        AND  (date > $2 OR (date = $2 AND time >= $3))
      ORDER  BY date ASC, time ASC
      LIMIT  $4
    `, [s.duration, s.date, s.time, count]);

    if (result.rows.length < count) {
      return res.status(409).json({
        error: `Only ${result.rows.length} available slot${result.rows.length === 1 ? '' : 's'} found. Please reduce the session count or ask admin to add more slots.`,
        available: result.rows.length,
      });
    }

    const sessionPrice = service ? await getServiceBulkPrice(service.trim()) : parseFloat(s.price || 0);
    const totalAmount  = sessionPrice * count;

    res.json({ slots: result.rows, session_price: sessionPrice, total_amount: totalAmount, currency: s.currency || 'GBP' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to preview bulk slots' });
  }
});

// POST /api/bookings/bulk — create bulk booking (paid or free)
app.post('/api/bookings/bulk', bookingLimiter, async (req, res) => {
  try {
    const { slot_ids, service, customer_name, customer_email, customer_phone, message } = req.body;
    if (!Array.isArray(slot_ids) || slot_ids.length < 2 || !service || !customer_name || !customer_email) {
      return res.status(400).json({ error: 'slot_ids (≥2), service, customer_name, and customer_email are required.' });
    }
    if (slot_ids.length > 50) return res.status(400).json({ error: 'Maximum 50 sessions per bulk booking.' });
    if (!slot_ids.every(id => Number.isInteger(id) && id > 0)) {
      return res.status(400).json({ error: 'Invalid slot IDs.' });
    }

    // Verify all slots are available
    const slotsResult = await pool.query(
      'SELECT * FROM slots WHERE id = ANY($1) AND is_booked = 0 ORDER BY date ASC, time ASC',
      [slot_ids]
    );
    if (slotsResult.rows.length !== slot_ids.length) {
      return res.status(409).json({ error: 'One or more slots are no longer available. Please start over.' });
    }

    const firstSlot = slotsResult.rows[0];
    const sessionPrice = await getServiceBulkPrice(service.trim()) || parseFloat(firstSlot.price || 0);
    const totalAmount  = sessionPrice * slot_ids.length;
    const bulkRef      = generateBookingRef();
    const stripeKey    = process.env.STRIPE_SECRET_KEY || '';
    const stripeActive = stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_');

    if (sessionPrice > 0 && stripeActive) {
      // Create bulk_bookings record (pending_payment) — slots remain unlocked until payment confirmed
      const bulkResult = await pool.query(`
        INSERT INTO bulk_bookings
          (booking_ref, customer_name, customer_email, customer_phone, service, session_count, session_price, currency, total_amount, message, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending_payment')
        RETURNING id
      `, [bulkRef, customer_name.trim(), customer_email.trim().toLowerCase(),
          (customer_phone||'').trim(), service.trim(), slot_ids.length,
          sessionPrice, firstSlot.currency||'GBP', totalAmount, (message||'').trim()]);
      const bulkId = bulkResult.rows[0].id;

      // Create individual bookings linked to bulk (pending_payment, slots NOT locked yet)
      for (const [i, slotId] of slot_ids.entries()) {
        const indRef = `${bulkRef}-${i+1}`;
        await pool.query(`
          INSERT INTO bookings (slot_id, service, customer_name, customer_email, customer_phone, message, status, booking_ref, bulk_booking_id)
          VALUES ($1,$2,$3,$4,$5,$6,'pending_payment',$7,$8)
        `, [slotId, service.trim(), customer_name.trim(), customer_email.trim().toLowerCase(),
            (customer_phone||'').trim(), (message||'').trim(), indRef, bulkId]);
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount:      Math.round(totalAmount * 100),
        currency:    (firstSlot.currency || 'GBP').toLowerCase(),
        description: `${service.trim()} × ${slot_ids.length} sessions`,
        metadata:    { bulk_booking_id: bulkId, booking_ref: bulkRef, session_count: slot_ids.length },
      });

      await pool.query('UPDATE bulk_bookings SET stripe_payment_intent = $1 WHERE id = $2',
        [paymentIntent.id, bulkId]);

      return res.status(201).json({
        payment_required:  true,
        client_secret:     paymentIntent.client_secret,
        bulk_booking_id:   bulkId,
        booking_ref:       bulkRef,
        amount:            totalAmount,
        session_count:     slot_ids.length,
        service:           service.trim(),
        slots:             slotsResult.rows,
      });
    }

    // Free sessions — lock all slots atomically
    const client = await pool.connect();
    let bulkId;
    try {
      await client.query('BEGIN');
      const bulkResult = await client.query(`
        INSERT INTO bulk_bookings
          (booking_ref, customer_name, customer_email, customer_phone, service, session_count, session_price, currency, total_amount, message, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed')
        RETURNING id
      `, [bulkRef, customer_name.trim(), customer_email.trim().toLowerCase(),
          (customer_phone||'').trim(), service.trim(), slot_ids.length,
          sessionPrice, firstSlot.currency||'GBP', totalAmount, (message||'').trim()]);
      bulkId = bulkResult.rows[0].id;

      for (const [i, slotId] of slot_ids.entries()) {
        const indRef = `${bulkRef}-${i+1}`;
        await client.query(`
          INSERT INTO bookings (slot_id, service, customer_name, customer_email, customer_phone, message, status, booking_ref, bulk_booking_id)
          VALUES ($1,$2,$3,$4,$5,$6,'confirmed',$7,$8)
        `, [slotId, service.trim(), customer_name.trim(), customer_email.trim().toLowerCase(),
            (customer_phone||'').trim(), (message||'').trim(), indRef, bulkId]);
        await client.query('UPDATE slots SET is_booked = 1 WHERE id = $1', [slotId]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    sendBookingConfirmation({
      customerName: customer_name.trim(), customerEmail: customer_email.trim().toLowerCase(),
      service, slot: slotsResult.rows[0], servicePrice: 0, cancelUrl: null, bookingRef: bulkRef,
      isBulk: true, sessionCount: slot_ids.length,
    }).catch(err => console.error('Bulk confirmation email error:', err));
    sendAdminAlert({
      customerName: customer_name.trim(), customerEmail: customer_email.trim().toLowerCase(),
      customerPhone: (customer_phone||'').trim(), service, slot: slotsResult.rows[0],
      servicePrice: 0, message: (message||''), cancelUrl: null, bookingRef: bulkRef,
      isBulk: true, sessionCount: slot_ids.length,
    }).catch(err => console.error('Bulk admin alert error:', err));

    res.status(201).json({ success: true, bulk_booking_id: bulkId, booking_ref: bulkRef,
      session_count: slot_ids.length, slots: slotsResult.rows, service });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create bulk booking' });
  }
});

// POST /api/bookings/bulk/confirm — verify payment and lock all slots
app.post('/api/bookings/bulk/confirm', confirmLimiter, async (req, res) => {
  try {
    const { bulk_booking_id, payment_intent_id } = req.body;
    if (!bulk_booking_id || !payment_intent_id) {
      return res.status(400).json({ error: 'bulk_booking_id and payment_intent_id are required.' });
    }

    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== 'succeeded') return res.status(402).json({ error: 'Payment not completed.' });
    if (String(pi.metadata.bulk_booking_id) !== String(bulk_booking_id)) {
      return res.status(400).json({ error: 'Payment does not match this bulk booking.' });
    }

    const bulkResult = await pool.query('SELECT * FROM bulk_bookings WHERE id = $1', [bulk_booking_id]);
    const bulk = bulkResult.rows[0];
    if (!bulk) return res.status(404).json({ error: 'Bulk booking not found.' });
    if (bulk.status === 'confirmed') {
      return res.json({ success: true, already_confirmed: true, booking_ref: bulk.booking_ref });
    }

    // Lock all slots atomically — if ANY slot is taken, refund and abort
    const individualBookings = await pool.query(
      "SELECT b.*, s.date, s.time, s.duration FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE b.bulk_booking_id = $1 AND b.status = 'pending_payment' ORDER BY s.date ASC, s.time ASC",
      [bulk_booking_id]
    );

    const client = await pool.connect();
    let confirmed = false;
    try {
      await client.query('BEGIN');
      // Check all slots are still free before locking any
      for (const b of individualBookings.rows) {
        const check = await client.query('SELECT is_booked FROM slots WHERE id = $1 FOR UPDATE', [b.slot_id]);
        if (check.rows[0]?.is_booked) {
          await client.query('ROLLBACK');
          // Slot taken — issue full Stripe refund and mark bulk as failed
          try {
            await stripe.refunds.create({ payment_intent: payment_intent_id });
          } catch (refundErr) {
            console.error('Stripe refund failed — manual refund needed for bulk_booking_id', bulk_booking_id, refundErr);
          }
          await pool.query("UPDATE bulk_bookings SET status = 'refunded' WHERE id = $1", [bulk_booking_id]);
          await pool.query("UPDATE bookings SET status = 'cancelled' WHERE bulk_booking_id = $1", [bulk_booking_id]);
          return res.status(409).json({
            error: 'One or more of your sessions was just taken by another customer. A full refund has been issued automatically. Please try booking again.',
          });
        }
      }
      // All slots free — lock them all
      for (const b of individualBookings.rows) {
        await client.query('UPDATE slots SET is_booked = 1 WHERE id = $1', [b.slot_id]);
        await client.query("UPDATE bookings SET status = 'confirmed' WHERE id = $1", [b.id]);
      }
      await client.query("UPDATE bulk_bookings SET status = 'confirmed' WHERE id = $1", [bulk_booking_id]);
      await client.query('COMMIT');
      confirmed = true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Send confirmation emails
    if (confirmed) {
      const firstSlot = individualBookings.rows[0];
      sendBookingConfirmation({
        customerName: bulk.customer_name, customerEmail: bulk.customer_email,
        service: bulk.service, slot: firstSlot, servicePrice: parseFloat(bulk.session_price),
        cancelUrl: null, bookingRef: bulk.booking_ref,
        isBulk: true, sessionCount: individualBookings.rows.length,
      }).catch(err => console.error('Bulk confirmation email error:', err));
      sendAdminAlert({
        customerName: bulk.customer_name, customerEmail: bulk.customer_email,
        customerPhone: bulk.customer_phone, service: bulk.service, slot: firstSlot,
        servicePrice: parseFloat(bulk.session_price), message: bulk.message,
        cancelUrl: null, bookingRef: bulk.booking_ref,
        isBulk: true, sessionCount: individualBookings.rows.length,
      }).catch(err => console.error('Bulk admin alert error:', err));
    }

    res.json({ success: true, booking_ref: bulk.booking_ref, confirmed: individualBookings.rows.length, total: individualBookings.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to confirm bulk booking' });
  }
});

// ════════════════════════════════════════════════════════════
// BULK BOOKING — ADMIN ENDPOINTS
// ════════════════════════════════════════════════════════════

// GET /api/admin/bulk-bookings
app.get('/api/admin/bulk-bookings', requireAdmin, async (req, res) => {
  try {
    const bulkResult = await pool.query(`
      SELECT bb.*,
        COUNT(b.id) FILTER (WHERE b.status = 'confirmed') AS confirmed_count,
        COUNT(b.id) FILTER (WHERE b.status = 'cancelled') AS released_count,
        COUNT(b.id) AS total_count
      FROM bulk_bookings bb
      LEFT JOIN bookings b ON b.bulk_booking_id = bb.id
      GROUP BY bb.id
      ORDER BY bb.created_at DESC
    `);

    // Fetch individual bookings with slot info for each bulk
    const bulks = await Promise.all(bulkResult.rows.map(async bb => {
      const slots = await pool.query(`
        SELECT b.id, b.status, b.booking_ref, s.id as slot_id,
               s.date::text, s.time::text, s.duration, s.price, s.currency
        FROM   bookings b JOIN slots s ON s.id = b.slot_id
        WHERE  b.bulk_booking_id = $1
        ORDER  BY s.date ASC, s.time ASC
      `, [bb.id]);
      return { ...bb, bookings: slots.rows };
    }));

    res.json({ bulk_bookings: bulks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bulk bookings' });
  }
});

// PATCH /api/admin/bulk-bookings/:bulkId/release/:bookingId
// Releases one session from a bulk booking back to available
app.patch('/api/admin/bulk-bookings/:bulkId/release/:bookingId', requireAdmin, async (req, res) => {
  try {
    const { bulkId, bookingId } = req.params;
    const bookingResult = await pool.query(
      'SELECT * FROM bookings WHERE id = $1 AND bulk_booking_id = $2', [bookingId, bulkId]
    );
    const booking = bookingResult.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found in this bulk.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE bookings SET status = 'released' WHERE id = $1", [bookingId]);
      await client.query('UPDATE slots SET is_booked = 0 WHERE id = $1', [booking.slot_id]);
      // Update bulk status to 'partial' if was 'confirmed'
      await client.query(`
        UPDATE bulk_bookings SET status = 'partial' WHERE id = $1 AND status = 'confirmed'
      `, [bulkId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to release slot' });
  }
});

// POST /api/admin/bulk-bookings/:bulkId/rebook/:bookingId
// Rebooks a released session to a different available slot
app.post('/api/admin/bulk-bookings/:bulkId/rebook/:bookingId', requireAdmin, async (req, res) => {
  try {
    const { bulkId, bookingId } = req.params;
    const { new_slot_id } = req.body;
    if (!new_slot_id) return res.status(400).json({ error: 'new_slot_id is required.' });

    const bookingResult = await pool.query(
      "SELECT * FROM bookings WHERE id = $1 AND bulk_booking_id = $2 AND status = 'released'",
      [bookingId, bulkId]
    );
    const booking = bookingResult.rows[0];
    if (!booking) return res.status(404).json({ error: 'Released booking not found.' });

    const newSlot = await pool.query('SELECT * FROM slots WHERE id = $1 AND is_booked = 0', [new_slot_id]);
    if (!newSlot.rows[0]) return res.status(409).json({ error: 'New slot is not available.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE slots SET is_booked = 1 WHERE id = $1', [new_slot_id]);
      await client.query(
        "UPDATE bookings SET slot_id = $1, status = 'confirmed' WHERE id = $2",
        [new_slot_id, bookingId]
      );
      // If all bookings are confirmed again, restore bulk status
      const remaining = await client.query(
        "SELECT COUNT(*) as c FROM bookings WHERE bulk_booking_id = $1 AND status = 'released'", [bulkId]
      );
      if (parseInt(remaining.rows[0].c) === 0) {
        await client.query("UPDATE bulk_bookings SET status = 'confirmed' WHERE id = $1", [bulkId]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true, slot: newSlot.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to rebook slot' });
  }
});

// GET /api/admin/bulk-bookings/export — CSV
app.get('/api/admin/bulk-bookings/export', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT bb.booking_ref, bb.customer_name, bb.customer_email, bb.customer_phone,
             bb.service, bb.session_count, bb.total_amount, bb.currency, bb.status, bb.created_at,
             b.booking_ref as session_ref, b.status as session_status,
             s.date::text, s.time::text, s.duration
      FROM   bulk_bookings bb
      JOIN   bookings b ON b.bulk_booking_id = bb.id
      JOIN   slots s ON s.id = b.slot_id
      ORDER  BY bb.created_at DESC, s.date ASC
    `);
    const headers = ['BulkRef','Name','Email','Phone','Service','TotalSessions','TotalAmount','Currency','BulkStatus','BookedAt','SessionRef','SessionStatus','Date','Time','Duration'];
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = result.rows.map(r => [
      r.booking_ref, r.customer_name, r.customer_email, r.customer_phone,
      r.service, r.session_count, r.total_amount, r.currency, r.status, r.created_at,
      r.session_ref, r.session_status, r.date, r.time, r.duration
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bulk-bookings-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export' });
  }
});

// GET /api/admin/bookings/export  — CSV download
app.get('/api/admin/bookings/export', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.customer_name, b.customer_email, b.customer_phone,
             b.service, b.status, b.message, b.created_at,
             s.date, s.time, s.duration, s.price, s.currency
      FROM   bookings b
      JOIN   slots s ON s.id = b.slot_id
      ORDER  BY b.created_at DESC
    `);

    const bookings = result.rows;
    const headers = ['ID','Name','Email','Phone','Service','Status','Date','Time','Duration(min)','Price','Currency','Message','BookedAt'];
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = bookings.map(b => [
      b.id, b.customer_name, b.customer_email, b.customer_phone,
      b.service, b.status, b.date, b.time, b.duration, b.price, b.currency,
      b.message, b.created_at
    ].map(escape).join(','));

    const csv = [headers.join(','), ...rows].join('\r\n');
    const filename = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export bookings' });
  }
});

// ════════════════════════════════════════════════════════════
// ADMIN UTILITY ENDPOINTS
// ════════════════════════════════════════════════════════════

// GET /api/admin/config — returns Stripe + email config status
app.get('/api/admin/config', requireAdmin, (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const stripeConfigured = stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_');
  const stripeMode = stripeKey.startsWith('sk_live_') ? 'live' : stripeKey.startsWith('sk_test_') ? 'test' : 'not_configured';
  const emailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  res.json({
    stripe: { configured: stripeConfigured, mode: stripeMode },
    email:  { configured: emailConfigured, host: process.env.SMTP_HOST || null, from: process.env.SMTP_FROM || null, adminEmail: process.env.ADMIN_EMAIL || null },
  });
});

// POST /api/admin/test-email — sends a test email
app.post('/api/admin/test-email', requireAdmin, async (req, res) => {
  const { to } = req.body;
  const { sendTestEmail } = require('./mailer');
  const recipient = to || process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  if (!recipient) return res.status(400).json({ error: 'No recipient address. Set ADMIN_EMAIL in .env or pass "to" in body.' });
  try {
    await sendTestEmail(recipient);
    res.json({ success: true, message: `Test email sent to ${recipient}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
// STARTUP
// ════════════════════════════════════════════════════════════
const cms = require('./cms');

async function init() {
  await initDatabase();
  await cms.init(pool, app, requireAdmin);
  return app;
}

async function start() {
  await init();
  app.listen(PORT, () => {
    console.log(`\n✦ Sacred Healing Server running at http://localhost:${PORT}`);
    console.log(`✦ Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`✦ Admin Password: [set — check .env or ADMIN_PASSWORD env var]\n`);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { init, pool };
