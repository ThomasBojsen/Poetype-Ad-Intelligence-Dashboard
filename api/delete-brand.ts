import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST and DELETE requests
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, brandId } = req.body;

    // Validate input
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required and must be a string' });
    }

    if (!brandId || (typeof brandId !== 'string' && typeof brandId !== 'number')) {
      return res.status(400).json({ error: 'brandId is required and must be a string or number' });
    }

    // First, verify the brand belongs to this session
    const { data: brand, error: fetchError } = await supabase
      .from('brands')
      .select('id, session_id')
      .eq('id', brandId)
      .eq('session_id', sessionId)
      .single();

    if (fetchError || !brand) {
      return res.status(404).json({ error: 'Brand not found or does not belong to this session' });
    }

    // Soft delete: Set is_active to false (preserves data integrity)
    const { error: updateError } = await supabase
      .from('brands')
      .update({ is_active: false })
      .eq('id', brandId)
      .eq('session_id', sessionId);

    if (updateError) {
      console.error('Error deleting brand:', updateError);
      return res.status(500).json({ error: 'Failed to delete brand', details: updateError.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Brand deleted successfully',
    });
  } catch (error: any) {
    console.error('Unexpected error in delete-brand:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

