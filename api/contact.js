import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fname, lname, company, email, tier, message } = req.body;

  if (!fname || !company || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 1. Store in Supabase
  const { error: dbError } = await supabase
    .from('sponsor_inquiries')
    .insert([{ fname, lname, company, email, tier, message, created_at: new Date().toISOString() }]);

  if (dbError) {
    console.error('Supabase error:', dbError);
    return res.status(500).json({ error: 'Database error' });
  }

  // 2. Send email via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Team Deimos <onboarding@resend.dev>',
      to: ['robotronics@students.iitmandi.ac.in'],
      subject: `[Deimos Sponsor Inquiry] ${company} — ${tier || 'General'}`,
      html: `
        <div style="font-family:monospace;background:#080810;color:#f5f0e8;padding:32px;border-radius:8px;border:1px solid rgba(212,168,83,0.2)">
          <h2 style="color:#d4a853;margin-bottom:24px">New Sponsor Inquiry — Team Deimos</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#6e6b65;padding:8px 0;width:140px">Name</td><td style="color:#f5f0e8">${fname} ${lname || ''}</td></tr>
            <tr><td style="color:#6e6b65;padding:8px 0">Company</td><td style="color:#f5f0e8;font-weight:bold">${company}</td></tr>
            <tr><td style="color:#6e6b65;padding:8px 0">Email</td><td><a href="mailto:${email}" style="color:#c14412">${email}</a></td></tr>
            <tr><td style="color:#6e6b65;padding:8px 0">Tier Interest</td><td style="color:#d4a853">${tier || 'Not specified'}</td></tr>
            <tr><td style="color:#6e6b65;padding:8px 0;vertical-align:top">Message</td><td style="color:#f5f0e8">${message || '—'}</td></tr>
          </table>
          <hr style="border-color:rgba(212,168,83,0.15);margin:24px 0">
          <p style="color:#6e6b65;font-size:12px">Submitted via teamdeimos.vercel.app · ${new Date().toLocaleString('en-IN', {timeZone:'Asia/Kolkata'})}</p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    console.error('Resend error:', await emailRes.text());
    // Don't fail the whole request — submission is saved
  }

  return res.status(200).json({ success: true });
}
