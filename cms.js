const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = {
  init: async function(pool, app, requireAdmin) {
    // ── CMS DB Setup ──────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_content (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS services (
        id          SERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT NOT NULL,
        features    TEXT NOT NULL,
        duration    INTEGER DEFAULT 60,
        price       NUMERIC(10,2) DEFAULT 0,
        order_num   INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id          SERIAL PRIMARY KEY,
        author      TEXT NOT NULL,
        comment     TEXT NOT NULL,
        status      TEXT DEFAULT 'pending',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id          SERIAL PRIMARY KEY,
        question    TEXT NOT NULL,
        answer      TEXT NOT NULL,
        order_num   INTEGER DEFAULT 0
      )
    `);

    await pool.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS extra_details TEXT DEFAULT '{}'`);
    await pool.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT`);

    // Migration: fix logo path if still pointing to old file
    await pool.query(
      "UPDATE site_content SET value = 'assets/logo-sbh.png' WHERE key = 'logo_img' AND value = 'assets/logo.png'"
    );

    // ── Upsert site_content with real content ────────────────
    const realContent = {
      'hero_title':         'Welcome to<br /><em class="gold-text">SoulBody Healing</em>',
      'hero_subtitle':      "Your healing sanctuary. We're dedicated to guiding you on a journey of self-discovery, self-love, healing and well-being. Discover how our unique services can help you find yourself and unlock your true potential.",
      'hero_button_text':   'Begin Your Journey →',
      'explore_button_text':'Explore Services',
      'about_title':        'Reena — Your<br /><em>Healing Guide</em>',
      'about_paragraph1':   "Reena's journey into healing began in childhood, guided by her mother's wisdom. After experiencing personal loss, she embarked on a spiritual journey, exploring various healing modalities that transformed her understanding of consciousness. It was during her Past Life Regression sessions with her clients that she discovered her clairvoyant gift. The passing of her mother during COVID led her to deepen her understanding of energy, leading her on another journey of healing grief.",
      'about_paragraph2':   "Reena is a Tier 1 Certified Holden QiGong Instructor, teaching Qi Gong and meditation. She is also a certified Regression Therapist, Hypnotherapist, Reiki & Integrated Energy Therapist, and Intuitive/Tarot Card Reader. We work as per divine guidance — for you, with you, with divine wisdom and light.",
      'contact_email':      'hello@soulbody.healing.com',
      'contact_phone':      '+44 7700 900000',
      'contact_location':   'Croydon, London',
      'footer_tagline':     'Ancient Wisdom · Infinite Healing<br />Croydon, London &amp; Online Sessions Available',
      'footer_online_text': '🌐 Online Sessions Available',
      'footer_copyright':   '© 2026 SoulBody Healing · Reena. All rights reserved. Crafted with ✦ love &amp; light.',
      'footer_credit':      'Site designed &amp; developed by <a href="https://shivayinfotech.co.uk/" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;text-underline-offset:3px;">Shivay Infotech Ltd.</a>',
      'logo_img':           'assets/logo-sbh.png',
      'hero_bg_img':        'assets/sacred_healing_hero_bg.png',
      'chakra_img':         'assets/mandala.png',
      'healer_img':         'assets/healer.jpg'
    };
    // Contact page content — use DO NOTHING so admin edits survive restarts
    const contactPageDefaults = {
      'contact_page_title':    'Have a <em>Question?</em>',
      'contact_page_subtitle': 'Every healing journey begins with a single, courageous step. Reach out and let us walk beside you.',
      'contact_page_intro':    'Whether you\'re seeking clarity, emotional release, or a deeper spiritual connection — we\'re here. Sessions are available in person in Croydon, London or online worldwide.',
    };
    for (const [key, val] of Object.entries(contactPageDefaults)) {
      await pool.query(
        'INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT(key) DO NOTHING',
        [key, val]
      );
    }
    for (const [key, val] of Object.entries(realContent)) {
      await pool.query(
        'INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT(key) DO NOTHING',
        [key, val]
      );
    }

    // ── Nav config defaults ──────────────────────────────────────
    const navDefaults = {
      about:          { location: 'page', label: 'About',               header: true,  footer: true,  order: 20 },
      philosophy:     { location: 'page', label: 'Our Philosophy',      header: false, footer: true,  order: 21 },
      story:          { location: 'page', label: 'Our Story',           header: false, footer: true,  order: 22 },
      services:       { location: 'page', label: 'Services',            header: true,  footer: true,  order: 30 },
      process:        { location: 'page', label: 'How It Works',        header: false, footer: true,  order: 31 },
      testimonials:   { location: 'page', label: 'Testimonials',        header: true,  footer: true,  order: 40 },
      'clarity-call': { location: 'home', label: 'Free Clarity Call',   header: false, footer: false, order: 45 },
      faq:            { location: 'page', label: 'FAQ',                 header: true,  footer: true,  order: 50 },
      contact:        { location: 'page', label: 'Contact',             header: true,  footer: true,  order: 60 },
      disclaimer:     { location: 'page', label: 'Legal Notice',        header: false, footer: true,  order: 70 },
      cancellation:   { location: 'page', label: 'Cancellation Policy', header: false, footer: true,  order: 71 },
      'reduced-rate': { location: 'page', label: 'Reduced-Rate Access', header: false, footer: false, order: 72 },
    };
    // Insert defaults for fresh installs only — never overwrite admin-saved settings
    await pool.query(
      `INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT(key) DO NOTHING`,
      ['nav_config', JSON.stringify(navDefaults)]
    );
    // Merge only new section keys that don't yet exist in the saved config (additive only)
    const navRow = await pool.query(`SELECT value FROM site_content WHERE key = 'nav_config'`);
    if (navRow.rows.length) {
      const existing = JSON.parse(navRow.rows[0].value);
      let changed = false;
      for (const [key, val] of Object.entries(navDefaults)) {
        if (!existing[key]) { existing[key] = val; changed = true; }
      }
      // One-time: rename 'Book Session' → 'Contact' (guarded so it only fires once)
      if (existing.contact && existing.contact.label === 'Book Session') {
        existing.contact.label = 'Contact';
        changed = true;
      }
      if (changed) {
        await pool.query(`UPDATE site_content SET value = $1 WHERE key = 'nav_config'`, [JSON.stringify(existing)]);
      }
    }

    // ── Fix contact page title if it still has the old booking heading ──
    await pool.query(
      `UPDATE site_content SET value = 'Have a <em>Question?</em>' WHERE key = 'contact_page_title' AND value LIKE '%Sacred Session%'`
    );

    // ── Remove placeholder seed services ─────────────────────
    await pool.query(
      "DELETE FROM services WHERE title IN ('Quantum Energy Reset','The Deep Awakening','Celestial Harmony Session')"
    );

    // ── Unique index on title (needed for ON CONFLICT(title)) ─
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS services_title_unique ON services(title)');

    // ── Upsert real services ──────────────────────────────────
    const realServices = [
      {
        title: 'Spiritual Healing',
        image_url: '/assets/service-spiritual.jpg',
        description: 'Transformative spiritual healing sessions designed to harmonise your mind, body, and spirit. We guide you on a journey of self-discovery and rejuvenation, helping release emotional blocks and promote inner peace through chakra balancing and energy work.',
        features: ['Chakra alignment & clearing', 'Aura cleansing & protection', 'Energy cord cutting', 'Emotional release & restoration'],
        duration: 90, price: 120, order: 1,
        extra: {
          icon: '🌀', tag: 'Energy Work', titleLine1: 'Spiritual', titleLine2: 'Healing',
          sessionType: 'One-on-one or Remote healing',
          bestFor: 'Emotional release, energy restoration, stress relief',
          longDescription: [
            'At SoulBody Healing, we offer transformative spiritual healing services designed to harmonise your mind, body, and spirit. We guide you on a journey of self-discovery and rejuvenation, helping release emotional blocks and promote inner peace.',
            'Embrace a holistic approach to wellness that nurtures your soul and revitalises your body, empowering you to live your best life. Our sessions release blockages and restore balance — best for emotional release, energy restoration and stress relief.'
          ],
          expect: [
            { title: 'Energy Assessment', text: 'We begin with a gentle evaluation of your energy field to identify areas of imbalance or blockage.' },
            { title: 'Chakra Balancing', text: 'Working through your energy centres to restore flow and harmony using focused resonance techniques.' },
            { title: 'Aura Cleansing', text: 'Clearing and protecting your auric field from negative energies and psychic debris.' },
            { title: 'Integration & Guidance', text: 'Closing with grounding practices and personalised guidance for your ongoing journey.' }
          ]
        }
      },
      {
        title: 'Psychic Reading',
        image_url: '/assets/service-psychic.jpg',
        description: 'Connect with divine guidance and gain profound insights into your life\'s journey. Our psychic readings provide clarity on relationships, career paths, life purpose, and spiritual development through intuitive channelling. You can also receive past life healing through psychic reading.',
        features: ['Soul purpose clarity', 'Relationship insights', 'Future path guidance', 'Past life healing through reading'],
        duration: 60, price: 95, order: 2,
        extra: {
          icon: '🔮', tag: 'Intuitive Guidance', titleLine1: 'Psychic', titleLine2: 'Reading',
          sessionType: 'In-person, phone, or video call',
          bestFor: 'Life guidance, decision-making, spiritual insight',
          longDescription: [
            'Connect with divine guidance and gain profound insights into your life\'s journey. Our psychic readings provide clarity on relationships, career paths, life purpose, and spiritual development through intuitive channelling.',
            'You can also receive past life healing through a psychic reading session — ideal for life guidance, decision-making and spiritual insight.'
          ],
          expect: [
            { title: 'Opening Connection', text: 'We centre ourselves and open the channel to divine guidance for your session.' },
            { title: 'Intuitive Reading', text: 'Receiving and sharing insights about your relationships, purpose and life path.' },
            { title: 'Questions & Clarity', text: 'Space for you to ask questions and dive deeper into specific areas of your life.' },
            { title: 'Closing & Integration', text: 'Grounding the insights received and discussing practical next steps for your journey.' }
          ]
        }
      },
      {
        title: 'Past Life Regression',
        image_url: '/assets/service-pastlife.jpg',
        description: 'Transformative past life regression therapy guiding you on a journey through time to uncover and heal wounds from previous incarnations. This powerful process helps you understand recurring patterns, release karmic bonds and integrate soul wisdom.',
        features: ['Past life regression therapy', 'Karmic cord cutting', 'Soul wound healing', 'Pattern & karmic healing'],
        duration: 120, price: 180, order: 3,
        extra: {
          icon: '⏳', tag: 'Regression Therapy', titleLine1: 'Past Life', titleLine2: 'Regression',
          sessionType: 'In-person guided regression',
          bestFor: 'Pattern recognition, karmic healing, soul exploration',
          longDescription: [
            'SoulBody Healing offers transformative past life regression therapy, guiding you on a journey through time to uncover and heal wounds from previous incarnations.',
            'This powerful process helps you understand recurring patterns, release karmic bonds and integrate valuable soul wisdom into your present life. Experience profound healing and renewal for a more harmonious existence.'
          ],
          expect: [
            { title: 'Preparation & Relaxation', text: 'A guided relaxation process to ease your mind and prepare for the regression journey.' },
            { title: 'Past Life Journey', text: 'Gentle guidance into past life memories relevant to your current patterns and challenges.' },
            { title: 'Healing & Release', text: 'Identifying and releasing karmic bonds, soul wounds and patterns no longer serving you.' },
            { title: 'Integration', text: 'Returning to the present with new understanding and practical wisdom for your life today.' }
          ]
        }
      },
      {
        title: 'Past Life Healing',
        image_url: '/assets/service-pastlife.jpg',
        description: 'An intuitive journey to help you understand recurring patterns, release karmic bonds and integrate soul wisdom into your present life. Journey through time to uncover and heal wounds from previous incarnations.',
        features: ['Intuitive past life exploration', 'Karmic bond release', 'Soul wisdom integration', 'Pattern recognition & healing'],
        duration: 90, price: 150, order: 4,
        extra: {
          icon: '🌟', tag: 'Soul Healing', titleLine1: 'Past Life', titleLine2: 'Healing',
          sessionType: 'In-person or Remote',
          bestFor: 'Pattern recognition, karmic healing, soul exploration',
          longDescription: [
            'Past life healing is an intuitive journey to help you understand recurring patterns, release karmic bonds and integrate soul wisdom into your present life.',
            'Journey through time to uncover and heal wounds from previous incarnations, gaining profound insight into why certain patterns and relationships exist in your current life.'
          ],
          expect: [
            { title: 'Intuitive Assessment', text: 'Opening with an assessment of the patterns and themes you\'re experiencing in this lifetime.' },
            { title: 'Past Life Exploration', text: 'Intuitively accessing past life memories most relevant to your healing and growth.' },
            { title: 'Karmic Release', text: 'Releasing karmic bonds and soul wounds carried across lifetimes.' },
            { title: 'Soul Wisdom Integration', text: 'Bringing forward the gifts and wisdom from past lives to enrich your present journey.' }
          ]
        }
      },
      {
        title: 'Ancestral Healing',
        image_url: '/assets/service-ancestral.jpg',
        description: 'Break free from inherited family patterns and generational trauma. Through deep ancestral work, we identify and release limiting beliefs, behaviours and energetic imprints passed down through your lineage, so you can reclaim your authentic path.',
        features: ['Generational trauma release', 'Family pattern clearing', 'Limiting belief release', 'Lineage clearing & blessings'],
        duration: 120, price: 200, order: 5,
        extra: {
          icon: '🌿', tag: 'Ancestral Work', titleLine1: 'Ancestral', titleLine2: 'Healing',
          sessionType: 'In-person or Remote healing',
          bestFor: 'Breaking family patterns, generational healing, lineage clearing',
          longDescription: [
            'At SoulBody Healing, we empower you to break free from inherited family patterns and heal generational trauma. Through profound ancestral work, we help identify and release limiting beliefs, behaviours and energetic imprints passed down through your lineage.',
            'Reclaim your authentic path and forge new patterns for future generations, fostering a legacy of well-being and resilience.'
          ],
          expect: [
            { title: 'Ancestral Mapping', text: 'Exploring the patterns, beliefs and traumas passed down through your family lineage.' },
            { title: 'Energy Clearing', text: 'Releasing inherited energetic imprints, limiting beliefs and generational trauma from your field.' },
            { title: 'Pattern Breaking', text: 'Establishing new, empowered patterns and energetic signatures for yourself and future generations.' },
            { title: 'Ancestral Blessings', text: 'Calling in the positive gifts, wisdom and blessings from your ancestral lineage.' }
          ]
        }
      },
      {
        title: 'Guided Meditation',
        image_url: '/assets/mandala.png',
        description: 'Embark on a transformative journey of meditation and visualisation designed to promote self-healing and deep relaxation. Our expert-guided sessions foster a calm environment that encourages restoration of both mind and body.',
        features: ['Deep relaxation techniques', 'Visualisation journeys', 'Breathwork practices', 'Self-healing activation'],
        duration: 60, price: 0, order: 6,
        extra: {
          icon: '🧘', tag: 'Meditation', titleLine1: 'Guided', titleLine2: 'Meditation',
          sessionType: 'In-person or Remote',
          bestFor: 'Relaxation, stress relief, inner peace',
          longDescription: [
            'At SoulBody Healing, we invite you to embark on a transformative journey of meditation and visualisation, designed to promote self-healing and deep relaxation.',
            'Our expert-guided sessions foster a calm environment that encourages restoration of both mind and body. Experience the rejuvenating power of our holistic practices and awaken your inner peace.'
          ],
          expect: [
            { title: 'Grounding Practice', text: 'Beginning with breathing and grounding techniques to settle the mind and body.' },
            { title: 'Guided Visualisation', text: 'A deeply immersive journey tailored to your healing intentions and needs.' },
            { title: 'Energy Activation', text: 'Gentle activation of your body\'s natural self-healing mechanisms through focused awareness.' },
            { title: 'Integration', text: 'Gentle return to full awareness with practical tools to carry the calm into daily life.' }
          ]
        }
      }
    ];

    for (const s of realServices) {
      await pool.query(`
        INSERT INTO services (title, description, features, duration, price, order_num, extra_details, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(title) DO UPDATE SET
          description   = EXCLUDED.description,
          features      = EXCLUDED.features,
          duration      = EXCLUDED.duration,
          price         = EXCLUDED.price,
          order_num     = EXCLUDED.order_num,
          extra_details = EXCLUDED.extra_details,
          image_url     = COALESCE(services.image_url, EXCLUDED.image_url)
      `, [s.title, s.description, JSON.stringify(s.features), s.duration, s.price, s.order, JSON.stringify(s.extra), s.image_url || null]);
    }

    // ── Upsert FAQs ───────────────────────────────────────────
    const faqCountResult = await pool.query('SELECT COUNT(*) as c FROM faqs');
    if (parseInt(faqCountResult.rows[0].c) === 0) {
      const realFaqs = [
        {
          q: 'What can I expect during my first healing session?',
          a: 'Each journey begins with a gentle energy assessment. We use intuitive mapping to identify blockages in your spiritual field, slowly restoring balance through focused resonance and clearing techniques. Your first session is a safe, non-judgmental space to simply be yourself.',
          order: 1
        },
        {
          q: 'How often should I schedule a healing session?',
          a: 'Healing is a deeply personal process. Some clients find clarity in a single intensive session, while others maintain a monthly rhythm to navigate ongoing life transitions and keep their vibration aligned. We will discuss what feels right for you during your session.',
          order: 2
        },
        {
          q: 'Is spiritual healing a substitute for medical treatment?',
          a: 'Absolutely not. We consider spiritual healing a vital complementary layer to traditional wellness. It addresses the metaphysical roots of stress and emotional fatigue but is never a replacement for clinical care. We always recommend working alongside qualified medical professionals.',
          order: 3
        },
        {
          q: 'Can energy work be performed remotely?',
          a: 'Yes. Spiritual medicine transcends physical geography. Remote sessions are conducted via video call and are designed to harness universal energy, achieving the same depth of restoration as an in-person visit. Many clients find remote sessions equally — or more — powerful.',
          order: 4
        },
        {
          q: 'Who are your sessions suitable for?',
          a: 'Our services are open to anyone 18 years of age or over who is seeking balance, clarity or healing. Sessions are not suitable for those under the influence of alcohol or drugs, or those currently undergoing psychiatric therapy or treatment for clinical depression. If in doubt, please consult your GP first.',
          order: 5
        },
        {
          q: 'What is the difference between Past Life Regression and Past Life Healing?',
          a: 'Past Life Regression is a guided therapeutic process where you actively journey into past life memories under hypnosis. Past Life Healing is an intuitive approach where Reena intuitively accesses and heals past life wounds on your behalf. Both are powerful — the best fit depends on your preference and readiness.',
          order: 6
        }
      ];
      for (const f of realFaqs) {
        await pool.query(
          'INSERT INTO faqs (question, answer, order_num) VALUES ($1, $2, $3)',
          [f.q, f.a, f.order]
        );
      }
    }

    // ── Seed reviews if empty ─────────────────────────────────
    const reviewCountResult = await pool.query('SELECT COUNT(*) as c FROM reviews');
    if (parseInt(reviewCountResult.rows[0].c) === 0) {
      const seedReviews = [
        ['Anonymous', 'I was hesitant at first, but the 10-minute courtesy call eased my worries. I immediately felt comfortable and trusted the process. Thank you, SoulBody Healing.', 'approved'],
        ['Anonymous', 'After just one session, I felt lighter and more at peace. I truly believe I have been healed. I highly recommend SoulBody Healing to anyone seeking clarity and healing.', 'approved'],
        ['Anonymous', 'I felt truly empowered after my session. The tips I received are helping me navigate my journey with confidence. I now feel in tune with self.', 'approved']
      ];
      for (const [author, comment, status] of seedReviews) {
        await pool.query(
          'INSERT INTO reviews (author, comment, status) VALUES ($1, $2, $3)',
          [author, comment, status]
        );
      }
    }

    // ── Multer Image Uploader ────────────────────────────────
    // UPLOAD_DIR env var points to a persistent volume on EasyPanel.
    // Default: assets/uploads/ inside the project (works locally).
    // On EasyPanel: set UPLOAD_DIR to the mounted volume path (e.g. /data/uploads).
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'assets', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    const storage = multer.diskStorage({
      destination: function (req, file, cb) { cb(null, uploadDir); },
      filename:    function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, file.fieldname + '-' + Date.now() + ext);
      }
    });
    const upload = multer({
      storage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: function (req, file, cb) {
        if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only image files are allowed (JPEG, PNG, WebP, GIF, SVG)'));
      }
    });
    // Serve admin-uploaded images at /uploads/ (maps to persistent UPLOAD_DIR)
    app.use('/uploads', express.static(uploadDir));

    // ── PUBLIC CMS ENDPOINTS ──────────────────────────────────
    app.get('/api/content', async (req, res) => {
      try {
        const [contentResult, servicesResult, reviewsResult, faqsResult] = await Promise.all([
          pool.query('SELECT * FROM site_content'),
          pool.query('SELECT * FROM services ORDER BY order_num ASC, id ASC'),
          pool.query("SELECT author, comment, created_at FROM reviews WHERE status = 'approved' ORDER BY id DESC LIMIT 10"),
          pool.query('SELECT * FROM faqs ORDER BY order_num ASC, id ASC')
        ]);

        const content = {};
        contentResult.rows.forEach(r => content[r.key] = r.value);

        const services = servicesResult.rows;
        services.forEach(s => {
          try { s.features = JSON.parse(s.features); } catch(e) { s.features = [s.features]; }
        });

        res.json({ content, services, reviews: reviewsResult.rows, faqs: faqsResult.rows });
      } catch (err) {
        res.status(500).json({ error: 'Failed to fetch content' });
      }
    });

    app.post('/api/reviews', express.json(), async (req, res) => {
      try {
        const { author, comment } = req.body;
        if (!author || !comment) return res.status(400).json({ error: 'Missing fields' });
        await pool.query(
          'INSERT INTO reviews (author, comment, status) VALUES ($1, $2, $3)',
          [author, comment, 'pending']
        );
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to submit review' });
      }
    });

    // ── ADMIN CMS ENDPOINTS ───────────────────────────────────

    app.put('/api/admin/content', requireAdmin, express.json(), async (req, res) => {
      try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: 'Missing content object' });

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          for (const [key, val] of Object.entries(content)) {
            await client.query(
              'INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value',
              [key, val]
            );
          }
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to update content' });
      }
    });

    app.post('/api/admin/upload', requireAdmin, upload.single('image_file'), async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const key = req.body.key;
        if (!key) return res.status(400).json({ error: 'Missing content key' });
        const fileUrl = '/uploads/' + req.file.filename;
        await pool.query(
          'INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value',
          [key, fileUrl]
        );
        res.json({ success: true, url: fileUrl });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
      }
    });

    // Service image upload — saves to UPLOAD_DIR, immediately links to service if service_id provided
    app.post('/api/admin/upload/service-image', requireAdmin, upload.single('image'), async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const fileUrl = '/uploads/' + req.file.filename;
        const serviceId = req.body.service_id ? parseInt(req.body.service_id) : null;
        if (serviceId) {
          await pool.query('UPDATE services SET image_url = $1 WHERE id = $2', [fileUrl, serviceId]);
        }
        res.json({ success: true, url: fileUrl });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
      }
    });

    // Services Management
    app.post('/api/admin/services', requireAdmin, express.json(), async (req, res) => {
      try {
        const { title, description, features, duration, price, order_num, extra_details, image_url } = req.body;
        const featureStr = JSON.stringify(Array.isArray(features) ? features : features.split('\\n'));
        const extraStr = extra_details ? JSON.stringify(extra_details) : '{}';
        await pool.query(
          'INSERT INTO services (title, description, features, duration, price, order_num, extra_details, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [title, description, featureStr, duration, price, order_num || 0, extraStr, image_url || null]
        );
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to add service' });
      }
    });

    app.put('/api/admin/services/:id', requireAdmin, express.json(), async (req, res) => {
      try {
        const { title, description, features, duration, price, order_num, extra_details, image_url } = req.body;
        const featureStr = JSON.stringify(Array.isArray(features) ? features : features.split('\\n'));
        const extraStr = extra_details ? JSON.stringify(extra_details) : '{}';
        await pool.query(
          'UPDATE services SET title=$1, description=$2, features=$3, duration=$4, price=$5, order_num=$6, extra_details=$7, image_url=$8 WHERE id=$9',
          [title, description, featureStr, duration, price, order_num || 0, extraStr, image_url || null, req.params.id]
        );
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to update service' });
      }
    });

    app.delete('/api/admin/services/:id', requireAdmin, async (req, res) => {
      try {
        await pool.query('DELETE FROM services WHERE id=$1', [req.params.id]);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to delete service' });
      }
    });

    // FAQ Management
    app.post('/api/admin/faqs', requireAdmin, express.json(), async (req, res) => {
      try {
        const { question, answer, order_num } = req.body;
        await pool.query(
          'INSERT INTO faqs (question, answer, order_num) VALUES ($1, $2, $3)',
          [question, answer, order_num || 0]
        );
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to add faq' });
      }
    });

    app.put('/api/admin/faqs/:id', requireAdmin, express.json(), async (req, res) => {
      try {
        const { question, answer, order_num } = req.body;
        await pool.query(
          'UPDATE faqs SET question=$1, answer=$2, order_num=$3 WHERE id=$4',
          [question, answer, order_num || 0, req.params.id]
        );
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to update faq' });
      }
    });

    app.delete('/api/admin/faqs/:id', requireAdmin, async (req, res) => {
      try {
        await pool.query('DELETE FROM faqs WHERE id=$1', [req.params.id]);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to delete faq' });
      }
    });

    // Reviews Management
    app.get('/api/admin/reviews', requireAdmin, async (req, res) => {
      try {
        const result = await pool.query('SELECT * FROM reviews ORDER BY id DESC');
        res.json({ reviews: result.rows });
      } catch (err) {
        res.status(500).json({ error: 'Failed to get reviews' });
      }
    });

    app.put('/api/admin/reviews/:id', requireAdmin, express.json(), async (req, res) => {
      try {
        const { status } = req.body;
        await pool.query('UPDATE reviews SET status=$1 WHERE id=$2', [status, req.params.id]);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to update review' });
      }
    });
  }
};
