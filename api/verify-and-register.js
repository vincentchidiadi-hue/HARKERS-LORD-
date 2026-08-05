
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { full_name, email, phone, password, otp_code } = req.body;

  try {
    const { data: otpRecords, error: otpError } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .eq('code', otp_code)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpError || !otpRecords || otpRecords.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP code' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { error: userError } = await supabase.from('users').insert([
      {
        full_name,
        email,
        phone,
        password_hash: hashedPassword,
        is_verified: true
      }
    ]);

    if (userError) throw userError;

    await supabase.from('otps').delete().eq('email', email);

    return res.status(200).json({ success: true, message: 'Account registered successfully!' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
