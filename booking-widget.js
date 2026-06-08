/**
 * booking-widget.js — Global multi-step booking modal
 * Include this on every page. Call openBookingModal(serviceSlug?) from any button.
 */
(function () {
  'use strict';

  // ── Module state ──────────────────────────────────────────────────────────
  let gbmServices   = [];
  let gbmSlotMap    = {}; // slotId → slot object
  let gbmSelSvc     = null;  // selected service object
  let gbmCalYear    = new Date().getFullYear();
  let gbmCalMonth   = new Date().getMonth(); // 0-indexed
  let gbmCalData    = {};    // { 'YYYY-MM-DD': { total, booked } }
  let gbmSelDate    = null;
  let gbmSelSlot    = null;  // selected slot object
  let gbmBookingId  = null;
  let gbmStripeInst = null;
  let gbmStripeEls  = null;
  let gbmPayEl      = null;

  // ── HTML injection ────────────────────────────────────────────────────────
  function injectModal () {
    if (document.getElementById('gbm-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="gbm-overlay" class="gbm-overlay" onclick="if(event.target===this)window.closeBookingModal()">
        <div class="gbm-box">
          <button class="gbm-close" onclick="window.closeBookingModal()">✕</button>

          <!-- Step indicator -->
          <div class="gbm-steps" id="gbm-steps">
            <div class="gbm-step active" data-step="1">
              <span class="gbm-step-num">1</span>
              <span class="gbm-step-lbl">Choose Time</span>
            </div>
            <div class="gbm-step-line"></div>
            <div class="gbm-step" data-step="2">
              <span class="gbm-step-num">2</span>
              <span class="gbm-step-lbl">Your Details</span>
            </div>
            <div class="gbm-step-line"></div>
            <div class="gbm-step" data-step="3">
              <span class="gbm-step-num">3</span>
              <span class="gbm-step-lbl">Confirmed</span>
            </div>
          </div>

          <!-- ── STEP 1: Service + Calendar + Slots ── -->
          <div class="gbm-pane" id="gbm-pane-1">
            <h2 class="gbm-title">Choose Your <em>Session</em></h2>

            <div class="gbm-field" id="gbm-svc-wrap">
              <label class="gbm-lbl">Service</label>
              <select id="gbm-svc" class="gbm-input" onchange="window._gbmOnSvcChange()">
                <option value="">Loading services…</option>
              </select>
            </div>

            <div class="gbm-cal-wrap">
              <!-- Calendar -->
              <div class="gbm-cal-panel">
                <div class="gbm-cal-hdr">
                  <button class="gbm-cal-nav" onclick="window._gbmPrev()">&#8249;</button>
                  <span class="gbm-month-lbl" id="gbm-month-lbl">—</span>
                  <button class="gbm-cal-nav" onclick="window._gbmNext()">&#8250;</button>
                </div>
                <div class="gbm-day-lbls">
                  <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                </div>
                <div class="gbm-cal-grid" id="gbm-cal-grid"></div>
                <div class="gbm-legend">
                  <span class="gbm-leg-item"><span class="gbm-leg-dot" style="background:#6aaca8"></span>Available</span>
                  <span class="gbm-leg-item"><span class="gbm-leg-dot" style="background:#f59e0b"></span>Full</span>
                </div>
              </div>
              <!-- Time slots -->
              <div class="gbm-slots-panel">
                <div class="gbm-slots-hdr" id="gbm-slots-hdr">Select a date</div>
                <div class="gbm-slots-grid" id="gbm-slots-grid">
                  <p class="gbm-empty" style="grid-column:1/-1;">← Pick a date</p>
                </div>
                <p class="gbm-tz">🕐 London time (GMT/BST)</p>
              </div>
            </div>
          </div>

          <!-- ── STEP 2: Personal details ── -->
          <div class="gbm-pane" id="gbm-pane-2" style="display:none;">
            <h2 class="gbm-title">Your <em>Details</em></h2>
            <p class="gbm-subtitle">Well done for taking a huge step for yourself.</p>
            <div class="gbm-summary" id="gbm-summary"></div>
            <div class="gbm-field">
              <label class="gbm-lbl">Full Name *</label>
              <input type="text" id="gbm-name" class="gbm-input" placeholder="Sarah Johnson" />
            </div>
            <div class="gbm-field">
              <label class="gbm-lbl">Email Address *</label>
              <input type="email" id="gbm-email" class="gbm-input" placeholder="your@email.com" />
            </div>
            <div class="gbm-field">
              <label class="gbm-lbl">Phone (optional)</label>
              <input type="tel" id="gbm-phone" class="gbm-input" placeholder="+44 7700 000000" />
            </div>
            <div class="gbm-field">
              <label class="gbm-lbl">Message for Reena (optional)</label>
              <textarea id="gbm-msg" class="gbm-input" rows="3" placeholder="Share anything you'd like Reena to know…"></textarea>
            </div>
            <div class="gbm-btns">
              <button class="gbm-btn-outline" onclick="window._gbmGoStep(1)">← Back</button>
              <button class="gbm-btn-primary" id="gbm-submit-btn" onclick="window._gbmSubmit()">Confirm Booking ✦</button>
            </div>
          </div>

          <!-- ── STEP 3: Confirmation ── -->
          <div class="gbm-pane" id="gbm-pane-3" style="display:none;">
            <div class="gbm-success">
              <div class="gbm-success-icon">✦</div>
              <h2 class="gbm-title">You're <em>Booked!</em></h2>
              <p class="gbm-success-msg">A confirmation email is on its way to you. Reena will be in touch shortly to confirm your session details.</p>
              <div class="gbm-conf-card" id="gbm-conf-card"></div>
              <button class="gbm-btn-primary" onclick="window.closeBookingModal()" style="margin-top:1.75rem;">Close</button>
            </div>
          </div>

          <!-- ── PAYMENT pane (Stripe) ── -->
          <div class="gbm-pane" id="gbm-pane-pay" style="display:none;">
            <h2 class="gbm-title">Complete <em>Payment</em></h2>
            <div class="gbm-summary" id="gbm-pay-summary"></div>
            <div id="gbm-pay-element" style="margin-top:1rem;"></div>
            <p id="gbm-pay-error" style="color:#dc2626;font-size:0.85rem;margin-top:0.65rem;display:none;"></p>
            <div class="gbm-btns" style="margin-top:1.25rem;">
              <button class="gbm-btn-outline" onclick="window._gbmGoStep(2)">← Back</button>
              <button class="gbm-btn-primary" id="gbm-pay-btn" onclick="window._gbmPay()">Pay Now ✦</button>
            </div>
          </div>

        </div>
      </div>
    `);
    injectStyles();
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  function injectStyles () {
    if (document.getElementById('gbm-css')) return;
    const s = document.createElement('style');
    s.id = 'gbm-css';
    s.textContent = `
      .gbm-overlay {
        position:fixed;inset:0;z-index:4000;
        background:rgba(30,28,24,.72);backdrop-filter:blur(8px);
        display:flex;align-items:center;justify-content:center;
        padding:1rem;
        opacity:0;pointer-events:none;
        transition:opacity .3s ease;
      }
      .gbm-overlay.open{opacity:1;pointer-events:all;}

      .gbm-box {
        background:#fff;border-radius:20px;padding:2.25rem;
        width:100%;max-width:780px;max-height:92vh;overflow-y:auto;
        position:relative;box-shadow:0 30px 70px rgba(0,0,0,.28);
      }

      .gbm-close {
        position:absolute;top:1rem;right:1rem;
        background:#f7f5f0;border:1px solid #e5e1d8;color:#9ca3af;
        width:32px;height:32px;border-radius:50%;
        font-size:.85rem;cursor:pointer;
        display:flex;align-items:center;justify-content:center;transition:all .2s;
      }
      .gbm-close:hover{background:#fee2e2;color:#dc2626;border-color:#fca5a5;}

      /* Step bar */
      .gbm-steps{display:flex;align-items:center;justify-content:center;margin-bottom:2rem;}
      .gbm-step{display:flex;flex-direction:column;align-items:center;gap:.3rem;opacity:.38;transition:opacity .3s;}
      .gbm-step.active,.gbm-step.done{opacity:1;}
      .gbm-step-num{
        width:26px;height:26px;border-radius:50%;
        background:#ccc;color:#fff;
        font-size:.72rem;font-weight:700;
        display:flex;align-items:center;justify-content:center;transition:background .3s;
      }
      .gbm-step.active .gbm-step-num{background:#7c7c5a;}
      .gbm-step.done  .gbm-step-num{background:#6aaca8;}
      .gbm-step-lbl{font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;white-space:nowrap;}
      .gbm-step-line{flex:1;height:1px;background:#e5e1d8;min-width:2.5rem;margin:0 .5rem .9rem;}

      /* Headings */
      .gbm-title{font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:#2c2a26;font-weight:300;margin-bottom:1.25rem;}
      .gbm-title em{font-style:italic;color:#7c7c5a;}
      .gbm-subtitle{font-size:.9rem;color:#6b7280;margin-top:-.85rem;margin-bottom:1.25rem;line-height:1.6;}

      /* Form */
      .gbm-lbl{display:block;font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin-bottom:.4rem;}
      .gbm-field{margin-bottom:1rem;}
      .gbm-input{
        width:100%;padding:.72rem 1rem;
        background:#faf8f4;border:1px solid #d4c5a0;color:#2c2a26;
        border-radius:8px;font-family:'Raleway',sans-serif;font-size:.9rem;
        outline:none;transition:border-color .2s;resize:vertical;box-sizing:border-box;
      }
      .gbm-input:focus{border-color:#7c7c5a;background:#fff;}

      /* Service select */
      #gbm-svc-wrap{margin-bottom:1.5rem;}

      /* Calendar layout */
      .gbm-cal-wrap{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;}
      .gbm-cal-panel,.gbm-slots-panel{background:#faf8f4;border:1px solid #e5e1d8;border-radius:12px;padding:1.1rem;}
      .gbm-cal-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:.9rem;}
      .gbm-cal-nav{
        background:none;border:1px solid #e5e1d8;border-radius:6px;
        width:1.85rem;height:1.85rem;cursor:pointer;font-size:1rem;color:#6b7280;
        display:flex;align-items:center;justify-content:center;transition:all .18s;
      }
      .gbm-cal-nav:hover{background:#f0ede6;border-color:#7c7c5a;color:#7c7c5a;}
      .gbm-month-lbl{font-family:'Cormorant Garamond',serif;font-size:1.05rem;font-weight:500;color:#2c2a26;}
      .gbm-day-lbls{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;margin-bottom:.2rem;}
      .gbm-day-lbls span{font-size:.58rem;font-weight:700;letter-spacing:.04em;color:#9ca3af;padding:.25rem 0;}
      .gbm-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:.1rem;}

      /* Calendar day cells */
      .gbm-day{
        aspect-ratio:1;display:flex;align-items:center;justify-content:center;
        border-radius:6px;font-size:.8rem;cursor:default;
        transition:all .15s;position:relative;border:1px solid transparent;
      }
      .gbm-day.past{color:#d1d5db;}
      .gbm-day.available{cursor:pointer;color:#2c2a26;}
      .gbm-day.available:hover{background:#e8f5f4;border-color:#6aaca8;}
      .gbm-day.available::after{content:'';position:absolute;bottom:2px;width:4px;height:4px;border-radius:50%;background:#6aaca8;}
      .gbm-day.selected{background:#6aaca8;color:#fff;border-color:#6aaca8;}
      .gbm-day.selected::after{background:#fff;}
      .gbm-day.fullbook{background:#fef3c7;border-color:#fbbf24;color:#92400e;cursor:not-allowed;}
      .gbm-day.fullbook::after{content:'';position:absolute;bottom:2px;width:4px;height:4px;border-radius:50%;background:#f59e0b;}

      /* Legend */
      .gbm-legend{display:flex;gap:.85rem;margin-top:.75rem;padding-top:.6rem;border-top:1px solid #e5e1d8;}
      .gbm-leg-item{display:flex;align-items:center;gap:.35rem;font-size:.65rem;color:#9ca3af;}
      .gbm-leg-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}

      /* Slots */
      .gbm-slots-panel{display:flex;flex-direction:column;min-height:220px;}
      .gbm-slots-hdr{font-family:'Cormorant Garamond',serif;font-size:1rem;color:#2c2a26;margin-bottom:.75rem;padding-bottom:.5rem;border-bottom:1px solid #e5e1d8;}
      .gbm-slots-grid{display:grid;grid-template-columns:1fr 1fr;gap:.45rem;flex:1;}
      .gbm-slot-btn{
        padding:.55rem .4rem;border:1px solid #e5e1d8;border-radius:6px;
        background:#fff;font-size:.78rem;font-family:'Raleway',sans-serif;
        cursor:pointer;text-align:center;transition:all .15s;line-height:1.3;
      }
      .gbm-slot-btn:hover:not(:disabled){background:#6aaca8;color:#fff;border-color:#6aaca8;}
      .gbm-slot-btn.selected{background:#6aaca8;color:#fff;border-color:#6aaca8;}
      .gbm-slot-btn:disabled{opacity:.38;cursor:not-allowed;text-decoration:line-through;}
      .gbm-slot-btn small{display:block;font-size:.68rem;opacity:.8;}
      .gbm-empty{color:#9ca3af;font-size:.85rem;text-align:center;padding:1.5rem 0;}
      .gbm-tz{font-size:.68rem;color:#9ca3af;text-align:center;margin-top:.65rem;padding-top:.5rem;border-top:1px solid #e5e1d8;}

      /* Step 2 summary */
      .gbm-summary{
        background:#faf8f4;border:1px solid #e5e1d8;border-radius:10px;
        padding:.9rem 1.1rem;margin-bottom:1.5rem;
        display:grid;grid-template-columns:auto 1fr;gap:.45rem .85rem;align-items:center;
      }
      .gbm-sum-k{font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;}
      .gbm-sum-v{color:#2c2a26;font-weight:500;font-size:.88rem;}

      /* Buttons */
      .gbm-btns{display:flex;gap:.85rem;justify-content:flex-end;margin-top:1.25rem;}
      .gbm-btn-primary{
        padding:.8rem 2rem;background:#7c7c5a;color:#fff;
        font-weight:600;font-size:.88rem;border:none;border-radius:8px;
        cursor:pointer;font-family:'Raleway',sans-serif;transition:all .2s;letter-spacing:.04em;
      }
      .gbm-btn-primary:hover:not(:disabled){background:#5c5c42;transform:translateY(-1px);}
      .gbm-btn-primary:disabled{opacity:.55;cursor:not-allowed;transform:none;}
      .gbm-btn-outline{
        padding:.8rem 1.5rem;background:transparent;color:#7c7c5a;
        border:1px solid #d4c5a0;border-radius:8px;cursor:pointer;
        font-family:'Raleway',sans-serif;font-size:.88rem;transition:all .2s;
      }
      .gbm-btn-outline:hover{background:#f7f5f0;}

      /* Success */
      .gbm-success{text-align:center;padding:1rem 0;}
      .gbm-success-icon{font-size:3rem;color:#7c7c5a;margin-bottom:.75rem;}
      .gbm-success-msg{color:#6b7280;font-size:.9rem;max-width:400px;margin:.5rem auto 0;line-height:1.75;}
      .gbm-conf-card{
        background:#faf8f4;border:1px solid #e5e1d8;border-radius:12px;
        padding:1.25rem 1.5rem;margin-top:1.5rem;text-align:left;
        display:grid;grid-template-columns:auto 1fr;gap:.6rem 1.25rem;align-items:center;
      }
      .gbm-ck{font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;}
      .gbm-cv{color:#2c2a26;font-weight:500;font-size:.88rem;}
      .gbm-ref{font-family:monospace;background:#e8f5f4;color:#0e7490;padding:.1rem .45rem;border-radius:4px;font-size:.85rem;}

      @media(max-width:600px){
        .gbm-box{padding:1.5rem 1.1rem;}
        .gbm-cal-wrap{grid-template-columns:1fr;}
        .gbm-step-lbl{display:none;}
      }
    `;
    document.head.appendChild(s);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.openBookingModal = async function (serviceSlug) {
    injectModal();
    // Reset state
    gbmSelDate  = null;
    gbmSelSlot  = null;
    gbmBookingId = null;
    gbmSlotMap  = {};
    // Reset form
    ['gbm-name','gbm-email','gbm-phone','gbm-msg'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const submitBtn = document.getElementById('gbm-submit-btn');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Confirm Booking ✦'; }

    document.getElementById('gbm-steps').style.display = 'flex';
    _gbmGoStep(1);
    document.getElementById('gbm-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';

    await _gbmLoadServices(serviceSlug);
    // Reset calendar to current month
    const now = new Date();
    gbmCalYear  = now.getFullYear();
    gbmCalMonth = now.getMonth();
    await _gbmLoadCalMonth();
  };

  window.closeBookingModal = function () {
    const el = document.getElementById('gbm-overlay');
    if (el) el.classList.remove('open');
    document.body.style.overflow = '';
  };

  // ── Services ─────────────────────────────────────────────────────────────
  async function _gbmLoadServices (preselect) {
    try {
      const res = await fetch('/api/content');
      const data = await res.json();
      gbmServices = data.services || [];
      const sel = document.getElementById('gbm-svc');
      sel.innerHTML = '<option value="">Select a service…</option>' +
        gbmServices.map(s =>
          `<option value="${s.id}">${s.title}${parseFloat(s.price) > 0 ? ' — £' + s.price : ' — Free'}</option>`
        ).join('');

      if (preselect) {
        const found = gbmServices.find(s =>
          (s.slug && s.slug === preselect) ||
          s.title.toLowerCase().replace(/\s+/g, '-') === preselect
        );
        if (found) { sel.value = found.id; gbmSelSvc = found; }
      }
    } catch (e) { console.error('gbm: failed to load services', e); }
  }

  window._gbmOnSvcChange = function () {
    const sel = document.getElementById('gbm-svc');
    gbmSelSvc = gbmServices.find(s => s.id == sel.value) || null;
    // Re-render slot tiles so the price label reflects the newly selected service
    if (gbmSelDate) _gbmLoadDateSlots(gbmSelDate);
  };

  // ── Calendar ──────────────────────────────────────────────────────────────
  async function _gbmLoadCalMonth () {
    const mm = String(gbmCalMonth + 1).padStart(2, '0');
    document.getElementById('gbm-month-lbl').textContent =
      new Date(gbmCalYear, gbmCalMonth, 1)
        .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    try {
      const res = await fetch(`/api/slots/calendar?month=${gbmCalYear}-${mm}`);
      gbmCalData = res.ok ? await res.json() : {};
    } catch (e) { gbmCalData = {}; }
    _gbmRenderCal();
  }

  function _gbmRenderCal () {
    const grid = document.getElementById('gbm-cal-grid');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const first = new Date(gbmCalYear, gbmCalMonth, 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const total = new Date(gbmCalYear, gbmCalMonth + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < offset; i++) html += '<div class="gbm-day" style="visibility:hidden"></div>';
    for (let d = 1; d <= total; d++) {
      const mm = String(gbmCalMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const ds = `${gbmCalYear}-${mm}-${dd}`;
      const cell = new Date(gbmCalYear, gbmCalMonth, d);
      const info = gbmCalData[ds];
      const isPast  = cell < today;
      const isFull  = info && parseInt(info.total) > 0 && parseInt(info.booked) >= parseInt(info.total);
      const hasSlot = info && parseInt(info.total) > 0 && parseInt(info.booked) < parseInt(info.total);
      const isSel   = ds === gbmSelDate;
      let cls = 'gbm-day', oc = '';
      if (isPast)   cls += ' past';
      else if (isFull)   cls += ' fullbook';
      else if (hasSlot)  { cls += ' available' + (isSel ? ' selected' : ''); oc = `onclick="window._gbmSelDate('${ds}')"` }
      else cls += ' past';
      html += `<div class="${cls}" ${oc}>${d}</div>`;
    }
    grid.innerHTML = html;
  }

  window._gbmSelDate = async function (ds) {
    gbmSelDate = ds;
    gbmSelSlot = null;
    _gbmRenderCal();

    const dateObj = new Date(ds + 'T12:00:00');
    document.getElementById('gbm-slots-hdr').textContent =
      dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const grid = document.getElementById('gbm-slots-grid');
    grid.innerHTML = '<p class="gbm-empty" style="grid-column:1/-1">Loading…</p>';

    try {
      const res = await fetch(`/api/slots/date/${ds}`);
      const data = await res.json();
      const slots = data.slots || [];
      if (!slots.length) {
        grid.innerHTML = '<p class="gbm-empty" style="grid-column:1/-1">No sessions on this date.</p>';
        return;
      }
      gbmSlotMap = {};
      slots.forEach(sl => { gbmSlotMap[sl.id] = sl; });
      grid.innerHTML = slots.map(sl => {
        const time = String(sl.time).substring(0, 5);
        const booked = sl.is_booked == 1 || sl.is_booked === true;
        const svcP  = gbmSelSvc ? parseFloat(gbmSelSvc.price) : 0;
        const price = svcP > 0 ? `£${svcP}` : (parseFloat(sl.price) > 0 ? `£${sl.price}` : 'Free');
        return `<button class="gbm-slot-btn" data-slot-id="${sl.id}"
          ${booked ? 'disabled title="Already booked"' : `onclick="window._gbmSelSlot(${sl.id})"`}>
          ${time}<small>${price}${booked ? ' · Booked' : ''}</small></button>`;
      }).join('');
    } catch (e) {
      grid.innerHTML = '<p class="gbm-empty" style="grid-column:1/-1">Unable to load slots.</p>';
    }
  };

  window._gbmSelSlot = function (slotId) {
    gbmSelSlot = gbmSlotMap[slotId];
    document.querySelectorAll('.gbm-slot-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.slotId == slotId)
    );
    _gbmGoStep(2);
  };

  window._gbmPrev = function () {
    gbmCalMonth--; if (gbmCalMonth < 0) { gbmCalMonth = 11; gbmCalYear--; }
    _gbmLoadCalMonth();
  };
  window._gbmNext = function () {
    gbmCalMonth++; if (gbmCalMonth > 11) { gbmCalMonth = 0; gbmCalYear++; }
    _gbmLoadCalMonth();
  };

  // ── Step navigation ───────────────────────────────────────────────────────
  window._gbmGoStep = function (step) {
    ['1', '2', '3', 'pay'].forEach(s => {
      const el = document.getElementById('gbm-pane-' + s);
      if (el) el.style.display = (s == step || s === step) ? 'block' : 'none';
    });
    [1, 2, 3].forEach(n => {
      const el = document.querySelector(`.gbm-step[data-step="${n}"]`);
      if (!el) return;
      el.classList.remove('active', 'done');
      if (n < step)      el.classList.add('done');
      else if (n == step) el.classList.add('active');
    });
    if (step === 2) {
      _gbmFillSummary('gbm-summary');
      const submitBtn = document.getElementById('gbm-submit-btn');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Confirm Booking ✦'; }
    }
  };

  function _gbmFillSummary (id) {
    const sl  = gbmSelSlot;
    const svc = gbmSelSvc;
    if (!sl) return;
    const dateObj  = new Date(sl.date + 'T12:00:00');
    const dateStr  = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr  = String(sl.time).substring(0, 5);
    const svcPrice = svc ? parseFloat(svc.price) : 0;
    const price    = svcPrice > 0 ? `£${svcPrice}` : (parseFloat(sl.price) > 0 ? `£${sl.price}` : 'Free');
    const svcTitle = svc ? svc.title : 'Healing Session';
    document.getElementById(id).innerHTML = `
      <span class="gbm-sum-k">Service</span><span class="gbm-sum-v">${svcTitle}</span>
      <span class="gbm-sum-k">Date</span><span class="gbm-sum-v">${dateStr}</span>
      <span class="gbm-sum-k">Time</span><span class="gbm-sum-v">${timeStr} London time</span>
      <span class="gbm-sum-k">Duration</span><span class="gbm-sum-v">${sl.duration} minutes</span>
      <span class="gbm-sum-k">Price</span><span class="gbm-sum-v">${price}</span>
    `;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  window._gbmSubmit = async function () {
    const name  = document.getElementById('gbm-name').value.trim();
    const email = document.getElementById('gbm-email').value.trim();
    const phone = document.getElementById('gbm-phone').value.trim();
    const msg   = document.getElementById('gbm-msg').value.trim();

    if (!name || !email) { alert('Please enter your name and email address.'); return; }
    if (!gbmSelSlot) { alert('Please select a date and time.'); _gbmGoStep(1); return; }

    const btn = document.getElementById('gbm-submit-btn');
    btn.disabled = true; btn.textContent = 'Submitting…';

    try {
      const body = {
        slot_id:         gbmSelSlot.id,
        service:         gbmSelSvc ? gbmSelSvc.title : 'Healing Session',
        customer_name:   name,
        customer_email:  email,
        customer_phone:  phone,
        message:         msg
      };
      const res  = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Booking failed');

      if (data.payment_required && data.client_secret) {
        gbmBookingId = data.booking_id;
        await _gbmInitStripe(data.client_secret, data.booking_ref, data.amount);
      } else {
        _gbmShowSuccess(data);
      }
    } catch (e) {
      alert(e.message || 'Something went wrong. Please try again.');
      btn.disabled = false; btn.textContent = 'Confirm Booking ✦';
    }
  };

  function _gbmShowSuccess (data) {
    const sl  = gbmSelSlot;
    const svc = gbmSelSvc;
    const dateObj = new Date(sl.date + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr  = String(sl.time).substring(0, 5);
    const svcPrice = svc ? parseFloat(svc.price) : 0;
    const price    = svcPrice > 0 ? `£${svcPrice}` : (parseFloat(sl.price) > 0 ? `£${sl.price}` : 'Free');

    document.getElementById('gbm-conf-card').innerHTML = `
      <span class="gbm-ck">Reference</span>
      <span class="gbm-cv"><span class="gbm-ref">${data.booking_ref || '—'}</span></span>
      <span class="gbm-ck">Service</span>
      <span class="gbm-cv">${svc ? svc.title : 'Healing Session'}</span>
      <span class="gbm-ck">Date</span>
      <span class="gbm-cv">${dateStr}</span>
      <span class="gbm-ck">Time</span>
      <span class="gbm-cv">${timeStr} · London time</span>
      <span class="gbm-ck">Duration</span>
      <span class="gbm-cv">${sl.duration} minutes</span>
      <span class="gbm-ck">Price</span>
      <span class="gbm-cv">${price}</span>
    `;

    document.getElementById('gbm-steps').style.display = 'none';
    _gbmGoStep(3);
  }

  // ── Stripe payment ────────────────────────────────────────────────────────
  async function _gbmInitStripe (clientSecret, bookingRef, amount) {
    // Lazy-load Stripe.js
    if (!window.Stripe) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = resolve; script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    const keyRes = await fetch('/api/stripe-key');
    const keyData = await keyRes.json();
    if (!keyData.publishableKey) {
      alert('Payment configuration is unavailable. Please contact us directly.'); return;
    }

    gbmStripeInst = window.Stripe(keyData.publishableKey);
    gbmStripeEls  = gbmStripeInst.elements({ clientSecret });
    gbmPayEl      = gbmStripeEls.create('payment');

    // Fill payment summary
    const sl  = gbmSelSlot;
    const svc = gbmSelSvc;
    const dateObj = new Date(sl.date + 'T12:00:00');
    document.getElementById('gbm-pay-summary').innerHTML = `
      <span class="gbm-sum-k">Service</span><span class="gbm-sum-v">${svc ? svc.title : 'Healing Session'}</span>
      <span class="gbm-sum-k">Date</span><span class="gbm-sum-v">${dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })} at ${String(sl.time).substring(0,5)}</span>
      <span class="gbm-sum-k">Amount</span><span class="gbm-sum-v" style="font-weight:700;font-size:1rem;">£${amount}</span>
    `;

    document.getElementById('gbm-pay-element').innerHTML = '';
    gbmPayEl.mount('#gbm-pay-element');
    _gbmGoStep('pay');
  }

  window._gbmPay = async function () {
    if (!gbmStripeInst || !gbmStripeEls) return;
    const btn = document.getElementById('gbm-pay-btn');
    const errEl = document.getElementById('gbm-pay-error');
    btn.disabled = true; btn.textContent = 'Processing…';
    errEl.style.display = 'none';

    try {
      const { error, paymentIntent } = await gbmStripeInst.confirmPayment({
        elements: gbmStripeEls,
        redirect: 'if_required'
      });
      if (error) {
        errEl.textContent = error.message;
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Pay Now ✦';
        return;
      }
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        const res  = await fetch('/api/bookings/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: gbmBookingId, payment_intent_id: paymentIntent.id })
        });
        const data = await res.json();
        _gbmShowSuccess(data);
      }
    } catch (e) {
      errEl.textContent = 'Payment failed. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Pay Now ✦';
    }
  };

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') window.closeBookingModal();
  });

  // Auto-inject
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectModal);
  } else {
    injectModal();
  }
})();
