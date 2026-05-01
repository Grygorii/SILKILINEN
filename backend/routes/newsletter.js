const express = require('express');
const router = express.Router();

let _resend = null;
function getResend() {
  const { Resend } = require('resend');
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/subscribe', async function(req, res) {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.json({ success: true });
  }

  try {
    const resend = getResend();

    // Send welcome email to subscriber
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Welcome to SILKILINEN — your 10% discount inside',
      html: `
        <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #2a2825;">
          <div style="background: #2a2825; padding: 32px; text-align: center;">
            <h1 style="color: #faf8f4; font-weight: 400; letter-spacing: 4px; font-size: 22px; margin: 0;">SILKILINEN</h1>
          </div>
          <div style="padding: 40px 32px;">
            <h2 style="font-weight: 400; font-size: 26px; margin-bottom: 16px;">Welcome to the list.</h2>
            <p style="line-height: 1.8; color: #6a6660;">Thank you for joining the SILKILINEN community. As promised, here is your exclusive discount code:</p>
            <div style="background: #f5f0e8; border-left: 3px solid #2a2825; padding: 20px 24px; margin: 28px 0; text-align: center;">
              <p style="font-size: 28px; letter-spacing: 6px; font-weight: 600; margin: 0; color: #2a2825;">SILK10</p>
              <p style="font-size: 12px; color: #6a6660; margin: 8px 0 0; letter-spacing: 1px;">10% off your first order</p>
            </div>
            <p style="line-height: 1.8; color: #6a6660;">Enter this code at checkout to receive 10% off your first order. No minimum spend.</p>
            <p style="margin-top: 32px; line-height: 1.8; color: #6a6660;">With love,<br /><strong>The SILKILINEN team</strong></p>
          </div>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send welcome email' });
  }
});

module.exports = router;
