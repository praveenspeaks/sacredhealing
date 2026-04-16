/* ============================================================
   SACRED HEALING — JavaScript
   - Particle canvas animation
   - Navbar scroll behavior
   - Mobile nav toggle
   - Scroll reveal animations
   - Active nav link tracking
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // 0. ANNOUNCE BAR — persist dismissed state across reloads
  // ============================================================
  const announceBar = document.getElementById('announce-bar');
  const announceClose = document.getElementById('announce-close-btn');
  if (announceBar) {
    if (sessionStorage.getItem('announce-dismissed')) {
      announceBar.style.display = 'none';
      document.body.classList.remove('has-announce');
    }
    if (announceClose) {
      announceClose.addEventListener('click', () => {
        announceBar.style.display = 'none';
        document.body.classList.remove('has-announce');
        sessionStorage.setItem('announce-dismissed', '1');
      });
    }
  }

  // ============================================================
  // 1. PARTICLE CANVAS
  // ============================================================
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');

  let particles = [];
  let animationId;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 1.5 + 0.3;
      this.opacity = Math.random() * 0.7 + 0.1;
      this.speedX = (Math.random() - 0.5) * 0.15;
      this.speedY = (Math.random() - 0.5) * 0.15;
      this.twinkleSpeed = Math.random() * 0.02 + 0.005;
      this.twinkleOffset = Math.random() * Math.PI * 2;
      // Occasionally gold, mostly white/cream
      const r = Math.random();
      if (r < 0.15) {
        this.color = `rgba(201, 168, 76, `;  // gold
      } else if (r < 0.25) {
        this.color = `rgba(155, 79, 222, `;  // amethyst
      } else {
        this.color = `rgba(245, 237, 214, `;  // cream
      }
    }

    update(time) {
      this.x += this.speedX;
      this.y += this.speedY;
      this.currentOpacity = this.opacity * (0.5 + 0.5 * Math.sin(time * this.twinkleSpeed + this.twinkleOffset));

      if (this.x < -5) this.x = canvas.width + 5;
      if (this.x > canvas.width + 5) this.x = -5;
      if (this.y < -5) this.y = canvas.height + 5;
      if (this.y > canvas.height + 5) this.y = -5;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `${this.color}${this.currentOpacity})`;
      ctx.fill();
    }
  }

  function initParticles() {
    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 8000);
    for (let i = 0; i < Math.min(count, 200); i++) {
      particles.push(new Particle());
    }
  }

  let startTime = null;
  function animateParticles(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.update(elapsed);
      p.draw();
    });

    animationId = requestAnimationFrame(animateParticles);
  }

  resizeCanvas();
  initParticles();
  animationId = requestAnimationFrame(animateParticles);

  window.addEventListener('resize', () => {
    resizeCanvas();
    initParticles();
  });


  // ============================================================
  // 2. NAVBAR SCROLL BEHAVIOR
  // ============================================================
  const navbar = document.getElementById('navbar');

  function handleNavbarScroll() {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleNavbarScroll, { passive: true });
  handleNavbarScroll();


  // ============================================================
  // 3. MOBILE NAV TOGGLE
  // ============================================================
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  const navBackdrop = document.getElementById('nav-backdrop');

  function openMobileNav() {
    navLinks.classList.add('open');
    navToggle.classList.add('active');
    if (navBackdrop) navBackdrop.style.display = 'block';
  }

  function closeMobileNav() {
    navLinks.classList.remove('open');
    navToggle.classList.remove('active');
    if (navBackdrop) navBackdrop.style.display = 'none';
  }

  navToggle.addEventListener('click', () => {
    navLinks.classList.contains('open') ? closeMobileNav() : openMobileNav();
  });

  if (navBackdrop) navBackdrop.addEventListener('click', closeMobileNav);

  // Close nav when a link is clicked
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });


  // ============================================================
  // 4. STATS COUNT-UP ANIMATION
  // ============================================================
  function animateCountUp(el, target, duration) {
    const start = performance.now();
    const isDecimal = target % 1 !== 0;
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = eased * target;
      el.textContent = isDecimal ? value.toFixed(1) : Math.floor(value) + '+';
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target + (Number.isInteger(target) ? '+' : '');
    }
    requestAnimationFrame(step);
  }

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const item = entry.target;
      const value = parseFloat(item.dataset.value);
      if (isNaN(value)) return;
      const numEl = item.querySelector('.stat-number');
      if (numEl) animateCountUp(numEl, value, 1500);
      statsObserver.unobserve(item);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-item[data-value]').forEach(el => statsObserver.observe(el));

  // ============================================================
  // 5. SCROLL REVEAL ANIMATIONS
  // ============================================================
  function addRevealClass() {
    const targets = document.querySelectorAll(
      '.stat-item, .about-content, .about-visual, .service-card, .testimonial-card, .process-step, .cta-content'
    );
    targets.forEach(el => el.classList.add('reveal'));
  }

  function handleReveal() {
    document.querySelectorAll('.reveal').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9) {
        el.classList.add('visible');
      }
    });
  }

  addRevealClass();
  window.addEventListener('scroll', handleReveal, { passive: true });
  handleReveal(); // Run on load


  // ============================================================
  // 5. ACTIVE NAV LINK ON SCROLL
  // ============================================================
  const sections = document.querySelectorAll('section[id]');
  const allNavLinks = document.querySelectorAll('.nav-link');

  function updateActiveLink() {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });

    allNavLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveLink, { passive: true });


  // ============================================================
  // 6. SERVICE CARD GLOW ON MOUSE MOVE
  // ============================================================
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const glow = card.querySelector('.service-card-glow');
      if (glow) {
        glow.style.left = `${x - 60}px`;
        glow.style.top = `${y - 60}px`;
      }
    });
  });


  // ============================================================
  // 7. STAGGER SERVICE CARDS REVEAL DELAY
  // ============================================================
  document.querySelectorAll('.service-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 0.1}s`;
  });

  document.querySelectorAll('.testimonial-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 0.12}s`;
  });

  document.querySelectorAll('.stat-item').forEach((item, i) => {
    item.style.transitionDelay = `${i * 0.08}s`;
  });

  // ============================================================
  // 8. BOOKING SYSTEM
  // ============================================================
  let allSlots = [];
  let activeServiceFilter = '';

  // ── Helpers ────────────────────────
  function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function fmtTime(timeStr) {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
  }

  const serviceIcons = {
    'Spiritual Healing': '🌀',
    'Psychic Reading': '🔮',
    'Past Life Healing': '⏳',
    'Ancestral Healing': '🌿'
  };

  // ── Fetch Slots ─────────────────────
  async function loadPublicSlots() {
    try {
      const res = await fetch('/api/slots');
      const data = await res.json();
      allSlots = data.slots || [];
      renderSlots(allSlots);
    } catch (err) {
      document.getElementById('public-slots-grid').innerHTML = `
        <div class="slots-empty">
          <div class="empty-icon">⚡</div>
          <p>Could not load sessions at the moment.<br/>Please contact us directly to book.</p>
        </div>`;
    }
  }

  function renderSlots(slots) {
    const grid = document.getElementById('public-slots-grid');
    if (!slots.length) {
      grid.innerHTML = `
        <div class="slots-empty">
          <div class="empty-icon">🌙</div>
          <p>No available sessions right now.<br/>Please check back soon or contact us to arrange a custom time.</p>
        </div>`;
      return;
    }
    grid.innerHTML = slots.map(slot => buildSlotCard(slot)).join('');
  }

  // ── Load on page load ───────────────
  loadPublicSlots();

});  // end DOMContentLoaded

// ── CURRENCY SYMBOLS ─────────────────
const CURR_SYMBOLS = { GBP: '£', USD: '$', EUR: '€', INR: '₹', AUD: 'A$' };

// ── Duration tag helper ───────────────
function durTag(min) {
  const cls = min <= 15 ? 'dur-15' : min <= 30 ? 'dur-30' : min <= 60 ? 'dur-60' : min <= 90 ? 'dur-90' : 'dur-120';
  const labels = { 15: '✨ 15 min', 30: '🌙 30 min', 60: '⭐ 60 min', 90: '🌟 90 min', 120: '💫 120 min' };
  return `<span class="slot-dur-tag ${cls}">${labels[min] || min + ' min'}</span>`;
}

// ── Price tag helper ──────────────────
function priceTag(price, currency) {
  const sym = CURR_SYMBOLS[currency] || '£';
  if (!price || parseFloat(price) === 0) return '<span class="slot-price is-free">FREE</span>';
  const val = parseFloat(price) % 1 === 0 ? parseInt(price) : parseFloat(price).toFixed(2);
  return `<span class="slot-price">${sym}${val}</span>`;
}

// ── Build Slot Card ───────────────────
function buildSlotCard(slot) {
  const dateStr = new Date(slot.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = formatTime12h(slot.time);
  const priceArg = slot.price || 0;
  const currArg  = slot.currency || 'GBP';
  return `
    <div class="slot-card" onclick="openBookingModal(${slot.id}, '${slot.date}', '${slot.time}', ${slot.duration}, ${priceArg}, '${currArg}')">
      <div class="slot-card-top">
        ${durTag(slot.duration)}
        ${priceTag(priceArg, currArg)}
      </div>
      <div class="slot-date">${dateStr}</div>
      <div class="slot-time">${timeStr}</div>
      <div class="slot-duration">Session length: ${slot.duration} minutes</div>
      <button class="slot-book-btn">Reserve This Slot →</button>
    </div>`;
}

// ── Render Slots (global) ─────────────
function renderSlotsPublic(slots) {
  const grid = document.getElementById('public-slots-grid');
  if (!slots || !slots.length) {
    grid.innerHTML = '<div class="slots-empty"><div class="empty-icon">🌙</div><p>No sessions match this filter.<br/>Try a different duration or check back soon.</p></div>';
    return;
  }
  grid.innerHTML = slots.map(s => buildSlotCard(s)).join('');
}

// ── Filter Slots (global) ─────────────
function filterSlots(btn, duration) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const param = duration ? `?duration=${duration}` : '';
  fetch('/api/slots' + param)
    .then(r => r.json())
    .then(data => renderSlotsPublic(data.slots || []));
}

// ── BOOKING MODAL FUNCTIONS (global) ──
let _currentSlotId = null;

function openBookingModal(slotId, date, time, duration, price, currency) {
  // Called without a slot (e.g. from navbar CTA) — just scroll to the booking section
  if (!slotId) {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const modal    = document.getElementById('booking-modal');
  const slotInfo = document.getElementById('modal-slot-info');
  const form     = document.getElementById('booking-form');
  const success  = document.getElementById('modal-success');

  form.reset();
  form.style.display = 'block';
  success.style.display = 'none';

  _currentSlotId = slotId;
  document.getElementById('booking-slot-id').value = slotId;
  const sym = CURR_SYMBOLS[currency] || '£';
  const priceStr = (!price || parseFloat(price) === 0) ? 'Free' : `${sym}${parseFloat(price) % 1 === 0 ? parseInt(price) : parseFloat(price).toFixed(2)}`;
  slotInfo.innerHTML = `
    <span>${new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
    <span>·</span><span>${formatTime12h(time)}</span>
    <span>·</span><span>${duration} min</span>
    <span>·</span><span>${priceStr}</span>`;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBookingModal() {
  const modal = document.getElementById('booking-modal');
  modal.classList.remove('open');
  document.body.style.overflow = '';
  _currentSlotId = null;
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('booking-modal')) {
    closeBookingModal();
  }
}

function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
}


async function submitBooking(e) {
  e.preventDefault();
  const slotId  = document.getElementById('booking-slot-id').value;
  const service = document.querySelector('input[name="modal-service"]:checked')?.value;
  const name    = document.getElementById('booking-name').value.trim();
  const email   = document.getElementById('booking-email').value.trim();
  const phone   = document.getElementById('booking-phone').value.trim();
  const msg     = document.getElementById('booking-message').value.trim();

  if (!slotId)  { alert('Please select a session slot first.'); return; }
  if (!service) { alert('Please choose a healing service for your session.'); return; }

  const submitBtn = document.getElementById('booking-submit-btn');
  submitBtn.textContent = 'Booking…';
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id: parseInt(slotId), service, customer_name: name, customer_email: email, customer_phone: phone, message: msg })
    });
    const data = await res.json();

    if (data.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }

    if (data.success) {
      document.getElementById('booking-form').style.display = 'none';
      const s = data.slot;
      const sym = CURR_SYMBOLS[s.currency] || '£';
      const priceStr = (!s.price || parseFloat(s.price) === 0) ? 'Free consultation' : `${sym}${parseFloat(s.price) % 1 === 0 ? parseInt(s.price) : parseFloat(s.price).toFixed(2)}`;
      document.getElementById('modal-success-msg').innerHTML =
        `Your <strong>${data.service}</strong> session is reserved for
         <strong>${new Date(s.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
         at <strong>${formatTime12h(s.time)}</strong> (${s.duration} min · ${priceStr}).<br/><br/>We'll be in touch shortly to confirm. ✦`;
      document.getElementById('modal-success').style.display = 'block';
      fetch('/api/slots').then(r => r.json()).then(d => renderSlotsPublic(d.slots || []));
    } else {
      alert(data.error || 'Something went wrong. Please try again.');
    }
  } catch (err) {
    alert('Could not connect to server. Please try again.');
  } finally {
    submitBtn.textContent = 'Confirm Booking →';
    submitBtn.disabled = false;
  }
}

// Close modal on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeBookingModal();
});

// ── Info Banner ───────────────────────────────────────────────
function showInfoBanner(msg, autoDismissMs = 8000) {
  const banner = document.getElementById('info-banner');
  const msgEl  = document.getElementById('info-banner-msg');
  if (!banner || !msgEl) return;
  msgEl.textContent = msg;
  banner.style.display = 'flex';
  banner.style.alignItems = 'center';
  if (autoDismissMs) {
    setTimeout(() => { banner.style.display = 'none'; }, autoDismissMs);
  }
}

// Check for Stripe success/cancel params
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('booking') === 'success') {
    const modal = document.getElementById('booking-modal');
    document.getElementById('booking-form').style.display = 'none';
    document.getElementById('modal-success-msg').innerHTML = 
      `Your payment was successful and your session is fully confirmed!<br/><br/>We'll be in touch shortly with details. ✦`;
    document.getElementById('modal-success').style.display = 'block';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    window.history.replaceState({}, '', '/');
  } else if (params.get('booking') === 'cancel') {
    showInfoBanner('Payment was cancelled — your slot is still available. Choose a session below to try again.');
    window.history.replaceState({}, '', '/');
  }
});
