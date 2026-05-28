const request = require('supertest');
const { init, pool } = require('../server');

const ADMIN_PWD = process.env.ADMIN_PASSWORD || 'test-admin-secret';
const AUTH      = { 'x-admin-password': ADMIN_PWD, 'Content-Type': 'application/json' };

// Unique test date far in future to avoid conflicting with real slots
const TEST_DATE = '2099-12-30';
const TEST_DATE2 = '2099-12-31';

let app;
let testSlotId;
let testBookingId;
let testServiceId;
let testFaqId;
let testReviewId;

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await init();

  // Ensure test date slots don't exist from prior runs
  await pool.query("DELETE FROM bookings WHERE slot_id IN (SELECT id FROM slots WHERE date = $1)", [TEST_DATE]);
  await pool.query("DELETE FROM slots WHERE date = $1 OR date = $2", [TEST_DATE, TEST_DATE2]);
});

afterAll(async () => {
  // Clean up all test data
  await pool.query("DELETE FROM bookings WHERE slot_id IN (SELECT id FROM slots WHERE date = $1)", [TEST_DATE]);
  await pool.query("DELETE FROM slots WHERE date = $1 OR date = $2", [TEST_DATE, TEST_DATE2]);
  if (testServiceId) await pool.query("DELETE FROM services WHERE id = $1", [testServiceId]);
  if (testFaqId)     await pool.query("DELETE FROM faqs WHERE id = $1",     [testFaqId]);
  if (testReviewId)  await pool.query("DELETE FROM reviews WHERE id = $1",  [testReviewId]);
  await pool.end();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function adminReq(method, url) {
  return request(app)[method](url).set(AUTH);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC CONTENT API
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/content', () => {
  it('returns 200 with content, services, reviews and faqs', async () => {
    const res = await request(app).get('/api/content');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('content');
    expect(res.body).toHaveProperty('services');
    expect(res.body).toHaveProperty('reviews');
    expect(res.body).toHaveProperty('faqs');
    expect(Array.isArray(res.body.services)).toBe(true);
    expect(Array.isArray(res.body.faqs)).toBe(true);
  });

  it('returns at least one service', async () => {
    const res = await request(app).get('/api/content');
    expect(res.body.services.length).toBeGreaterThan(0);
    const svc = res.body.services[0];
    expect(svc).toHaveProperty('title');
    expect(svc).toHaveProperty('price');
    expect(Array.isArray(svc.features)).toBe(true);
  });

  it('content includes required site keys', async () => {
    const res = await request(app).get('/api/content');
    expect(res.body.content).toHaveProperty('hero_title');
    expect(res.body.content).toHaveProperty('contact_email');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. PUBLIC SLOTS API
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/slots', () => {
  it('returns 200 with slots array', async () => {
    const res = await request(app).get('/api/slots');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
  });

  it('accepts duration filter 60', async () => {
    const res = await request(app).get('/api/slots?duration=60');
    expect(res.status).toBe(200);
    res.body.slots.forEach(s => expect(s.duration).toBe(60));
  });

  it('accepts duration filter 90+', async () => {
    const res = await request(app).get('/api/slots?duration=90%2B');
    expect(res.status).toBe(200);
    res.body.slots.forEach(s => expect(s.duration).toBeGreaterThanOrEqual(90));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. ADMIN AUTH
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Authentication', () => {
  it('POST /api/admin/login — correct password returns token', async () => {
    const res = await request(app).post('/api/admin/login')
      .send({ password: ADMIN_PWD });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBe(ADMIN_PWD);
  });

  it('POST /api/admin/login — wrong password returns 401', async () => {
    const res = await request(app).post('/api/admin/login')
      .send({ password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/slots — no auth returns 401', async () => {
    const res = await request(app).get('/api/admin/slots');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/slots — wrong auth returns 401', async () => {
    const res = await request(app).get('/api/admin/slots')
      .set('x-admin-password', 'wrong');
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. ADMIN SLOTS MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Slots', () => {
  it('GET /api/admin/slots — returns slots array', async () => {
    const res = await adminReq('get', '/api/admin/slots');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
  });

  it('POST /api/admin/slots — creates slot', async () => {
    const res = await adminReq('post', '/api/admin/slots')
      .send({ date: TEST_DATE, time: '10:00', duration: 60 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
    testSlotId = res.body.id;
  });

  it('POST /api/admin/slots — duplicate returns 409', async () => {
    const res = await adminReq('post', '/api/admin/slots')
      .send({ date: TEST_DATE, time: '10:00', duration: 60 });
    expect(res.status).toBe(409);
  });

  it('POST /api/admin/slots — missing date returns 400', async () => {
    const res = await adminReq('post', '/api/admin/slots')
      .send({ time: '10:00' });
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/slots/bulk — creates multiple slots', async () => {
    const slots = [
      { date: TEST_DATE2, time: '09:00', duration: 60 },
      { date: TEST_DATE2, time: '11:00', duration: 90 },
      { date: TEST_DATE2, time: '11:00', duration: 60 }, // duplicate — should be skipped
    ];
    const res = await adminReq('post', '/api/admin/slots/bulk').send({ slots });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.added).toBe(3); // count includes attempted inserts
  });

  it('POST /api/admin/slots/bulk — empty array returns 400', async () => {
    const res = await adminReq('post', '/api/admin/slots/bulk').send({ slots: [] });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/admin/slots/:id — updates duration and note', async () => {
    const res = await adminReq('patch', `/api/admin/slots/${testSlotId}`)
      .send({ duration: 90, note: 'test note' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PATCH /api/admin/slots/:id — non-existent slot returns 404', async () => {
    const res = await adminReq('patch', '/api/admin/slots/99999999')
      .send({ duration: 60 });
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. PUBLIC BOOKING API
// ════════════════════════════════════════════════════════════════════════════

describe('Booking', () => {
  it('POST /api/bookings — creates booking for free session', async () => {
    // Guided Meditation is free (price=0) — Stripe won't trigger
    const res = await request(app).post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send({
        slot_id: testSlotId,
        service: 'Guided Meditation',
        customer_name: 'Test User',
        customer_email: 'test@example.com',
        customer_phone: '',
        message: 'Test booking',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.booking_id).toBeDefined();
    expect(res.body.booking_ref).toMatch(/^SH-[A-Z0-9]{8}$/);
    testBookingId = res.body.booking_id;
  });

  it('POST /api/bookings — double-booking returns 409', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send({
        slot_id: testSlotId,
        service: 'Guided Meditation',
        customer_name: 'Another User',
        customer_email: 'other@example.com',
      });
    expect(res.status).toBe(409);
  });

  it('POST /api/bookings — missing required fields returns 400', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send({ slot_id: testSlotId });
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. ADMIN BOOKINGS MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Bookings', () => {
  it('GET /api/admin/bookings — returns bookings array', async () => {
    const res = await adminReq('get', '/api/admin/bookings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookings)).toBe(true);
    const found = res.body.bookings.find(b => b.id === testBookingId);
    expect(found).toBeDefined();
    expect(found.service).toBe('Guided Meditation');
  });

  it('PATCH /api/admin/bookings/:id — confirms booking', async () => {
    const res = await adminReq('patch', `/api/admin/bookings/${testBookingId}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PATCH /api/admin/bookings/:id — cancels booking and frees slot', async () => {
    const res = await adminReq('patch', `/api/admin/bookings/${testBookingId}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);

    // Slot should now be free again
    const slotRes = await request(app).get('/api/slots');
    const freed = slotRes.body.slots.find(s => s.id === testSlotId);
    expect(freed).toBeDefined();
  });

  it('PATCH /api/admin/bookings/:id — invalid status returns 400', async () => {
    const res = await adminReq('patch', `/api/admin/bookings/${testBookingId}`)
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/admin/bookings/:id — non-existent booking returns 404', async () => {
    const res = await adminReq('patch', '/api/admin/bookings/99999999')
      .send({ status: 'confirmed' });
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. ADMIN STATS + EXPORT
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Stats and Export', () => {
  it('GET /api/admin/stats — returns numeric stats', async () => {
    const res = await adminReq('get', '/api/admin/stats');
    expect(res.status).toBe(200);
    const stats = res.body;
    expect(typeof stats.totalSlots).toBe('number');
    expect(typeof stats.availableSlots).toBe('number');
    expect(typeof stats.totalBookings).toBe('number');
    expect(typeof stats.pendingBookings).toBe('number');
    expect(typeof stats.confirmedBookings).toBe('number');
    expect(typeof stats.todayBookings).toBe('number');
    expect(typeof stats.revenue).toBe('number');
  });

  it('GET /api/admin/bookings/export — returns CSV', async () => {
    const res = await adminReq('get', '/api/admin/bookings/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('ID,Name,Email');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. ADMIN SLOT DELETE (after bookings tests, slot is now unbooked)
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Slot Delete', () => {
  it('DELETE /api/admin/slots/:id — deletes free slot', async () => {
    const res = await adminReq('delete', `/api/admin/slots/${testSlotId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    testSlotId = null;
  });

  it('DELETE /api/admin/slots/:id — non-existent returns 404', async () => {
    const res = await adminReq('delete', '/api/admin/slots/99999999');
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. SITE CONTENT MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Content Management', () => {
  it('PUT /api/admin/content — updates content key', async () => {
    const res = await adminReq('put', '/api/admin/content')
      .send({ content: { test_key_jest: 'jest_test_value' } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/content — reflects updated content', async () => {
    const res = await request(app).get('/api/content');
    expect(res.body.content.test_key_jest).toBe('jest_test_value');
  });

  it('PUT /api/admin/content — missing body returns 400', async () => {
    const res = await adminReq('put', '/api/admin/content').send({});
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. SERVICES MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Services Management', () => {
  it('POST /api/admin/services — creates service', async () => {
    const res = await adminReq('post', '/api/admin/services')
      .send({
        title: 'Jest Test Service',
        description: 'Test description',
        features: ['feature 1', 'feature 2'],
        duration: 60,
        price: 50,
        order_num: 99,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Get the new service ID
    const content = await request(app).get('/api/content');
    const svc = content.body.services.find(s => s.title === 'Jest Test Service');
    expect(svc).toBeDefined();
    testServiceId = svc.id;
  });

  it('PUT /api/admin/services/:id — updates service', async () => {
    const res = await adminReq('put', `/api/admin/services/${testServiceId}`)
      .send({
        title: 'Jest Test Service',
        description: 'Updated description',
        features: ['feature 1'],
        duration: 90,
        price: 75,
        order_num: 99,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/admin/services/:id — deletes service', async () => {
    const res = await adminReq('delete', `/api/admin/services/${testServiceId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    testServiceId = null;
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11. FAQ MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

describe('Admin FAQ Management', () => {
  it('POST /api/admin/faqs — creates FAQ', async () => {
    const res = await adminReq('post', '/api/admin/faqs')
      .send({ question: 'Jest test question?', answer: 'Jest test answer.', order_num: 99 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const content = await request(app).get('/api/content');
    const faq = content.body.faqs.find(f => f.question === 'Jest test question?');
    expect(faq).toBeDefined();
    testFaqId = faq.id;
  });

  it('PUT /api/admin/faqs/:id — updates FAQ', async () => {
    const res = await adminReq('put', `/api/admin/faqs/${testFaqId}`)
      .send({ question: 'Updated question?', answer: 'Updated answer.', order_num: 99 });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/admin/faqs/:id — deletes FAQ', async () => {
    const res = await adminReq('delete', `/api/admin/faqs/${testFaqId}`);
    expect(res.status).toBe(200);
    testFaqId = null;
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 12. REVIEWS MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

describe('Reviews', () => {
  it('POST /api/reviews — submits review (pending)', async () => {
    const res = await request(app).post('/api/reviews')
      .set('Content-Type', 'application/json')
      .send({ author: 'Jest Tester', comment: 'Automated test review.' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/reviews — missing fields returns 400', async () => {
    const res = await request(app).post('/api/reviews')
      .set('Content-Type', 'application/json')
      .send({ author: 'No comment' });
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/reviews — returns reviews including pending', async () => {
    const res = await adminReq('get', '/api/admin/reviews');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    const pending = res.body.reviews.find(r => r.author === 'Jest Tester');
    expect(pending).toBeDefined();
    expect(pending.status).toBe('pending');
    testReviewId = pending.id;
  });

  it('PUT /api/admin/reviews/:id — approves review', async () => {
    const res = await adminReq('put', `/api/admin/reviews/${testReviewId}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/content — approved review appears in public reviews', async () => {
    const res = await request(app).get('/api/content');
    const review = res.body.reviews.find(r => r.author === 'Jest Tester');
    expect(review).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 13. SERVICE SLUG API
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/services/:slug', () => {
  it('returns service detail for known slug', async () => {
    const res = await request(app).get('/api/services/spiritual-healing');
    expect(res.status).toBe(200);
    expect(res.body.service).toBeDefined();
    expect(res.body.service.title).toBe('Spiritual Healing');
    expect(Array.isArray(res.body.service.features)).toBe(true);
    expect(res.body.all).toBeDefined();
  });

  it('returns 404 for unknown slug', async () => {
    const res = await request(app).get('/api/services/does-not-exist');
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 14. ADMIN CONFIG
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/admin/config', () => {
  it('returns config status without auth → 401', async () => {
    const res = await request(app).get('/api/admin/config');
    expect(res.status).toBe(401);
  });

  it('returns config status with auth', async () => {
    const res = await adminReq('get', '/api/admin/config');
    expect(res.status).toBe(200);
    expect(res.body.stripe).toHaveProperty('configured');
    expect(res.body.stripe).toHaveProperty('mode');
    expect(res.body.email).toHaveProperty('configured');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 15. STRIPE PUBLIC KEY ENDPOINT
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/stripe-key', () => {
  it('returns publishableKey field (null when Stripe not configured in test env)', async () => {
    const res = await request(app).get('/api/stripe-key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('publishableKey');
    // In test env STRIPE_SECRET_KEY is empty, so publishableKey should be null
    expect(res.body.publishableKey).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 16. PAYMENT CONFIRM ENDPOINT — validation only (no real Stripe in tests)
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/bookings/confirm', () => {
  it('returns 400 when booking_id or payment_intent_id missing', async () => {
    const res = await request(app).post('/api/bookings/confirm')
      .set('Content-Type', 'application/json')
      .send({ booking_id: 1 }); // missing payment_intent_id
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when both fields missing', async () => {
    const res = await request(app).post('/api/bookings/confirm')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(400);
  });
});
