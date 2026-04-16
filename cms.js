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

    // Seed Initial Content if empty
    const contentCount = db.prepare('SELECT COUNT(*) as c FROM site_content').get().c;
    if (contentCount === 0) {
      const initContent = db.prepare('INSERT INTO site_content (key, value) VALUES (?, ?)');
      const defaultContent = {
        'hero_title': 'Awaken Your Sacred Self',
        'hero_subtitle': 'Journey beyond the veil of ordinary existence. Ancient wisdom meets infinite healing potential — within you.',
        'hero_button_text': 'Begin Your Journey →',
        'explore_button_text': 'Explore Services',
        'about_title': 'Meet Your Guide',
        'about_paragraph1': 'I am a conduit for universal energy, dedicated to guiding souls back to their inherent state of harmony. For over a decade, I have studied ancient modalities, blending them with intuitive insight to create a sanctuary where profound shifts occur.',
        'about_paragraph2': 'When you enter this space, there is no judgment—only deep listening and the gentle encouragement required to help you release patterns that no longer serve you.',
        'contact_email': 'hello@sacredhealing.com',
        'contact_phone': '+44 7700 900000',
        'contact_location': 'Elysian Fields, London, UK',
        'logo_img': 'assets/logo.png',
        'hero_bg_img': 'assets/sacred_healing_hero_bg.png',
        'chakra_img': 'assets/mandala.png',
        'healer_img': 'assets/healer.jpg'
      };
      
      const insertManyContent = db.transaction((contentObj) => {
        for (const [key, val] of Object.entries(contentObj)) {
          initContent.run(key, val);
        }
      });
      insertManyContent(defaultContent);
      
      // Default Services
      const insertService = db.prepare('INSERT INTO services (title, description, features, duration, price, order_num) VALUES (?, ?, ?, ?, ?, ?)');
      const defaultServices = [
        {
          title: "Quantum Energy Reset",
          desc: "A rapid energetic alignment designed to clear immediate blockages and restore your auric field.",
          features: "Aura Cleansing\nChakra Balancing\nSound Bath Healing",
          duration: 30, price: 50, order: 1
        },
        {
          title: "The Deep Awakening",
          desc: "Our signature session. A profound dive into your soul's blueprint to heal generational trauma and reignite your core purpose.",
          features: "Past-Life Regression\nKarmic Cord Cutting\nIntuitive Oracle Guidance\nCustom Herbal Blend",
          duration: 90, price: 120, order: 2
        },
        {
          title: "Celestial Harmony Session",
          desc: "A beautifully guided meditative healing focusing on aligning the physical body with your higher self.",
          features: "Crystal Grid Therapy\nReiki Energy Transfer\nBreathwork Integration",
          duration: 60, price: 80, order: 3
        }
      ];
      const insertManyServices = db.transaction((services) => {
        for (const s of services) {
          insertService.run(s.title, s.desc, JSON.stringify(s.features.split('\n')), s.duration, s.price, s.order);
        }
      });
      insertManyServices(defaultServices);
    }
    
    // Seed dummy reviews if empty
    const reviewCount = db.prepare('SELECT COUNT(*) as c FROM reviews').get().c;
    if (reviewCount === 0) {
      db.prepare("INSERT INTO reviews (author, comment, status) VALUES ('Sarah Jenkins', 'A truly transformative experience. I felt heavy blocks lift that I had been carrying for years.', 'approved')").run();
      db.prepare("INSERT INTO reviews (author, comment, status) VALUES ('Michael R.', 'Incredible intuition. I left my session feeling like I was walking on air.', 'approved')").run();
      db.prepare("INSERT INTO reviews (author, comment, status) VALUES ('Elena Woods', 'Beautiful space, beautiful energy. Worth every penny for the clarity I gained.', 'pending')").run();
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
