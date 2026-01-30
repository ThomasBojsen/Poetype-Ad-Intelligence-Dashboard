import type { VercelRequest, VercelResponse } from '@vercel/node';

const metaToken = process.env.META_TOKEN;
const metaAccountsEnv = process.env.META_AD_ACCOUNTS || '';
const metaAccounts = metaAccountsEnv.split(',').map(s=>s.trim()).filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!metaToken || metaAccounts.length === 0) return res.status(200).json({ success: true, ads: [], count: 0, message: 'No token/accounts' });

  const datePreset = (req.query.datePreset as string) || 'last_7d';
  const limit = Number(req.query.limit || 20);

  try {
    // Take first account only
    const act = metaAccounts[0];
    const listUrl = new URL(`https://graph.facebook.com/v19.0/${act}/ads`);
    listUrl.searchParams.set('fields', 'id,name,account_id');
    listUrl.searchParams.set('limit', String(limit));
    listUrl.searchParams.set('access_token', metaToken);
    const listResp = await fetch(listUrl.toString());
    if (!listResp.ok) {
      const txt = await listResp.text();
      return res.status(500).json({ error: 'List ads failed', detail: txt });
    }
    const listJson = await listResp.json();
    const ads = listJson.data || [];

    const results: any[] = [];
    for (const ad of ads) {
      const insightsUrl = new URL(`https://graph.facebook.com/v19.0/${ad.id}/insights`);
      insightsUrl.searchParams.set('fields', 'spend,impressions,clicks,cpm,cpc,ctr,actions,action_values,purchase_roas,currency');
      insightsUrl.searchParams.set('date_preset', datePreset);
      insightsUrl.searchParams.set('access_token', metaToken);
      const iResp = await fetch(insightsUrl.toString());
      if (!iResp.ok) continue;
      const iJson = await iResp.json();
      const first = iJson?.data?.[0];
      if (!first) continue;
      const actions = first.actions || [];
      const actionValues = first.action_values || [];
      const purchaseRoas = first.purchase_roas && first.purchase_roas.length > 0 ? Number(first.purchase_roas[0].value || 0) : 0;
      const purchases = actions.filter((a:any)=>String(a.action_type||'').includes('purchase')).reduce((s:number,a:any)=>s+Number(a.value||0),0);
      const purchaseValue = actionValues.filter((a:any)=>String(a.action_type||'').includes('purchase')).reduce((s:number,a:any)=>s+Number(a.value||0),0);
      results.push({
        ad_id: ad.id,
        name: ad.name,
        account_id: ad.account_id,
        spend: Number(first.spend||0),
        impressions: Number(first.impressions||0),
        clicks: Number(first.clicks||0),
        cpm: Number(first.cpm||0),
        cpc: Number(first.cpc||0),
        ctr: Number(first.ctr||0),
        purchases,
        purchase_value: purchaseValue,
        roas: purchaseRoas,
        currency: first.currency,
        date_preset: datePreset,
      });
    }

    return res.status(200).json({ success: true, ads: results, count: results.length });
  } catch (err: any) {
    console.error('direct insights error', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
