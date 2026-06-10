const { Resend } = require('resend');

// Lazily initialised so the module loads without crashing when RESEND_API_KEY is not yet set.
let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// onboarding@resend.dev works for free-tier test sends (to your own Resend account email only).
// Set RESEND_FROM_EMAIL to "SILKILINEN <orders@silkilinen.com>" once domain is verified in Resend.
const FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
// Escape HTML-special characters in user-supplied strings before interpolating into email templates.
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shortId(mongoId) {
  return String(mongoId).slice(-8).toUpperCase();
}

function buildItemsRows(items) {
  return items.map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eae8e3;">
        <span style="font-family:Georgia,serif;font-size:15px;color:#1a1916;">${item.name}</span>
        ${item.colour || item.size
    ? `<br><span style="font-size:12px;color:#8a8680;">${[item.colour, item.size].filter(Boolean).join(' / ')}</span>`
    : ''}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #eae8e3;text-align:center;font-size:13px;color:#5a5650;white-space:nowrap;">× ${item.quantity}</td>
      <td style="padding:12px 0;border-bottom:1px solid #eae8e3;text-align:right;font-size:14px;color:#1a1916;white-space:nowrap;">€${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');
}

function formatAddress(addr) {
  if (!addr) return '—';
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country]
    .filter(Boolean)
    .join(', ');
}

function buildHtml({ order, isAdmin }) {
  const id = shortId(order._id);
  const itemsSubtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingCost = order.shippingCost || 0;
  const discountAmount = order.discountAmount || 0;
  const grandTotal = order.total ?? (itemsSubtotal - discountAmount + shippingCost);
  const firstName = order.customerName ? order.customerName.split(' ')[0] : 'there';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1a1916;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:6px;color:#faf8f4;">SILKILINEN</p>
              <p style="margin:8px 0 0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#7a7670;">Silk &amp; Linen Intimates</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#faf8f4;padding:40px 40px 32px;">
              <p style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1916;">
                ${isAdmin ? `New order #${id}` : 'Thank you for your order'}
              </p>
              <p style="margin:0 0 32px;font-size:13px;color:#5a5650;line-height:1.8;">
                ${isAdmin
    ? `A new order has been placed by ${order.customerName || order.customerEmail || 'a customer'}.`
    : `Hi ${firstName}, your order is confirmed. We'll send a shipping update once your items are on their way.`
  }
              </p>

              <!-- Order number pill -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;background:#f0ede8;border-radius:2px;">
                <tr>
                  <td style="padding:14px 20px;">
                    <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8680;">Order</span>
                    <span style="font-size:14px;color:#1a1916;font-weight:500;margin-left:12px;">#${id}</span>
                  </td>
                </tr>
              </table>

              <!-- Items -->
              <p style="margin:0 0 14px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8a8680;">Items ordered</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                ${buildItemsRows(order.items)}
              </table>

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#5a5650;">Items subtotal</td>
                  <td style="padding:8px 0;font-size:13px;color:#1a1916;text-align:right;">€${itemsSubtotal.toFixed(2)}</td>
                </tr>
                ${discountAmount > 0 ? `
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#5a5650;">Discount${order.discountCode ? ` (${order.discountCode})` : ''}</td>
                  <td style="padding:8px 0;font-size:13px;color:#2d7d47;text-align:right;">−€${discountAmount.toFixed(2)}</td>
                </tr>` : ''}
                ${shippingCost > 0 ? `
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#5a5650;">Shipping${order.shippingMethod ? ` (${order.shippingMethod})` : ''}</td>
                  <td style="padding:8px 0;font-size:13px;color:#1a1916;text-align:right;">€${shippingCost.toFixed(2)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:14px 0 0;font-size:15px;color:#1a1916;border-top:1px solid #eae8e3;"><strong>Total</strong></td>
                  <td style="padding:14px 0 0;font-size:15px;color:#1a1916;font-weight:600;text-align:right;border-top:1px solid #eae8e3;">€${grandTotal.toFixed(2)}</td>
                </tr>
              </table>

              <!-- Shipping address -->
              <p style="margin:0 0 10px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8a8680;">Shipping to</p>
              <p style="margin:0;font-size:13px;color:#1a1916;line-height:1.7;">${formatAddress(order.shippingAddress)}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f0ede8;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#8a8680;">Questions? Email us at <a href="mailto:hello@silkilinen.com" style="color:#1a1916;text-decoration:underline;">hello@silkilinen.com</a></p>
              <p style="margin:0;font-size:11px;color:#aca8a2;">Donegal, Ireland &nbsp;·&nbsp; Worldwide shipping</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendOrderConfirmation(order) {
  if (!process.env.RESEND_API_KEY || !order.customerEmail) return;
  const id = shortId(order._id);
  await getResend().emails.send({
    from: FROM,
    to: order.customerEmail,
    subject: `Your SILKILINEN order #${id} is confirmed`,
    html: buildHtml({ order, isAdmin: false }),
  });
}

