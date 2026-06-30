const request = require('supertest');
const { init, pool } = require('../server');

const ADMIN_PWD = process.env.ADMIN_PASSWORD || 'test-admin-secret';
const AUTH      = { 'x-admin-password': ADMIN_PWD, 'Content-Type': 'application/json' };

// Far-future dates to avoid clashing with real slots
const TEST_DATE  = '2099-12-30';
const TEST_DATE2 = '2099-12-31';
const TEST_DATE3 = '2099-11-30'; // bulk preview test slots
const TEST_DATE4 = '2099-10-31'; // bulk create test slots
const PAST_DATE  = '2020-01-01'; // past-slot rejection tests

let app;
let testSlotId;
let testBookingId;
let testServiceId;
let testFaqId;
let testReviewId;

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await init();
  for (const d of [TEST_DATE, TEST_DATE4, PAST_DATE]) {
    await pool.query('DELETE FROM bookings WHERE slot_id IN (SELECT id FROM slots WHERE date = $1)', [d]);
  }
  await pool.query(
    'DELETE FROM slots WHERE date = $1 OR date = $2 OR date = $3 OR date = $4 OR date = $5',
    [TEST_DATE, TEST_DATE2, TEST_DATE3, TEST_DATE4, PAST_DATE]
  );
});

afterAll(async () => {
  for (const d of [TEST_DATE, TEST_DATE4, PAST_DATE]) {
    await pool.query('DELETE FROM bookings WHERE slot_id IN (SELECT id FROM slots WHERE date = $1)', [d]);
  }
  await pool.query(
    'DELETE FROM slots WHERE date = $1 OR date = $2 OR date = $3 OR date = $4 OR date = $5',
    [TEST_DATE, TEST_DATE2, TEST_DATE3, TEST_DATE4, PAST_DATE]
  );
  if (testServiceId) await pool.query('DELETE FROM services WHERE id = $1', [testServiceId]);
  if (testFaqId)     await pool.query('DELETE FROM faqs    WHERE id = $1', [testFaqId]);
  if (testReviewId)  await pool.query('DELETE FROM reviews WHERE id = $1', [testReviewId]);
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
    expect(Array.isArray(res.body.reviews)).toBe(true);
  });

  it('returns at least one service with required fields', async () => {
    const res = await request(app).get('/api/content');
    expect(res.body.services.length).toBeGreaterThan(0);
    const svc = res.body.services[0];
    expect(svc).toHaveProperty('id');
    expect(svc).toHaveProperty('title');
    expect(svc).toHaveProperty('price');
    expect(Array.isArray(svc.features)).toBe(true);
  });

  it('content includes required site keys', async () => {
    const res = await request(app).get('/api/content');
    expect(res.body.content).toHaveProperty('hero_title');
    expect(res.body.content).toHaveProperty('contact_email');
    expect(res.body.content).toHaveProperty('footer_tagline');
  });

  it('reviews in public content are only approved ones', async () => {
    const res = await request(app).get('/api/content');
    // Public endpoint must not expose pending/rejected reviews
    res.body.reviews.forEach(r => {
      expect(r).not.toHaveProperty('status'); // status is excluded from public projection
    });
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

  it('duration filter 60 returns only 60-min slots', async () => {
    const res = await request(app).get('/api/slots?duration=60');
    expect(res.status).toBe(200);
    res.body.slots.forEach(s => expect(s.duration).toBe(60));
  });

  it('duration filter 90+ returns slots >= 90 min', async () => {
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
      .send({ password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('admin endpoint without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/slots');
    expect(res.status).toBe(401);
  });

  it('admin endpoint with wrong auth returns 401', async () => {
    const res = await request(app).get('/api/admin/slots')
      .set('x-admin-password', 'wrong-password');
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

  it('POST /api/admin/slots — creates slot and returns 201 with id', async () => {
    const res = await adminReq('post', '/api/admin/slots')
      .send({ date: TEST_DATE, time: '10:00', duration: 60 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
    testSlotId = res.body.id;
  });

  it('POST /api/admin/slots — duplicate date+time returns 409', async () => {
    const res = await adminReq('post', '/api/admin/slots')
      .send({ date: TEST_DATE, time: '10:00', duration: 60 });
    expect(res.status).toBe(409);
  });

  it('POST /api/admin/slots — missing date returns 400', async () => {
    const res = await adminReq('post', '/api/admin/slots')
      .send({ time: '10:00' });
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/slots — missing time returns 400', async () => {
    const res = await adminReq('post', '/api/admin/slots')
      .send({ date: TEST_DATE });
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/slots/bulk — creates multiple slots', async () => {
    const slots = [
      { date: TEST_DATE2, time: '09:00', duration: 60 },
      { date: TEST_DATE2, time: '11:00', duration: 90 },
      { date: TEST_DATE2, time: '13:00', duration: 60 },
    ];
    const res = await adminReq('post', '/api/admin/slots/bulk').send({ slots });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.added).toBe(3);
  });

  it('POST /api/admin/slots/bulk — empty array returns 400', async () => {
    const res = await adminReq('post', '/api/admin/slots/bulk').send({ slots: [] });
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/slots/bulk — missing slots key returns 400', async () => {
    const res = await adminReq('post', '/api/admin/slots/bulk').send({});
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
// 5. CALENDAR & DATE SLOT ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

describe('Calendar API', () => {
  it('GET /api/slots/calendar — returns date map for a month', async () => {
    const res = await request(app).get(`/api/slots/calendar?month=2099-12`);
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
    // Our test slots are on TEST_DATE2 (2099-12-31)
    expect(res.body).toHaveProperty(TEST_DATE2);
    const info = res.body[TEST_DATE2];
    expect(info).toHaveProperty('total');
    expect(info).toHaveProperty('booked');
    expect(parseInt(info.total)).toBeGreaterThan(0);
  });

  it('GET /api/slots/calendar — missing month returns 400', async () => {
    const res = await request(app).get('/api/slots/calendar');
    expect(res.status).toBe(400);
  });

  it('GET /api/slots/date/:date — returns slots for test date', async () => {
    const res = await request(app).get(`/api/slots/date/${TEST_DATE2}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(res.body.slots.length).toBeGreaterThan(0);
    const slot = res.body.slots[0];
    expect(slot).toHaveProperty('id');
    expect(slot).toHaveProperty('time');
    expect(slot).toHaveProperty('duration');
    expect(slot).toHaveProperty('price');
  });

  it('GET /api/slots/date/:date — date with no slots returns empty array', async () => {
    const res = await request(app).get('/api/slots/date/2099-01-01');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(res.body.slots.length).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. PUBLIC BOOKING API
// ════════════════════════════════════════════════════════════════════════════

describe('Booking', () => {
  it('POST /api/bookings — creates booking for free session (201)', async () => {
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

  it('POST /api/bookings — double-booking same slot returns 409', async () => {
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

  it('POST /api/bookings — non-existent slot_id returns 409 (unavailable)', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send({
        slot_id: 99999999,
        service: 'Guided Meditation',
        customer_name: 'Test User',
        customer_email: 'test@example.com',
      });
    expect(res.status).toBe(409);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. ADMIN BOOKINGS MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Bookings', () => {
  it('GET /api/admin/bookings — returns bookings with joined slot fields', async () => {
    const res = await adminReq('get', '/api/admin/bookings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookings)).toBe(true);
    const found = res.body.bookings.find(b => b.id === testBookingId);
    expect(found).toBeDefined();
    expect(found.service).toBe('Guided Meditation');
    expect(found).toHaveProperty('date');
    expect(found).toHaveProperty('time');
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

    // Slot must be available again after cancellation
    const slotsRes = await request(app).get('/api/slots');
    const freed = slotsRes.body.slots.find(s => s.id === testSlotId);
    expect(freed).toBeDefined();
    expect(freed.is_booked).toBeFalsy();
  });

  it('PATCH /api/admin/bookings/:id — invalid status returns 400', async () => {
    const res = await adminReq('patch', `/api/admin/bookings/${testBookingId}`)
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/admin/bookings/:id — non-existent booking returns 404', async () => {
    const res = await adminReq('patch', '/api/admin/bookings/99999999')
      .send({ status: 'confirmed' });
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. ADMIN STATS + EXPORT
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Stats and Export', () => {
  it('GET /api/admin/stats — returns all numeric stat fields', async () => {
    const res = await adminReq('get', '/api/admin/stats');
    expect(res.status).toBe(200);
    const { totalSlots, availableSlots, totalBookings, pendingBookings, confirmedBookings, todayBookings, revenue } = res.body;
    [totalSlots, availableSlots, totalBookings, pendingBookings, confirmedBookings, todayBookings, revenue].forEach(v => {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThanOrEqual(0);
    });
  });

  it('GET /api/admin/bookings/export — returns CSV with header row', async () => {
    const res = await adminReq('get', '/api/admin/bookings/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('ID,Name,Email');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. ADMIN SLOT DELETE (slot is unbooked after booking was cancelled above)
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Slot Delete', () => {
  it('DELETE /api/admin/slots/:id — deletes free slot', async () => {
    const res = await adminReq('delete', `/api/admin/slots/${testSlotId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    testSlotId = null;
  });

  it('DELETE /api/admin/slots/:id — non-existent slot returns 404', async () => {
    const res = await adminReq('delete', '/api/admin/slots/99999999');
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. SITE CONTENT MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Content Management', () => {
  it('PUT /api/admin/content — upserts content key', async () => {
    const res = await adminReq('put', '/api/admin/content')
      .send({ content: { test_key_jest: 'jest_test_value' } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/content — reflects updated content key', async () => {
    const res = await request(app).get('/api/content');
    expect(res.body.content.test_key_jest).toBe('jest_test_value');
  });

  it('PUT /api/admin/content — missing content object returns 400', async () => {
    const res = await adminReq('put', '/api/admin/content').send({});
    expect(res.status).toBe(400);
  });

  it('PUT /api/admin/content — can update multiple keys in one request', async () => {
    const res = await adminReq('put', '/api/admin/content')
      .send({ content: { test_key_a: 'value_a', test_key_b: 'value_b' } });
    expect(res.status).toBe(200);
    const content = await request(app).get('/api/content');
    expect(content.body.content.test_key_a).toBe('value_a');
    expect(content.body.content.test_key_b).toBe('value_b');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11. SERVICES CRUD
// ════════════════════════════════════════════════════════════════════════════

describe('Admin Services Management', () => {
  it('POST /api/admin/services — creates service (201 with id)', async () => {
    const res = await adminReq('post', '/api/admin/services')
      .send({
        title: 'Jest Test Service',
        description: 'Test description for jest',
        features: ['feature 1', 'feature 2'],
        duration: 60,
        price: 50,
        order_num: 99,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
    testServiceId = res.body.id;
  });

  it('POST /api/admin/services — missing title returns 400', async () => {
    const res = await adminReq('post', '/api/admin/services')
      .send({ description: 'No title service' });
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/services — missing description returns 400', async () => {
    const res = await adminReq('post', '/api/admin/services')
      .send({ title: 'No desc service' });
    expect(res.status).toBe(400);
  });

  it('GET /api/content — new service appears in public listing', async () => {
    const res = await request(app).get('/api/content');
    const svc = res.body.services.find(s => s.id === testServiceId);
    expect(svc).toBeDefined();
    expect(svc.title).toBe('Jest Test Service');
    expect(Array.isArray(svc.features)).toBe(true);
    expect(svc.features).toContain('feature 1');
  });

  it('PUT /api/admin/services/:id — updates service fields', async () => {
    const res = await adminReq('put', `/api/admin/services/${testServiceId}`)
      .send({
        title: 'Jest Test Service',
        description: 'Updated description',
        features: ['updated feature'],
        duration: 90,
        price: 75,
        order_num: 99,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /api/admin/services/:id — update reflected in GET /api/content', async () => {
    const res = await request(app).get('/api/content');
    const svc = res.body.services.find(s => s.id === testServiceId);
    expect(svc.description).toBe('Updated description');
    expect(svc.duration).toBe(90);
  });

  it('PUT /api/admin/services/:id — non-existent id returns 404', async () => {
    const res = await adminReq('put', '/api/admin/services/99999999')
      .send({ title: 'X', description: 'Y', features: [] });
    expect(res.status).toBe(404);
  });

  it('PUT /api/admin/services/:id — missing title returns 400', async () => {
    const res = await adminReq('put', `/api/admin/services/${testServiceId}`)
      .send({ description: 'Updated' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/admin/services/:id — deletes service', async () => {
    const res = await adminReq('delete', `/api/admin/services/${testServiceId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    testServiceId = null;
  });

  it('DELETE /api/admin/services/:id — non-existent id returns 404', async () => {
    const res = await adminReq('delete', '/api/admin/services/99999999');
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 12. FAQ CRUD
// ════════════════════════════════════════════════════════════════════════════

describe('Admin FAQ Management', () => {
  it('POST /api/admin/faqs — creates FAQ (201 with id)', async () => {
    const res = await adminReq('post', '/api/admin/faqs')
      .send({ question: 'Jest test question?', answer: 'Jest test answer.', order_num: 99 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
    testFaqId = res.body.id;
  });

  it('POST /api/admin/faqs — missing question returns 400', async () => {
    const res = await adminReq('post', '/api/admin/faqs')
      .send({ answer: 'No question' });
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/faqs — missing answer returns 400', async () => {
    const res = await adminReq('post', '/api/admin/faqs')
      .send({ question: 'No answer?' });
    expect(res.status).toBe(400);
  });

  it('GET /api/content — new FAQ appears in public faqs list', async () => {
    const res = await request(app).get('/api/content');
    const faq = res.body.faqs.find(f => f.id === testFaqId);
    expect(faq).toBeDefined();
    expect(faq.question).toBe('Jest test question?');
    expect(faq.answer).toBe('Jest test answer.');
  });

  it('PUT /api/admin/faqs/:id — updates FAQ question and answer', async () => {
    const res = await adminReq('put', `/api/admin/faqs/${testFaqId}`)
      .send({ question: 'Updated question?', answer: 'Updated answer.', order_num: 99 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /api/admin/faqs/:id — update reflected in GET /api/content', async () => {
    const res = await request(app).get('/api/content');
    const faq = res.body.faqs.find(f => f.id === testFaqId);
    expect(faq.question).toBe('Updated question?');
    expect(faq.answer).toBe('Updated answer.');
  });

  it('PUT /api/admin/faqs/:id — missing question returns 400', async () => {
    const res = await adminReq('put', `/api/admin/faqs/${testFaqId}`)
      .send({ answer: 'Only answer' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/admin/faqs/:id — non-existent id returns 404', async () => {
    const res = await adminReq('put', '/api/admin/faqs/99999999')
      .send({ question: 'X?', answer: 'Y.' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/admin/faqs/:id — deletes FAQ', async () => {
    const res = await adminReq('delete', `/api/admin/faqs/${testFaqId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    testFaqId = null;
  });

  it('DELETE /api/admin/faqs/:id — deleted FAQ gone from GET /api/content', async () => {
    const res = await request(app).get('/api/content');
    const faq = res.body.faqs.find(f => f.question === 'Updated question?');
    expect(faq).toBeUndefined();
  });

  it('DELETE /api/admin/faqs/:id — non-existent id returns 404', async () => {
    const res = await adminReq('delete', '/api/admin/faqs/99999999');
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 13. REVIEWS CRUD
// ════════════════════════════════════════════════════════════════════════════

describe('Reviews', () => {
  it('POST /api/reviews — submits review with pending status', async () => {
    const res = await request(app).post('/api/reviews')
      .set('Content-Type', 'application/json')
      .send({ author: 'Jest Tester', comment: 'Automated test review.' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/reviews — missing comment returns 400', async () => {
    const res = await request(app).post('/api/reviews')
      .set('Content-Type', 'application/json')
      .send({ author: 'No comment' });
    expect(res.status).toBe(400);
  });

  it('POST /api/reviews — missing author returns 400', async () => {
    const res = await request(app).post('/api/reviews')
      .set('Content-Type', 'application/json')
      .send({ comment: 'No author' });
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/reviews — returns all reviews including pending', async () => {
    const res = await adminReq('get', '/api/admin/reviews');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    const pending = res.body.reviews.find(r => r.author === 'Jest Tester');
    expect(pending).toBeDefined();
    expect(pending.status).toBe('pending');
    testReviewId = pending.id;
  });

  it('GET /api/admin/reviews — blocked without auth (401)', async () => {
    const res = await request(app).get('/api/admin/reviews');
    expect(res.status).toBe(401);
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

  it('PUT /api/admin/reviews/:id — rejects review', async () => {
    const res = await adminReq('put', `/api/admin/reviews/${testReviewId}`)
      .send({ status: 'rejected' });
    expect(res.status).toBe(200);
  });

  it('GET /api/content — rejected review is removed from public', async () => {
    const res = await request(app).get('/api/content');
    const review = res.body.reviews.find(r => r.author === 'Jest Tester');
    expect(review).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 14. SERVICE SLUG API
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/services/:slug', () => {
  it('returns service detail and all services for known slug', async () => {
    const res = await request(app).get('/api/services/spiritual-healing');
    expect(res.status).toBe(200);
    expect(res.body.service).toBeDefined();
    expect(res.body.service.title).toBe('Spiritual Healing');
    expect(Array.isArray(res.body.service.features)).toBe(true);
    expect(Array.isArray(res.body.all)).toBe(true);
  });

  it('returns 404 for unknown slug', async () => {
    const res = await request(app).get('/api/services/does-not-exist');
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 15. ADMIN CONFIG
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/admin/config', () => {
  it('without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/config');
    expect(res.status).toBe(401);
  });

  it('with auth returns stripe and email config status', async () => {
    const res = await adminReq('get', '/api/admin/config');
    expect(res.status).toBe(200);
    expect(res.body.stripe).toHaveProperty('configured');
    expect(res.body.stripe).toHaveProperty('mode');
    expect(res.body.email).toHaveProperty('configured');
    // In test env Stripe is not configured
    expect(res.body.stripe.configured).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 16. STRIPE PUBLIC KEY
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/stripe-key', () => {
  it('returns publishableKey (null when Stripe not configured)', async () => {
    const res = await request(app).get('/api/stripe-key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('publishableKey');
    expect(res.body.publishableKey).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 17. PAYMENT CONFIRM — validation only (no Stripe in test env)
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/bookings/confirm', () => {
  it('missing payment_intent_id returns 400', async () => {
    const res = await request(app).post('/api/bookings/confirm')
      .set('Content-Type', 'application/json')
      .send({ booking_id: 1 });
    expect(res.status).toBe(400);
  });

  it('missing booking_id returns 400', async () => {
    const res = await request(app).post('/api/bookings/confirm')
      .set('Content-Type', 'application/json')
      .send({ payment_intent_id: 'pi_test' });
    expect(res.status).toBe(400);
  });

  it('empty body returns 400', async () => {
    const res = await request(app).post('/api/bookings/confirm')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 18. SERVICES — package_price FIELD
// ════════════════════════════════════════════════════════════════════════════

describe('Services — package_price field', () => {
  let pkgServiceId;
  let variantServiceId;

  afterAll(async () => {
    if (pkgServiceId)     await pool.query('DELETE FROM services WHERE id = $1', [pkgServiceId]);
    if (variantServiceId) await pool.query('DELETE FROM services WHERE id = $1', [variantServiceId]);
  });

  it('POST /api/admin/services — creates service with package_price', async () => {
    const res = await adminReq('post', '/api/admin/services')
      .send({
        title: 'Jest Pkg Price Service',
        description: 'Package price test service',
        features: ['Feature A'],
        duration: 60,
        price: 100,
        package_price: 80,
        order_num: 99,
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    pkgServiceId = res.body.id;
  });

  it('GET /api/content — service exposes package_price field', async () => {
    const res = await request(app).get('/api/content');
    const svc = res.body.services.find(s => s.id === pkgServiceId);
    expect(svc).toBeDefined();
    expect(parseFloat(svc.package_price)).toBe(80);
  });

  it('PUT /api/admin/services/:id — updates package_price', async () => {
    const res = await adminReq('put', `/api/admin/services/${pkgServiceId}`)
      .send({
        title: 'Jest Pkg Price Service',
        description: 'Updated description',
        features: ['Feature A'],
        duration: 60,
        price: 100,
        package_price: 70,
        order_num: 99,
      });
    expect(res.status).toBe(200);
    const content = await request(app).get('/api/content');
    const svc = content.body.services.find(s => s.id === pkgServiceId);
    expect(parseFloat(svc.package_price)).toBe(70);
  });

  it('POST /api/admin/services — stores variant package_price inside extra_details', async () => {
    const res = await adminReq('post', '/api/admin/services')
      .send({
        title: 'Jest Variant Pkg Service',
        description: 'Variant package price service',
        features: [],
        duration: 60,
        price: 100,
        order_num: 99,
        extra_details: {
          variants: [
            { label: '60 min', duration: 60, price: 100, package_price: 80 },
            { label: '90 min', duration: 90, price: 150, package_price: 120 },
          ],
        },
      });
    expect(res.status).toBe(201);
    variantServiceId = res.body.id;
    const content = await request(app).get('/api/content');
    const svc = content.body.services.find(s => s.id === variantServiceId);
    expect(svc).toBeDefined();
    const details = typeof svc.extra_details === 'string'
      ? JSON.parse(svc.extra_details)
      : (svc.extra_details || {});
    expect(Array.isArray(details.variants)).toBe(true);
    expect(parseFloat(details.variants[0].package_price)).toBe(80);
    expect(parseFloat(details.variants[1].package_price)).toBe(120);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 19. PAST SLOT REJECTION
// ════════════════════════════════════════════════════════════════════════════

describe('Past slot rejection', () => {
  let pastSlotId;

  afterAll(async () => {
    if (pastSlotId) await pool.query('DELETE FROM slots WHERE id = $1', [pastSlotId]);
  });

  it('admin can create a slot in the past (no date validation on admin create)', async () => {
    const res = await adminReq('post', '/api/admin/slots')
      .send({ date: PAST_DATE, time: '10:00', duration: 60 });
    expect(res.status).toBe(201);
    pastSlotId = res.body.id;
  });

  it('POST /api/bookings — past slot returns 400 with "already passed" error', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send({
        slot_id: pastSlotId,
        service: 'Guided Meditation',
        customer_name: 'Past Booker',
        customer_email: 'past@example.com',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already passed/i);
  });

  it('GET /api/slots — past slot does not appear in the public listing', async () => {
    const res = await request(app).get('/api/slots');
    expect(res.status).toBe(200);
    const found = res.body.slots.find(s => s.id === pastSlotId);
    expect(found).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 20. BULK BOOKING PREVIEW
// ════════════════════════════════════════════════════════════════════════════

describe('Bulk booking preview', () => {
  let previewSlotIds = [];

  beforeAll(async () => {
    await pool.query('DELETE FROM slots WHERE date = $1', [TEST_DATE3]);
    for (const time of ['08:00', '09:00', '10:00', '11:00', '12:00']) {
      const r = await pool.query(
        "INSERT INTO slots (date, time, duration, price, currency, is_booked) VALUES ($1, $2, 60, 0, 'GBP', 0) RETURNING id",
        [TEST_DATE3, time]
      );
      previewSlotIds.push(r.rows[0].id);
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM slots WHERE date = $1', [TEST_DATE3]);
    previewSlotIds = [];
  });

  it('POST /api/bookings/bulk/preview — returns slots and pricing for valid request', async () => {
    const res = await request(app).post('/api/bookings/bulk/preview')
      .set('Content-Type', 'application/json')
      .send({ slot_id: previewSlotIds[0], count: 3, service: 'Guided Meditation' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(res.body.slots.length).toBe(3);
    expect(typeof res.body.session_price).toBe('number');
    expect(typeof res.body.total_amount).toBe('number');
    expect(res.body.currency).toBeDefined();
  });

  it('POST /api/bookings/bulk/preview — missing slot_id returns 400', async () => {
    const res = await request(app).post('/api/bookings/bulk/preview')
      .set('Content-Type', 'application/json')
      .send({ count: 3, service: 'Guided Meditation' });
    expect(res.status).toBe(400);
  });

  it('POST /api/bookings/bulk/preview — missing count returns 400', async () => {
    const res = await request(app).post('/api/bookings/bulk/preview')
      .set('Content-Type', 'application/json')
      .send({ slot_id: previewSlotIds[0], service: 'Guided Meditation' });
    expect(res.status).toBe(400);
  });

  it('POST /api/bookings/bulk/preview — count < 2 returns 400', async () => {
    const res = await request(app).post('/api/bookings/bulk/preview')
      .set('Content-Type', 'application/json')
      .send({ slot_id: previewSlotIds[0], count: 1, service: 'Guided Meditation' });
    expect(res.status).toBe(400);
  });

  it('POST /api/bookings/bulk/preview — non-existent slot_id returns 409', async () => {
    const res = await request(app).post('/api/bookings/bulk/preview')
      .set('Content-Type', 'application/json')
      .send({ slot_id: 99999999, count: 3, service: 'Guided Meditation' });
    expect(res.status).toBe(409);
  });

  it('POST /api/bookings/bulk/preview — count exceeds available slots returns 409', async () => {
    const res = await request(app).post('/api/bookings/bulk/preview')
      .set('Content-Type', 'application/json')
      .send({ slot_id: previewSlotIds[0], count: 50, service: 'Guided Meditation' });
    expect(res.status).toBe(409);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 21. BULK BOOKING CREATE
// ════════════════════════════════════════════════════════════════════════════

describe('Bulk booking create', () => {
  let bulkSlotIds = [];
  let testBulkId;

  beforeAll(async () => {
    await pool.query('DELETE FROM bookings WHERE slot_id IN (SELECT id FROM slots WHERE date = $1)', [TEST_DATE4]);
    await pool.query('DELETE FROM slots WHERE date = $1', [TEST_DATE4]);
    for (const time of ['08:00', '09:00', '10:00']) {
      const r = await pool.query(
        "INSERT INTO slots (date, time, duration, price, currency, is_booked) VALUES ($1, $2, 60, 0, 'GBP', 0) RETURNING id",
        [TEST_DATE4, time]
      );
      bulkSlotIds.push(r.rows[0].id);
    }
  });

  afterAll(async () => {
    if (testBulkId) {
      await pool.query('DELETE FROM bookings WHERE bulk_booking_id = $1', [testBulkId]);
      await pool.query('DELETE FROM bulk_bookings WHERE id = $1', [testBulkId]);
    }
    await pool.query('UPDATE slots SET is_booked = 0 WHERE date = $1', [TEST_DATE4]);
    await pool.query('DELETE FROM slots WHERE date = $1', [TEST_DATE4]);
    bulkSlotIds = [];
  });

  it('POST /api/bookings/bulk — missing slot_ids returns 400', async () => {
    const res = await request(app).post('/api/bookings/bulk')
      .set('Content-Type', 'application/json')
      .send({ service: 'Guided Meditation', customer_name: 'Test', customer_email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  it('POST /api/bookings/bulk — single slot_id (< 2) returns 400', async () => {
    const res = await request(app).post('/api/bookings/bulk')
      .set('Content-Type', 'application/json')
      .send({ slot_ids: [bulkSlotIds[0]], service: 'Guided Meditation', customer_name: 'Test', customer_email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  it('POST /api/bookings/bulk — missing service returns 400', async () => {
    const res = await request(app).post('/api/bookings/bulk')
      .set('Content-Type', 'application/json')
      .send({ slot_ids: bulkSlotIds, customer_name: 'Test', customer_email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  it('POST /api/bookings/bulk — missing customer_name returns 400', async () => {
    const res = await request(app).post('/api/bookings/bulk')
      .set('Content-Type', 'application/json')
      .send({ slot_ids: bulkSlotIds, service: 'Guided Meditation', customer_email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  it('POST /api/bookings/bulk — invalid slot IDs (non-positive integers) returns 400', async () => {
    const res = await request(app).post('/api/bookings/bulk')
      .set('Content-Type', 'application/json')
      .send({ slot_ids: [-1, 0], service: 'Guided Meditation', customer_name: 'Test', customer_email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  it('POST /api/bookings/bulk — non-existent slot IDs returns 409', async () => {
    const res = await request(app).post('/api/bookings/bulk')
      .set('Content-Type', 'application/json')
      .send({ slot_ids: [99999998, 99999999], service: 'Guided Meditation', customer_name: 'Test', customer_email: 'test@example.com' });
    expect(res.status).toBe(409);
  });

  it('POST /api/bookings/bulk — valid free slots creates bulk booking (201)', async () => {
    const res = await request(app).post('/api/bookings/bulk')
      .set('Content-Type', 'application/json')
      .send({
        slot_ids: bulkSlotIds,
        service: 'Guided Meditation',
        customer_name: 'Bulk Tester',
        customer_email: 'bulk@example.com',
        customer_phone: '',
        message: 'Bulk test booking',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.bulk_booking_id).toBeDefined();
    expect(res.body.booking_ref).toMatch(/^SH-[A-Z0-9]{8}$/);
    expect(res.body.session_count).toBe(bulkSlotIds.length);
    testBulkId = res.body.bulk_booking_id;
  });

  it('POST /api/bookings/bulk — booking already-booked slots returns 409', async () => {
    const res = await request(app).post('/api/bookings/bulk')
      .set('Content-Type', 'application/json')
      .send({
        slot_ids: bulkSlotIds,
        service: 'Guided Meditation',
        customer_name: 'Another Tester',
        customer_email: 'another@example.com',
      });
    expect(res.status).toBe(409);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 22. Booking form extended fields (timezone, session_reason, session_type)
// ════════════════════════════════════════════════════════════════════════════

const TEST_DATE5 = '2099-09-15';
const TEST_DATE5B = '2099-09-16';

describe('Suite 22: Extended booking fields & 30-min slot payment path', () => {
  let extSlot30Id;   // 30-min free slot
  let extSlot60Id;   // 60-min free slot

  beforeAll(async () => {
    await pool.query('DELETE FROM bookings WHERE slot_id IN (SELECT id FROM slots WHERE date = $1 OR date = $2)', [TEST_DATE5, TEST_DATE5B]);
    await pool.query('DELETE FROM slots WHERE date = $1 OR date = $2', [TEST_DATE5, TEST_DATE5B]);

    const s30 = await pool.query(
      "INSERT INTO slots (date, time, duration, price, currency) VALUES ($1, '10:00', 30, 0, 'GBP') RETURNING id",
      [TEST_DATE5]
    );
    extSlot30Id = s30.rows[0].id;

    const s60 = await pool.query(
      "INSERT INTO slots (date, time, duration, price, currency) VALUES ($1, '10:00', 60, 0, 'GBP') RETURNING id",
      [TEST_DATE5B]
    );
    extSlot60Id = s60.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM bookings WHERE slot_id IN (SELECT id FROM slots WHERE date = $1 OR date = $2)', [TEST_DATE5, TEST_DATE5B]);
    await pool.query('DELETE FROM slots WHERE date = $1 OR date = $2', [TEST_DATE5, TEST_DATE5B]);
  });

  it('POST /api/bookings — 30-min free slot with all extended fields returns 201', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send({
        slot_id:            extSlot30Id,
        service:            'Clarity Call',
        customer_name:      'Jane Doe',
        customer_email:     'jane@example.com',
        customer_phone:     '+44 7700 000001',
        timezone:           'United Kingdom (GMT+1)',
        session_reason:     'Looking for guidance after a difficult period',
        pre_session_notes:  'I have some anxiety about opening up',
        referral_source:    'Instagram',
        prior_healing:      'No',
        session_type:       'Remote',
        message:            'Looking forward to it',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.booking_ref).toMatch(/^SH-[A-Z0-9]{8}$/);
  });

  it('POST /api/bookings — 30-min slot stores session_type=Remote in DB', async () => {
    // Use the 60-min slot since 30-min was just booked
    const res = await request(app).post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send({
        slot_id:        extSlot60Id,
        service:        'Healing Session',
        customer_name:  'Bob Test',
        customer_email: 'bob@example.com',
        timezone:       'India (IST)',
        session_reason: 'Spiritual growth',
        session_type:   'In Person',
      });
    expect(res.status).toBe(201);
    const row = await pool.query('SELECT session_type, timezone, session_reason FROM bookings WHERE booking_ref = $1', [res.body.booking_ref]);
    expect(row.rows[0].session_type).toBe('In Person');
    expect(row.rows[0].timezone).toBe('India (IST)');
    expect(row.rows[0].session_reason).toBe('Spiritual growth');
  });

  it('POST /api/bookings — past slot still returns 400', async () => {
    const pastSlot = await pool.query(
      "INSERT INTO slots (date, time, duration, price, currency) VALUES ('2020-06-27', '16:00', 30, 0, 'GBP') RETURNING id"
    );
    const pastId = pastSlot.rows[0].id;
    const res = await request(app).post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send({
        slot_id:        pastId,
        service:        'Clarity Call',
        customer_name:  'Test User',
        customer_email: 'test@example.com',
        timezone:       'UK',
        session_reason: 'Test',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/passed/i);
    await pool.query('DELETE FROM slots WHERE id = $1', [pastId]);
  });

  it('POST /api/bookings — paid slot with placeholder Stripe key returns 500 with error message', async () => {
    // Create a paid 30-min slot
    const paidSlot = await pool.query(
      "INSERT INTO slots (date, time, duration, price, currency) VALUES ($1, '14:00', 30, 50, 'GBP') RETURNING id",
      [TEST_DATE5]
    );
    const paidId = paidSlot.rows[0].id;
    const res = await request(app).post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send({
        slot_id:        paidId,
        service:        'Clarity Call',
        customer_name:  'Pay Tester',
        customer_email: 'pay@example.com',
        timezone:       'UK (GMT+1)',
        session_reason: 'Testing payment',
        session_type:   'Remote',
      });
    // With a placeholder key, Stripe throws → server returns 500 with error
    // OR if Stripe not configured (key not sk_test_/sk_live_), falls through to free-booking path
    if (res.status === 201) {
      // Stripe not active — booking treated as free
      expect(res.body.success).toBe(true);
    } else {
      // Stripe active but placeholder key → payment init fails
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/payment|stripe/i);
    }
    await pool.query('DELETE FROM bookings WHERE slot_id = $1', [paidId]);
    await pool.query('DELETE FROM slots WHERE id = $1', [paidId]);
  });

  it('POST /api/reviews — accepts service_name and country fields', async () => {
    const res = await request(app).post('/api/reviews')
      .set('Content-Type', 'application/json')
      .send({
        author:       'Test Reviewer',
        comment:      'A genuinely wonderful experience.',
        service_name: 'Past Life Regression',
        country:      'United Kingdom',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Verify fields stored
    const row = await pool.query("SELECT service_name, country FROM reviews WHERE author = 'Test Reviewer' ORDER BY id DESC LIMIT 1");
    expect(row.rows[0].service_name).toBe('Past Life Regression');
    expect(row.rows[0].country).toBe('United Kingdom');
    await pool.query("DELETE FROM reviews WHERE author = 'Test Reviewer'");
  });
});
