/**
 * cookie-banner.js — Cookie & copyright consent banner
 * Standalone script; loaded independently on every public page.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'sh_cookie_consent';

  function alreadyAccepted() {
    try { return localStorage.getItem(STORAGE_KEY) === 'accepted'; } catch (e) { return false; }
  }

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, 'accepted'); } catch (e) {}
    dismiss();
  }

  function decline() {
    try { localStorage.setItem(STORAGE_KEY, 'declined'); } catch (e) {}
    dismiss();
  }

  function dismiss() {
    var el = document.getElementById('sh-cookie-banner');
    if (!el) return;
    el.style.transition = 'opacity 0.4s, transform 0.4s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(100%)';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
  }

  function injectBanner() {
    if (alreadyAccepted()) return;
    if (document.getElementById('sh-cookie-banner')) return;
    if (!document.body) return;

    var year = new Date().getFullYear();
    var style = document.createElement('style');
    style.id = 'sh-cookie-banner-css';
    style.textContent = [
      '#sh-cookie-banner{',
        'position:fixed;bottom:0;left:0;right:0;z-index:99999;',
        'background:#1a1814;border-top:1px solid rgba(218,180,103,0.25);',
        'padding:1rem 1.5rem;display:flex;align-items:center;',
        'gap:1.25rem;flex-wrap:wrap;justify-content:space-between;',
        'box-shadow:0 -4px 24px rgba(0,0,0,0.45);',
        'font-family:Raleway,sans-serif;font-size:0.83rem;',
        'color:#c9c4b8;line-height:1.55;',
      '}',
      '#sh-cookie-banner .sh-cb-text{flex:1;min-width:220px;}',
      '#sh-cookie-banner .sh-cb-text strong{color:#DAB467;}',
      '#sh-cookie-banner .sh-cb-text a{color:#DAB467;text-underline-offset:3px;}',
      '#sh-cookie-banner .sh-cb-copy{font-size:0.73rem;color:#6b6760;margin-top:0.2rem;}',
      '#sh-cookie-banner .sh-cb-actions{display:flex;gap:0.6rem;flex-shrink:0;align-items:center;flex-wrap:wrap;}',
      '#sh-cookie-banner .sh-cb-accept{',
        'padding:0.55rem 1.4rem;background:#DAB467;color:#1a1814;',
        'border:none;border-radius:6px;font-weight:700;font-size:0.82rem;',
        'cursor:pointer;font-family:inherit;transition:background 0.18s;white-space:nowrap;',
      '}',
      '#sh-cookie-banner .sh-cb-accept:hover{background:#c9a353;}',
      '#sh-cookie-banner .sh-cb-decline{',
        'padding:0.55rem 1rem;background:transparent;color:#9ca3af;',
        'border:1px solid rgba(156,163,175,0.3);border-radius:6px;',
        'font-size:0.8rem;cursor:pointer;font-family:inherit;',
        'transition:border-color 0.18s,color 0.18s;white-space:nowrap;',
      '}',
      '#sh-cookie-banner .sh-cb-decline:hover{border-color:#9ca3af;color:#c9c4b8;}',
      '@media(max-width:600px){',
        '#sh-cookie-banner{padding:1rem;gap:0.85rem;}',
        '#sh-cookie-banner .sh-cb-actions{width:100%;}',
        '#sh-cookie-banner .sh-cb-accept,#sh-cookie-banner .sh-cb-decline{flex:1;text-align:center;}',
      '}'
    ].join('');

    var banner = document.createElement('div');
    banner.id = 'sh-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');

    var textDiv = document.createElement('div');
    textDiv.className = 'sh-cb-text';
    textDiv.innerHTML = '<div><strong>Sacred Healing</strong> uses cookies to enhance your browsing experience and analyse site traffic. By continuing to use this site you agree to our use of cookies.</div>' +
      '<div class="sh-cb-copy">© ' + year + ' SoulBody Healing · Reena. All rights reserved.  ·  <a href="/disclaimer.html" target="_blank" rel="noopener">Privacy &amp; Disclaimer</a></div>';

    var actionsDiv = document.createElement('div');
    actionsDiv.className = 'sh-cb-actions';

    var declineBtn = document.createElement('button');
    declineBtn.className = 'sh-cb-decline';
    declineBtn.textContent = 'Decline';
    declineBtn.addEventListener('click', decline);

    var acceptBtn = document.createElement('button');
    acceptBtn.className = 'sh-cb-accept';
    acceptBtn.textContent = 'Accept Cookies ✦';
    acceptBtn.addEventListener('click', accept);

    actionsDiv.appendChild(declineBtn);
    actionsDiv.appendChild(acceptBtn);
    banner.appendChild(textDiv);
    banner.appendChild(actionsDiv);

    document.head.appendChild(style);
    document.body.appendChild(banner);
  }

  function tryInject() {
    if (document.body) {
      injectBanner();
    } else {
      document.addEventListener('DOMContentLoaded', injectBanner);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanner);
  } else {
    tryInject();
  }
})();
