const nodemailer = require('nodemailer');

const enabled =
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS;

const transporter = enabled
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

if (!enabled) {
  console.warn('⚠️  SMTP not configured — email notifications are disabled. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable.');
}

const FROM        = process.env.SMTP_FROM || '"Sacred Healing" <noreply@soulbody.healing.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
}

async function sendBookingConfirmation({ customerName, customerEmail, service, slot, servicePrice, cancelUrl }) {
  if (!transporter) return;
  const price     = servicePrice != null ? parseFloat(servicePrice) : parseFloat(slot.price || 0);
  const priceStr  = price > 0
    ? `£${price % 1 === 0 ? parseInt(price) : price.toFixed(2)}`
    : 'Free consultation';

  await transporter.sendMail({
    from:    FROM,
    to:      customerEmail,
    subject: `Your ${service} session is booked ✦ Sacred Healing`,
    html: `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#FDFCF8;padding:2.5rem;border-radius:12px;">
        <h1 style="color:#DAB467;font-size:1.6rem;margin-bottom:0.5rem;">Sacred Healing</h1>
        <p style="color:#A1A1AA;font-size:0.85rem;margin-bottom:2rem;">SoulBody Healing · Croydon, London &amp; Online</p>
        <h2 style="font-size:1.2rem;margin-bottom:1.5rem;">Your session is confirmed, ${customerName} ✦</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:2rem;">
          <tr><td style="padding:0.6rem 0;color:#A1A1AA;width:40%">Service</td><td style="color:#FDFCF8;font-weight:600">${service}</td></tr>
          <tr><td style="padding:0.6rem 0;color:#A1A1AA">Date</td><td style="color:#FDFCF8">${formatDate(slot.date)}</td></tr>
          <tr><td style="padding:0.6rem 0;color:#A1A1AA">Time</td><td style="color:#FDFCF8">${formatTime(slot.time)}</td></tr>
          <tr><td style="padding:0.6rem 0;color:#A1A1AA">Duration</td><td style="color:#FDFCF8">${slot.duration} minutes</td></tr>
          <tr><td style="padding:0.6rem 0;color:#A1A1AA">Price</td><td style="color:#DAB467;font-weight:600">${priceStr}</td></tr>
        </table>
        <p style="color:#A1A1AA;font-size:0.9rem;line-height:1.7;">We will be in touch shortly to confirm the details of your session.
          If you need to reach us, reply to this email or contact us at
          <a href="mailto:${ADMIN_EMAIL}" style="color:#DAB467">${ADMIN_EMAIL}</a>.</p>
        ${cancelUrl ? `<p style="margin-top:1.5rem;font-size:0.8rem;color:#71717A;">Need to cancel? <a href="${cancelUrl}" style="color:#DAB467;">Cancel your booking</a> (link expires once used).</p>` : ''}
        <p style="margin-top:2rem;color:#DAB467;font-size:1rem;">✦ With light &amp; love, Reena</p>
      </div>
    `,
  });
}

async function sendAdminAlert({ customerName, customerEmail, customerPhone, service, slot, servicePrice, message, cancelUrl }) {
  if (!transporter || !ADMIN_EMAIL) return;
  const price    = servicePrice != null ? parseFloat(servicePrice) : parseFloat(slot.price || 0);
  const priceStr = price > 0
    ? `£${price % 1 === 0 ? parseInt(price) : price.toFixed(2)}`
    : 'Free';

  await transporter.sendMail({
    from:    FROM,
    to:      ADMIN_EMAIL,
    subject: `New booking: ${service} — ${customerName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#A57C27;">New Booking Received</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:0.5rem 0;color:#555;width:40%">Customer</td><td><strong>${customerName}</strong></td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Email</td><td><a href="mailto:${customerEmail}">${customerEmail}</a></td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Phone</td><td>${customerPhone || '—'}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Service</td><td>${service}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Date</td><td>${formatDate(slot.date)}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Time</td><td>${formatTime(slot.time)}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Duration</td><td>${slot.duration} min</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Price</td><td>${priceStr}</td></tr>
          ${message ? `<tr><td style="padding:0.5rem 0;color:#555;vertical-align:top">Message</td><td style="white-space:pre-wrap">${message}</td></tr>` : ''}
          ${cancelUrl ? `<tr><td style="padding:0.5rem 0;color:#555">Cancel link</td><td><a href="${cancelUrl}">${cancelUrl}</a></td></tr>` : ''}
        </table>
      </div>
    `,
  });
}

async function sendTestEmail(to) {
  if (!transporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file.');
  }
  await transporter.sendMail({
    from:    FROM,
    to,
    subject: '✦ Sacred Healing — Email Test',
    html: `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#FDFCF8;padding:2.5rem;border-radius:12px;">
        <h1 style="color:#DAB467;font-size:1.5rem;margin-bottom:0.5rem;">Sacred Healing</h1>
        <p style="color:#A1A1AA;font-size:0.85rem;margin-bottom:2rem;">Email Configuration Test</p>
        <p style="line-height:1.8;">This is a test email confirming that your email configuration is working correctly.</p>
        <table style="width:100%;border-collapse:collapse;margin:1.5rem 0;font-size:0.9rem;">
          <tr><td style="padding:0.4rem 0;color:#A1A1AA;width:40%">SMTP Host</td><td>${process.env.SMTP_HOST}</td></tr>
          <tr><td style="padding:0.4rem 0;color:#A1A1AA">From</td><td>${FROM}</td></tr>
          <tr><td style="padding:0.4rem 0;color:#A1A1AA">Sent to</td><td>${to}</td></tr>
          <tr><td style="padding:0.4rem 0;color:#A1A1AA">Time</td><td>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</td></tr>
        </table>
        <p style="color:#10B981;font-weight:600;">✓ Email notifications are working correctly.</p>
      </div>
    `,
  });
}

module.exports = { sendBookingConfirmation, sendAdminAlert, sendTestEmail };
