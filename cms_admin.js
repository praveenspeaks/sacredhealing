let siteContent = {};
let servicesList = [];
let reviewsList = [];
let faqsList = [];

// Load CMS Data on page switch
const originalShowPage = showPage;
showPage = function(pageId) {
    originalShowPage(pageId);
    if (pageId === 'content') loadContent();
    if (pageId === 'services') loadServices();
    if (pageId === 'reviews') loadReviews();
    if (pageId === 'faqs') loadFaqs();
    if (pageId === 'navigation') loadNavConfig();
};

async function loadContent() {
    try {
        const res = await fetch('/api/content');
        const data = await res.json();
        siteContent = data.content;
        
        const textKeys = ['hero_title', 'hero_subtitle', 'hero_button_text', 'explore_button_text', 'about_title', 'about_paragraph1', 'about_paragraph2', 'contact_email', 'contact_phone', 'contact_location', 'social_instagram', 'social_whatsapp', 'footer_tagline', 'footer_online_text', 'footer_copyright', 'footer_credit'];
        textKeys.forEach(k => {
            const el = document.getElementById('cms-' + k);
            if (el && siteContent[k]) el.value = siteContent[k];
        });
        
        // Populate image previews
        ['logo_img', 'hero_bg_img', 'healer_img'].forEach(k => {
            const el = document.getElementById('preview-' + k);
            if (el && siteContent[k]) el.src = siteContent[k];
        });
    } catch(err) {
        toast('Failed to load content', 'error');
    }
}

async function saveContent() {
    const textKeys = ['hero_title', 'hero_subtitle', 'hero_button_text', 'explore_button_text', 'about_title', 'about_paragraph1', 'about_paragraph2', 'contact_email', 'contact_phone', 'contact_location', 'social_instagram', 'social_whatsapp'];
    const updates = {};
    textKeys.forEach(k => {
        const el = document.getElementById('cms-' + k);
        if (el) updates[k] = el.value;
    });
    
    try {
        const res = await fetch('/api/admin/content', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
            body: JSON.stringify({ content: updates })
        });
        if (res.ok) toast('Content updated safely!', 'success');
        else toast('Failed to update content', 'error');
    } catch(err) {
        toast('Error saving content', 'error');
    }
}

async function uploadImage(key) {
    const fileInput = document.getElementById('upload-' + key);
    if (!fileInput.files || fileInput.files.length === 0) {
        return toast('Please select a file first', 'error');
    }
    
    const formData = new FormData();
    formData.append('image_file', fileInput.files[0]);
    formData.append('key', key);
    
    try {
        const res = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'x-admin-password': adminToken },
            body: formData
        });
        if (res.ok) {
            toast('Image uploaded safely!', 'success');
            fileInput.value = '';
            loadContent(); // Refresh the previews
        } else {
            toast('Upload failed', 'error');
        }
    } catch(err) {
        toast('Upload error', 'error');
    }
}

async function loadServices() {
    try {
        const res = await fetch('/api/content');
        const data = await res.json();
        servicesList = data.services || [];
        renderServicesTable();
    } catch(err) {
        toast('Failed to load services', 'error');
    }
}

