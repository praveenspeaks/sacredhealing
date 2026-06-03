/* ── Clarity Call Modal Widget ──────────────────────────────────────────────
   Self-contained. Include on any page, then call openClarityModal().
   Requires /api/contact and /api/content endpoints.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var _injected = false;
  var _servicesLoaded = false;

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inject() {
    if (_injected) return;
    _injected = true;

    // ── Styles ──────────────────────────────────────────────────────────
    var style = document.createElement('style');
    style.textContent = [
      '.ccw-overlay{position:fixed;inset:0;z-index:9100;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);padding:1rem;}',
      '.ccw-overlay.open{display:flex;}',
      '.ccw-box{background:var(--cream-light,#faf8f4);border-radius:16px;width:100%;max-width:780px;max-height:90vh;overflow-y:auto;display:grid;grid-template-columns:1fr 1.15fr;box-shadow:0 24px 64px rgba(0,0,0,0.22);}',
      '.ccw-left{padding:2.5rem 2rem;background:var(--charcoal,#1a1a2e);border-radius:16px 0 0 16px;display:flex;flex-direction:column;justify-content:center;}',
      '.ccw-left .section-tag{color:rgba(255,255,255,0.55);font-size:0.68rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:1rem;}',
      '.ccw-left h2{font-family:var(--font-heading,"Cormorant Garamond",serif);font-size:clamp(1.7rem,3vw,2.3rem);font-weight:300;color:#fff;line-height:1.2;margin-bottom:1.25rem;}',
      '.ccw-left h2 em{font-style:italic;color:var(--olive-light,#7A7860);}',
      '.ccw-bullets{list-style:none;padding:0;margin:0 0 1.25rem;display:flex;flex-direction:column;gap:0.55rem;}',
      '.ccw-bullets li{color:rgba(255,255,255,0.75);font-size:0.87rem;line-height:1.6;display:flex;gap:0.5rem;}',
      '.ccw-bullets li span{color:var(--olive-light,#7A7860);flex-shrink:0;}',
      '.ccw-tagline{font-size:0.83rem;color:rgba(255,255,255,0.5);line-height:1.7;}',
      '.ccw-right{padding:2rem 2rem 2rem;position:relative;}',
      '.ccw-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.5rem;color:var(--text-muted,#888);cursor:pointer;line-height:1;padding:0.2rem 0.5rem;border-radius:4px;}',
      '.ccw-close:hover{background:rgba(0,0,0,0.06);}',
      '.ccw-form-row{display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:0.6rem;}',
      '.ccw-label{display:block;font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted,#888);margin-bottom:0.3rem;}',
      '.ccw-input{width:100%;padding:0.62rem 0.85rem;border:1px solid var(--border-strong,rgba(0,0,0,0.15));border-radius:6px;background:#fff;color:var(--charcoal,#1a1a2e);font-family:var(--font-body,"Raleway",sans-serif);font-size:0.85rem;box-sizing:border-box;transition:border-color 0.15s;}',
      '.ccw-input:focus{outline:none;border-color:#2a8c7c;}',
      '.ccw-radio-list{display:flex;flex-direction:column;gap:0.3rem;margin-bottom:0.85rem;}',
      '.ccw-radio-list label{display:flex;align-items:center;gap:0.5rem;font-size:0.84rem;color:var(--charcoal,#1a1a2e);cursor:pointer;line-height:1.5;}',
      '.ccw-radio-list input[type="radio"]{accent-color:#2a8c7c;flex-shrink:0;}',
      '.ccw-err{font-size:0.8rem;color:#c0392b;min-height:1.1rem;margin-bottom:0.4rem;}',
      '.ccw-submit{width:100%;padding:0.8rem;background:var(--olive,#5C5B47);color:#fff;border:none;border-radius:8px;font-family:var(--font-body,"Raleway",sans-serif);font-size:0.9rem;font-weight:600;letter-spacing:0.04em;cursor:pointer;transition:background 0.2s;}',
      '.ccw-submit:hover:not(:disabled){background:var(--olive-dark,#3D3C2E);}',
      '.ccw-submit:disabled{opacity:0.6;cursor:default;}',
      '.ccw-success{text-align:center;padding:2.5rem 1rem;}',
      '.ccw-success-icon{font-size:2.5rem;color:#2a8c7c;margin-bottom:0.75rem;}',
      '.ccw-success h3{font-family:var(--font-heading,"Cormorant Garamond",serif);font-size:1.8rem;font-weight:400;color:var(--charcoal,#1a1a2e);margin-bottom:0.5rem;}',
      '.ccw-success p{color:var(--text-body,#555);font-size:0.9rem;line-height:1.75;max-width:300px;margin:0 auto;}',
      '@media(max-width:640px){.ccw-box{grid-template-columns:1fr;max-height:95vh;}.ccw-left{border-radius:16px 16px 0 0;padding:1.75rem 1.5rem;}.ccw-right{padding:1.5rem 1.25rem;}}'
    ].join('');
    document.head.appendChild(style);

    // ── HTML ─────────────────────────────────────────────────────────────
    var html = [
      '<div class="ccw-overlay" id="ccw-overlay" onclick="_ccwBgClick(event)">',
        '<div class="ccw-box" role="dialog" aria-modal="true" aria-label="Book a Free Clarity Call">',

          // Left panel
          '<div class="ccw-left">',
            '<div class="section-tag">✦ Free 15-Minute Session</div>',
            '<h2>Book a Free <em>Clarity Call</em></h2>',
            '<ul class="ccw-bullets">',
              '<li><span>✦</span> What you\'re struggling with</li>',
              '<li><span>✦</span> What you\'re looking for</li>',
              '<li><span>✦</span> If my offerings are in alignment with your goals</li>',
            '</ul>',
            '<p class="ccw-tagline">I\'m looking forward to learning about your journey and connecting with you.</p>',
          '</div>',

          // Right panel — form
          '<div class="ccw-right" id="ccw-right">',
            '<button class="ccw-close" onclick="closeClarityModal()" aria-label="Close">&times;</button>',
            '<div class="ccw-form-row">',
              '<div>',
                '<label class="ccw-label">First Name <span style="color:#c0392b">*</span></label>',
                '<input type="text" id="ccw-fname" class="ccw-input" autocomplete="given-name" />',
              '</div>',
              '<div>',
                '<label class="ccw-label">Last Name <span style="color:#c0392b">*</span></label>',
                '<input type="text" id="ccw-lname" class="ccw-input" autocomplete="family-name" />',
              '</div>',
            '</div>',
            '<label class="ccw-label" style="margin-top:0.5rem;">Email <span style="color:#c0392b">*</span></label>',
            '<input type="email" id="ccw-email" class="ccw-input" autocomplete="email" style="margin-bottom:0.75rem;" />',
            '<label class="ccw-label">Phone</label>',
            '<input type="tel" id="ccw-phone" class="ccw-input" autocomplete="tel" style="margin-bottom:0.75rem;" />',
            '<label class="ccw-label">Which service are you interested in? <span style="color:#c0392b">*</span></label>',
            '<div class="ccw-radio-list" id="ccw-services"></div>',
            '<label class="ccw-label">Which areas of your life are you looking to transform?</label>',
            '<input type="text" id="ccw-transform" class="ccw-input" style="margin-bottom:0.75rem;" />',
            '<label class="ccw-label">Any questions or information you\'d like to share?</label>',
            '<textarea id="ccw-message" class="ccw-input" rows="2" style="resize:vertical;margin-bottom:0.75rem;"></textarea>',
            '<div class="ccw-err" id="ccw-err"></div>',
            '<button id="ccw-submit" class="ccw-submit" onclick="_ccwSubmit()">Request a Free Clarity Call ✦</button>',
          '</div>',

        '</div>',
      '</div>'
    ].join('');

    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
  }

  function loadServices() {
    if (_servicesLoaded) return;
    fetch('/api/content')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list = document.getElementById('ccw-services');
        if (!list || !data.services) return;
        var html = data.services.map(function (s) {
          return '<label><input type="radio" name="ccw-service" value="' + esc(s.title) + '" /> ' + esc(s.title) + '</label>';
        }).join('');
        html += '<label><input type="radio" name="ccw-service" value="Other / Not Sure" /> Other / Not Sure</label>';
        list.innerHTML = html;
        _servicesLoaded = true;
      })
      .catch(function () {});
  }

  // ── Public API ──────────────────────────────────────────────────────────
  window.openClarityModal = function (preselect) {
    inject();
    loadServices();
    var overlay = document.getElementById('ccw-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Optionally pre-select a service
    if (preselect) {
      setTimeout(function () {
        var radios = document.querySelectorAll('input[name="ccw-service"]');
        radios.forEach(function (r) {
          if (r.value === preselect) r.checked = true;
        });
      }, 50);
    }
    // Reset form to fresh state
    var right = document.getElementById('ccw-right');
    if (right && !right.classList.contains('ccw-success')) {
      ['ccw-fname', 'ccw-lname', 'ccw-email', 'ccw-phone', 'ccw-transform', 'ccw-message'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.querySelectorAll('input[name="ccw-service"]').forEach(function (r) { r.checked = false; });
      var errEl = document.getElementById('ccw-err');
      if (errEl) errEl.textContent = '';
      var btn = document.getElementById('ccw-submit');
      if (btn) { btn.disabled = false; btn.textContent = 'Request a Free Clarity Call ✦'; }
    }
    setTimeout(function () {
      var first = document.getElementById('ccw-fname');
      if (first) first.focus();
    }, 100);
  };

  window.closeClarityModal = function () {
    var overlay = document.getElementById('ccw-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  window._ccwBgClick = function (e) {
    if (e.target === document.getElementById('ccw-overlay')) window.closeClarityModal();
  };

  window._ccwSubmit = async function () {
    var fname     = (document.getElementById('ccw-fname').value || '').trim();
    var lname     = (document.getElementById('ccw-lname').value || '').trim();
    var email     = (document.getElementById('ccw-email').value || '').trim();
    var phone     = (document.getElementById('ccw-phone').value || '').trim();
    var svcEl     = document.querySelector('input[name="ccw-service"]:checked');
    var service   = svcEl ? svcEl.value : '';
    var transform = (document.getElementById('ccw-transform').value || '').trim();
    var msgVal    = (document.getElementById('ccw-message').value || '').trim();
    var errEl     = document.getElementById('ccw-err');

    if (!fname || !lname || !email) {
      errEl.textContent = 'Please fill in your first name, last name, and email.';
      return;
    }
    if (!email.includes('@')) {
      errEl.textContent = 'Please enter a valid email address.';
      return;
    }
    errEl.textContent = '';

    var btn = document.getElementById('ccw-submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    var message = [
      'FREE CLARITY CALL REQUEST',
      phone     ? 'Phone: ' + phone                  : '',
      service   ? 'Interested in: ' + service        : '',
      transform ? 'Areas to transform: ' + transform : '',
      msgVal    ? 'Message: ' + msgVal               : ''
    ].filter(Boolean).join('\n');

    try {
      var res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: fname + ' ' + lname, email: email, phone: phone, message: message })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');

      document.getElementById('ccw-right').innerHTML = [
        '<button class="ccw-close" onclick="closeClarityModal()" aria-label="Close">&times;</button>',
        '<div class="ccw-success">',
          '<div class="ccw-success-icon">✦</div>',
          '<h3>Thank You!</h3>',
          '<p>Your request has been received. Reena will be in touch with you shortly to confirm a time for your free 15-minute clarity call.</p>',
        '</div>'
      ].join('');
    } catch (err) {
      errEl.textContent = err.message || 'Something went wrong. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Request a Free Clarity Call ✦';
    }
  };

  // Keyboard close
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.closeClarityModal();
  });
})();
