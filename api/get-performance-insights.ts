import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const { data, error } = await supabase
      .from('performance_insights')
      .select('*')
      .order('spend', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, ads: data || [] });
  } catch (err:any) {
    return res.status(500).json({ error: err.message });
  }
}