async function sendAdminOrderNotification(order) {
  if (!process.env.RESEND_API_KEY || !ADMIN_EMAIL) return;
  const id = shortId(order._id);
  await getResend().emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New order #${id} — €${(order.total || 0).toFixed(2)}`,
    html: buildHtml({ order, isAdmin: true }),
  });
}

async function sendMagicLink({ email, link }) {
  if (!process.env.RESEND_API_KEY) return;
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Sign in to your SILKILINEN account',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 16px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
<tr><td style="background:#1a1916;padding:32px 40px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:6px;color:#faf8f4;">SILKILINEN</p>
<p style="margin:8px 0 0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#7a7670;">Silk &amp; Linen Intimates</p>
</td></tr>
<tr><td style="background:#faf8f4;padding:48px 40px;text-align:center;">
<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1916;">Your sign-in link</p>
<p style="margin:0 0 36px;font-size:13px;color:#5a5650;line-height:1.8;">Click the button below to sign in. This link expires in 15 minutes and can only be used once.</p>
<a href="${link}" style="display:inline-block;background:#1a1916;color:#faf8f4;text-decoration:none;padding:14px 36px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Sign in to your account</a>
<p style="margin:36px 0 0;font-size:11px;color:#8a8680;">If you didn't request this, you can safely ignore this email.</p>
</td></tr>
<tr><td style="background:#f0ede8;padding:24px 40px;text-align:center;">
<p style="margin:0;font-size:11px;color:#aca8a2;">Donegal, Ireland &nbsp;·&nbsp; hello@silkilinen.com</p>
</td></tr>
</table></td></tr></table></body></html>`,
  });
}

async function sendWelcome({ email, firstName }) {
  if (!process.env.RESEND_API_KEY) return;
  const name = firstName || 'there';
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Welcome to SILKILINEN — a gift for you',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 16px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
<tr><td style="background:#1a1916;padding:32px 40px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:6px;color:#faf8f4;">SILKILINEN</p>
<p style="margin:8px 0 0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#7a7670;">Silk &amp; Linen Intimates</p>
</td></tr>
<tr><td style="background:#faf8f4;padding:48px 40px;">
<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1916;">Welcome, ${name}</p>
<p style="margin:0 0 24px;font-size:13px;color:#5a5650;line-height:1.8;">Thank you for joining SILKILINEN. We're an Irish silk and linen brand based in Donegal, choosing pure natural fibres for the pieces closest to your skin — made to be worn, felt, and loved.</p>
<p style="margin:0 0 36px;font-size:13px;color:#5a5650;line-height:1.8;">As a welcome gift, use code <strong style="color:#1a1916;letter-spacing:1px;">SILK10</strong> at checkout for 10% off your first order.</p>
<a href="https://silkilinen.com/shop" style="display:inline-block;background:#1a1916;color:#faf8f4;text-decoration:none;padding:14px 36px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Shop the collection</a>
</td></tr>
<tr><td style="background:#f0ede8;padding:24px 40px;text-align:center;">
<p style="margin:0;font-size:11px;color:#aca8a2;">Donegal, Ireland &nbsp;·&nbsp; hello@silkilinen.com</p>
</td></tr>
</table></td></tr></table></body></html>`,
  });
}

