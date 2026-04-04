let siteContent = {};
let servicesList = [];
let reviewsList = [];

// Load CMS Data on page switch
const originalShowPage = showPage;
showPage = function(pageId) {
    originalShowPage(pageId);
    if (pageId === 'content') loadContent();
    if (pageId === 'services') loadServices();
    if (pageId === 'reviews') loadReviews();
};

async function loadContent() {
    try {
        const res = await fetch('/api/content');
        const data = await res.json();
        siteContent = data.content;
        
        const textKeys = ['hero_title', 'hero_subtitle', 'hero_button_text', 'explore_button_text', 'about_title', 'about_paragraph1', 'about_paragraph2'];
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
    const textKeys = ['hero_title', 'hero_subtitle', 'hero_button_text', 'explore_button_text', 'about_title', 'about_paragraph1', 'about_paragraph2'];
    const updates = {};
    textKeys.forEach(k => {
        updates[k] = document.getElementById('cms-' + k).value;
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

async function addService() {
    const title = document.getElementById('srv-title').value.trim();
    const price = document.getElementById('srv-price').value.trim();
    const duration = document.getElementById('srv-duration').value;
    const desc = document.getElementById('srv-desc').value.trim();
    const features = document.getElementById('srv-features').value.trim();
    
    if (!title || !desc || !features) return toast('Fill all required fields', 'error');
    
    try {
        const res = await fetch('/api/admin/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminToken },
            body: JSON.stringify({ title, price, duration, description: desc, features, order_num: servicesList.length + 1 })
        });
        if (res.ok) {
            toast('Service added successfully', 'success');
            document.getElementById('srv-title').value = '';
            document.getElementById('srv-price').value = '';
            document.getElementById('srv-desc').value = '';
            document.getElementById('srv-features').value = '';
            loadServices();
        } else {
            toast('Failed to add service', 'error');
        }
    } catch(err) {
        toast('Error adding service', 'error');
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

async function loadReviews() {
    try {
        const res = await fetch('/api/admin/reviews', {
            headers: { 'x-admin-password': adminToken }
        });
        const data = await res.json();
        reviewsList = data.reviews || [];
        renderReviewsTable();
    } catch(err) {
        toast('Failed to load reviews', 'error');
    }
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
