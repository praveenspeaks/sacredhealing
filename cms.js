const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = {
  init: function(db, app, requireAdmin) {
    // ── CMS DB Setup ──────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS site_content (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS services (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        description TEXT NOT NULL,
        features    TEXT NOT NULL,
        duration    INTEGER DEFAULT 60,
        price       REAL DEFAULT 0,
        order_num   INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        author      TEXT NOT NULL,
        comment     TEXT NOT NULL,
        status      TEXT DEFAULT 'pending',
        created_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS faqs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        question    TEXT NOT NULL,
        answer      TEXT NOT NULL,
        order_num   INTEGER DEFAULT 0
      );
    `);

    try {
      db.exec('ALTER TABLE services ADD COLUMN extra_details TEXT DEFAULT "{}"');
    } catch(e) {
      // Ignore if column already exists
    }

    // Migration: fix logo path if it still points to the old non-existent file
    db.prepare(
      "UPDATE site_content SET value = 'assets/logo-sbh.png' WHERE key = 'logo_img' AND value = 'assets/logo.png'"
    ).run();

    // ── Upsert site_content with real content ────────────────
    const upsertContent = db.prepare(
      'INSERT INTO site_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
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
      'logo_img':           'assets/logo-sbh.png',
      'hero_bg_img':        'assets/sacred_healing_hero_bg.png',
      'chakra_img':         'assets/mandala.png',
      'healer_img':         'assets/healer.jpg'
    };
    const upsertManyContent = db.transaction((obj) => {
      for (const [key, val] of Object.entries(obj)) upsertContent.run(key, val);
    });
    upsertManyContent(realContent);

    // ── Remove placeholder seed services ─────────────────────
    db.prepare(
      "DELETE FROM services WHERE title IN ('Quantum Energy Reset','The Deep Awakening','Celestial Harmony Session')"
    ).run();

    // ── Upsert real services ──────────────────────────────────
    const upsertService = db.prepare(`
      INSERT INTO services (title, description, features, duration, price, order_num, extra_details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(title) DO UPDATE SET
        description   = excluded.description,
        features      = excluded.features,
        duration      = excluded.duration,
        price         = excluded.price,
        order_num     = excluded.order_num,
        extra_details = excluded.extra_details
    `);

    // Add unique index on title if it doesn't exist yet
    try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS services_title_unique ON services(title)'); } catch(e) {}

    const realServices = [
      {
        title: 'Spiritual Healing',
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

    const upsertManyServices = db.transaction((services) => {
      for (const s of services) {
        upsertService.run(
          s.title, s.description,
          JSON.stringify(s.features),
          s.duration, s.price, s.order,
          JSON.stringify(s.extra)
        );
      }
    });
    upsertManyServices(realServices);

    // ── Upsert FAQs ───────────────────────────────────────────
    const faqCount = db.prepare('SELECT COUNT(*) as c FROM faqs').get().c;
    if (faqCount === 0) {
      const insertFaq = db.prepare('INSERT INTO faqs (question, answer, order_num) VALUES (?, ?, ?)');
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
      const insertFaqs = db.transaction((faqs) => {
        for (const f of faqs) insertFaq.run(f.q, f.a, f.order);
      });
      insertFaqs(realFaqs);
    }

    // ── Seed reviews if empty ─────────────────────────────────
    const reviewCount = db.prepare('SELECT COUNT(*) as c FROM reviews').get().c;
    if (reviewCount === 0) {
      db.prepare("INSERT INTO reviews (author, comment, status) VALUES ('Anonymous', 'I was hesitant at first, but the 10-minute courtesy call eased my worries. I immediately felt comfortable and trusted the process. Thank you, SoulBody Healing.', 'approved')").run();
      db.prepare("INSERT INTO reviews (author, comment, status) VALUES ('Anonymous', 'After just one session, I felt lighter and more at peace. I truly believe I have been healed. I highly recommend SoulBody Healing to anyone seeking clarity and healing.', 'approved')").run();
      db.prepare("INSERT INTO reviews (author, comment, status) VALUES ('Anonymous', 'I felt truly empowered after my session. The tips I received are helping me navigate my journey with confidence. I now feel in tune with self.', 'approved')").run();
    }

    // ── Multer Image Uploader ────────────────────────────────
    const uploadDir = path.join(__dirname, 'assets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, uploadDir)
      },
      filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + Date.now() + ext)
      }
    });
    const upload = multer({
      storage: storage,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: function (req, file, cb) {
        if (ALLOWED_MIME.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed (JPEG, PNG, WebP, GIF, SVG)'));
        }
      }
    });
    app.use('/assets', express.static(uploadDir));

    // ── PUBLIC CMS ENDPOINTS ──────────────────────────────────
    app.get('/api/content', (req, res) => {
      try {
        const contentRows = db.prepare('SELECT * FROM site_content').all();
        const content = {};
        contentRows.forEach(r => content[r.key] = r.value);
        
        const services = db.prepare('SELECT * FROM services ORDER BY order_num ASC, id ASC').all();
        // Parse features from JSON
        services.forEach(s => {
          try { s.features = JSON.parse(s.features); } catch(e) { s.features = [s.features]; }
        });
        
        const reviews = db.prepare("SELECT author, comment, created_at FROM reviews WHERE status = 'approved' ORDER BY id DESC LIMIT 10").all();
        
        const faqs = db.prepare('SELECT * FROM faqs ORDER BY order_num ASC, id ASC').all();

        res.json({ content, services, reviews, faqs });
      } catch (err) {
        res.status(500).json({ error: 'Failed to fetch content' });
      }
    });

    app.post('/api/reviews', express.json(), (req, res) => {
      try {
        const { author, comment } = req.body;
        if (!author || !comment) return res.status(400).json({ error: 'Missing fields' });
        db.prepare('INSERT INTO reviews (author, comment, status) VALUES (?, ?, ?)')
          .run(author, comment, 'pending');
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to submit review' });
      }
    });

    // ── ADMIN CMS ENDPOINTS ───────────────────────────────────
    
    // Content Texts Update
    app.put('/api/admin/content', requireAdmin, express.json(), (req, res) => {
      try {
        const { content } = req.body; // Map of key-values
        if (!content) return res.status(400).json({ error: 'Missing content object' });
        
        const updateStmt = db.prepare('INSERT INTO site_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        const updateMany = db.transaction((entries) => {
          for (const [key, val] of Object.entries(entries)) {
            updateStmt.run(key, val);
          }
        });
        updateMany(content);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Failed to update content' });
      }
    });

    // Image Upload Endpoint (Saves to server, updates site_content natively)
    app.post('/api/admin/upload', requireAdmin, upload.single('image_file'), (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const key = req.body.key; // e.g., 'logo_img'
        if (!key) return res.status(400).json({ error: 'Missing content key' });
        
        const fileUrl = 'assets/' + req.file.filename;
        db.prepare('INSERT INTO site_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
          .run(key, fileUrl);
          
        res.json({ success: true, url: fileUrl });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
      }
    });
    
    // Services Management
    app.post('/api/admin/services', requireAdmin, express.json(), (req, res) => {
        try {
            const { title, description, features, duration, price, order_num, extra_details } = req.body;
            const featureStr = JSON.stringify(Array.isArray(features) ? features : features.split('\\n'));
            const extraStr = extra_details ? JSON.stringify(extra_details) : "{}";
            db.prepare('INSERT INTO services (title, description, features, duration, price, order_num, extra_details) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .run(title, description, featureStr, duration, price, order_num || 0, extraStr);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Failed to add service' });
        }
    });
    
    app.put('/api/admin/services/:id', requireAdmin, express.json(), (req, res) => {
        try {
            const id = req.params.id;
            const { title, description, features, duration, price, order_num, extra_details } = req.body;
            const featureStr = JSON.stringify(Array.isArray(features) ? features : features.split('\\n'));
            const extraStr = extra_details ? JSON.stringify(extra_details) : "{}";
            db.prepare('UPDATE services SET title=?, description=?, features=?, duration=?, price=?, order_num=?, extra_details=? WHERE id=?')
              .run(title, description, featureStr, duration, price, order_num || 0, extraStr, id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Failed to update service' });
        }
    });
    
    app.delete('/api/admin/services/:id', requireAdmin, (req, res) => {
        try {
            db.prepare('DELETE FROM services WHERE id=?').run(req.params.id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Failed to delete service' });
        }
    });
    
    // FAQ Management
    app.post('/api/admin/faqs', requireAdmin, express.json(), (req, res) => {
        try {
            const { question, answer, order_num } = req.body;
            db.prepare('INSERT INTO faqs (question, answer, order_num) VALUES (?, ?, ?)')
              .run(question, answer, order_num || 0);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Failed to add faq' });
        }
    });

    app.put('/api/admin/faqs/:id', requireAdmin, express.json(), (req, res) => {
        try {
            const { question, answer, order_num } = req.body;
            db.prepare('UPDATE faqs SET question=?, answer=?, order_num=? WHERE id=?')
              .run(question, answer, order_num || 0, req.params.id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Failed to update faq' });
        }
    });

    app.delete('/api/admin/faqs/:id', requireAdmin, (req, res) => {
        try {
            db.prepare('DELETE FROM faqs WHERE id=?').run(req.params.id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Failed to delete faq' });
        }
    });
    
    // Reviews Management
    app.get('/api/admin/reviews', requireAdmin, (req, res) => {
        try {
            const reviews = db.prepare("SELECT * FROM reviews ORDER BY id DESC").all();
            res.json({ reviews });
        } catch (err) {
            res.status(500).json({ error: 'Failed to get reviews' });
        }
    });
    
    app.put('/api/admin/reviews/:id', requireAdmin, express.json(), (req, res) => {
        try {
            const id = req.params.id;
            const { status } = req.body;
            db.prepare('UPDATE reviews SET status=? WHERE id=?').run(status, id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Failed to update review' });
        }
    });

  }
};
