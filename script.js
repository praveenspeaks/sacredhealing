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
  const navToggle  = document.getElementById('nav-toggle');
  const navPanel   = document.getElementById('nav-mobile-panel');
  const navBackdrop = document.getElementById('nav-backdrop');

  function openMobileNav() {
    if (navPanel) navPanel.classList.add('open');
    if (navToggle) navToggle.classList.add('active');
    if (navBackdrop) navBackdrop.style.display = 'block';
  }

  function closeMobileNav() {
    if (navPanel) navPanel.classList.remove('open');
    if (navToggle) navToggle.classList.remove('active');
    if (navBackdrop) navBackdrop.style.display = 'none';
  }

  // Expose globally so inline onclick handlers can call closeMobileNav()
  window.closeMobileNav = closeMobileNav;

  if (navToggle) navToggle.addEventListener('click', () => {
    navPanel && navPanel.classList.contains('open') ? closeMobileNav() : openMobileNav();
  });

  if (navBackdrop) navBackdrop.addEventListener('click', closeMobileNav);

  // Close nav when a link is clicked (event delegation — nav is dynamically populated)
  if (navPanel) navPanel.addEventListener('click', (e) => {
    if (e.target.classList.contains('nav-link')) closeMobileNav();
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
    const grid = document.getElementById('public-slots-grid');
    if (!grid) return;
    try {
      const res = await fetch('/api/slots');
      const data = await res.json();
      allSlots = data.slots || [];
      renderSlots(allSlots);
    } catch (err) {
      grid.innerHTML = `
        <div class="slots-empty">
          <div class="empty-icon">⚡</div>
          <p>Could not load sessions at the moment.<br/>Please contact us directly to book.</p>
        </div>`;
    }
  }

  function renderSlots(slots) {
    const grid = document.getElementById('public-slots-grid');
    if (!grid) return;
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
  if (!grid) return;
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
    // Bulk payment confirmation
    if (_pendingBooking.isBulk) {
      const res  = await fetch('/api/bookings/bulk/confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bulk_booking_id: _pendingBooking.bulkBookingId, payment_intent_id: paymentIntentId }),
      });
      const data = await res.json();
      if (data.success) {
        showConfirmationStep({
          bookingRef:   data.booking_ref,
          service:      _pendingBooking.service,
          slot:         _bulkPreviewSlots?.[0],
          paid:         true,
          isBulk:       true,
          sessionCount: _pendingBooking.sessionCount,
        });
        fetch('/api/slots').then(r => r.json()).then(d => renderSlotsPublic(d.slots || []));
      } else {
        document.getElementById('payment-error').textContent = data.error || 'Confirmation failed.';
        document.getElementById('payment-error').style.display = 'block';
      }
      return;
    }

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

function showConfirmationStep({ bookingRef, service, slot, paid, isBulk, sessionCount }) {
  document.getElementById('modal-step-form').style.display    = 'none';
  document.getElementById('modal-step-payment').style.display = 'none';
  document.getElementById('modal-step-bulk-preview') && (document.getElementById('modal-step-bulk-preview').style.display = 'none');

  const refDisplay = document.getElementById('booking-ref-display');
  const refCode    = document.getElementById('modal-booking-ref');
  if (bookingRef && refDisplay && refCode) {
    refCode.textContent      = bookingRef;
    refDisplay.style.display = 'block';
  } else if (refDisplay) {
    refDisplay.style.display = 'none';
  }

  const msgEl = document.getElementById('modal-success-msg');
  if (msgEl) {
    if (isBulk && sessionCount) {
      const firstDate = slot ? ` starting <strong>${_fmtDateLong(slot.date)}</strong>` : '';
      msgEl.innerHTML = `<strong>${sessionCount} sessions</strong> of <strong>${service}</strong> booked${firstDate}.<br/><br/>
        ${paid ? 'Payment received. ' : ''}We'll send you a full schedule by email. ✦`;
    } else if (slot) {
      msgEl.innerHTML = `Your <strong>${service}</strong> session is confirmed for
        <strong>${_fmtDateLong(slot.date)}</strong> at <strong>${formatTime12h(slot.time)}</strong>
        (${slot.duration} min).<br/><br/>${paid ? 'Payment received. ' : ''}We'll be in touch shortly. ✦`;
    }
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

// ── Bulk booking state & helpers ──────────────────────────────
let _bulkPreviewSlots = null;

// ── Package Modal (standalone bulk booking entry point) ────────
let _pkgPreviewSlots   = null;
let _pkgBookingData    = null;
let _pkgStripeElements = null;

function openBulkBooking(serviceName, servicePrice) {
  const modal = document.getElementById('pkg-modal');
  if (!modal) return;
  pkgShowStep('config');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  pkgLoadSlots();
  pkgLoadServices(serviceName);
  // Wire up "Custom" radio for count
  document.querySelectorAll('input[name="pkg-count"]').forEach(r => {
    r.onchange = () => {
      document.getElementById('pkg-count-custom').style.display =
        r.value === 'custom' && r.checked ? 'block' : 'none';
    };
  });
}

function closePkgModal() {
  const modal = document.getElementById('pkg-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  _pkgPreviewSlots   = null;
  _pkgBookingData    = null;
  if (_pkgStripeElements) {
    try { _pkgStripeElements.getElement('payment')?.unmount(); } catch(e) {}
    _pkgStripeElements = null;
  }
}

function pkgShowStep(name) {
  ['config','details','preview','payment','success'].forEach(s => {
    const el = document.getElementById(`pkg-step-${s}`);
    if (el) el.style.display = s === name ? 'block' : 'none';
  });
}

async function pkgLoadSlots() {
  const sel = document.getElementById('pkg-start-slot');
  if (!sel) return;
  sel.innerHTML = '<option value="">Loading…</option>';
  try {
    const res  = await fetch('/api/slots');
    const data = await res.json();
    const avail = (data.slots || []).filter(s => !s.is_booked);
    if (!avail.length) {
      sel.innerHTML = '<option value="">No available slots — check back soon</option>';
      return;
    }
    sel.innerHTML = '<option value="">Choose your first session…</option>' +
      avail.map(s => {
        const d = new Date(s.date + 'T00:00:00').toLocaleDateString('en-GB',
          { weekday:'short', day:'numeric', month:'short', year:'numeric' });
        const t = formatTime12h(s.time);
        const price = s.price > 0 ? ` · £${parseFloat(s.price).toFixed(2)}` : ' · Free';
        return `<option value="${s.id}">${d} at ${t} (${s.duration}min${price})</option>`;
      }).join('');
  } catch(e) {
    sel.innerHTML = '<option value="">Could not load slots</option>';
  }
}

async function pkgLoadServices(preselect) {
  const sel = document.getElementById('pkg-service');
  if (!sel) return;
  try {
    const res  = await fetch('/api/content');
    const data = await res.json();
    const svcs = data.services || [];
    if (svcs.length) {
      sel.innerHTML = '<option value="">Choose a service…</option>' +
        svcs.map(s => `<option value="${escHtmlJs(s.title)}"${preselect === s.title ? ' selected' : ''}>${escHtmlJs(s.title)}</option>`).join('');
    } else {
      sel.innerHTML = '<option value="">Spiritual Healing</option><option value="Psychic Reading">Psychic Reading</option><option value="Past Life Healing">Past Life Healing</option>';
      if (preselect) sel.value = preselect;
    }
  } catch(e) {
    sel.innerHTML = '<option value="">Could not load services</option>';
  }
}

function escHtmlJs(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pkgGoToDetails() {
  const service = document.getElementById('pkg-service').value;
  const slotId  = document.getElementById('pkg-start-slot').value;
  const countEl = document.querySelector('input[name="pkg-count"]:checked');
  const countVal = countEl?.value;
  const count   = countVal === 'custom'
    ? parseInt(document.getElementById('pkg-count-custom').value)
    : parseInt(countVal || '10');

  if (!service) { alert('Please choose a service.'); return; }
  if (!slotId)  { alert('Please choose a starting slot.'); return; }
  if (!count || count < 2 || count > 50) { alert('Please enter a valid session count (2–50).'); return; }
  pkgShowStep('details');
}

async function pkgPreview() {
  const service = document.getElementById('pkg-service').value;
  const slotId  = parseInt(document.getElementById('pkg-start-slot').value);
  const countVal = document.querySelector('input[name="pkg-count"]:checked')?.value;
  const count   = countVal === 'custom'
    ? parseInt(document.getElementById('pkg-count-custom').value)
    : parseInt(countVal || '10');
  const name  = document.getElementById('pkg-name').value.trim();
  const email = document.getElementById('pkg-email').value.trim();
  if (!name || !email) { alert('Please enter your name and email.'); return; }

  const btn = document.getElementById('pkg-preview-btn');
  btn.textContent = 'Finding sessions…';
  btn.disabled = true;

  try {
    const res  = await fetch('/api/bookings/bulk/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id: slotId, count, service }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Could not find enough available slots.'); return; }

    _pkgPreviewSlots = data.slots;
    const sym = { GBP:'£', USD:'$', EUR:'€', INR:'₹', AUD:'A$' }[data.currency] || data.currency;

    document.getElementById('pkg-preview-summary').innerHTML =
      `<strong>${data.slots.length} sessions</strong> · ${escHtmlJs(service)} · ${sym}${parseFloat(data.session_price).toFixed(2)} per session`;
    document.getElementById('pkg-preview-list').innerHTML = data.slots.map((s, i) => {
      const d = new Date(s.date + 'T00:00:00').toLocaleDateString('en-GB',
        { weekday:'short', day:'numeric', month:'short', year:'numeric' });
      return `<div class="bulk-slot-row">
        <span class="bulk-slot-num">${i + 1}</span>
        <span>${d}</span>
        <span>${formatTime12h(s.time)} · ${s.duration} min</span>
      </div>`;
    }).join('');
    document.getElementById('pkg-preview-total').innerHTML =
      data.total_amount > 0
        ? `Total: <strong>${sym}${parseFloat(data.total_amount).toFixed(2)}</strong>`
        : 'Total: <strong>Free</strong>';
    pkgShowStep('preview');
  } catch(e) {
    alert('Could not connect. Please try again.');
  } finally {
    btn.textContent = 'Preview Package →';
    btn.disabled = false;
  }
}

async function pkgConfirm() {
  if (!_pkgPreviewSlots) return;
  const slot_ids = _pkgPreviewSlots.map(s => s.id);
  const service  = document.getElementById('pkg-service').value;
  const name     = document.getElementById('pkg-name').value.trim();
  const email    = document.getElementById('pkg-email').value.trim();
  const phone    = document.getElementById('pkg-phone').value.trim();
  const message  = document.getElementById('pkg-message').value.trim();

  const btn = document.getElementById('pkg-confirm-btn');
  btn.textContent = 'Booking…';
  btn.disabled = true;

  try {
    const res  = await fetch('/api/bookings/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_ids, service, customer_name: name, customer_email: email,
        customer_phone: phone, message }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Booking failed. Please try again.'); return; }

    _pkgBookingData = data;

    if (data.client_secret && _stripeInstance) {
      // Paid — mount Stripe payment element
      const sym = { GBP:'£', USD:'$', EUR:'€', INR:'₹', AUD:'A$' }[data.currency] || '';
      document.getElementById('pkg-payment-summary').textContent =
        `${slot_ids.length} sessions of ${service} — Total: ${sym}${parseFloat(data.total_amount || 0).toFixed(2)}`;
      _pkgStripeElements = _stripeInstance.elements({
        clientSecret: data.client_secret,
        appearance: { theme:'flat', variables: { colorPrimary:'#5c5b47', colorBackground:'#f9f8f4',
          colorText:'#1a1a18', fontFamily:'Georgia, serif', borderRadius:'6px' } },
      });
      document.getElementById('pkg-payment-element').innerHTML = '';
      _pkgStripeElements.create('payment').mount('#pkg-payment-element');
      document.getElementById('pkg-payment-error').style.display = 'none';
      pkgShowStep('payment');
    } else {
      // Free — confirm directly
      document.getElementById('pkg-success-msg').innerHTML =
        `<strong>${slot_ids.length} sessions</strong> of <strong>${escHtmlJs(service)}</strong> are confirmed.<br><br>
         Booking reference: <strong>${data.booking_ref}</strong><br><br>
         A confirmation email is on its way. We look forward to your healing journey. ✦`;
      pkgShowStep('success');
    }
  } catch(e) {
    alert('Could not connect. Please try again.');
  } finally {
    btn.textContent = 'Book All Sessions →';
    btn.disabled = false;
  }
}

async function pkgSubmitPayment() {
  if (!_pkgStripeElements || !_pkgBookingData) return;
  const btn = document.getElementById('pkg-pay-btn');
  btn.textContent = 'Processing…';
  btn.disabled = true;
  document.getElementById('pkg-payment-error').style.display = 'none';

  try {
    const { error, paymentIntent } = await _stripeInstance.confirmPayment({
      elements: _pkgStripeElements,
      redirect: 'if_required',
    });
    if (error) {
      document.getElementById('pkg-payment-error').textContent  = error.message;
      document.getElementById('pkg-payment-error').style.display = 'block';
      return;
    }
    if (paymentIntent?.status === 'succeeded') {
      const res  = await fetch('/api/bookings/bulk/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk_booking_id: _pkgBookingData.bulk_booking_id,
          payment_intent_id: paymentIntent.id }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Confirmation failed. Please contact us.'); return; }
      document.getElementById('pkg-success-msg').innerHTML =
        `Payment received. <strong>${data.confirmed} sessions</strong> of <strong>${escHtmlJs(document.getElementById('pkg-service').value)}</strong> are confirmed.<br><br>
         Booking reference: <strong>${data.booking_ref}</strong><br><br>
         A full schedule has been sent to your email. ✦`;
      pkgShowStep('success');
    }
  } catch(e) {
    document.getElementById('pkg-payment-error').textContent  = 'Payment error. Please try again.';
    document.getElementById('pkg-payment-error').style.display = 'block';
  } finally {
    btn.textContent = 'Pay Now →';
    btn.disabled = false;
  }
}

function toggleBulkMode() {
  const on = document.getElementById('bulk-toggle').checked;
  document.getElementById('bulk-options').style.display = on ? 'block' : 'none';
  document.getElementById('booking-submit-btn').textContent = on ? 'Preview Sessions →' : 'Confirm Booking →';
  // Watch for custom count
  document.querySelectorAll('input[name="bulk-count"]').forEach(r => {
    r.onchange = () => {
      document.getElementById('bulk-count-custom').style.display =
        r.value === 'custom' && r.checked ? 'block' : 'none';
    };
  });
}

function getBulkCount() {
  const sel = document.querySelector('input[name="bulk-count"]:checked');
  if (!sel) return 10;
  if (sel.value === 'custom') {
    const n = parseInt(document.getElementById('bulk-count-custom').value);
    return (n >= 2 && n <= 50) ? n : null;
  }
  return parseInt(sel.value);
}

function backToBulkForm() {
  document.getElementById('modal-step-form').style.display = 'block';
  document.getElementById('modal-step-bulk-preview').style.display = 'none';
  _bulkPreviewSlots = null;
}

async function showBulkPreview(slotId, service, count) {
  const btn = document.getElementById('booking-submit-btn');
  btn.textContent = 'Finding sessions…';
  btn.disabled = true;
  try {
    const res  = await fetch('/api/bookings/bulk/preview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slot_id: parseInt(slotId), count, service }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Could not find enough slots.'); return; }

    _bulkPreviewSlots = data.slots;

    const sym = { GBP:'£', USD:'$', EUR:'€', INR:'₹', AUD:'A$' }[data.currency] || data.currency;
    document.getElementById('bulk-preview-summary').textContent =
      `${count} sessions of ${service} — ${sym}${data.session_price.toFixed(2)} each`;
    document.getElementById('bulk-preview-total').textContent =
      `${sym}${data.total_amount.toFixed(2)}`;

    const list = document.getElementById('bulk-preview-list');
    list.innerHTML = data.slots.map((s, i) => {
      const d = new Date(s.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
      const t = formatTime12h(s.time);
      return `<div class="bulk-slot-row">
        <div style="display:flex;align-items:center;">
          <div class="slot-num">${i+1}</div>
          <div><strong>${d}</strong> &nbsp;·&nbsp; ${t}</div>
        </div>
        <span style="color:var(--muted);font-size:0.8rem;">${s.duration} min</span>
      </div>`;
    }).join('');

    document.getElementById('modal-step-form').style.display       = 'none';
    document.getElementById('modal-step-bulk-preview').style.display = 'block';
  } catch (err) {
    alert('Could not connect to server. Please try again.');
  } finally {
    btn.textContent = 'Preview Sessions →';
    btn.disabled = false;
  }
}

async function confirmBulkBooking() {
  if (!_bulkPreviewSlots) return;
  const name    = document.getElementById('booking-name').value.trim();
  const email   = document.getElementById('booking-email').value.trim();
  const phone   = document.getElementById('booking-phone').value.trim();
  const msg     = document.getElementById('booking-message').value.trim();
  const service = document.getElementById('booking-service-hidden').value ||
                  document.querySelector('input[name="modal-service"]:checked')?.value;

  const btn = document.getElementById('bulk-confirm-btn');
  btn.textContent = 'Processing…';
  btn.disabled = true;
  try {
    const res  = await fetch('/api/bookings/bulk', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        slot_ids: _bulkPreviewSlots.map(s => s.id),
        service, customer_name: name, customer_email: email,
        customer_phone: phone, message: msg,
      }),
    });
    const data = await res.json();

    if (data.payment_required) {
      // Reuse the same payment step — just swap pending booking details
      _pendingBooking = {
        clientSecret:   data.client_secret,
        bookingId:      null,
        bulkBookingId:  data.bulk_booking_id,
        bookingRef:     data.booking_ref,
        amount:         data.amount,
        service:        data.service,
        isBulk:         true,
        sessionCount:   data.session_count,
      };
      document.getElementById('modal-step-bulk-preview').style.display = 'none';
      await showPaymentStep();
      return;
    }

    if (data.success) {
      document.getElementById('modal-step-bulk-preview').style.display = 'none';
      showConfirmationStep({
        bookingRef: data.booking_ref,
        service:    data.service,
        slot:       data.slots[0],
        paid:       false,
        isBulk:     true,
        sessionCount: data.session_count,
      });
      fetch('/api/slots').then(r => r.json()).then(d => renderSlotsPublic(d.slots || []));
    } else {
      alert(data.error || 'Something went wrong.');
    }
  } catch (err) {
    alert('Could not connect. Please try again.');
  } finally {
    btn.textContent = 'Pay & Book All Sessions →';
    btn.disabled = false;
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
  _bulkPreviewSlots = null;
  // Reset bulk toggle
  const bulkToggle = document.getElementById('bulk-toggle');
  if (bulkToggle) { bulkToggle.checked = false; toggleBulkMode(); }
  // Reset steps back to form
  const stepForm    = document.getElementById('modal-step-form');
  const stepPayment = document.getElementById('modal-step-payment');
  const stepSuccess = document.getElementById('modal-success');
  if (stepForm)    stepForm.style.display    = 'block';
  if (stepPayment) stepPayment.style.display = 'none';
  if (stepSuccess) stepSuccess.style.display = 'none';
  const stepBulkPreview = document.getElementById('modal-step-bulk-preview');
  if (stepBulkPreview) {
    stepBulkPreview.style.display = 'none';
    const pl = document.getElementById('bulk-preview-list');
    const ps = document.getElementById('bulk-preview-summary');
    const pt = document.getElementById('bulk-preview-total');
    if (pl) pl.innerHTML = '';
    if (ps) ps.textContent = '';
    if (pt) pt.textContent = '';
  }
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

  // Bulk mode: show preview instead of confirming directly
  if (document.getElementById('bulk-toggle')?.checked) {
    if (!name || !email) { alert('Please enter your name and email first.'); return; }
    const count = getBulkCount();
    if (!count) { alert('Please enter a valid session count (2–50).'); return; }
    await showBulkPreview(slotId, service, count);
    return;
  }

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
  if (e.key === 'Escape') {
    closeBookingModal();
    closePkgModal();
  }
});

// ── Testimonials Carousel ─────────────────────────────────────
let _carouselPage  = 0;
let _carouselTotal = 0;
let _carouselTimer = null;

function _carouselPerPage() { return window.innerWidth >= 768 ? 3 : 1; }

function _carouselTotalPages() { return Math.ceil(_carouselTotal / _carouselPerPage()); }

function _carouselGoTo(pageIdx) {
  const track = document.querySelector('.carousel-track');
  if (!track) return;
  const cards    = track.querySelectorAll('.testimonial-card');
  if (!cards.length) return;

  const totalPgs = _carouselTotalPages();
  _carouselPage  = ((pageIdx % totalPgs) + totalPgs) % totalPgs;

  // Pixel offset: card width + gap, stepped by perPage cards
  const cardWidth = cards[0].offsetWidth;
  const gap       = parseFloat(getComputedStyle(track).columnGap) || 0;
  const rawOffset = _carouselPage * _carouselPerPage() * (cardWidth + gap);
  // Clamp so we never scroll past the last card
  const maxOffset = Math.max(0, track.scrollWidth - track.parentElement.offsetWidth);
  const offset    = Math.min(rawOffset, maxOffset);

  track.style.transform = `translateX(-${offset}px)`;
  document.querySelectorAll('.carousel-dot').forEach((d, i) =>
    d.classList.toggle('active', i === _carouselPage)
  );
}

function _carouselBuildDots() {
  const el = document.getElementById('carousel-dots');
  if (!el) return;
  const pages = _carouselTotalPages();
  el.innerHTML = Array.from({ length: pages }, (_, i) =>
    `<button class="carousel-dot${i === 0 ? ' active' : ''}" aria-label="Page ${i + 1}"></button>`
  ).join('');
  el.querySelectorAll('.carousel-dot').forEach((d, i) =>
    d.addEventListener('click', () => { _carouselGoTo(i); _carouselRestart(); })
  );
}

function _carouselStart() {
  _carouselTimer = setInterval(() => { _carouselGoTo(_carouselPage + 1); }, 6000);
}

function _carouselRestart() { clearInterval(_carouselTimer); _carouselStart(); }

function initCarousel() {
  const track = document.querySelector('.carousel-track');
  if (!track) return;
  _carouselTotal = track.querySelectorAll('.testimonial-card').length;
  if (_carouselTotal < 2) return;
  _carouselPage = 0;
  track.style.transform = 'translateX(0)';
  _carouselBuildDots();
  _carouselStart();
  document.getElementById('carousel-prev')
    ?.addEventListener('click', () => { _carouselGoTo(_carouselPage - 1); _carouselRestart(); });
  document.getElementById('carousel-next')
    ?.addEventListener('click', () => { _carouselGoTo(_carouselPage + 1); _carouselRestart(); });
  // Rebuild dots when viewport size crosses the 768px breakpoint
  window.addEventListener('resize', () => { _carouselBuildDots(); _carouselGoTo(0); }, { passive: true });
}

function reinitCarousel() {
  clearInterval(_carouselTimer);
  const track = document.querySelector('.carousel-track');
  if (!track) return;
  _carouselTotal = track.querySelectorAll('.testimonial-card').length;
  _carouselPage  = 0;
  track.style.transform = 'translateX(0)';
  _carouselBuildDots();
  if (_carouselTotal >= 2) _carouselStart();
}

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
  initCarousel();

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
