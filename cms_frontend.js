const FONT_GOOGLE_PARAMS = {
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400',
  'Playfair Display':   'Playfair+Display:ital,wght@0,400;0,600;1,400',
  'Libre Baskerville':  'Libre+Baskerville:ital,wght@0,400;1,400',
  'Merriweather':       'Merriweather:ital,wght@0,300;0,400;1,300',
  'EB Garamond':        'EB+Garamond:ital,wght@0,400;0,500;1,400',
  'Lora':               'Lora:ital,wght@0,400;0,600;1,400',
  'Cardo':              'Cardo:ital,wght@0,400;1,400',
  'Crimson Pro':        'Crimson+Pro:ital,wght@0,400;0,600;1,400',
  'Cinzel':             'Cinzel:wght@400;600',
  'Spectral':           'Spectral:ital,wght@0,400;0,600;1,400',
  'Gilda Display':      'Gilda+Display',
  'Josefin Slab':       'Josefin+Slab:ital,wght@0,300;0,400;1,300',
  'Raleway':            'Raleway:wght@300;400;500;600;700',
  'Inter':              'Inter:wght@300;400;500;600',
  'Nunito':             'Nunito:wght@300;400;500;600',
  'Lato':               'Lato:wght@300;400;700',
  'Open Sans':          'Open+Sans:wght@300;400;500;600',
  'Montserrat':         'Montserrat:wght@300;400;500;600',
  'Poppins':            'Poppins:wght@300;400;500;600',
  'Jost':               'Jost:wght@300;400;500;600',
  'DM Sans':            'DM+Sans:wght@300;400;500;600',
  'Source Sans 3':      'Source+Sans+3:wght@300;400;500;600',
};

const ACCENT_PALETTES_FE = {
  olive:       { main:'#5C5B47', dark:'#3D3C2E', mid:'#4A4938', light:'#7A7860', glow:'rgba(92,91,71,0.12)',   border:'rgba(92,91,71,0.12)',   borderStrong:'rgba(92,91,71,0.28)'   },
  forest:      { main:'#2D5016', dark:'#1a2e0d', mid:'#24400f', light:'#4a7a2a', glow:'rgba(45,80,22,0.12)',   border:'rgba(45,80,22,0.12)',   borderStrong:'rgba(45,80,22,0.28)'   },
  indigo:      { main:'#4B4E6D', dark:'#2d2f4a', mid:'#3d3f5e', light:'#6b6f90', glow:'rgba(75,78,109,0.12)', border:'rgba(75,78,109,0.12)', borderStrong:'rgba(75,78,109,0.28)' },
  terracotta:  { main:'#9B4A2E', dark:'#6b2f1a', mid:'#7d3c23', light:'#bc6b50', glow:'rgba(155,74,46,0.12)', border:'rgba(155,74,46,0.12)', borderStrong:'rgba(155,74,46,0.28)' },
  sage:        { main:'#7A8C6E', dark:'#526040', mid:'#647858', light:'#96a88c', glow:'rgba(122,140,110,0.12)',border:'rgba(122,140,110,0.12)',borderStrong:'rgba(122,140,110,0.28)'},
  navy:        { main:'#1E3A5F', dark:'#0f1f35', mid:'#162d4a', light:'#2e5080', glow:'rgba(30,58,95,0.12)',  border:'rgba(30,58,95,0.12)',  borderStrong:'rgba(30,58,95,0.28)'  },
  burgundy:    { main:'#6B2737', dark:'#3d1520', mid:'#581f2c', light:'#8c3d4e', glow:'rgba(107,39,55,0.12)', border:'rgba(107,39,55,0.12)', borderStrong:'rgba(107,39,55,0.28)' },
  gold:        { main:'#8B6914', dark:'#5a420c', mid:'#715510', light:'#b08a36', glow:'rgba(139,105,20,0.12)',border:'rgba(139,105,20,0.12)',borderStrong:'rgba(139,105,20,0.28)'},
};