// Win-back reminder (#15) — gentle "we miss you" nudge to lapsed customers,
// reminding them the existing 10% welcome offer is still available. No new
// code minted (founder choice). Only send to customers who haven't already
// redeemed SILK10 — the caller filters those out.
async function sendWinbackReminder({ email, firstName }) {
  if (!process.env.RESEND_API_KEY) return;
  const name = firstName || 'there';
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'We saved your spot — 10% off when you’re ready',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 16px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
<tr><td style="background:#1a1916;padding:32px 40px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:6px;color:#faf8f4;">SILKILINEN</p>
<p style="margin:8px 0 0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#7a7670;">Silk &amp; Linen Intimates</p>
</td></tr>
<tr><td style="background:#faf8f4;padding:48px 40px;">
<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1916;">We’ve missed you, ${esc(name)}</p>
<p style="margin:0 0 24px;font-size:13px;color:#5a5650;line-height:1.8;">It’s been a little while. We're still here in Donegal with the same considered silk and linen pieces you know — and a few quiet new ones have arrived since you last visited.</p>
<p style="margin:0 0 36px;font-size:13px;color:#5a5650;line-height:1.8;">If you’d like to treat yourself, your <strong style="color:#1a1916;letter-spacing:1px;">SILK10</strong> code is still good for 10% off whenever you’re ready.</p>
<a href="https://silkilinen.com/shop" style="display:inline-block;background:#1a1916;color:#faf8f4;text-decoration:none;padding:14px 36px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">See what's new</a>
</td></tr>
<tr><td style="background:#f0ede8;padding:24px 40px;text-align:center;">
<p style="margin:0;font-size:11px;color:#aca8a2;">Donegal, Ireland &nbsp;·&nbsp; hello@silkilinen.com</p>
</td></tr>
</table></td></tr></table></body></html>`,
  });
}

function buildStatusHtml({ order, heading, body, trackingBlock }) {
  const id = shortId(order._id);
  const firstName = order.customerName ? order.customerName.split(' ')[0] : 'there';
  const FRONTEND = process.env.FRONTEND_URL || 'https://silkilinen.com';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 16px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="background:#1a1916;padding:32px 40px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:6px;color:#faf8f4;">SILKILINEN</p>
<p style="margin:8px 0 0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#7a7670;">Silk &amp; Linen Intimates</p>
</td></tr>
<tr><td style="background:#faf8f4;padding:40px 40px 32px;">
<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1916;">${heading}</p>
<p style="margin:0 0 28px;font-size:13px;color:#5a5650;line-height:1.8;">Hi ${firstName}, ${body}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:#f0ede8;border-radius:2px;">
<tr><td style="padding:14px 20px;">
<span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8680;">Order</span>
<span style="font-size:14px;color:#1a1916;font-weight:500;margin-left:12px;">#${id}</span>
</td></tr>
</table>
${trackingBlock || ''}
<a href="${FRONTEND}/account/orders" style="display:inline-block;background:#1a1916;color:#faf8f4;text-decoration:none;padding:14px 36px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">View your order</a>
</td></tr>
<tr><td style="background:#f0ede8;padding:24px 40px;text-align:center;">
<p style="margin:0 0 6px;font-size:12px;color:#8a8680;">Questions? <a href="mailto:hello@silkilinen.com" style="color:#1a1916;text-decoration:underline;">hello@silkilinen.com</a></p>
<p style="margin:0;font-size:11px;color:#aca8a2;">Donegal, Ireland &nbsp;·&nbsp; Worldwide shipping</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendProcessingEmail(order) {
  if (!process.env.RESEND_API_KEY || !order.customerEmail) return;
  const id = shortId(order._id);
  await getResend().emails.send({
    from: FROM,
    to: order.customerEmail,
    subject: `Your SILKILINEN order #${id} is being prepared`,
    html: buildStatusHtml({
      order,
      heading: "We're preparing your order",
      body: "your order is now being carefully prepared and packed. We'll email you again once it's on its way.",
    }),
  });
}

