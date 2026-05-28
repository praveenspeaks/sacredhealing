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
  // 1. PARTICLE CANVAS — disabled (warm minimal theme)
  // ============================================================



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

// ── Build Slot Card (no price — price comes from service) ─────
function buildSlotCard(slot) {
  const dateStr = new Date(slot.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = formatTime12h(slot.time);
  return `
    <div class="slot-card" onclick="openBookingModal(${slot.id}, '${slot.date}', '${slot.time}', ${slot.duration})">
      <div class="slot-card-top">
        ${durTag(slot.duration)}
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

// ── Render Slots (global duplicate removed) ───────────────────

// ── BOOKING MODAL FUNCTIONS (global) ──
let _currentSlotId       = null;
let _preselectedService  = null; // { name, price } — set by service cards

// ── Stripe state ──────────────────────────────────────────────
let _stripeInstance = null;
let _stripeElements = null;
let _pendingBooking = null; // { clientSecret, bookingId, bookingRef, amount, service, slot }

async function initStripe() {
  if (_stripeInstance) return;
  try {
    const res  = await fetch('/api/stripe-key');
    const data = await res.json();
    if (data.publishableKey && typeof Stripe !== 'undefined') {
      _stripeInstance = Stripe(data.publishableKey);
    }
  } catch (err) {
    console.error('Failed to load Stripe key:', err);
  }
}

function _fmtAmount(amount) {
  const n = parseFloat(amount);
  return `£${n % 1 === 0 ? parseInt(n) : n.toFixed(2)}`;
}

function _fmtDateLong(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function showPaymentStep() {
  document.getElementById('modal-step-form').style.display    = 'none';
  document.getElementById('modal-step-payment').style.display = 'block';
  document.getElementById('modal-success').style.display      = 'none';

  const { amount, service, slot } = _pendingBooking;
  document.getElementById('payment-summary').innerHTML = `
    <strong style="color:var(--olive);font-family:var(--font-heading);font-size:1.05rem">${service}</strong><br/>
    ${_fmtDateLong(slot.date)} at ${formatTime12h(slot.time)} · ${slot.duration} min<br/>
    <strong style="font-size:1.05rem">Total: ${_fmtAmount(amount)}</strong>`;

  const payBtn = document.getElementById('payment-submit-btn');
  payBtn.textContent = 'Pay Now →';
  payBtn.disabled    = false;
  document.getElementById('payment-error').style.display = 'none';

  if (!_stripeInstance) {
    document.getElementById('payment-error').textContent = 'Payment system unavailable. Please refresh and try again.';
    document.getElementById('payment-error').style.display = 'block';
    return;
  }

  _stripeElements = _stripeInstance.elements({
    clientSecret: _pendingBooking.clientSecret,
    appearance: {
      theme: 'flat',
      variables: {
        colorPrimary:    '#5c5b47',
        colorBackground: '#f9f8f4',
        colorText:       '#1a1a18',
        fontFamily:      'Georgia, serif',
        borderRadius:    '6px',
      },
    },
  });
  document.getElementById('stripe-payment-element').innerHTML = '';
  _stripeElements.create('payment').mount('#stripe-payment-element');
}

function backToDetailsStep() {
  document.getElementById('modal-step-form').style.display    = 'block';
  document.getElementById('modal-step-payment').style.display = 'none';
}

async function submitPayment() {
  const payBtn = document.getElementById('payment-submit-btn');
  payBtn.textContent = 'Processing…';
  payBtn.disabled    = true;
  document.getElementById('payment-error').style.display = 'none';

  try {
    const { error, paymentIntent } = await _stripeInstance.confirmPayment({
      elements:  _stripeElements,
      redirect:  'if_required',
    });

    if (error) {
      document.getElementById('payment-error').textContent    = error.message;
      document.getElementById('payment-error').style.display  = 'block';
      payBtn.textContent = 'Pay Now →';
      payBtn.disabled    = false;
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      await _finishBookingConfirm(paymentIntent.id);
    } else {
      document.getElementById('payment-error').textContent   = 'Payment could not be completed. Please try again.';
      document.getElementById('payment-error').style.display = 'block';
      payBtn.textContent = 'Pay Now →';
      payBtn.disabled    = false;
    }
  } catch (err) {
    document.getElementById('payment-error').textContent   = 'An unexpected error occurred. Please try again.';
    document.getElementById('payment-error').style.display = 'block';
    payBtn.textContent = 'Pay Now →';
    payBtn.disabled    = false;
  }
}

async function _finishBookingConfirm(paymentIntentId) {
  try {
    const res  = await fetch('/api/bookings/confirm', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ booking_id: _pendingBooking.bookingId, payment_intent_id: paymentIntentId }),
    });
    const data = await res.json();

    if (data.success) {
      showConfirmationStep({
        bookingRef: data.booking_ref,
        service:    data.service || _pendingBooking.service,
        slot:       data.slot    || _pendingBooking.slot,
        paid:       true,
      });
      fetch('/api/slots').then(r => r.json()).then(d => renderSlotsPublic(d.slots || []));
    } else {
      document.getElementById('payment-error').textContent   = data.error || 'Booking confirmation failed. Please contact us.';
      document.getElementById('payment-error').style.display = 'block';
      document.getElementById('payment-submit-btn').textContent = 'Pay Now →';
      document.getElementById('payment-submit-btn').disabled    = false;
    }
  } catch (err) {
    document.getElementById('payment-error').textContent   = 'Could not confirm booking. Your payment may have been taken — please contact us.';
    document.getElementById('payment-error').style.display = 'block';
    document.getElementById('payment-submit-btn').textContent = 'Pay Now →';
    document.getElementById('payment-submit-btn').disabled    = false;
  }
}

function showConfirmationStep({ bookingRef, service, slot, paid }) {
  document.getElementById('modal-step-form').style.display    = 'none';
  document.getElementById('modal-step-payment').style.display = 'none';

  const refDisplay = document.getElementById('booking-ref-display');
  const refCode    = document.getElementById('modal-booking-ref');
  if (bookingRef && refDisplay && refCode) {
    refCode.textContent      = bookingRef;
    refDisplay.style.display = 'block';
  } else if (refDisplay) {
    refDisplay.style.display = 'none';
  }

  const msgEl = document.getElementById('modal-success-msg');
  if (msgEl && slot) {
    msgEl.innerHTML = `Your <strong>${service}</strong> session is confirmed for
      <strong>${_fmtDateLong(slot.date)}</strong> at <strong>${formatTime12h(slot.time)}</strong>
      (${slot.duration} min).<br/><br/>${paid ? 'Payment received. ' : ''}We'll be in touch shortly. ✦`;
  }

  document.getElementById('modal-success').style.display = 'block';
}

