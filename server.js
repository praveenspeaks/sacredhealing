const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const { sendBookingConfirmation, sendAdminAlert } = require('./mailer');

const crypto = require('crypto');
const pool   = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
const corsOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin } : {}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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
}

// ════════════════════════════════════════════════════════════
// CLEAN SEO URLS FOR SERVICES
// ════════════════════════════════════════════════════════════

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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

// GET /api/slots  — Available future slots (unbooked only)
app.get('/api/slots', async (req, res) => {
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
app.post('/api/bookings', async (req, res) => {
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

    const cancelToken = crypto.randomBytes(32).toString('hex');

    const client = await pool.connect();
    let bookingId;
    try {
      await client.query('BEGIN');
      const bookingResult = await client.query(`
        INSERT INTO bookings (slot_id, service, customer_name, customer_email, customer_phone, message, cancel_token)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        slot_id,
        service.trim(),
        customer_name.trim(),
        customer_email.trim().toLowerCase(),
        (customer_phone || '').trim(),
        (message || '').trim(),
        cancelToken
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

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const cancelUrl = `${baseUrl}/cancel?token=${cancelToken}`;

    // Look up service price — payment is driven by service type, not slot
    const svcResult = await pool.query('SELECT price FROM services WHERE title = $1', [service.trim()]);
    const servicePrice = svcResult.rows[0] ? parseFloat(svcResult.rows[0].price) : 0;

    if (servicePrice > 0 && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'gbp',
              product_data: {
                name: service + ' Session',
                description: `Date: ${slot.date} at ${slot.time} (${slot.duration} min)`,
              },
              unit_amount: Math.round(servicePrice * 100),
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${process.env.BASE_URL || `${req.protocol}://${req.get('host')}`}/api/bookings/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url:  `${process.env.BASE_URL || `${req.protocol}://${req.get('host')}`}/api/bookings/cancel?session_id={CHECKOUT_SESSION_ID}`,
          metadata: { booking_id: bookingId },
        });
        return res.status(201).json({ checkout_url: session.url });
      } catch (err) {
        console.error('Stripe error:', err);
        await pool.query('UPDATE slots SET is_booked = 0 WHERE id = $1', [slot_id]);
        await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
        return res.status(500).json({ error: 'Failed to initialize payment gateway. Please ensure Stripe is configured or contact support.' });
      }
    }

    sendBookingConfirmation({ customerName: customer_name, customerEmail: customer_email, service, slot, cancelUrl })
      .catch(err => console.error('Confirmation email error:', err));
    sendAdminAlert({ customerName: customer_name, customerEmail: customer_email, customerPhone: customer_phone, service, slot, message, cancelUrl })
      .catch(err => console.error('Admin alert email error:', err));

    res.status(201).json({
      success: true,
      message: 'Your session has been booked! We will confirm shortly.',
      booking_id: bookingId,
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

// GET /api/bookings/success — Stripe success redirect endpoint
app.get('/api/bookings/success', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.redirect('/');
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const bookingId = session.metadata.booking_id;
    if (session.payment_status === 'paid') {
      await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', ['confirmed', bookingId]);
    }
    res.redirect(`/?booking=success&booking_id=${bookingId}`);
  } catch (err) {
    console.error('Stripe retrieve error:', err);
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
    const bookingResult = await pool.query('SELECT slot_id FROM bookings WHERE id = $1', [bookingId]);
    const booking = bookingResult.rows[0];
    if (booking) {
      await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', ['cancelled', bookingId]);
      await pool.query('UPDATE slots SET is_booked = 0 WHERE id = $1', [booking.slot_id]);
    }
    res.redirect('/?booking=cancel');
  } catch (err) {
    console.error('Stripe cancel retrieve error:', err);
    res.redirect('/');
  }
});

// ════════════════════════════════════════════════════════════
// ADMIN ROUTES (protected)
// ════════════════════════════════════════════════════════════

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
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
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
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
// STARTUP
// ════════════════════════════════════════════════════════════
const cms = require('./cms');

async function start() {
  await initDatabase();
  await cms.init(pool, app, requireAdmin);
  app.listen(PORT, () => {
    console.log(`\n✦ Sacred Healing Server running at http://localhost:${PORT}`);
    console.log(`✦ Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`✦ Admin Password: ${ADMIN_PASSWORD}\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
