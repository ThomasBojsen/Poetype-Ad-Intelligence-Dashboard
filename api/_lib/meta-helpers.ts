export const META_API_VERSION = 'v21.0';

export const PURCHASE_ACTION_PRIORITY = [
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'purchase',
];

export type ActionItem = { action_type?: string; value?: string | number };

/**
 * Meta returns the same conversion under multiple action types (purchase,
 * omni_purchase, offsite_conversion.fb_pixel_purchase). Summing all causes
 * 2-3x overcounting. Use only ONE canonical type, in priority order.
 */
export function getSinglePurchaseMetric(arr: ActionItem[] | undefined): number {
  if (!arr || !Array.isArray(arr)) return 0;
  for (const canonicalType of PURCHASE_ACTION_PRIORITY) {
    const item = arr.find((a) => String(a.action_type || '').toLowerCase() === canonicalType);
    if (item) {
      const val = Number(item.value ?? 0);
      return Number.isFinite(val) ? val : 0;
    }
  }
  return 0;
}

export type ClickRow = {
  outbound_clicks?: string | number | Array<{ action_type?: string; value?: string | number }>;
  inline_link_clicks?: string | number;
  clicks?: string | number;
  actions?: ActionItem[];
};

/** Extract outbound/link clicks from various Meta API response formats. Prefer outbound, fall back to link clicks. */
export function getClickCount(row: ClickRow): number {
  const ob = row?.outbound_clicks;
  if (ob != null) {
    if (typeof ob === 'number' && Number.isFinite(ob)) return ob;
    if (typeof ob === 'string') {
      const n = Number(ob);
      if (Number.isFinite(n)) return n;
    }
    if (Array.isArray(ob) && ob.length > 0) {
      const outboundItems = ob.filter((a) =>
        String(a?.action_type || '').toLowerCase().includes('outbound')
      );
      const toSum = outboundItems.length > 0 ? outboundItems : ob;
      const sum = toSum.reduce((acc, a) => {
        const v = a?.value ?? (a as unknown as number | string);
        const n = typeof v === 'number' ? v : Number(v);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);
      if (sum > 0) return sum;
      const v = ob[0]?.value ?? (ob[0] as unknown as number | string);
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  const item = row.actions?.find((a) =>
    ['outbound_click', 'link_click', 'inline_link_click'].includes(
      String(a.action_type || '').toLowerCase()
    )
  );
  if (item) {
    const n = Number(item.value ?? 0);
    if (Number.isFinite(n)) return n;
  }
  const inline = row?.inline_link_clicks;
  if (inline != null) {
    const n = typeof inline === 'number' ? inline : Number(inline);
    if (Number.isFinite(n)) return n;
  }
  const clicks = row?.clicks;
  if (clicks != null) {
    const n = typeof clicks === 'number' ? clicks : Number(clicks);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export type InsightsRow = ClickRow & {
  spend?: string | number;
  impressions?: string | number;
  actions?: ActionItem[];
  action_values?: ActionItem[];
  account_currency?: string;
};

export type ComputedMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  purchases: number;
  purchase_value: number;
  roas: number | null;
};

/** Single source of truth for ROAS and derived metrics. ROAS = purchase_value / spend (28d_click). */
export function computeMetrics(row: InsightsRow): ComputedMetrics {
  const spend = Math.max(0, Number(row.spend ?? 0));
  const impressions = Math.max(0, Number(row.impressions ?? 0));
  const clicks = getClickCount(row);
  const purchases = getSinglePurchaseMetric(row.actions);
  const purchase_value = getSinglePurchaseMetric(row.action_values);
  const roas =
    spend > 0 && Number.isFinite(purchase_value) ? purchase_value / spend : null;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  return { spend, impressions, clicks, cpm, cpc, ctr, purchases, purchase_value, roas };
}