// Called from service card "Reserve" buttons
function openBookingForService(serviceName, servicePrice) {
  _preselectedService = { name: serviceName, price: parseFloat(servicePrice) || 0 };
  // Scroll to the slots/booking section
  const section = document.getElementById('contact');
  if (section) section.scrollIntoView({ behavior: 'smooth' });
  // Show a subtle banner above the slots grid
  const existing = document.getElementById('service-preselect-banner');
  if (existing) existing.remove();
  const grid = document.getElementById('public-slots-grid');
  if (grid) {
    const priceStr = _preselectedService.price > 0 ? ` · £${_preselectedService.price}` : '';
    grid.insertAdjacentHTML('beforebegin', `
      <div id="service-preselect-banner" style="margin-bottom:1rem;padding:0.75rem 1.25rem;background:rgba(92,91,71,0.12);border:1px solid rgba(92,91,71,0.3);border-radius:8px;display:flex;align-items:center;justify-content:space-between;font-size:0.9rem;color:var(--text-body);">
        <span>✦ <strong style="color:var(--olive)">${serviceName}</strong>${priceStr} — choose your time slot below</span>
        <button onclick="_preselectedService=null;document.getElementById('service-preselect-banner').remove();" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;padding:0 0.25rem;">✕</button>
      </div>`);
  }
}