function applyTheme(content) {
  const headingFont = content.font_heading;
  const bodyFont    = content.font_body;
  const accentKey   = content.accent_preset;

  if (headingFont || bodyFont) {
    const families = [];
    if (headingFont && headingFont !== 'Cormorant Garamond' && FONT_GOOGLE_PARAMS[headingFont])
      families.push(FONT_GOOGLE_PARAMS[headingFont]);
    if (bodyFont && bodyFont !== 'Raleway' && FONT_GOOGLE_PARAMS[bodyFont])
      families.push(FONT_GOOGLE_PARAMS[bodyFont]);

    if (families.length) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${families.map(f => 'family=' + f).join('&')}&display=swap`;
      document.head.appendChild(link);
    }

    if (headingFont) document.documentElement.style.setProperty('--font-heading', `'${headingFont}', serif`);
    if (bodyFont)    document.documentElement.style.setProperty('--font-body',    `'${bodyFont}', sans-serif`);
  }

  if (accentKey && accentKey !== 'olive' && ACCENT_PALETTES_FE[accentKey]) {
    const p = ACCENT_PALETTES_FE[accentKey];
    document.documentElement.style.setProperty('--olive',        p.main);
    document.documentElement.style.setProperty('--olive-dark',   p.dark);
    document.documentElement.style.setProperty('--olive-mid',    p.mid);
    document.documentElement.style.setProperty('--olive-light',  p.light);
    document.documentElement.style.setProperty('--olive-glow',   p.glow);
    document.documentElement.style.setProperty('--border',       p.border);
    document.documentElement.style.setProperty('--border-strong',p.borderStrong);
  }
}

// ── Nav helpers ──────────────────────────────────────────────

// Which page-group each sub-section belongs to
const NAV_PARENTS = {
  philosophy:      'about',
  story:           'about',
  process:         'services',
  disclaimer:      'contact',
  cancellation:    'contact',
  'reduced-rate':  'contact',
};

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function navHref(key, cfg, onHome, allCfg) {
  // Any section with location='page' gets its own clean URL (no hashes)
  if (cfg.location === 'page') {
    if (key === 'faq') return '/faq.html';
    return '/' + key;
  }
  // Sub-sections on 'home': follow parent
  const parentKey = NAV_PARENTS[key];
  if (parentKey) {
    const parentCfg = allCfg && allCfg[parentKey];
    if (parentCfg && parentCfg.location === 'page') {
      return '/' + parentKey + '#' + key;
    }
  }
  return onHome ? '#' + key : '/#' + key;
}

function isActivePage(key, cfg) {
  const p = location.pathname;
  if (cfg.location === 'page') {
    if (key === 'faq') return p === '/faq.html' || p === '/faq';
    return p === '/' + key;
  }
  return false;
}


function buildNav(content) {
  const cfg = content.nav_config ? (typeof content.nav_config === 'string' ? JSON.parse(content.nav_config) : content.nav_config) : {};
  const onHome = location.pathname === '/' || location.pathname === '/index.html';

  // Header nav
  const headerUl = document.getElementById('nav-links');
  if (headerUl) {
    const headerItems = Object.entries(cfg)
      .filter(([, c]) => c.header)
      .sort(([, a], [, b]) => a.order - b.order);

    headerUl.innerHTML = '<li><a href="' + (onHome ? '#home' : '/') + '" class="nav-link' + (onHome && location.hash === '' ? ' active' : '') + '">Home</a></li>';
    headerItems.forEach(([key, c]) => {
      const href = navHref(key, c, onHome, cfg);
      const active = isActivePage(key, c) ? ' active' : '';
      headerUl.innerHTML += `<li><a href="${escHtml(href)}" class="nav-link${active}">${escHtml(c.label)}</a></li>`;
    });
  }

  // Footer explore nav
  const footerUl = document.getElementById('footer-nav-explore');
  if (footerUl) {
    footerUl.innerHTML = '<li><a href="' + (onHome ? '#home' : '/') + '">Home</a></li>';
    const allItems = Object.entries(cfg).sort(([, a], [, b]) => a.order - b.order);
    allItems.forEach(([key, c]) => {
      if (!c.footer) return;
      const href = navHref(key, c, onHome, cfg);
      footerUl.innerHTML += `<li><a href="${escHtml(href)}">${escHtml(c.label)}</a></li>`;
    });
  }
}

function applySectionVisibility(content) {
  const cfg = content.nav_config ? (typeof content.nav_config === 'string' ? JSON.parse(content.nav_config) : content.nav_config) : {};
  const onHome = location.pathname === '/' || location.pathname === '/index.html';
  if (!onHome) return;

  const allSections = Array.from(document.querySelectorAll('[data-page-section]'));
  allSections.forEach(el => {
    const key = el.dataset.pageSection;
    const c = cfg[key];
    el.style.display = (c && c.location === 'page') ? 'none' : '';
  });

  // Reorder sections on the home page based on admin-configured order
  if (allSections.length > 1) {
    const parent = allSections[0].parentElement;
    // Use element after the last section as insert marker
    const lastSection = allSections[allSections.length - 1];
    const marker = lastSection.nextSibling;
    allSections.sort((a, b) => {
      const oA = cfg[a.dataset.pageSection] ? (cfg[a.dataset.pageSection].order || 999) : 999;
      const oB = cfg[b.dataset.pageSection] ? (cfg[b.dataset.pageSection].order || 999) : 999;
      return oA - oB;
    });
    allSections.forEach(el => parent.insertBefore(el, marker));
  }
}

// ── DOMContentLoaded ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/content');
        const data = await res.json();

        const content = data.content;

        // Apply fonts + accent colour before rendering
        applyTheme(content);

        // Build dynamic navigation from nav_config
        buildNav(content);

        // Show/hide home page sections based on nav_config
        applySectionVisibility(content);

        // Populate text fields — querySelectorAll handles duplicate ids gracefully
        for (const [key, val] of Object.entries(content)) {
            document.querySelectorAll(`[id="${key}"]`).forEach(el => {
                if (el.tagName === 'IMG') {
                    el.src = val;
                } else if (key.endsWith('_bg_img')) {
                    el.style.backgroundImage = `url(${val})`;
                } else if (el.tagName === 'A') {
                    if (val) {
                        const orig = el.getAttribute('href') || '';
                        const looksLikeUrl = /^(https?:|mailto:|tel:|\/|#)/.test(val);
                        if (orig.startsWith('mailto:')) {
                            // Email link: update both href and visible text
                            el.href = 'mailto:' + val;
                            el.innerHTML = val;
                        } else if (looksLikeUrl) {
                            el.href = val;
                        } else {
                            // Plain text value — update link label, leave href untouched
                            el.innerHTML = val;
                        }
                    }
                } else {
                    el.innerHTML = val;
                }
            });
        }
        // Update any mailto links tagged with data-mailto (e.g. CTA buttons)
        document.querySelectorAll('[data-mailto]').forEach(el => {
            const key = el.getAttribute('data-mailto');
            if (content[key]) el.href = 'mailto:' + content[key];
        });

        // Dispatch event so pages can react to loaded CMS data
        window.dispatchEvent(new CustomEvent('cmsContentLoaded', { detail: content }));

        // Populate Services
        const servicesGrid = document.querySelector('.services-grid');
        if (data.services && servicesGrid) {
            servicesGrid.innerHTML = '';
            data.services.forEach((s, idx) => {
                const fHTML = s.features.map(f => `<li>${f}</li>`).join('');
                const number = (idx+1).toString().padStart(2, '0');
                const isFeatured = idx === 1 ? 'featured' : '';
                const featuredBadge = idx === 1 ? `<div class="service-card-badge">Most Loved</div>` : '';

                servicesGrid.innerHTML += `
                <div class="service-card ${isFeatured}">
                  <div class="service-card-glow"></div>
                  ${featuredBadge}
                  <div class="service-number">${number}</div>
                  <h3 class="service-title">${s.title}</h3>
                  <p class="service-desc">${s.description}</p>
                  <ul class="service-features">${fHTML}</ul>
                  <div class="service-price" style="color:var(--olive); font-size:1.2rem; margin-bottom:1.5rem; font-family:var(--font-heading);">
                    <span>£${s.price}</span> <span style="font-size:0.9rem; color:var(--text-muted)">/ ${s.duration} mins</span>
                  </div>
                  <a href="/services/${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}" class="service-link-detail" style="font-size:0.8rem;color:var(--text-muted);text-decoration:none;display:block;margin-bottom:0.5rem;">View Details →</a>
                  <button onclick="openBookingForService('${s.title.replace(/'/g,"\\'")}', ${s.price})" class="service-link">Reserve This Path →</button>
                </div>
                `;
            });
        }

        // Populate Reviews
        const reviewsGrid = document.querySelector('.testimonial-slider');
        if (data.reviews && reviewsGrid) {
            reviewsGrid.innerHTML = '';
            data.reviews.forEach(r => {
                reviewsGrid.innerHTML += `
                <div class="testimonial-card">
                  <div class="testimonial-stars">★★★★★</div>
                  <p class="testimonial-text">"${r.comment}"</p>
                  <h4 class="testimonial-author">— ${r.author}</h4>
                </div>
                `;
            });
            reviewsGrid.innerHTML += `
            <div class="testimonial-card submit-review-card" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.28);padding:2.5rem 1.75rem;">
                <div style="font-size:2rem;margin-bottom:1rem;opacity:0.85;">✦</div>
                <h4 style="font-family:var(--font-heading);font-size:1.5rem;color:#fff;font-weight:400;margin-bottom:0.6rem;">Share Your Journey</h4>
                <p style="font-size:0.88rem;color:rgba(255,255,255,0.7);line-height:1.75;margin-bottom:1.75rem;max-width:240px;">Your healing story could be the light that guides someone else's path.</p>
                <button onclick="openReviewModal()" style="padding:0.75rem 1.6rem;background:#fff;color:var(--olive-dark,#3D3C2E);border:none;border-radius:6px;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer;letter-spacing:0.03em;transition:opacity 0.2s;" onmouseover="this.style.opacity=0.88" onmouseout="this.style.opacity=1">Write a Review →</button>
            </div>
            `;
        }

        // Populate FAQs (faq.html)
        const faqsContainer = document.getElementById('faqs-container');
        if (faqsContainer && data.faqs) {
            faqsContainer.innerHTML = '';
            data.faqs.forEach(faq => {
                faqsContainer.innerHTML += `
                <div class="card" style="padding: 1.5rem 2rem;">
                  <h4 style="color:var(--olive); margin-bottom:0.75rem;">${faq.question}</h4>
                  <p style="color:var(--text-body); line-height:1.8;">${faq.answer}</p>
                </div>
                `;
            });
        }
    } catch(err) {
        console.error('CMS Error', err);
    }
});

function openReviewModal() {
    let m = document.getElementById('review-modal');
    if (!m) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay" id="review-modal" onclick="if(event.target===this)closeReviewModal()">
                <div class="modal-box" style="max-width:480px;text-align:left;">
                    <button class="modal-close" onclick="closeReviewModal()" aria-label="Close">&times;</button>
                    <h2 class="modal-title" style="margin-bottom:1.5rem;text-align:center">Write a Review</h2>
                    <input type="text" id="review-author" placeholder="Your Name" style="width:100%;padding:0.8rem;margin-bottom:1rem;border-radius:4px;border:1px solid var(--border);background:rgba(0,0,0,0.5);color:var(--cream);font-family:var(--font-body);box-sizing:border-box;" />
                    <textarea id="review-comment" placeholder="Your Experience" style="width:100%;padding:0.8rem;margin-bottom:1.5rem;height:120px;border-radius:4px;border:1px solid var(--border);background:rgba(0,0,0,0.5);color:var(--cream);font-family:var(--font-body);resize:vertical;box-sizing:border-box;"></textarea>
                    <button class="btn btn-gold" style="width:100%" onclick="submitReview()">Submit Review</button>
                    <div id="review-msg" style="margin-top:1rem;color:var(--olive);text-align:center;height:20px;"></div>
                </div>
            </div>
        `);
        m = document.getElementById('review-modal');
    }
    m.classList.add('open');
}

function closeReviewModal() {
    const m = document.getElementById('review-modal');
    if (m) m.classList.remove('open');
}

async function submitReview() {
    const author  = document.getElementById('review-author').value.trim();
    const comment = document.getElementById('review-comment').value.trim();
    const msgEl   = document.getElementById('review-msg');

    if (!author || !comment) { msgEl.innerText = 'Please fill all fields.'; return; }

    msgEl.innerText = 'Submitting...';
    try {
        const res = await fetch('/api/reviews', {
            method: 'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({author, comment})
        });

        if (res.ok) {
            msgEl.innerText = 'Thank you! Your review is pending approval.';
            setTimeout(() => {
                closeReviewModal();
                document.getElementById('review-author').value  = '';
                document.getElementById('review-comment').value = '';
                msgEl.innerText = '';
            }, 3000);
        } else {
            msgEl.innerText = 'An error occurred. Please try again.';
        }
    } catch(err) {
        msgEl.innerText = 'Network error. Please try again.';
    }
}
