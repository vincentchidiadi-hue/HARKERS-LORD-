
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// IMPORTANT: use a verified sender domain, NOT onboarding@resend.dev
const FROM = process.env.MAIL_FROM || 'Vankleff Global <noreply@your-verified-domain.com>';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const normalized = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // clear old codes for this email first
    await supabase.from('otps').delete().eq('email', normalized);

    const { error: dbError } = await supabase.from('otps').insert([
      { email: normalized, code: otpCode, expires_at: expiresAt }
    ]);
    if (dbError) throw dbError;

    const { error: mailError } = await resend.emails.send({
      from: FROM,
      to: normalized,
      subject: 'Your Vankleff Global Verification Code',
      html: `<p>Your verification code is: <strong style="font-size:22px;letter-spacing:3px">${otpCode}</strong></p><p>It expires in 5 minutes. If you didn't request this, ignore this email.</p>`
    });
    if (mailError) throw mailError;

    return res.status(200).json({ success: true, message: 'OTP sent to email' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to send OTP' });
  }
}
