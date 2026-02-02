import type { VercelRequest, VercelResponse } from '@vercel/node';

const metaToken = process.env.META_TOKEN;
const metaAccountsEnv = process.env.META_AD_ACCOUNTS || '';
const metaAccounts = metaAccountsEnv.split(',').map(s => s.trim()).filter(Boolean);

// Supabase (use only to store cached insights)
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!metaToken || metaAccounts.length === 0) return res.status(200).json({ success: true, message: 'No token/accounts' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  const datePreset = (req.body?.datePreset as string) || 'last_7d';
  const adLimit = Number(req.body?.adLimit || 30);

  const results: any[] = [];

  for (const act of metaAccounts) {
    try {
      // List ads for this account (limited)
      const listUrl = new URL(`https://graph.facebook.com/v19.0/${act}/ads`);
      listUrl.searchParams.set('fields', 'id,name,account_id');
      listUrl.searchParams.set('limit', String(adLimit));
      listUrl.searchParams.set('access_token', metaToken);
      const listResp = await fetch(listUrl.toString());
      if (!listResp.ok) {
        const txt = await listResp.text();
        results.push({ account: act, error: `list failed ${listResp.status}`, detail: txt });
        continue;
      }
      const listJson = await listResp.json();
      const ads = listJson.data || [];

      for (const ad of ads) {
        const insightsUrl = new URL(`https://graph.facebook.com/v19.0/${ad.id}/insights`);
        insightsUrl.searchParams.set('fields', 'spend,impressions,clicks,cpm,cpc,ctr,actions,action_values,purchase_roas,currency');
        insightsUrl.searchParams.set('date_preset', datePreset);
        insightsUrl.searchParams.set('access_token', metaToken);
        const iResp = await fetch(insightsUrl.toString());
        if (!iResp.ok) {
          const txt = await iResp.text();
          results.push({ account: act, ad_id: ad.id, error: `insights failed ${iResp.status}`, detail: txt });
          continue;
        }
        const iJson = await iResp.json();
        const first = iJson?.data?.[0];
        if (!first) {
          results.push({ account: act, ad_id: ad.id, info: 'no data' });
          continue;
        }
        const actions = first.actions || [];
        const actionValues = first.action_values || [];
        const purchaseRoas = first.purchase_roas && first.purchase_roas.length > 0 ? Number(first.purchase_roas[0].value || 0) : 0;
        const purchases = actions.filter((a:any)=>String(a.action_type||'').includes('purchase')).reduce((s:number,a:any)=>s+Number(a.value||0),0);
        const purchaseValue = actionValues.filter((a:any)=>String(a.action_type||'').includes('purchase')).reduce((s:number,a:any)=>s+Number(a.value||0),0);

        const row = {
          ad_id: ad.id,
          account_id: ad.account_id,
          name: ad.name,
          spend: Number(first.spend || 0),
          impressions: Number(first.impressions || 0),
          clicks: Number(first.clicks || 0),
          cpm: Number(first.cpm || 0),
          cpc: Number(first.cpc || 0),
          ctr: Number(first.ctr || 0),
          purchases,
          purchase_value: purchaseValue,
          roas: purchaseRoas,
          currency: first.currency,
          date_preset: datePreset,
          fetched_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from('performance_insights')
          .upsert(row, { onConflict: 'ad_id' });
        if (upsertError) {
          results.push({ account: act, ad_id: ad.id, error: 'upsert failed', detail: upsertError.message });
        } else {
          results.push({ account: act, ad_id: ad.id, ok: true });
        }
      }
    } catch (err:any) {
      results.push({ account: act, error: err.message });
    }
  }

  return res.status(200).json({ success: true, results });
}