async function sendShippedEmail(order) {
  if (!process.env.RESEND_API_KEY || !order.customerEmail) return;
  const id = shortId(order._id);
  const trackingBlock = (order.trackingNumber || order.trackingUrl) ? `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #eae8e3;border-radius:2px;">
<tr><td style="padding:16px 20px;">
<p style="margin:0 0 6px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8a8680;">Tracking</p>
${order.carrier ? `<p style="margin:0 0 4px;font-size:13px;color:#5a5650;">${order.carrier}</p>` : ''}
${order.trackingUrl
    ? `<a href="${order.trackingUrl}" style="font-size:14px;color:#1a1916;font-weight:500;">${order.trackingNumber || 'Track your package →'}</a>`
    : `<p style="margin:0;font-size:14px;color:#1a1916;font-weight:500;">${order.trackingNumber}</p>`}
${order.estimatedDelivery ? `<p style="margin:8px 0 0;font-size:12px;color:#8a8680;">Est. delivery: ${new Date(order.estimatedDelivery).toDateString()}</p>` : ''}
</td></tr>
</table>` : '';
  await getResend().emails.send({
    from: FROM,
    to: order.customerEmail,
    subject: `Your SILKILINEN order #${id} is on its way`,
    html: buildStatusHtml({
      order,
      heading: 'Your order is on its way',
      body: 'your order has been dispatched and is heading your way.',
      trackingBlock,
    }),
  });
}

async function sendDeliveredEmail(order) {
  if (!process.env.RESEND_API_KEY || !order.customerEmail) return;
  const id = shortId(order._id);
  await getResend().emails.send({
    from: FROM,
    to: order.customerEmail,
    subject: `Your SILKILINEN order #${id} has been delivered`,
    html: buildStatusHtml({
      order,
      heading: 'Your order has arrived',
      body: `your order has been delivered. We hope you love every piece. If anything isn't right, please reach out — we're here to help.`,
    }),
  });
}

async function sendCancelledEmail(order) {
  if (!process.env.RESEND_API_KEY || !order.customerEmail) return;
  const id = shortId(order._id);
  await getResend().emails.send({
    from: FROM,
    to: order.customerEmail,
    subject: `Your SILKILINEN order #${id} has been cancelled`,
    html: buildStatusHtml({
      order,
      heading: 'Your order has been cancelled',
      body: 'your order has been cancelled. If a refund is due, it will appear in your account within 5–10 business days. Please contact us if you have any questions.',
    }),
  });
}

