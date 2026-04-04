document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/content');
        const data = await res.json();
        
        // 1. Populate text fields automatically
        const content = data.content;
        
        // Find elements by id corresponding to the keys
        for (const [key, val] of Object.entries(content)) {
            const el = document.getElementById(key);
            if (el) {
                if (el.tagName === 'IMG') {
                   el.src = val;
                } else if (key.endsWith('_bg_img')) {
                   el.style.backgroundImage = `url(${val})`;
                } else {
                   el.innerHTML = val;
                }
            }
        }
        
        // 2. Populate Services
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
                  <div class="service-price" style="color:var(--gold); font-size:1.2rem; margin-bottom:1.5rem; font-family:'Cormorant Garamond', serif;">
                    <span>£${s.price}</span> <span style="font-size:0.9rem; color:var(--cream-dim)">/ ${s.duration} mins</span>
                  </div>
                  <a href="#" class="service-link" onclick="openBookingModal(); return false;">Reserve This Path →</a>
                </div>
                `;
            });
        }
        
        // 3. Populate Reviews
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
            // add submit review button
            reviewsGrid.innerHTML += `
            <div class="testimonial-card submit-review-card" style="display:flex; flex-direction:column; justify-content:center; align-items:center; border: 1px dashed rgba(201,168,76,0.3); background: transparent;">
                <h4 style="color:var(--gold); font-size:1.2rem; margin-bottom:0.5rem">Share Your Journey</h4>
                <p style="text-align:center; margin-bottom:1.5rem; font-size:0.9rem; color:var(--cream-dim)">Your healing story can inspire others</p>
                <button class="btn btn-outline" style="width:100%" onclick="openReviewModal()">Write a Review</button>
            </div>
            `;
        }
    } catch(err) {
        console.error('CMS Error', err);
    }
});

function openReviewModal() {
    let m = document.getElementById('review-modal');
    if (!m) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal" id="review-modal">
                <div class="modal-content" style="max-width: 400px; text-align:left;">
                    <span class="close-modal" onclick="document.getElementById('review-modal').classList.remove('active')">&times;</span>
                    <h2 class="modal-title" style="margin-bottom:1.5rem; text-align:center">Write a Review</h2>
                    <input type="text" id="review-author" placeholder="Your Name" style="width:100%; padding:0.8rem; margin-bottom:1rem; border-radius:4px; border:1px solid var(--border); background:rgba(0,0,0,0.5); color:var(--cream); font-family:var(--font-main)" />
                    <textarea id="review-comment" placeholder="Your Experience" style="width:100%; padding:0.8rem; margin-bottom:1.5rem; height:120px; border-radius:4px; border:1px solid var(--border); background:rgba(0,0,0,0.5); color:var(--cream); font-family:var(--font-main); resize:vertical"></textarea>
                    <button class="btn btn-gold" style="width:100%" onclick="submitReview()">Submit Review</button>
                    <div id="review-msg" style="margin-top:1rem; color:var(--gold); text-align:center; height:20px;"></div>
                </div>
            </div>
        `);
        m = document.getElementById('review-modal');
    }
    m.classList.add('active');
}

async function submitReview() {
    const author = document.getElementById('review-author').value.trim();
    const comment = document.getElementById('review-comment').value.trim();
    const msgEl = document.getElementById('review-msg');
    
    if (!author || !comment) {
        msgEl.innerText = 'Please fill all fields.';
        return;
    }
    
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
                document.getElementById('review-modal').classList.remove('active');
                document.getElementById('review-author').value = '';
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
