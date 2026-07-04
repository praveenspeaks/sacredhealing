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

const FROM        = process.env.SMTP_FROM || '"6R Ascension" <noreply@healwithreena.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
const REPLY_TO    = process.env.SMTP_REPLY_TO || ADMIN_EMAIL;

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function formatDateShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function dtLocal(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-');
  const [hh, mm] = timeStr.split(':');
  return `${y}${mo}${d}T${hh}${mm}00`;
}

function dtEnd(dateStr, timeStr, mins) {
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  dt.setMinutes(dt.getMinutes() + (parseInt(mins) || 60));
  return `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

// Generates a single ICS file with one VEVENT per slot.
function generateICS({ service, slots, customerName, customerEmail, bookingRef, location, session_type }) {
  const dtstamp = new Date().toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
  const loc     = (session_type === 'In Person' ? (location || 'London') : 'Online / Remote').replace(/,/g, '\\,');
  const isMulti = slots.length > 1;

  const events = slots.map((slot, i) => {
    const uid  = `sh-${bookingRef || Date.now()}-${i+1}@6rascension.com`;
    const summary = isMulti
      ? `6R Ascension — ${service} (Session ${i+1} of ${slots.length})`
      : `6R Ascension — ${service}`;
    const desc = `Your ${service} session with Reena at 6R Ascension.${isMulti ? `\\nSession ${i+1} of ${slots.length}.` : ''}${bookingRef ? '\\nBooking Reference: ' + bookingRef : ''}\\n\\nFor queries\\, reply to this email.`;
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Europe/London:${dtLocal(slot.date, slot.time)}`,
      `DTEND;TZID=Europe/London:${dtEnd(slot.date, slot.time, slot.duration)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${loc}`,
      `ORGANIZER;CN="6R Ascension":mailto:${ADMIN_EMAIL || 'noreply@6rascension.com'}`,
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="${customerName}":mailto:${customerEmail}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//6R Ascension//EN',
    'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

// ── Customer confirmation email ────────────────────────────────────────────

async function sendBookingConfirmation({
  customerName, customerEmail, service,
  slot,        // single booking — one slot object
  slots,       // bulk booking — array of slot objects
  servicePrice, cancelUrl, bookingRef,
  isBulk, sessionCount, totalAmount,
  location, session_type,
}) {
  if (!transporter) return;

  const allSlots   = slots || (slot ? [slot] : []);
  const firstSlot  = allSlots[0] || {};
  const isPackage  = isBulk || allSlots.length > 1;
  const count      = sessionCount || allSlots.length;
  const priceEach  = servicePrice != null ? parseFloat(servicePrice) : parseFloat(firstSlot.price || 0);
  const grand      = totalAmount  != null ? parseFloat(totalAmount)  : priceEach * count;
  const currency   = firstSlot.currency || 'GBP';
  const sym        = { GBP:'£', USD:'$', EUR:'€', INR:'₹', AUD:'A$' }[currency] || '£';
  const fmtPrice   = p => `${sym}${parseFloat(p) % 1 === 0 ? parseInt(p) : parseFloat(p).toFixed(2)}`;
  const grandStr   = grand > 0  ? fmtPrice(grand) : 'Free';
  const perStr     = priceEach > 0 ? `${fmtPrice(priceEach)} per session` : 'Free';
  const isInPerson = session_type === 'In Person';
  const locLine    = location || 'London';

  let subjectLine, detailsHtml;

  if (isPackage) {
    subjectLine = `Your ${count}-session package is confirmed ✦ 6R Ascension`;
    const sessionRows = allSlots.map((s, i) => `
      <tr>
        <td style="padding:0.45rem 0.5rem;color:#A1A1AA;border-bottom:1px solid rgba(255,255,255,0.05);">${i + 1}</td>
        <td style="padding:0.45rem 0.5rem;color:#FDFCF8;border-bottom:1px solid rgba(255,255,255,0.05);">${formatDate(s.date)}</td>
        <td style="padding:0.45rem 0.5rem;color:#FDFCF8;border-bottom:1px solid rgba(255,255,255,0.05);">${formatTime(s.time)}</td>
        <td style="padding:0.45rem 0.5rem;color:#A1A1AA;border-bottom:1px solid rgba(255,255,255,0.05);">${s.duration} min</td>
      </tr>`).join('');

    detailsHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
        <tr><td style="padding:0.6rem 0;color:#A1A1AA;width:40%">Service</td><td style="color:#FDFCF8;font-weight:600">${service}</td></tr>
        <tr><td style="padding:0.6rem 0;color:#A1A1AA">Sessions</td><td style="color:#FDFCF8;font-weight:600">${count}</td></tr>
        <tr><td style="padding:0.6rem 0;color:#A1A1AA">Price per session</td><td style="color:#FDFCF8">${perStr}</td></tr>
        <tr><td style="padding:0.6rem 0;color:#A1A1AA">Total paid</td><td style="color:#DAB467;font-weight:700;font-size:1.05rem">${grandStr}</td></tr>
      </table>
      <p style="color:#A1A1AA;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.75rem;">Your Session Schedule</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:2rem;font-size:0.88rem;">
        <thead>
          <tr>
            <th style="padding:0.4rem 0.5rem;color:#71717A;text-align:left;font-weight:500;">#</th>
            <th style="padding:0.4rem 0.5rem;color:#71717A;text-align:left;font-weight:500;">Date</th>
            <th style="padding:0.4rem 0.5rem;color:#71717A;text-align:left;font-weight:500;">Time</th>
            <th style="padding:0.4rem 0.5rem;color:#71717A;text-align:left;font-weight:500;">Duration</th>
          </tr>
        </thead>
        <tbody>${sessionRows}</tbody>
      </table>`;
  } else {
    subjectLine = `Your ${service} session is booked ✦ 6R Ascension`;
    const sessionTypeLine = session_type
      ? `<tr><td style="padding:0.6rem 0;color:#A1A1AA">Session Format</td><td style="color:#FDFCF8">${session_type === 'In Person' ? `📍 In Person — ${locLine}` : '🌐 Remote / Online'}</td></tr>`
      : '';
    detailsHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:2rem;">
        <tr><td style="padding:0.6rem 0;color:#A1A1AA;width:40%">Service</td><td style="color:#FDFCF8;font-weight:600">${service}</td></tr>
        <tr><td style="padding:0.6rem 0;color:#A1A1AA">Date</td><td style="color:#FDFCF8">${formatDate(firstSlot.date)}</td></tr>
        <tr><td style="padding:0.6rem 0;color:#A1A1AA">Time</td><td style="color:#FDFCF8">${formatTime(firstSlot.time)}</td></tr>
        <tr><td style="padding:0.6rem 0;color:#A1A1AA">Duration</td><td style="color:#FDFCF8">${firstSlot.duration} minutes</td></tr>
        ${sessionTypeLine}
        <tr><td style="padding:0.6rem 0;color:#A1A1AA">Price</td><td style="color:#DAB467;font-weight:600">${grandStr}</td></tr>
      </table>`;
  }

  await transporter.sendMail({
    from:    FROM,
    replyTo: REPLY_TO,
    to:      customerEmail,
    subject: subjectLine,
    attachments: [{
      filename:    'sacred-healing-session.ics',
      content:     generateICS({ service, slots: allSlots, customerName, customerEmail, bookingRef, location: locLine, session_type }),
      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
    }],
    html: `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#FDFCF8;padding:2.5rem;border-radius:12px;">
        <h1 style="color:#DAB467;font-size:1.6rem;margin-bottom:0.5rem;">6R Ascension</h1>
        <p style="color:#A1A1AA;font-size:0.85rem;margin-bottom:2rem;">6R Ascension · ${isInPerson ? locLine : 'Online / Remote'}</p>
        <h2 style="font-size:1.2rem;margin-bottom:1.5rem;">${isPackage ? `Your ${count}-session package is confirmed` : 'Your session is confirmed'}, ${customerName} ✦</h2>
        ${bookingRef ? `
        <div style="text-align:center;margin-bottom:1.75rem;padding:1rem;background:rgba(218,180,103,0.1);border:1px solid rgba(218,180,103,0.35);border-radius:10px;">
          <p style="color:#A1A1AA;font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 0.35rem">Booking Reference</p>
          <p style="color:#DAB467;font-size:1.6rem;font-weight:700;letter-spacing:0.15em;font-family:monospace;margin:0">${bookingRef}</p>
          <p style="color:#71717A;font-size:0.75rem;margin:0.35rem 0 0">Keep this reference for your records</p>
        </div>` : ''}
        ${detailsHtml}
        <p style="color:#A1A1AA;font-size:0.9rem;line-height:1.7;">We will be in touch shortly to confirm the details of your session.
          If you need to reach us, reply to this email or contact us at
          <a href="mailto:${ADMIN_EMAIL}" style="color:#DAB467">${ADMIN_EMAIL}</a>.</p>
        ${cancelUrl ? `<p style="margin-top:1.5rem;font-size:0.8rem;color:#71717A;">Need to cancel? <a href="${cancelUrl}" style="color:#DAB467;">Cancel your booking</a> (link expires once used).</p>` : ''}
        <p style="margin-top:2rem;color:#DAB467;font-size:1rem;">✦ With light &amp; love, Reena</p>
      </div>
    `,
  });
}

// ── Admin alert email ──────────────────────────────────────────────────────

async function sendAdminAlert({
  customerName, customerEmail, customerPhone, service,
  slot,
  slots,
  servicePrice, message, cancelUrl, bookingRef,
  isBulk, sessionCount, totalAmount,
  location,
}) {
  if (!transporter || !ADMIN_EMAIL) return;

  const allSlots  = slots || (slot ? [slot] : []);
  const firstSlot = allSlots[0] || {};
  const isPackage = isBulk || allSlots.length > 1;
  const count     = sessionCount || allSlots.length;
  const priceEach = servicePrice != null ? parseFloat(servicePrice) : parseFloat(firstSlot.price || 0);
  const grand     = totalAmount  != null ? parseFloat(totalAmount)  : priceEach * count;
  const sym       = { GBP:'£', USD:'$', EUR:'€', INR:'₹', AUD:'A$' }[firstSlot.currency || 'GBP'] || '£';
  const fmtPrice  = p => `${sym}${parseFloat(p) % 1 === 0 ? parseInt(p) : parseFloat(p).toFixed(2)}`;
  const grandStr  = grand > 0  ? fmtPrice(grand) : 'Free';
  const perStr    = priceEach > 0 ? `${fmtPrice(priceEach)}/session` : 'Free';

  let sessionBlock = '';
  if (isPackage && allSlots.length > 1) {
    sessionBlock = `
      <tr><td colspan="2" style="padding:0.75rem 0 0.25rem;color:#555;font-weight:600;">Session Schedule (${count} sessions)</td></tr>
      ${allSlots.map((s, i) => `
        <tr>
          <td style="padding:0.25rem 0;color:#888;padding-left:1rem;">${i+1}.</td>
          <td style="padding:0.25rem 0;">${formatDateShort(s.date)} — ${formatTime(s.time)} (${s.duration} min)</td>
        </tr>`).join('')}`;
  }

  await transporter.sendMail({
    from:    FROM,
    to:      ADMIN_EMAIL,
    subject: isPackage
      ? `New PACKAGE booking: ${service} × ${count} sessions — ${customerName}`
      : `New booking: ${service} — ${customerName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#A57C27;">${isPackage ? `New Package Booking (${count} Sessions)` : 'New Booking Received'}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:0.5rem 0;color:#555;width:40%">Customer</td><td><strong>${customerName}</strong></td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Email</td><td><a href="mailto:${customerEmail}">${customerEmail}</a></td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Phone</td><td>${customerPhone || '—'}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Service</td><td>${service}</td></tr>
          ${isPackage ? `
          <tr><td style="padding:0.5rem 0;color:#555">Sessions</td><td><strong>${count}</strong></td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Per session</td><td>${perStr}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Total paid</td><td><strong style="color:#A57C27">${grandStr}</strong></td></tr>
          ` : `
          <tr><td style="padding:0.5rem 0;color:#555">Date</td><td>${formatDate(firstSlot.date)}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Time</td><td>${formatTime(firstSlot.time)}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Duration</td><td>${firstSlot.duration} min</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Price</td><td>${grandStr}</td></tr>
          `}
          ${bookingRef ? `<tr><td style="padding:0.5rem 0;color:#555">Booking Ref</td><td><strong style="letter-spacing:0.08em">${bookingRef}</strong></td></tr>` : ''}
          ${message ? `<tr><td style="padding:0.5rem 0;color:#555;vertical-align:top">Message</td><td style="white-space:pre-wrap">${message}</td></tr>` : ''}
          ${cancelUrl ? `<tr><td style="padding:0.5rem 0;color:#555">Cancel link</td><td><a href="${cancelUrl}">${cancelUrl}</a></td></tr>` : ''}
          ${sessionBlock}
        </table>
      </div>
    `,
  });
}

async function sendCancellationNotification({ customerName, customerEmail, service, slot, bookingRef }) {
  if (!transporter) return;
  const dateStr = slot ? formatDate(slot.date) : '';
  const timeStr = slot ? formatTime(slot.time) : '';
  await transporter.sendMail({
    from:    FROM,
    replyTo: REPLY_TO,
    to:      customerEmail,
    subject: `Your 6R Ascension session has been cancelled — ${service}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#FDFCF8;padding:2.5rem;border-radius:12px;">
        <h1 style="color:#DAB467;font-size:1.6rem;margin-bottom:0.5rem;">6R Ascension</h1>
        <p style="color:#A1A1AA;font-size:0.85rem;margin-bottom:2rem;">6R Ascension</p>
        <h2 style="font-size:1.2rem;margin-bottom:1.5rem;">Your session has been cancelled, ${customerName}</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:2rem;">
          <tr><td style="padding:0.6rem 0;color:#A1A1AA;width:40%">Service</td><td style="color:#FDFCF8;font-weight:600">${service}</td></tr>
          ${dateStr ? `<tr><td style="padding:0.6rem 0;color:#A1A1AA">Date</td><td style="color:#FDFCF8">${dateStr}</td></tr>` : ''}
          ${timeStr ? `<tr><td style="padding:0.6rem 0;color:#A1A1AA">Time</td><td style="color:#FDFCF8">${timeStr}</td></tr>` : ''}
          ${bookingRef ? `<tr><td style="padding:0.6rem 0;color:#A1A1AA">Booking Ref</td><td style="color:#FDFCF8;font-family:monospace">${bookingRef}</td></tr>` : ''}
        </table>
        <p style="color:#A1A1AA;font-size:0.9rem;line-height:1.7;">We're sorry your session was cancelled. If you'd like to rebook or have any questions, please reply to this email or reach out to us at <a href="mailto:${ADMIN_EMAIL}" style="color:#DAB467;">${ADMIN_EMAIL}</a>.</p>
        <p style="margin-top:2rem;color:#DAB467;font-size:1rem;">✦ With light &amp; love, Reena</p>
      </div>
    `,
  });
}

async function sendCancellationAdminAlert({ customerName, customerEmail, customerPhone, service, slot, bookingRef }) {
  if (!transporter || !ADMIN_EMAIL) return;
  const dateStr = slot ? formatDate(slot.date) : '';
  const timeStr = slot ? formatTime(slot.time) : '';
  await transporter.sendMail({
    from:    FROM,
    to:      ADMIN_EMAIL,
    subject: `Booking cancelled: ${service} — ${customerName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#A57C27;">Booking Cancelled</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:0.5rem 0;color:#555;width:40%">Customer</td><td><strong>${customerName}</strong></td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Email</td><td><a href="mailto:${customerEmail}">${customerEmail}</a></td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Phone</td><td>${customerPhone || '—'}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#555">Service</td><td>${service}</td></tr>
          ${dateStr ? `<tr><td style="padding:0.5rem 0;color:#555">Date</td><td>${dateStr}</td></tr>` : ''}
          ${timeStr ? `<tr><td style="padding:0.5rem 0;color:#555">Time</td><td>${timeStr}</td></tr>` : ''}
          ${bookingRef ? `<tr><td style="padding:0.5rem 0;color:#555">Booking Ref</td><td><strong style="letter-spacing:0.08em">${bookingRef}</strong></td></tr>` : ''}
        </table>
        <p style="color:#888;font-size:0.85rem;margin-top:1rem;">The slot has been released and is available for new bookings.</p>
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
    subject: '✦ 6R Ascension — Email Test',
    html: `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#FDFCF8;padding:2.5rem;border-radius:12px;">
        <h1 style="color:#DAB467;font-size:1.5rem;margin-bottom:0.5rem;">6R Ascension</h1>
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

async function sendContactEnquiry({ name, email, message }) {
  if (!transporter) return;
  await transporter.sendMail({
    from:     FROM,
    to:       ADMIN_EMAIL,
    replyTo:  email,
    subject:  `✦ New Enquiry from ${name} — 6R Ascension`,
    html: `
      <div style="font-family:Georgia,serif;max-width:540px;margin:0 auto;background:#fff;padding:2rem;border-radius:10px;border:1px solid #e8e0d0;">
        <h2 style="color:#5C5B47;font-size:1.3rem;margin-bottom:0.25rem;">New Contact Enquiry</h2>
        <p style="color:#8A8070;font-size:0.85rem;margin-bottom:1.5rem;">6R Ascension Website</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
          <tr><td style="padding:0.5rem 0;color:#8A8070;width:30%">Name</td><td><strong>${name}</strong></td></tr>
          <tr><td style="padding:0.5rem 0;color:#8A8070">Email</td><td><a href="mailto:${email}" style="color:#5C5B47">${email}</a></td></tr>
          <tr><td style="padding:0.5rem 0;color:#8A8070;vertical-align:top">Message</td><td style="white-space:pre-wrap;line-height:1.7">${message}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e8e0d0;margin:1.5rem 0;" />
        <p style="font-size:0.8rem;color:#A89E92;">Reply directly to this email to respond to ${name}.</p>
      </div>
    `,
  });
}

module.exports = { sendBookingConfirmation, sendAdminAlert, sendCancellationNotification, sendCancellationAdminAlert, sendTestEmail, sendContactEnquiry };
