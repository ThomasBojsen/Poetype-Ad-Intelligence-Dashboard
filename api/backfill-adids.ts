import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}
const supabase = createClient(supabaseUrl, supabaseKey);

function parseAdId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/[?&]id=(\d+)/);
  return m ? m[1] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { data, error } = await supabase
      .from('ads')
      .select('id, ad_library_url, brand_ad_library_url, ad_id')
      .is('ad_id', null)
      .limit(1000);
    if (error) {
      console.error('Fetch ads error:', error);
      return res.status(500).json({ error: 'Failed to fetch ads' });
    }
    const updates = (data || []).map((row) => {
      const adId = parseAdId(row.ad_library_url) || parseAdId(row.brand_ad_library_url);
      if (!adId) return null;
      return { id: row.id, ad_id: adId };
    }).filter(Boolean) as any[];
    if (updates.length === 0) {
      return res.status(200).json({ success: true, updated: 0, message: 'No ad_ids parsed' });
    }
    const { error: upsertError } = await supabase.from('ads').upsert(updates, { onConflict: 'id' });
    if (upsertError) {
      console.error('Upsert ad_ids error:', upsertError);
      return res.status(500).json({ error: 'Failed to upsert ad_ids' });
    }
    return res.status(200).json({ success: true, updated: updates.length });
  } catch (err: any) {
    console.error('Unexpected backfill error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