function openBookingModal(slotId, date, time, duration) {
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

  const dateStr = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  if (_preselectedService) {
    // Hide service picker, show badge with service name + price
    const priceStr = _preselectedService.price > 0 ? `£${_preselectedService.price}` : 'Free';
    document.getElementById('service-badge-display').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;background:rgba(92,91,71,0.1);border:1px solid rgba(92,91,71,0.28);border-radius:8px;">
        <span style="font-family:var(--font-heading);font-size:1.1rem;color:var(--olive)">${_preselectedService.name}</span>
        <span style="font-weight:600;color:var(--olive)">${priceStr}</span>
      </div>`;
    document.getElementById('service-badge-group').style.display = 'block';
    document.getElementById('service-selector-group').style.display = 'none';
    document.getElementById('booking-service-hidden').value = _preselectedService.name;
    slotInfo.innerHTML = `
      <span>${dateStr}</span><span>·</span><span>${formatTime12h(time)}</span>
      <span>·</span><span>${duration} min</span><span>·</span><strong>${priceStr}</strong>`;
  } else {
    // Show service picker for generic slot booking
    document.getElementById('service-badge-group').style.display = 'none';
    document.getElementById('service-selector-group').style.display = 'block';
    document.getElementById('booking-service-hidden').value = '';
    slotInfo.innerHTML = `
      <span>${dateStr}</span><span>·</span><span>${formatTime12h(time)}</span>
      <span>·</span><span>${duration} min</span>`;
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBookingModal() {
  const modal = document.getElementById('booking-modal');
  modal.classList.remove('open');
  document.body.style.overflow = '';
  _currentSlotId = null;
  _pendingBooking = null;
  // Reset steps back to form
  const stepForm    = document.getElementById('modal-step-form');
  const stepPayment = document.getElementById('modal-step-payment');
  const stepSuccess = document.getElementById('modal-success');
  if (stepForm)    stepForm.style.display    = 'block';
  if (stepPayment) stepPayment.style.display = 'none';
  if (stepSuccess) stepSuccess.style.display = 'none';
  // Tear down Stripe elements
  if (_stripeElements) {
    try { _stripeElements.getElement('payment')?.unmount(); } catch(e) {}
    _stripeElements = null;
  }
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
  const service = document.getElementById('booking-service-hidden').value ||
                  document.querySelector('input[name="modal-service"]:checked')?.value;
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
    const res  = await fetch('/api/bookings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slot_id: parseInt(slotId), service, customer_name: name, customer_email: email, customer_phone: phone, message: msg }),
    });
    const data = await res.json();

    if (data.payment_required) {
      _pendingBooking = {
        clientSecret: data.client_secret,
        bookingId:    data.booking_id,
        bookingRef:   data.booking_ref,
        amount:       data.amount,
        service:      data.service,
        slot:         data.slot,
      };
      await showPaymentStep();
      return;
    }

    if (data.success) {
      showConfirmationStep({
        bookingRef: data.booking_ref,
        service:    data.service,
        slot:       data.slot,
        paid:       false,
      });
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

// Initialise Stripe key on page load + handle redirect params
window.addEventListener('DOMContentLoaded', () => {
  // Pre-fetch Stripe publishable key so it's ready when needed
  initStripe();

  const params = new URLSearchParams(window.location.search);
  // Legacy: handle redirect back from old Stripe Checkout Session flow
  if (params.get('booking') === 'success') {
    const modal = document.getElementById('booking-modal');
    document.getElementById('modal-step-form').style.display    = 'none';
    document.getElementById('modal-step-payment').style.display = 'none';
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
