const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Database Setup ──────────────────────────────────────────
const db = new Database(path.join(__dirname, 'sacredhealing.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS slots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL,
    time        TEXT    NOT NULL,
    duration    INTEGER DEFAULT 60,
    price       REAL    DEFAULT 0,
    currency    TEXT    DEFAULT 'GBP',
    note        TEXT    DEFAULT '',
    is_booked   INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id        INTEGER NOT NULL,
    service        TEXT    NOT NULL,
    customer_name  TEXT    NOT NULL,
    customer_email TEXT    NOT NULL,
    customer_phone TEXT    DEFAULT '',
    message        TEXT    DEFAULT '',
    status         TEXT    DEFAULT 'pending',
    created_at     TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (slot_id) REFERENCES slots(id)
  );
`);

// Admin config
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sacred2024';

function requireAdmin(req, res, next) {
  const auth = req.headers['x-admin-password'];
  if (!auth || auth !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Currency helpers ────────────────────────────────────────
const CURRENCY_SYMBOLS = { GBP: '£', USD: '$', EUR: '€', INR: '₹', AUD: 'A$' };

// ════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════════════════

// GET /api/slots  — Available future slots (unbooked only)
app.get('/api/slots', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { duration } = req.query; // optional filter: 15, 30, 60, 90+

    let query = `
      SELECT id, date, time, duration, price, currency, note
      FROM   slots
      WHERE  is_booked = 0
        AND  date >= ?
    `;
    const params = [today];

    if (duration === '90+') {
      query += ' AND duration >= 90';
    } else if (duration) {
      query += ' AND duration = ?';
      params.push(parseInt(duration));
    }

    query += ' ORDER BY date ASC, time ASC';

    const slots = db.prepare(query).all(...params);
    res.json({ slots });
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

    const slot = db.prepare('SELECT * FROM slots WHERE id = ? AND is_booked = 0').get(slot_id);
    if (!slot) {
      return res.status(409).json({ error: 'This slot is no longer available. Please choose another time.' });
    }

    const insertBooking = db.prepare(`
      INSERT INTO bookings (slot_id, service, customer_name, customer_email, customer_phone, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const markBooked = db.prepare('UPDATE slots SET is_booked = 1 WHERE id = ?');

    const transaction = db.transaction(() => {
      const info = insertBooking.run(
        slot_id,
        service.trim(),
        customer_name.trim(),
        customer_email.trim().toLowerCase(),
        (customer_phone || '').trim(),
        (message || '').trim()
      );
      markBooked.run(slot_id);
      return info.lastInsertRowid;
    });

    const bookingId = transaction();

    // If there is a price and Stripe is somewhat configured (not empty string)
    if (slot.price > 0 && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: slot.currency.toLowerCase(),
              product_data: {
                name: service + ' Session',
                description: \`Date: \${slot.date} at \${slot.time} (\${slot.duration} min)\`,
              },
              unit_amount: Math.round(slot.price * 100),
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: \`\${req.protocol}://\${req.get('host')}/api/bookings/success?session_id={CHECKOUT_SESSION_ID}\`,
          cancel_url: \`\${req.protocol}://\${req.get('host')}/api/bookings/cancel?session_id={CHECKOUT_SESSION_ID}\`,
          metadata: { booking_id: bookingId },
        });

        // Return the checkout url for the frontend to redirect
        return res.status(201).json({ checkout_url: session.url });
      } catch (err) {
        console.error('Stripe error:', err);
        // If Stripe fails, fallback to standard error but we should actually unbook the slot
        db.prepare('UPDATE slots SET is_booked = 0 WHERE id = ?').run(slot_id);
        db.prepare('DELETE FROM bookings WHERE id = ?').run(bookingId);
        return res.status(500).json({ error: 'Failed to initialize payment gateway. Please ensure Stripe is configured or contact support.' });
      }
    }

    // Default flow for free slots
    res.status(201).json({
      success: true,
      message: 'Your session has been booked! We will confirm shortly.',
      booking_id: bookingId,
      slot: {
        date: slot.date,
        time: slot.time,
        duration: slot.duration,
        price: slot.price,
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
      db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('confirmed', bookingId);
    }
    // Redirect to frontend with success marker
    res.redirect(\`/?booking=success&booking_id=\${bookingId}\`);
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
    const booking = db.prepare('SELECT slot_id FROM bookings WHERE id = ?').get(bookingId);
    if (booking) {
      db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('cancelled', bookingId);
      db.prepare('UPDATE slots SET is_booked = 0 WHERE id = ?').run(booking.slot_id);
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
app.get('/api/admin/slots', requireAdmin, (req, res) => {
  try {
    const slots = db.prepare(`
      SELECT s.*, b.service, b.customer_name, b.customer_email, b.customer_phone, b.status as booking_status
      FROM   slots s
      LEFT   JOIN bookings b ON b.slot_id = s.id
      ORDER  BY s.date DESC, s.time ASC
    `).all();
    res.json({ slots });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// POST /api/admin/slots  — Add single slot
app.post('/api/admin/slots', requireAdmin, (req, res) => {
  try {
    const { date, time, duration, price, currency, note } = req.body;
    if (!date || !time) return res.status(400).json({ error: 'date and time are required.' });

    const existing = db.prepare('SELECT id FROM slots WHERE date = ? AND time = ?').get(date, time);
    if (existing) return res.status(409).json({ error: 'A slot already exists for this date and time.' });

    const info = db.prepare(`
      INSERT INTO slots (date, time, duration, price, currency, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(date, time, duration || 60, price || 0, currency || 'GBP', note || '');

    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add slot' });
  }
});

// POST /api/admin/slots/bulk  — Bulk add slots
app.post('/api/admin/slots/bulk', requireAdmin, (req, res) => {
  try {
    const { slots } = req.body;
    if (!Array.isArray(slots) || !slots.length) return res.status(400).json({ error: 'slots array required.' });

    const insert = db.prepare(`
      INSERT OR IGNORE INTO slots (date, time, duration, price, currency, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((arr) => {
      let count = 0;
      for (const s of arr) {
        if (s.date && s.time) {
          insert.run(s.date, s.time, s.duration || 60, s.price || 0, s.currency || 'GBP', s.note || '');
          count++;
        }
      }
      return count;
    });

    const count = insertMany(slots);
    res.status(201).json({ success: true, added: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to bulk add slots' });
  }
});

// PATCH /api/admin/slots/:id  — Update price/duration/note of available slot
app.patch('/api/admin/slots/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { price, duration, note, currency } = req.body;
    const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(id);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.is_booked) return res.status(409).json({ error: 'Cannot edit a booked slot.' });

    db.prepare(`
      UPDATE slots SET
        price    = COALESCE(?, price),
        duration = COALESCE(?, duration),
        note     = COALESCE(?, note),
        currency = COALESCE(?, currency)
      WHERE id = ?
    `).run(
      price !== undefined ? price : null,
      duration !== undefined ? duration : null,
      note !== undefined ? note : null,
      currency !== undefined ? currency : null,
      id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update slot' });
  }
});

// DELETE /api/admin/slots/:id
app.delete('/api/admin/slots/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(id);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.is_booked) return res.status(409).json({ error: 'Cannot delete a booked slot. Cancel the booking first.' });
    db.prepare('DELETE FROM slots WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

// GET /api/admin/bookings
app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT b.*, s.date, s.time, s.duration, s.price, s.currency
      FROM   bookings b
      JOIN   slots s ON s.id = b.slot_id
      ORDER  BY b.created_at DESC
    `).all();
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// PATCH /api/admin/bookings/:id  — Update booking status
app.patch('/api/admin/bookings/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const info = db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id);
    if (info.changes === 0) return res.status(404).json({ error: 'Booking not found' });

    if (status === 'cancelled') {
      const booking = db.prepare('SELECT slot_id FROM bookings WHERE id = ?').get(id);
      if (booking) db.prepare('UPDATE slots SET is_booked = 0 WHERE id = ?').run(booking.slot_id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const stats = {
      totalSlots:        db.prepare('SELECT COUNT(*) as c FROM slots').get().c,
      availableSlots:    db.prepare('SELECT COUNT(*) as c FROM slots WHERE is_booked = 0 AND date >= ?').get(today).c,
      totalBookings:     db.prepare('SELECT COUNT(*) as c FROM bookings').get().c,
      pendingBookings:   db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'").get().c,
      confirmedBookings: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'confirmed'").get().c,
      todayBookings:     db.prepare("SELECT COUNT(*) as c FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE s.date = ?").get(today).c,
      revenue:           db.prepare("SELECT COALESCE(SUM(s.price),0) as r FROM bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status != 'cancelled'").get().r,
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.listen(PORT, () => {
  console.log(`\n✦ Sacred Healing Server running at http://localhost:${PORT}`);
  console.log(`✦ Admin Panel: http://localhost:${PORT}/admin.html`);
  console.log(`✦ Admin Password: ${ADMIN_PASSWORD}\n`);
});
