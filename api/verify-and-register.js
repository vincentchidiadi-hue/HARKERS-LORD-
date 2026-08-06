
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { full_name, email, phone, password, otp_code } = req.body || {};
  if (!email || !password || !otp_code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const code = String(otp_code).trim();

  try {
    // 1. verify OTP (otps.code column MUST be TEXT)
    const { data: otpRecords, error: otpError } = await supabase
      .from('otps')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('code', code)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpError) throw otpError;
    if (!otpRecords || otpRecords.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP code' });
    }

    // 2. duplicate check
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1);
    if (existing && existing.length) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // 3. hash + insert
    const hashedPassword = await bcrypt.hash(password, 10);
    const { error: userError } = await supabase.from('users').insert([
      {
        full_name,
        email: normalizedEmail,
        phone,
        password_hash: hashedPassword,
        is_verified: true
      }
    ]);
    if (userError) throw userError;

    // 4. clean up used OTP
    await supabase.from('otps').delete().eq('email', normalizedEmail);

    return res.status(200).json({ success: true, message: 'Account registered successfully!' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Registration failed' });
  }
}
