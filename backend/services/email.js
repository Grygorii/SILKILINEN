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
  const itemsSubtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingCost = order.shippingCost || 0;
  const grandTotal = itemsSubtotal + shippingCost;
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
              <p style="margin:0;font-size:11px;color:#aca8a2;">Dublin, Ireland &nbsp;·&nbsp; Worldwide shipping</p>
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
  const grandTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0) + (order.shippingCost || 0);
  await getResend().emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New order #${id} — €${grandTotal.toFixed(2)}`,
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
<p style="margin:0;font-size:11px;color:#aca8a2;">Dublin, Ireland &nbsp;·&nbsp; hello@silkilinen.com</p>
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
<p style="margin:0 0 24px;font-size:13px;color:#5a5650;line-height:1.8;">Thank you for joining SILKILINEN. Every piece we make is crafted by hand in Dublin from pure silk and linen — made to be worn, felt, and loved.</p>
<p style="margin:0 0 36px;font-size:13px;color:#5a5650;line-height:1.8;">As a welcome gift, use code <strong style="color:#1a1916;letter-spacing:1px;">SILK10</strong> at checkout for 10% off your first order.</p>
<a href="https://silkilinen.vercel.app/shop" style="display:inline-block;background:#1a1916;color:#faf8f4;text-decoration:none;padding:14px 36px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Shop the collection</a>
</td></tr>
<tr><td style="background:#f0ede8;padding:24px 40px;text-align:center;">
<p style="margin:0;font-size:11px;color:#aca8a2;">Dublin, Ireland &nbsp;·&nbsp; hello@silkilinen.com</p>
</td></tr>
</table></td></tr></table></body></html>`,
  });
}

module.exports = { sendOrderConfirmation, sendAdminOrderNotification, sendMagicLink, sendWelcome };