async function sendNewsletterWelcome({ email, code, validUntil, unsubscribeToken }) {
  if (!process.env.RESEND_API_KEY) return;
  const FRONTEND = process.env.FRONTEND_URL || 'https://silkilinen.com';
  const expires = validUntil
    ? new Date(validUntil).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '30 days';
  const unsubLink = unsubscribeToken
    ? `${process.env.BACKEND_URL || 'https://silkilinen-production.up.railway.app'}/api/newsletter/unsubscribe/${unsubscribeToken}`
    : `${FRONTEND}/unsubscribe`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Welcome to SILKILINEN — your 10% off is inside',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 16px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
<tr><td style="background:#1a1916;padding:32px 40px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:6px;color:#faf8f4;">SILKILINEN</p>
<p style="margin:8px 0 0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#7a7670;">Silk &amp; Linen Intimates</p>
</td></tr>
<tr><td style="background:#faf8f4;padding:48px 40px;">
<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1916;">Welcome.</p>
<p style="margin:0 0 24px;font-size:13px;color:#5a5650;line-height:1.8;">Thank you for joining us. We're a small Irish brand based in Donegal, working in silk and linen, in considered batches.</p>
<p style="margin:0 0 28px;font-size:13px;color:#5a5650;line-height:1.8;">Your first order has 10% off. Use this code at checkout:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
<tr><td style="background:#f0ede8;border-left:3px solid #1a1916;padding:20px 24px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:28px;letter-spacing:6px;font-weight:600;color:#1a1916;">${code}</p>
<p style="margin:8px 0 0;font-size:12px;color:#8a8680;letter-spacing:1px;">10% off · 1 use · valid until ${expires}</p>
</td></tr>
</table>
<a href="${FRONTEND}/shop" style="display:inline-block;background:#1a1916;color:#faf8f4;text-decoration:none;padding:14px 36px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Shop the collection</a>
<p style="margin:40px 0 0;font-size:13px;color:#5a5650;line-height:1.8;">Slowly,<br>SILKILINEN<br><a href="mailto:hello@silkilinen.com" style="color:#1a1916;">hello@silkilinen.com</a></p>
</td></tr>
<tr><td style="background:#f0ede8;padding:20px 40px;text-align:center;">
<p style="margin:0;font-size:11px;color:#aca8a2;">Donegal, Ireland &nbsp;·&nbsp; Worldwide shipping &nbsp;·&nbsp; <a href="${unsubLink}" style="color:#aca8a2;">Unsubscribe</a></p>
</td></tr>
</table></td></tr></table></body></html>`,
  });
}

async function sendDropAHint({ recipientName, recipientEmail, senderName, message, productName, productUrl, productImage, price }) {
  if (!process.env.RESEND_API_KEY) return;

  // Escape all user-supplied strings before HTML interpolation.
  const safeRecipientName = esc(recipientName);
  const safeSenderName = esc(senderName);
  const safeMessage = esc(message);
  const safeProductName = esc(productName);
  // For URL attributes: only allow http(s) URLs — blocks javascript: and data: URL injection.
  const safeProductUrl = (typeof productUrl === 'string' && /^https?:\/\//i.test(productUrl)) ? productUrl : '#';
  const safeProductImage = (typeof productImage === 'string' && /^https?:\/\//i.test(productImage)) ? productImage : '';

  const greeting = recipientName ? `Hi ${safeRecipientName},` : 'Hello,';
  const imageBlock = safeProductImage
    ? `<tr><td style="padding:0 0 24px;text-align:center;"><img src="${safeProductImage}" alt="${safeProductName}" style="max-width:280px;width:100%;height:auto;display:block;margin:0 auto;" /></td></tr>`
    : '';
  const messageBlock = message
    ? `<tr><td style="padding:0 0 28px;"><p style="font-size:14px;color:#5a5650;line-height:1.8;font-style:italic;border-left:3px solid #e0ddd7;padding-left:16px;margin:0;">"${safeMessage}"</p></td></tr>`
    : '';

  await getResend().emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `${safeSenderName} thinks you'd love this`,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 16px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
<tr><td style="background:#1a1916;padding:28px 40px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:20px;font-weight:400;letter-spacing:6px;color:#faf8f4;">SILKILINEN</p>
</td></tr>
<tr><td style="background:#faf8f4;padding:48px 40px 40px;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 20px;">
<p style="margin:0;font-size:14px;color:#5a5650;line-height:1.8;">${greeting}</p>
<p style="margin:12px 0 0;font-size:14px;color:#5a5650;line-height:1.8;">${safeSenderName} thought you might love this:</p>
</td></tr>
${imageBlock}
<tr><td style="padding:0 0 8px;">
<p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;color:#1a1916;">${safeProductName}</p>
</td></tr>
<tr><td style="padding:0 0 24px;">
<p style="margin:0;font-size:18px;color:#1a1916;">€${Number(price).toFixed(2)}</p>
</td></tr>
${messageBlock}
<tr><td style="padding:0 0 36px;">
<a href="${safeProductUrl}" style="display:inline-block;background:#1a1916;color:#faf8f4;text-decoration:none;padding:16px 40px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;">VIEW PRODUCT</a>
</td></tr>
<tr><td>
<p style="margin:0;font-size:13px;color:#8a8680;line-height:1.8;">Slowly,<br>SILKILINEN</p>
</td></tr>
</table>
</td></tr>
<tr><td style="background:#f0ede8;padding:20px 40px;text-align:center;">
<p style="margin:0;font-size:11px;color:#aca8a2;">Donegal, Ireland &nbsp;·&nbsp; Worldwide shipping</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`,
  });
}

const SUBJECTS = {
  1: 'You left something behind',
  2: 'Still thinking it over?',
  3: 'Last chance — your silk pieces are waiting',
};

const HEADLINES = {
  1: 'You left something behind',
  2: 'Still thinking it over?',
  3: 'Your silk pieces are still here',
};

const INTROS = {
  1: name => `Hi ${name}, it looks like you left something in your cart. We've held it for you — it's just waiting.`,
  2: name => `Hi ${name}, we noticed you haven't completed your order yet. No rush — but we wanted to make sure you didn't forget.`,
  3: name => `Hi ${name}, this is your final reminder about the piece(s) you were considering. We'd love to see them find their home with you.`,
};

