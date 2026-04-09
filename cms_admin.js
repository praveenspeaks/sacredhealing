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
};

async function loadContent() {
    try {
        const res = await fetch('/api/content');
        const data = await res.json();
        siteContent = data.content;
        
        const textKeys = ['hero_title', 'hero_subtitle', 'hero_button_text', 'explore_button_text', 'about_title', 'about_paragraph1', 'about_paragraph2', 'contact_email', 'contact_phone', 'contact_location'];
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
    const textKeys = ['hero_title', 'hero_subtitle', 'hero_button_text', 'explore_button_text', 'about_title', 'about_paragraph1', 'about_paragraph2', 'contact_email', 'contact_phone', 'contact_location'];
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
