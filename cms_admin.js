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
            if (el && siteContent[k]) {
                el.src = siteContent[k];
                el.style.display = 'block';
            }
        });
    } catch(err) {
        toast('Failed to load content', 'error');
    }
}

async function saveContent() {
    const textKeys = ['hero_title', 'hero_subtitle', 'hero_button_text', 'explore_button_text', 'about_title', 'about_paragraph1', 'about_paragraph2', 'contact_email', 'contact_phone', 'contact_location', 'social_instagram', 'social_whatsapp', 'footer_tagline', 'footer_online_text', 'footer_copyright', 'footer_credit', 'contact_page_title', 'contact_page_subtitle', 'contact_page_intro'];
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
        const imgHtml = s.image_url
            ? `<img src="${s.image_url}" alt="" style="width:48px;height:36px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:0.5rem;" />`
            : `<span style="display:inline-block;width:48px;height:36px;background:#f3f4f6;border-radius:4px;vertical-align:middle;margin-right:0.5rem;"></span>`;
        return `
        <tr>
            <td>${imgHtml}<strong>${s.title}</strong></td>
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

function addVariantRow(label, duration, price) {
    const row = document.createElement('div');
    row.className = 'variant-row';
    row.style.cssText = 'display:grid;grid-template-columns:1fr 90px 70px 28px;gap:0.35rem;align-items:center;';
    row.innerHTML = `
        <input type="text" class="form-control variant-label" placeholder="e.g. Remote / In-Person / 30 min" style="font-size:0.82rem;padding:0.4rem 0.6rem;" value="${label||''}" />
        <select class="form-control variant-dur" style="font-size:0.82rem;padding:0.4rem 0.3rem;">
            <option value="30"${duration==30?' selected':''}>30 min</option>
            <option value="60"${duration==60?' selected':''}>60 min</option>
            <option value="90"${duration==90?' selected':''}>90 min</option>
            <option value="120"${duration==120?' selected':''}>120 min</option>
            <option value="0"${duration==0?' selected':''}>Variable</option>
        </select>
        <input type="number" class="form-control variant-price" placeholder="£" style="font-size:0.82rem;padding:0.4rem 0.4rem;" value="${price||''}" />
        <button type="button" onclick="this.closest('.variant-row').remove()" style="background:#dc2626;color:#fff;border:none;border-radius:4px;padding:0.3rem 0.5rem;cursor:pointer;font-size:0.75rem;">✕</button>
    `;
    document.getElementById('srv-variants-list').appendChild(row);
}

function getServiceFormData() {
    const icon = document.getElementById('srv-icon').value.trim();
    const tagSelect = document.getElementById('srv-tag');
    const tagCustom = document.getElementById('srv-tag-custom');
    const tag = (tagSelect && tagSelect.value && tagSelect.value !== '__custom')
        ? tagSelect.value
        : (tagCustom ? tagCustom.value.trim() : '');
    const sessionType = document.getElementById('srv-sessionType').value;
    const bestFor = document.getElementById('srv-bestFor').value.trim();
    const durationNote = document.getElementById('srv-durationNote').value.trim();
    const longDescRaw = document.getElementById('srv-longDescription').value.trim();
    const expectRaw = document.getElementById('srv-expect').value.trim();

    const longDescription = longDescRaw ? longDescRaw.split('\n').filter(Boolean) : [];
    const expect = expectRaw ? expectRaw.split('\n').filter(Boolean).map(line => {
        const parts = line.split('|');
        return { title: parts[0] || '', text: parts[1] || '' };
    }) : [];

    const variants = [];
    document.querySelectorAll('#srv-variants-list .variant-row').forEach(row => {
        const lbl = row.querySelector('.variant-label').value.trim();
        const dur = parseInt(row.querySelector('.variant-dur').value);
        const prc = parseFloat(row.querySelector('.variant-price').value);
        if (lbl || !isNaN(prc)) variants.push({ label: lbl, duration: dur, price: isNaN(prc) ? 0 : prc });
    });

    return { icon, tag, sessionType, bestFor, durationNote, longDescription, expect, variants };
}

function editService(id) {
    const s = servicesList.find(x => x.id === id);
    if (!s) return;
    editServiceId = id;
    document.getElementById('srv-title').value = s.title;
    document.getElementById('srv-price').value = s.price;
    document.getElementById('srv-duration').value = s.duration;
    document.getElementById('srv-desc').value = s.description;
    document.getElementById('srv-features').value = Array.isArray(s.features) ? s.features.join('\n') : s.features;

    let details = {};
    if (s.extra_details) {
        try { details = JSON.parse(s.extra_details); } catch(e){}
    }
    document.getElementById('srv-icon').value = details.icon || '';
    document.getElementById('srv-durationNote').value = details.durationNote || '';

    // Tag: try to match select options, else populate custom
    const tagSelect = document.getElementById('srv-tag');
    const tagCustom = document.getElementById('srv-tag-custom');
    const savedTag = details.tag || '';
    const tagOpt = [...tagSelect.options].find(o => o.value === savedTag && o.value !== '__custom');
    if (tagOpt) {
        tagSelect.value = savedTag;
        tagCustom.style.display = 'none';
    } else if (savedTag) {
        tagSelect.value = '__custom';
        tagCustom.value = savedTag;
        tagCustom.style.display = 'block';
        tagSelect.style.display = 'none';
    } else {
        tagSelect.value = '';
        tagCustom.style.display = 'none';
    }

    document.getElementById('srv-sessionType').value = details.sessionType || '';
    document.getElementById('srv-bestFor').value = details.bestFor || '';
    document.getElementById('srv-longDescription').value = details.longDescription ? details.longDescription.join('\n') : '';
    document.getElementById('srv-expect').value = details.expect ? details.expect.map(e => `${e.title}|${e.text}`).join('\n') : '';

    // Load variants
    const variantList = document.getElementById('srv-variants-list');
    variantList.innerHTML = '';
    if (details.variants && details.variants.length) {
        details.variants.forEach(v => addVariantRow(v.label, v.duration, v.price));
    }

    // Load image
    const imageUrl = s.image_url || '';
    document.getElementById('srv-image-url').value = imageUrl;
    const preview = document.getElementById('srv-image-preview');
    const thumb = document.getElementById('srv-image-thumb');
    if (imageUrl) {
        thumb.src = imageUrl;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
        thumb.src = '';
    }

    const btn = document.querySelector('button[onclick="addService()"]') || document.querySelector('button[onclick="updateService()"]');
    if (btn) {
        btn.innerText = 'Update Service';
        btn.setAttribute('onclick', 'updateService()');
    }
    btn.scrollIntoView({ behavior: 'smooth', block: 'end' });
    toast('Service loaded for editing', 'info');
}

async function updateService() {
    if (!editServiceId) return addService();

    const title = document.getElementById('srv-title').value.trim();
    const price = document.getElementById('srv-price').value.trim();
    const duration = document.getElementById('srv-duration').value;
    const desc = document.getElementById('srv-desc').value.trim();
    const features = document.getElementById('srv-features').value.trim();

    if (!title || !desc || !features) return toast('Fill Title, Description and Features', 'error');

    const extra_details = getServiceFormData();
    const image_url = document.getElementById('srv-image-url').value || null;

    try {
        const res = await fetch('/api/admin/services/' + editServiceId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
            body: JSON.stringify({ title, price, duration, description: desc, features, extra_details, image_url })
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

    if (!title || !desc || !features) return toast('Fill Title, Description and Features', 'error');

    const extra_details = getServiceFormData();
    const image_url = document.getElementById('srv-image-url').value || null;

    try {
        const res = await fetch('/api/admin/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
            body: JSON.stringify({ title, price, duration, description: desc, features, order_num: servicesList.length + 1, extra_details, image_url })
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
    document.getElementById('srv-duration').value = '60';
    document.getElementById('srv-durationNote').value = '';
    document.getElementById('srv-desc').value = '';
    document.getElementById('srv-features').value = '';
    document.getElementById('srv-icon').value = '';

    const tagSelect = document.getElementById('srv-tag');
    const tagCustom = document.getElementById('srv-tag-custom');
    if (tagSelect) { tagSelect.value = ''; tagSelect.style.display = 'block'; }
    if (tagCustom) { tagCustom.value = ''; tagCustom.style.display = 'none'; }

    document.getElementById('srv-sessionType').value = '';
    document.getElementById('srv-bestFor').value = '';
    document.getElementById('srv-longDescription').value = '';
    document.getElementById('srv-expect').value = '';
    document.getElementById('srv-variants-list').innerHTML = '';

    clearServiceImage();

    const btn = document.querySelector('button[onclick="updateService()"]') || document.querySelector('button[onclick="addService()"]');
    if (btn) {
        btn.innerText = '💾 Save Service';
        btn.setAttribute('onclick', 'addService()');
    }
}

function clearServiceImage() {
    document.getElementById('srv-image-url').value = '';
    document.getElementById('srv-image-file').value = '';
    document.getElementById('srv-image-preview').style.display = 'none';
    document.getElementById('srv-image-thumb').src = '';
}

async function uploadServiceImage(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    // If editing an existing service, send the ID so the image is saved immediately
    if (editServiceId) formData.append('service_id', editServiceId);
    try {
        const res = await fetch('/api/admin/upload/service-image', {
            method: 'POST',
            headers: { 'x-admin-password': adminToken },
            body: formData
        });
        const data = await res.json();
        if (data.url) {
            document.getElementById('srv-image-url').value = data.url;
            document.getElementById('srv-image-thumb').src = data.url;
            document.getElementById('srv-image-preview').style.display = 'block';
            toast(editServiceId ? 'Image uploaded and saved to service' : 'Image uploaded — save service to link it', 'success');
            if (editServiceId) loadServices(); // refresh table thumbnail
        } else {
            toast(data.error || 'Upload failed', 'error');
        }
    } catch(e) {
        toast('Upload error', 'error');
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
let faqEditingId = null;

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
                    <button class="btn-sm btn-primary" onclick="editFaq(${f.id})">Edit</button>
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

function editFaq(id) {
    const faq = faqsList.find(f => f.id === id);
    if (!faq) return;
    faqEditingId = id;
    document.getElementById('faq-question').value = faq.question;
    document.getElementById('faq-answer').value = faq.answer;
    document.getElementById('faq-save-btn').textContent = '💾 Update FAQ';
    document.getElementById('faq-cancel-btn').style.display = 'inline-block';
    document.getElementById('faq-question').focus();
}

function cancelFaqEdit() {
    faqEditingId = null;
    document.getElementById('faq-question').value = '';
    document.getElementById('faq-answer').value = '';
    document.getElementById('faq-save-btn').textContent = '💾 Save FAQ';
    document.getElementById('faq-cancel-btn').style.display = 'none';
}

async function saveFaq() {
    const question = document.getElementById('faq-question').value.trim();
    const answer = document.getElementById('faq-answer').value.trim();
    if (!question || !answer) return toast('Fill out both fields', 'error');

    if (faqEditingId) {
        try {
            const res = await fetch('/api/admin/faqs/' + faqEditingId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
                body: JSON.stringify({ question, answer, order_num: faqsList.findIndex(f => f.id === faqEditingId) + 1 })
            });
            if (res.ok) {
                toast('FAQ updated', 'success');
                cancelFaqEdit();
                loadFaqs();
            } else {
                const data = await res.json().catch(() => ({}));
                toast(data.error || 'Failed to update FAQ', 'error');
            }
        } catch(err) {
            toast('Error updating FAQ', 'error');
        }
    } else {
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
                const data = await res.json().catch(() => ({}));
                toast(data.error || 'Failed to add FAQ', 'error');
            }
        } catch(err) {
            toast('Error adding FAQ', 'error');
        }
    }
}

async function deleteFaq(id) {
    if (!confirm('Delete this FAQ?')) return;
    if (faqEditingId === id) cancelFaqEdit();
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
    about:            'About (Meet Reena)',
    philosophy:       'Our Philosophy',
    story:            'Our Story',
    services:         'Services (Healing Services)',
    process:          'How It Works',
    testimonials:     'Testimonials',
    'clarity-call':   'Free Clarity Call (Home section only)',
    faq:              'FAQ',
    contact:          'Contact / Book Session',
    disclaimer:       'Legal Disclaimer',
    cancellation:     'Cancellation Policy',
    'reduced-rate':   'Reduced-Rate Access',
};

// Sections that can only live on the home page (no dedicated page)
const HOME_ONLY_SECTIONS = new Set(['clarity-call']);

let navConfigState = {};
let navDragKey = null;

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

function navSortedKeys() {
    const all = ['about', 'philosophy', 'story', 'services', 'process', 'testimonials', 'clarity-call', 'faq', 'contact', 'disclaimer', 'cancellation', 'reduced-rate'];
    return all.sort((a, b) => {
        const oA = navConfigState[a] ? (navConfigState[a].order || 99) : 99;
        const oB = navConfigState[b] ? (navConfigState[b].order || 99) : 99;
        return oA - oB;
    });
}

function renderNavConfigRows() {
    const tbody = document.getElementById('nav-config-rows');
    if (!tbody) return;

    const keys = navSortedKeys();
    tbody.innerHTML = keys.map(key => {
        const c = navConfigState[key] || { location: HOME_ONLY_SECTIONS.has(key) ? 'home' : 'page', label: key, header: false, footer: false, order: 99 };
        const isHome = c.location === 'home';
        const homeOnly = HOME_ONLY_SECTIONS.has(key);
        const locationCell = homeOnly
            ? `<span style="font-size:0.78rem;color:var(--text-muted);font-style:italic;">Home only</span>`
            : `<select id="nav-location-${key}" style="padding:0.4rem 0.6rem;border-radius:4px;border:1px solid var(--border);background:var(--indigo);color:var(--cream);font-size:0.82rem;cursor:pointer;">
                 <option value="home" ${isHome ? 'selected' : ''}>Home Section</option>
                 <option value="page" ${!isHome ? 'selected' : ''}>Own Page</option>
               </select>`;
        return `
        <tr draggable="true" data-key="${key}"
            style="border-bottom:1px solid var(--border);cursor:grab;transition:background 0.1s;"
            ondragstart="navDragStart(event,'${key}')"
            ondragover="navDragOver(event)"
            ondragleave="navDragLeave(event)"
            ondrop="navDrop(event,'${key}')"
            ondragend="navDragEnd()">
          <td style="padding:0.6rem 0.5rem 0.6rem 1rem;color:var(--text-muted);font-size:1.1rem;cursor:grab;" title="Drag to reorder">⠿</td>
          <td style="padding:0.6rem 0.75rem;font-weight:500;color:var(--cream);white-space:nowrap;">${NAV_SECTION_LABELS[key] || key}</td>
          <td style="padding:0.6rem 0.75rem;">
            <input type="text" value="${(c.label || '').replace(/"/g,'&quot;')}" id="nav-label-${key}"
              style="width:120px;padding:0.35rem 0.55rem;border-radius:4px;border:1px solid var(--border);background:var(--indigo);color:var(--cream);font-size:0.82rem;" />
          </td>
          <td style="padding:0.6rem 0.75rem;text-align:center;">${locationCell}</td>
          <td style="padding:0.6rem 0.75rem;text-align:center;">
            <input type="checkbox" id="nav-header-${key}" ${c.header ? 'checked' : ''}
              style="width:17px;height:17px;cursor:pointer;accent-color:var(--gold);" />
          </td>
          <td style="padding:0.6rem 0.75rem;text-align:center;">
            <input type="checkbox" id="nav-footer-${key}" ${c.footer ? 'checked' : ''}
              style="width:17px;height:17px;cursor:pointer;accent-color:var(--gold);" />
          </td>
        </tr>`;
    }).join('');
}

function navDragStart(event, key) {
    navDragKey = key;
    event.dataTransfer.effectAllowed = 'move';
    event.currentTarget.style.opacity = '0.45';
}

function navDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.style.background = 'rgba(255,255,255,0.07)';
    event.currentTarget.style.borderTop = '2px solid var(--gold)';
}

function navDragLeave(event) {
    event.currentTarget.style.background = '';
    event.currentTarget.style.borderTop = '';
}

function navDrop(event, targetKey) {
    event.preventDefault();
    navDragLeave(event);
    if (!navDragKey || navDragKey === targetKey) return;

    const tbody = document.getElementById('nav-config-rows');
    const rows = Array.from(tbody.querySelectorAll('tr[data-key]'));
    const order = rows.map(r => r.dataset.key);

    const fromIdx = order.indexOf(navDragKey);
    const toIdx   = order.indexOf(targetKey);
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, navDragKey);

    // Update order values in state
    order.forEach((key, idx) => {
        if (!navConfigState[key]) navConfigState[key] = {};
        navConfigState[key] = { ...navConfigState[key], order: (idx + 1) * 10 };
    });

    renderNavConfigRows();
    saveNavConfig();
}

function navDragEnd() {
    navDragKey = null;
    document.querySelectorAll('#nav-config-rows tr').forEach(tr => {
        tr.style.opacity = '';
        tr.style.background = '';
        tr.style.borderTop = '';
    });
}

async function saveNavConfig() {
    const tbody = document.getElementById('nav-config-rows');
    const rows = Array.from(tbody.querySelectorAll('tr[data-key]'));
    const updated = {};
    rows.forEach((row, idx) => {
        const key = row.dataset.key;
        const homeOnly = HOME_ONLY_SECTIONS.has(key);
        const locEl = document.getElementById(`nav-location-${key}`);
        updated[key] = {
            label:    (document.getElementById(`nav-label-${key}`)?.value || '').trim() || key,
            location: homeOnly ? 'home' : (locEl ? locEl.value : 'page'),
            header:   document.getElementById(`nav-header-${key}`)?.checked || false,
            footer:   document.getElementById(`nav-footer-${key}`)?.checked || false,
            order:    (idx + 1) * 10,
        };
    });
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