async function sendCartRecoveryEmail(order, seq) {
  if (!process.env.RESEND_API_KEY || !order.customerEmail) return;

  const FRONTEND = process.env.FRONTEND_URL || 'https://silkilinen.com';
  const BACKEND  = process.env.BACKEND_URL  || 'https://silkilinen-production.up.railway.app';

  const firstName = order.customerName ? order.customerName.split(' ')[0] : 'there';
  const subject   = SUBJECTS[seq] || SUBJECTS[1];
  const headline  = HEADLINES[seq] || HEADLINES[1];
  const intro     = (INTROS[seq] || INTROS[1])(esc(firstName));

  // Resume link — go to the product page of the first item if we have an ID, else the shop
  const firstProductId = order.items?.[0]?.productId;
  const resumeLink = firstProductId
    ? `${FRONTEND}/product/${firstProductId}`
    : `${FRONTEND}/shop`;

  // One-click unsubscribe — encode order ID in base64url so it's URL-safe
  const oidToken = Buffer.from(String(order._id)).toString('base64url');
  const unsubLink = `${BACKEND}/api/cart-recovery/unsubscribe?oid=${oidToken}`;

  const itemRows = (order.items || []).map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eae8e3;">
        <span style="font-family:Georgia,serif;font-size:15px;color:#1a1916;">${esc(item.name)}</span>
        ${item.colour || item.size
    ? `<br><span style="font-size:12px;color:#8a8680;">${[item.colour, item.size].filter(Boolean).map(esc).join(' / ')}</span>`
    : ''}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #eae8e3;text-align:center;font-size:13px;color:#5a5650;white-space:nowrap;">× ${item.quantity || 1}</td>
      <td style="padding:12px 0;border-bottom:1px solid #eae8e3;text-align:right;font-size:14px;color:#1a1916;white-space:nowrap;">€${(item.price * (item.quantity || 1)).toFixed(2)}</td>
    </tr>
  `).join('');

  const subtotal = (order.items || []).reduce((s, i) => s + i.price * (i.quantity || 1), 0);

  await getResend().emails.send({
    from: FROM,
    to: order.customerEmail,
    subject,
    headers: { 'List-Unsubscribe': `<${unsubLink}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 16px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
<tr><td style="background:#1a1916;padding:32px 40px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:6px;color:#faf8f4;">SILKILINEN</p>
<p style="margin:8px 0 0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#7a7670;">Silk &amp; Linen Intimates</p>
</td></tr>
<tr><td style="background:#faf8f4;padding:40px 40px 32px;">
<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1916;">${esc(headline)}</p>
<p style="margin:0 0 32px;font-size:13px;color:#5a5650;line-height:1.8;">${intro}</p>
<p style="margin:0 0 14px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8a8680;">Your cart</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
${itemRows}
<tr>
  <td colspan="2" style="padding:14px 0 0;font-size:13px;color:#5a5650;border-top:1px solid #eae8e3;">Subtotal</td>
  <td style="padding:14px 0 0;font-size:15px;color:#1a1916;font-weight:600;text-align:right;border-top:1px solid #eae8e3;">€${subtotal.toFixed(2)}</td>
</tr>
</table>
<a href="${resumeLink}" style="display:inline-block;background:#1a1916;color:#faf8f4;text-decoration:none;padding:16px 40px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:32px;">Shop now</a>
<p style="margin:0;font-size:13px;color:#8a8680;line-height:1.8;">Slowly,<br>SILKILINEN</p>
</td></tr>
<tr><td style="background:#f0ede8;padding:20px 40px;text-align:center;">
<p style="margin:0 0 6px;font-size:12px;color:#8a8680;">Questions? <a href="mailto:hello@silkilinen.com" style="color:#1a1916;text-decoration:underline;">hello@silkilinen.com</a></p>
<p style="margin:0;font-size:11px;color:#aca8a2;">Donegal, Ireland &nbsp;·&nbsp; <a href="${unsubLink}" style="color:#aca8a2;text-decoration:underline;">Unsubscribe</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>`,
  });
}

// ── Post-purchase review request ─────────────────────────────────────────
// One email per order, sent ~14 days after order creation. Lists each item
// with a tokenised "Write a review" link that auto-fills productId on the
// /write-review page and marks the resulting review as verifiedPurchase.
async function sendReviewRequest({ order, links }) {
  if (!process.env.RESEND_API_KEY || !order.customerEmail) return;
  const id = shortId(order._id);
  const firstName = (order.customerName || '').split(' ')[0] || '';

  // Build one row per item with its review link. Items without a
  // productId (legacy data or bundle children) are skipped silently.
  const itemRows = (links || []).map(link => `
<tr><td style="padding:14px 16px;border-bottom:1px solid #eae8e3;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="vertical-align:middle;font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:#2a2218;">
        ${link.name}
      </td>
      <td align="right" style="vertical-align:middle;">
        <a href="${link.url}"
           style="display:inline-block;padding:10px 22px;background:#2a2218;color:#faf8f4;
                  text-decoration:none;font-family:'Jost',sans-serif;font-size:11px;
                  letter-spacing:2px;text-transform:uppercase;border-radius:2px;">
          Write a review
        </a>
      </td>
    </tr>
  </table>
</td></tr>`).join('');

  await getResend().emails.send({
    from: FROM,
    to: order.customerEmail,
    subject: 'A moment for your thoughts — SILKILINEN',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#faf8f4;font-family:'Jost',sans-serif;color:#2a2218;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;padding:40px 16px;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#faf8f4;">

    <tr><td style="text-align:center;padding-bottom:32px;">
      <p style="font-family:'Jost',sans-serif;font-size:11px;letter-spacing:2.5px;
                text-transform:uppercase;color:#8a8278;margin:0;">
        SILKILINEN · Donegal
      </p>
    </td></tr>

    <tr><td style="padding:0 8px 32px;">
      <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;
                 font-size:32px;line-height:1.2;color:#2a2218;margin:0 0 20px;">
        ${firstName ? `${firstName}, how is the silk?` : 'How is the silk?'}
      </h1>
      <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:15px;
                line-height:1.7;color:#2a2218;margin:0 0 12px;">
        Order #${id} has had a little time to settle. We'd love to hear how
        the pieces feel — how they drape, how they wash, whether they fit
        the way you hoped.
      </p>
      <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:15px;
                line-height:1.7;color:#2a2218;margin:0;">
        A few honest words helps the next person decide. Each review is
        reviewed by our team before it goes live.
      </p>
    </td></tr>

    <tr><td style="border:1px solid #eae8e3;border-radius:2px;background:#fff;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${itemRows}
      </table>
    </td></tr>

    <tr><td style="padding-top:32px;text-align:center;">
      <p style="font-family:'Jost',sans-serif;font-size:11px;color:#8a8278;
                margin:0;line-height:1.6;">
        Links expire 90 days from this email. Replies to this address reach
        a real person.
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`,
  });
}

