
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: dbError } = await supabase.from('otps').insert([
      { email, code: otpCode, expires_at: expiresAt }
    ]);
    if (dbError) throw dbError;

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Your Verification Code',
      html: `<p>Your OTP code is: <strong>${otpCode}</strong>. It expires in 5 minutes.</p>`
    });

    return res.status(200).json({ success: true, message: 'OTP sent to email' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