function renderServicesTable() {
    const tbody = servicesList.map(s => {
        const fList = Array.isArray(s.features) ? s.features.join(', ') : s.features;
        return `
        <tr>
            <td><strong>${s.title}</strong></td>
            <td>£${s.price}</td>
            <td>${s.duration} min</td>
            <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis" title="${fList}">${fList}</td>
            <td>
                <div class="td-actions">
                    <button class="btn-sm btn-primary" onclick="editService(${s.id})" style="padding:0.2rem 0.5rem">Edit</button>
                    <button class="btn-sm btn-danger" onclick="deleteService(${s.id})">Delete</button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
    
    document.getElementById('services-table').innerHTML = `
    <table>
        <thead><tr><th>Title</th><th>Price</th><th>Duration</th><th>Features</th><th>Actions</th></tr></thead>
        <tbody>${tbody || '<tr><td colspan="5" style="text-align:center">No services found</td></tr>'}</tbody>
    </table>
    `;
}

let editServiceId = null;

function editService(id) {
    const s = servicesList.find(x => x.id === id);
    if (!s) return;
    editServiceId = id;
    document.getElementById('srv-title').value = s.title;
    document.getElementById('srv-price').value = s.price;
    document.getElementById('srv-duration').value = s.duration;
    document.getElementById('srv-desc').value = s.description;
    document.getElementById('srv-features').value = Array.isArray(s.features) ? s.features.join('n') : s.features;
    
    let details = {};
    if (s.extra_details) {
        try { details = JSON.parse(s.extra_details); } catch(e){}
    }
    document.getElementById('srv-icon').value = details.icon || '';
    document.getElementById('srv-tag').value = details.tag || '';
    document.getElementById('srv-sessionType').value = details.sessionType || '';
    document.getElementById('srv-bestFor').value = details.bestFor || '';
    document.getElementById('srv-longDescription').value = details.longDescription ? details.longDescription.join('n') : '';
    document.getElementById('srv-expect').value = details.expect ? details.expect.map(e => `${e.title}|${e.text}`).join('n') : '';
    
    const btn = document.querySelector('button[onclick="addService()"]') || document.querySelector('button[onclick="updateService()"]');
    if (btn) {
        btn.innerText = 'Update Service';
        btn.setAttribute('onclick', 'updateService()');
    }
    toast('Service loaded for editing', 'info');
}

async function updateService() {
    if (!editServiceId) return addService();
    
    const title = document.getElementById('srv-title').value.trim();
    const price = document.getElementById('srv-price').value.trim();
    const duration = document.getElementById('srv-duration').value;
    const desc = document.getElementById('srv-desc').value.trim();
    const features = document.getElementById('srv-features').value.trim();
    
    const icon = document.getElementById('srv-icon').value.trim();
    const tag = document.getElementById('srv-tag').value.trim();
    const sessionType = document.getElementById('srv-sessionType').value.trim();
    const bestFor = document.getElementById('srv-bestFor').value.trim();
    const longDescRaw = document.getElementById('srv-longDescription').value.trim();
    const expectRaw = document.getElementById('srv-expect').value.trim();

    if (!title || !desc || !features) return toast('Fill all required fields', 'error');

    const longDescription = longDescRaw ? longDescRaw.split('n').filter(Boolean) : [];
    const expect = expectRaw ? expectRaw.split('n').filter(Boolean).map(line => {
        const parts = line.split('|');
        return { title: parts[0] || '', text: parts[1] || '' };
    }) : [];

    const extra_details = {
        icon, tag, sessionType, bestFor, longDescription, expect
    };
    
    try {
        const res = await fetch('/api/admin/services/' + editServiceId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
            body: JSON.stringify({ title, price, duration, description: desc, features, extra_details })
        });
        if (res.ok) {
            toast('Service updated successfully', 'success');
            clearServiceForm();
            loadServices();
        } else {
            toast('Failed to update service', 'error');
        }
    } catch(err) {
        toast('Error updating service', 'error');
    }
}

async function addService() {
    const title = document.getElementById('srv-title').value.trim();
    const price = document.getElementById('srv-price').value.trim();
    const duration = document.getElementById('srv-duration').value;
    const desc = document.getElementById('srv-desc').value.trim();
    const features = document.getElementById('srv-features').value.trim();
    
    const icon = document.getElementById('srv-icon').value.trim();
    const tag = document.getElementById('srv-tag').value.trim();
    const sessionType = document.getElementById('srv-sessionType').value.trim();
    const bestFor = document.getElementById('srv-bestFor').value.trim();
    const longDescRaw = document.getElementById('srv-longDescription').value.trim();
    const expectRaw = document.getElementById('srv-expect').value.trim();

    if (!title || !desc || !features) return toast('Fill all required fields', 'error');
    
    const longDescription = longDescRaw ? longDescRaw.split('n').filter(Boolean) : [];
    const expect = expectRaw ? expectRaw.split('n').filter(Boolean).map(line => {
        const parts = line.split('|');
        return { title: parts[0] || '', text: parts[1] || '' };
    }) : [];

    const extra_details = {
        icon, tag, sessionType, bestFor, longDescription, expect
    };

    try {
        const res = await fetch('/api/admin/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
            body: JSON.stringify({ title, price, duration, description: desc, features, order_num: servicesList.length + 1, extra_details })
        });
        if (res.ok) {
            toast('Service added successfully', 'success');
            clearServiceForm();
            loadServices();
        } else {
            toast('Failed to add service', 'error');
        }
    } catch(err) {
        toast('Error adding service', 'error');
    }
}

function clearServiceForm() {
    editServiceId = null;
    document.getElementById('srv-title').value = '';
    document.getElementById('srv-price').value = '';
    document.getElementById('srv-desc').value = '';
    document.getElementById('srv-features').value = '';
    
    document.getElementById('srv-icon').value = '';
    document.getElementById('srv-tag').value = '';
    document.getElementById('srv-sessionType').value = '';
    document.getElementById('srv-bestFor').value = '';
    document.getElementById('srv-longDescription').value = '';
    document.getElementById('srv-expect').value = '';
    
    const btn = document.querySelector('button[onclick="updateService()"]') || document.querySelector('button[onclick="addService()"]');
    if (btn) {
        btn.innerText = 'Add / Update Service';
        btn.setAttribute('onclick', 'addService()');
    }
}

async function deleteService(id) {
    if (!confirm('Are you sure you want to permanently delete this service?')) return;
    try {
        const res = await fetch('/api/admin/services/' + id, {
            method: 'DELETE',
            headers: { 'x-admin-password': adminToken }
        });
        if (res.ok) {
            toast('Service deleted', 'success');
            loadServices();
        } else {
            toast('Deletion failed', 'error');
        }
    } catch(err) {
        toast('Error deleting service', 'error');
    }
}

// ── FAQs ──
async function loadFaqs() {
    try {
        const res = await fetch('/api/content');
        const data = await res.json();
        faqsList = data.faqs || [];
        renderFaqsTable();
    } catch(err) {
        toast('Failed to load FAQs', 'error');
    }
}

function renderFaqsTable() {
    const tbody = faqsList.map(f => `
        <tr>
            <td><strong>${f.question}</strong></td>
            <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${f.answer}</td>
            <td>
                <div class="td-actions">
                    <button class="btn-sm btn-danger" onclick="deleteFaq(${f.id})">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('faqs-table').innerHTML = `
    <table>
        <thead><tr><th>Question</th><th>Answer</th><th>Actions</th></tr></thead>
        <tbody>${tbody || '<tr><td colspan="3" style="text-align:center">No FAQs found</td></tr>'}</tbody>
    </table>
    `;
}

async function addFaq() {
    const question = document.getElementById('faq-question').value.trim();
    const answer = document.getElementById('faq-answer').value.trim();
    if (!question || !answer) return toast('Fill out both fields', 'error');
    
    try {
        const res = await fetch('/api/admin/faqs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
            body: JSON.stringify({ question, answer, order_num: faqsList.length + 1 })
        });
        if (res.ok) {
            toast('FAQ added', 'success');
            document.getElementById('faq-question').value = '';
            document.getElementById('faq-answer').value = '';
            loadFaqs();
        } else {
            toast('Failed to add FAQ', 'error');
        }
    } catch(err) {
        toast('Error adding FAQ', 'error');
    }
}

async function deleteFaq(id) {
    if (!confirm('Delete this FAQ?')) return;
    try {
        const res = await fetch('/api/admin/faqs/' + id, { method: 'DELETE', headers: { 'x-admin-password': adminToken } });
        if (res.ok) {
            toast('FAQ deleted', 'success');
            loadFaqs();
        } else toast('Deletion failed', 'error');
    } catch(err) { toast('Error deleting FAQ', 'error'); }
}

async function loadReviews() {
    try {
        const res = await fetch('/api/admin/reviews', { headers: { 'x-admin-password': adminToken } });
        const data = await res.json();
        reviewsList = data.reviews || [];
        renderReviewsTable();
    } catch(err) { toast('Failed to load reviews', 'error'); }
}

function renderReviewsTable() {
    const tbody = reviewsList.map(r => {
        let badgeClass = r.status === 'pending' ? 'badge-warning' : r.status === 'approved' ? 'badge-success' : 'badge-danger';
        return `
        <tr>
            <td><strong>${r.author}</strong></td>
            <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis">"${r.comment}"</td>
            <td><span class="badge ${badgeClass}">${r.status}</span></td>
            <td>
                <div class="td-actions">
                    ${r.status !== 'approved' ? `<button class="btn-sm btn-success" onclick="updateReviewStatus(${r.id}, 'approved')">Approve</button>` : ''}
                    ${r.status !== 'rejected' ? `<button class="btn-sm btn-danger" onclick="updateReviewStatus(${r.id}, 'rejected')">Reject</button>` : ''}
                </div>
            </td>
        </tr>
        `;
    }).join('');
    
    document.getElementById('reviews-table').innerHTML = `
    <table>
        <thead><tr><th>Author</th><th>Review</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${tbody || '<tr><td colspan="4" style="text-align:center">No reviews found</td></tr>'}</tbody>
    </table>
    `;
}

async function updateReviewStatus(id, status) {
    try {
        const res = await fetch('/api/admin/reviews/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            toast('Review ' + status, 'success');
            loadReviews();
        } else {
            toast('Failed to update review status', 'error');
        }
    } catch(err) {
        toast('Error updating review', 'error');
    }
}

// ── THEME & FONTS ─────────────────────────────────────────────

const HEADING_FONTS = [
  { name: 'Cormorant Garamond', google: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400', category: 'Elegant Serif' },
  { name: 'Playfair Display',   google: 'Playfair+Display:ital,wght@0,400;0,600;1,400',          category: 'Editorial Serif' },
  { name: 'Libre Baskerville',  google: 'Libre+Baskerville:ital,wght@0,400;1,400',               category: 'Classic Serif' },
  { name: 'Merriweather',       google: 'Merriweather:ital,wght@0,300;0,400;1,300',              category: 'Literary Serif' },
  { name: 'EB Garamond',        google: 'EB+Garamond:ital,wght@0,400;0,500;1,400',               category: 'Renaissance Serif' },
  { name: 'Lora',               google: 'Lora:ital,wght@0,400;0,600;1,400',                      category: 'Contemporary Serif' },
  { name: 'Cardo',              google: 'Cardo:ital,wght@0,400;1,400',                            category: 'Humanist Serif' },
  { name: 'Crimson Pro',        google: 'Crimson+Pro:ital,wght@0,400;0,600;1,400',               category: 'Transitional Serif' },
  { name: 'Cinzel',             google: 'Cinzel:wght@400;600',                                    category: 'Roman Serif' },
  { name: 'Spectral',           google: 'Spectral:ital,wght@0,400;0,600;1,400',                  category: 'Screen Serif' },
  { name: 'Gilda Display',      google: 'Gilda+Display',                                          category: 'Art Deco Serif' },
  { name: 'Josefin Slab',       google: 'Josefin+Slab:ital,wght@0,300;0,400;1,300',              category: 'Geometric Slab' },
];

const BODY_FONTS = [
  { name: 'Raleway',       google: 'Raleway:wght@300;400;500;600;700',      category: 'Elegant Sans' },
  { name: 'Inter',         google: 'Inter:wght@300;400;500;600',            category: 'Modern Sans' },
  { name: 'Nunito',        google: 'Nunito:wght@300;400;500;600',           category: 'Friendly Rounded' },
  { name: 'Lato',          google: 'Lato:wght@300;400;700',                 category: 'Humanist Sans' },
  { name: 'Open Sans',     google: 'Open+Sans:wght@300;400;500;600',        category: 'Neutral Sans' },
  { name: 'Montserrat',    google: 'Montserrat:wght@300;400;500;600',       category: 'Geometric Sans' },
  { name: 'Poppins',       google: 'Poppins:wght@300;400;500;600',          category: 'Circular Sans' },
  { name: 'Jost',          google: 'Jost:wght@300;400;500;600',             category: 'Clean Sans' },
  { name: 'DM Sans',       google: 'DM+Sans:wght@300;400;500;600',          category: 'Low Contrast' },
  { name: 'Source Sans 3', google: 'Source+Sans+3:wght@300;400;500;600',    category: 'Readable Sans' },
];

const ACCENT_PALETTES = [
  { key: 'olive',      name: 'Olive',       main: '#5C5B47', dark: '#3D3C2E', mid: '#4A4938', light: '#7A7860', glow: 'rgba(92,91,71,0.12)',   border: 'rgba(92,91,71,0.12)',   borderStrong: 'rgba(92,91,71,0.28)'   },
  { key: 'forest',     name: 'Forest',      main: '#2D5016', dark: '#1a2e0d', mid: '#24400f', light: '#4a7a2a', glow: 'rgba(45,80,22,0.12)',   border: 'rgba(45,80,22,0.12)',   borderStrong: 'rgba(45,80,22,0.28)'   },
  { key: 'indigo',     name: 'Indigo',      main: '#4B4E6D', dark: '#2d2f4a', mid: '#3d3f5e', light: '#6b6f90', glow: 'rgba(75,78,109,0.12)', border: 'rgba(75,78,109,0.12)', borderStrong: 'rgba(75,78,109,0.28)' },
  { key: 'terracotta', name: 'Terracotta',  main: '#9B4A2E', dark: '#6b2f1a', mid: '#7d3c23', light: '#bc6b50', glow: 'rgba(155,74,46,0.12)', border: 'rgba(155,74,46,0.12)', borderStrong: 'rgba(155,74,46,0.28)' },
  { key: 'sage',       name: 'Sage',        main: '#7A8C6E', dark: '#526040', mid: '#647858', light: '#96a88c', glow: 'rgba(122,140,110,0.12)',border: 'rgba(122,140,110,0.12)',borderStrong: 'rgba(122,140,110,0.28)'},
  { key: 'navy',       name: 'Navy',        main: '#1E3A5F', dark: '#0f1f35', mid: '#162d4a', light: '#2e5080', glow: 'rgba(30,58,95,0.12)',  border: 'rgba(30,58,95,0.12)',  borderStrong: 'rgba(30,58,95,0.28)'  },
  { key: 'burgundy',   name: 'Burgundy',    main: '#6B2737', dark: '#3d1520', mid: '#581f2c', light: '#8c3d4e', glow: 'rgba(107,39,55,0.12)', border: 'rgba(107,39,55,0.12)', borderStrong: 'rgba(107,39,55,0.28)' },
  { key: 'gold',       name: 'Gold',        main: '#8B6914', dark: '#5a420c', mid: '#715510', light: '#b08a36', glow: 'rgba(139,105,20,0.12)',border: 'rgba(139,105,20,0.12)',borderStrong: 'rgba(139,105,20,0.28)'},
];

let themeState = { font_heading: 'Cormorant Garamond', font_body: 'Raleway', accent_preset: 'olive' };

function loadThemeAdminFonts() {
    if (document.getElementById('admin-all-fonts')) return;
    const all = [...HEADING_FONTS, ...BODY_FONTS].map(f => 'family=' + f.google).join('&');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id  = 'admin-all-fonts';
    link.href = `https://fonts.googleapis.com/css2?${all}&display=swap`;
    document.head.appendChild(link);
}

async function loadTheme() {
    loadThemeAdminFonts();
    try {
        const res  = await fetch('/api/content');
        const data = await res.json();
        const c    = data.content || {};
        themeState.font_heading  = c.font_heading  || 'Cormorant Garamond';
        themeState.font_body     = c.font_body     || 'Raleway';
        themeState.accent_preset = c.accent_preset || 'olive';
        renderThemePickers();
        updateThemePreview();
    } catch(e) {
        toast('Failed to load theme settings', 'error');
    }
}

function renderThemePickers() {
    // Heading fonts
    document.getElementById('heading-font-grid').innerHTML = HEADING_FONTS.map(f => {
        const active = f.name === themeState.font_heading;
        return `
        <div onclick="selectFont('heading','${f.name}')"
          style="cursor:pointer;padding:1rem 0.75rem;border:2px solid ${active ? 'var(--gold)' : 'var(--border)'};
                 border-radius:var(--radius);background:${active ? 'var(--gold-glow)' : 'var(--indigo)'};
                 text-align:center;transition:var(--transition);"
          onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='${active ? 'var(--gold)' : 'var(--border)'}'">
          <div style="font-family:'${f.name}',serif;font-size:1.25rem;color:var(--cream);line-height:1.2;margin-bottom:0.35rem;">${f.name}</div>
          <div style="font-size:0.6rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;">${f.category}</div>
          ${active ? '<div style="font-size:0.6rem;color:var(--gold);margin-top:0.3rem;font-weight:700;">✓ Active</div>' : ''}
        </div>`;
    }).join('');

    // Body fonts
    document.getElementById('body-font-grid').innerHTML = BODY_FONTS.map(f => {
        const active = f.name === themeState.font_body;
        return `
        <div onclick="selectFont('body','${f.name}')"
          style="cursor:pointer;padding:1rem 0.75rem;border:2px solid ${active ? 'var(--gold)' : 'var(--border)'};
                 border-radius:var(--radius);background:${active ? 'var(--gold-glow)' : 'var(--indigo)'};
                 text-align:center;transition:var(--transition);"
          onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='${active ? 'var(--gold)' : 'var(--border)'}'">
          <div style="font-family:'${f.name}',sans-serif;font-size:1rem;color:var(--cream);margin-bottom:0.35rem;">${f.name}</div>
          <div style="font-size:0.6rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;">${f.category}</div>
          ${active ? '<div style="font-size:0.6rem;color:var(--gold);margin-top:0.3rem;font-weight:700;">✓ Active</div>' : ''}
        </div>`;
    }).join('');

    // Accent colours
    document.getElementById('accent-color-grid').innerHTML = ACCENT_PALETTES.map(p => {
        const active = p.key === themeState.accent_preset;
        return `
        <div onclick="selectAccent('${p.key}')" style="cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;gap:0.4rem;">
          <div style="width:50px;height:50px;border-radius:50%;background:${p.main};
                      border:3px solid ${active ? '#fff' : 'transparent'};
                      box-shadow:${active ? '0 0 0 3px var(--gold)' : '0 2px 8px rgba(0,0,0,0.3)'};
                      transition:all 0.2s;"></div>
          <div style="font-size:0.62rem;color:${active ? 'var(--gold)' : 'var(--muted)'};max-width:58px;text-align:center;font-weight:${active ? '700' : '400'};">${p.name}</div>
        </div>`;
    }).join('');
}

function selectFont(type, fontName) {
    if (type === 'heading') themeState.font_heading = fontName;
    else themeState.font_body = fontName;
    renderThemePickers();
    updateThemePreview();
}

function selectAccent(key) {
    themeState.accent_preset = key;
    renderThemePickers();
    updateThemePreview();
}

function updateThemePreview() {
    const hFont   = themeState.font_heading;
    const bFont   = themeState.font_body;
    const palette = ACCENT_PALETTES.find(p => p.key === themeState.accent_preset) || ACCENT_PALETTES[0];

    const prevHeading = document.getElementById('prev-heading');
    const prevBody    = document.getElementById('prev-body');
    const prevBtn     = document.getElementById('prev-btn');
    const prevTag     = document.getElementById('prev-tag');

    if (prevHeading) prevHeading.style.fontFamily = `'${hFont}', serif`;
    if (prevBody)    prevBody.style.fontFamily    = `'${bFont}', sans-serif`;
    if (prevTag)     prevTag.style.fontFamily     = `'${bFont}', sans-serif`;
    if (prevBtn) {
        prevBtn.style.fontFamily   = `'${bFont}', sans-serif`;
        prevBtn.style.background   = palette.main;
        prevBtn.style.color        = '#fff';
    }
}

async function saveTheme() {
    try {
        const res = await fetch('/api/admin/content', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
            body: JSON.stringify({ content: {
                font_heading:  themeState.font_heading,
                font_body:     themeState.font_body,
                accent_preset: themeState.accent_preset,
            }})
        });
        if (res.ok) toast('Theme saved — changes are live on the website!', 'success');
        else        toast('Failed to save theme', 'error');
    } catch(e) {
        toast('Error saving theme', 'error');
    }
}

// ── NAVIGATION CONFIG ─────────────────────────────────────────

const NAV_SECTION_LABELS = {
    about:          'About (Meet Reena)',
    philosophy:     'Our Philosophy (The Principles)',
    story:          'Our Story (Core Values)',
    services:       'Services (Healing Services)',
    process:        'How It Works (The Journey)',
    testimonials:   'Testimonials (Client Stories)',
    faq:            'FAQ (Frequently Asked Questions)',
    contact:        'Contact / Book Session',
    disclaimer:     'Legal Disclaimer',
    cancellation:   'Cancellation Policy',
    'reduced-rate': 'Reduced-Rate Access',
};

let navConfigState = {};

async function loadNavConfig() {
    try {
        const res = await fetch('/api/content');
        const data = await res.json();
        const raw = data.content.nav_config;
        navConfigState = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
        renderNavConfigRows();
    } catch(e) {
        toast('Failed to load navigation config', 'error');
    }
}

function renderNavConfigRows() {
    const tbody = document.getElementById('nav-config-rows');
    if (!tbody) return;

    const keys = ['about', 'philosophy', 'story', 'services', 'process', 'testimonials', 'faq', 'contact', 'disclaimer', 'cancellation', 'reduced-rate'];
    tbody.innerHTML = keys.map(key => {
        const c = navConfigState[key] || { location: 'home', label: key, header: true, footer: true, order: 0 };
        const isHome = c.location === 'home';
        return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:0.85rem 1rem;font-weight:500;color:var(--cream);">${NAV_SECTION_LABELS[key] || key}</td>
          <td style="padding:0.85rem 1rem;">
            <input type="text" value="${c.label || ''}"
              id="nav-label-${key}"
              style="width:130px;padding:0.4rem 0.6rem;border-radius:4px;border:1px solid var(--border);background:var(--indigo);color:var(--cream);font-size:0.85rem;" />
          </td>
          <td style="padding:0.85rem 1rem;text-align:center;">
            <select id="nav-location-${key}"
              style="padding:0.4rem 0.6rem;border-radius:4px;border:1px solid var(--border);background:var(--indigo);color:var(--cream);font-size:0.85rem;cursor:pointer;">
              <option value="home" ${isHome ? 'selected' : ''}>Home</option>
              <option value="page" ${!isHome ? 'selected' : ''}>Own Page</option>
            </select>
          </td>
          <td style="padding:0.85rem 1rem;text-align:center;">
            <input type="checkbox" id="nav-header-${key}" ${c.header ? 'checked' : ''}
              style="width:18px;height:18px;cursor:pointer;accent-color:var(--gold);" />
          </td>
          <td style="padding:0.85rem 1rem;text-align:center;">
            <input type="checkbox" id="nav-footer-${key}" ${c.footer ? 'checked' : ''}
              style="width:18px;height:18px;cursor:pointer;accent-color:var(--gold);" />
          </td>
          <td style="padding:0.85rem 1rem;text-align:center;">
            <input type="number" value="${c.order || 0}" id="nav-order-${key}" min="0" max="99"
              style="width:60px;padding:0.4rem 0.6rem;border-radius:4px;border:1px solid var(--border);background:var(--indigo);color:var(--cream);font-size:0.85rem;text-align:center;" />
          </td>
        </tr>`;
    }).join('');
}

async function saveNavConfig() {
    const keys = ['about', 'philosophy', 'story', 'services', 'process', 'testimonials', 'faq', 'contact', 'disclaimer', 'cancellation', 'reduced-rate'];
    const updated = {};
    for (const key of keys) {
        updated[key] = {
            label:    document.getElementById(`nav-label-${key}`).value.trim() || key,
            location: document.getElementById(`nav-location-${key}`).value,
            header:   document.getElementById(`nav-header-${key}`).checked,
            footer:   document.getElementById(`nav-footer-${key}`).checked,
            order:    parseInt(document.getElementById(`nav-order-${key}`).value) || 0,
        };
    }
    try {
        const res = await fetch('/api/admin/content', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
            body: JSON.stringify({ content: { nav_config: JSON.stringify(updated) } })
        });
        if (res.ok) {
            navConfigState = updated;
            toast('Navigation saved — changes are live on the website!', 'success');
        } else {
            toast('Failed to save navigation', 'error');
        }
    } catch(e) {
        toast('Error saving navigation', 'error');
    }
}