// Weekly "state of the store" digest to the founder — the top priorities from
// the advisor, so the dashboard reaches out instead of waiting to be opened.
const DIGEST_PRIORITY = {
  high:        { bg: '#f8d7da', color: '#721c24', label: 'DO NOW' },
  medium:      { bg: '#fff3cd', color: '#856404', label: 'SOON' },
  low:         { bg: '#e2e3e5', color: '#383d41', label: 'LATER' },
  opportunity: { bg: '#d4edda', color: '#155724', label: 'OPPORTUNITY' },
};

async function sendAdvisorDigest({ recommendations = [], generatedAt } = {}) {
  if (!process.env.RESEND_API_KEY || !ADMIN_EMAIL) return;

  const dateStr = new Date(generatedAt || Date.now()).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
  const top = recommendations.slice(0, 8);

  const rows = top.length
    ? top.map(r => {
        const p = DIGEST_PRIORITY[r.priority] || DIGEST_PRIORITY.low;
        return `
      <tr><td style="padding:16px 0;border-bottom:1px solid #eae8e3;">
        <span style="display:inline-block;padding:2px 8px;font-size:10px;font-weight:700;letter-spacing:0.5px;border-radius:3px;background:${p.bg};color:${p.color};">${p.label}</span>
        <span style="font-size:11px;color:#8a8680;text-transform:uppercase;letter-spacing:0.5px;margin-left:8px;">${esc(r.category)}</span>
        <p style="margin:8px 0 4px;font-family:Georgia,serif;font-size:16px;color:#1a1916;">${esc(r.title)}</p>
        <p style="margin:0 0 6px;font-size:13px;color:#5a5650;line-height:1.6;">${esc(r.why)}</p>
        <p style="margin:0;font-size:13px;color:#1a1916;line-height:1.6;"><em>→ ${esc(r.action)}</em></p>
      </td></tr>`;
      }).join('')
    : `<tr><td style="padding:24px 0;text-align:center;font-size:14px;color:#5a5650;">Nothing pressing this week — catalogue, content and reviews are in good shape.</td></tr>`;

  await getResend().emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `SILKILINEN — your weekly priorities (${dateStr})`,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 16px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="background:#1a1916;padding:32px 40px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:22px;letter-spacing:6px;color:#faf8f4;">SILKILINEN</p>
<p style="margin:8px 0 0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#7a7670;">Weekly priorities</p>
</td></tr>
<tr><td style="background:#faf8f4;padding:40px;">
<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1a1916;">What to do next</p>
<p style="margin:0 0 24px;font-size:13px;color:#8a8680;">${dateStr} · top ${top.length} action${top.length === 1 ? '' : 's'}</p>
<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
</td></tr>
<tr><td style="background:#f0ede8;padding:24px 40px;text-align:center;">
<p style="margin:0;font-size:11px;color:#aca8a2;">Generated from your live store data · silkilinen.com/admin</p>
</td></tr>
</table></td></tr></table></body></html>`,
  });
}

module.exports = { sendOrderConfirmation, sendAdminOrderNotification, sendMagicLink, sendWelcome, sendNewsletterWelcome, sendProcessingEmail, sendShippedEmail, sendDeliveredEmail, sendCancelledEmail, sendDropAHint, sendCartRecoveryEmail, sendWinbackReminder, sendReviewRequest, sendAdvisorDigest };
