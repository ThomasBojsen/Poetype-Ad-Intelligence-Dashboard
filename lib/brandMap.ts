/** Map Meta ad account ID (with or without act_ prefix) to brand name. */
export const BRAND_BY_ACCOUNT_ID: Record<string, string> = {
  'act_160601090255453': 'Bottleswithhistory',
  '160601090255453': 'Bottleswithhistory',
  'act_291563024': 'Brugteski',
  '291563024': 'Brugteski',
  'act_4535200689936481': 'Danaure',
  '4535200689936481': 'Danaure',
  'act_132188028743186': 'Sneakerzone',
  '132188028743186': 'Sneakerzone',
  'act_1315885735242181': 'Hansen&Nissen',
  '1315885735242181': 'Hansen&Nissen',
  'act_1698660960387576': 'Langkilde&Søn',
  '1698660960387576': 'Langkilde&Søn',
  'act_455696865623438': 'Langkilde&Søn norge',
  '455696865623438': 'Langkilde&Søn norge',
  'act_261638895522837': 'Langkilde&Søn Sverige',
  '261638895522837': 'Langkilde&Søn Sverige',
  'act_317052092634318': 'Poetype',
  '317052092634318': 'Poetype',
  'act_10154295052743253': 'Zentabox',
  '10154295052743253': 'Zentabox',
};

export const ALL_BRAND_NAMES = [...new Set(Object.values(BRAND_BY_ACCOUNT_ID))].sort();

export function getBrandName(accountId: string | null | undefined): string {
  if (!accountId) return '—';
  const normalized = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  return BRAND_BY_ACCOUNT_ID[normalized] ?? BRAND_BY_ACCOUNT_ID[accountId] ?? accountId;
}
