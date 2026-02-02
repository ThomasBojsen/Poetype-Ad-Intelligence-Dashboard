import React, { useEffect, useState, useMemo } from 'react';
import { AdData } from '../../types';
import { fetchPerformanceInsights } from '../../services/adService';
import { DollarSign, TrendingUp, Eye, MousePointer, Image as ImageIcon, Filter, Search, X, RefreshCw } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type SortKey = 'spend' | 'roas' | null;
type SortDir = 'asc' | 'desc';

const CURRENCY = 'DKK';

/** Map Meta ad account ID (with or without act_ prefix) to brand name. */
const BRAND_BY_ACCOUNT_ID: Record<string, string> = {
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

const ALL_BRAND_NAMES = [...new Set(Object.values(BRAND_BY_ACCOUNT_ID))].sort();

function getBrandName(accountId: string | null | undefined): string {
  if (!accountId) return '—';
  const normalized = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  return BRAND_BY_ACCOUNT_ID[normalized] ?? BRAND_BY_ACCOUNT_ID[accountId] ?? accountId;
}

interface AdIndexFilters {
  selectedBrands: string[];
  minSpend: number | '';
  maxSpend: number | '';
  minRoas: number | '';
  searchQuery: string;
}

const defaultFilters: AdIndexFilters = {
  selectedBrands: [],
  minSpend: '',
  maxSpend: '',
  minRoas: '',
  searchQuery: '',
};

const AdIndex: React.FC = () => {
  const [ads, setAds] = useState<AdData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<AdIndexFilters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchPerformanceInsights();
      setAds(result.ads ?? []);
    } catch (e) {
      console.error(e);
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    let totalSynced = 0;
    let offset = 0;
    try {
      for (;;) {
        const res = await fetch(`${API_BASE_URL}/sync-meta-insights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountOffset: offset,
            accountsPerBatch: 3,
            maxAdsPerAccount: 20,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSyncMessage((json.error as string) || res.statusText || 'Sync failed');
          break;
        }
        totalSynced += json.synced ?? 0;
        const nextOffset = json.accountOffset ?? offset + 3;
        if (!json.hasMore || nextOffset >= (json.totalAccounts ?? 0)) {
          setSyncMessage(
            totalSynced > 0
              ? `Synced ${totalSynced} ad(s) across all brands.`
              : (json.message as string) || 'No new data.'
          );
          break;
        }
        offset = nextOffset;
      }
      await loadData();
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      const brand = getBrandName(ad.account_id);
      if (filters.selectedBrands.length > 0 && !filters.selectedBrands.includes(brand)) return false;
      const spend = Number(ad.spend ?? 0);
      if (filters.minSpend !== '' && spend < Number(filters.minSpend)) return false;
      if (filters.maxSpend !== '' && spend > Number(filters.maxSpend)) return false;
      const roas = ad.roas != null ? Number(ad.roas) : null;
      if (filters.minRoas !== '' && (roas == null || roas < Number(filters.minRoas))) return false;
      const q = filters.searchQuery.trim().toLowerCase();
      if (q) {
        const name = (ad.page_name || ad.id || '').toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [ads, filters]);

  const sortedAds = useMemo(() => {
    if (!sortKey) return filteredAds;
    return [...filteredAds].sort((a, b) => {
      const aVal = sortKey === 'spend' ? (a.spend ?? 0) : (a.roas ?? 0);
      const bVal = sortKey === 'spend' ? (b.spend ?? 0) : (b.roas ?? 0);
      const cmp = aVal - bVal;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredAds, sortKey, sortDir]);

  const totalSpend = filteredAds.reduce((s, a) => s + (a.spend ?? 0), 0);
  const totalImpressions = filteredAds.reduce((s, a) => s + (a.impressions ?? 0), 0);
  const totalClicks = filteredAds.reduce((s, a) => s + (a.clicks ?? 0), 0);
  const globalRoas = totalSpend > 0
    ? filteredAds.reduce((s, a) => s + (a.purchase_value ?? 0), 0) / totalSpend
    : 0;

  const hasActiveFilters =
    filters.selectedBrands.length > 0 ||
    filters.minSpend !== '' ||
    filters.maxSpend !== '' ||
    filters.minRoas !== '' ||
    filters.searchQuery.trim() !== '';

  const clearFilters = () => setFilters(defaultFilters);

  const toggleBrand = (brand: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedBrands: prev.selectedBrands.includes(brand)
        ? prev.selectedBrands.filter((b) => b !== brand)
        : [...prev.selectedBrands, brand],
    }));
  };

  const formatCurrency = (n: number) =>
    `${CURRENCY} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatPct = (n: number | null | undefined) =>
    n != null ? `${Number(n).toFixed(2)}%` : '—';

  const metricCards = [
    { label: 'Total Spend', value: formatCurrency(totalSpend), icon: DollarSign },
    { label: 'Global ROAS', value: globalRoas.toFixed(2), icon: TrendingUp },
    { label: 'Total Impressions', value: totalImpressions.toLocaleString(), icon: Eye },
    { label: 'Total Clicks', value: totalClicks.toLocaleString(), icon: MousePointer },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF2EB] min-h-0">
      <div className="max-w-7xl mx-auto px-8 py-10">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#0B1221]">Ad Index</h1>
            <p className="text-stone-500 mt-1">Performance data from your Meta Ads</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#0B1221] text-white hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={16} strokeWidth={1.5} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing all brands...' : 'Sync from Meta'}
            </button>
            {syncMessage && (
              <p className={`text-sm ${syncMessage.startsWith('Synced') ? 'text-stone-600' : 'text-amber-700'}`}>
                {syncMessage}
              </p>
            )}
          </div>
        </header>

        {!loading && (
          <div className="mb-6 bg-white rounded-xl border border-[#EADFD8] shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium text-stone-700 hover:bg-[#FFF8F5] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Filter size={18} strokeWidth={1.5} className="text-[#D6453D]" />
                Filtre
                {hasActiveFilters && (
                  <span className="bg-[#D6453D] text-white text-xs px-2 py-0.5 rounded-full">
                    {filters.selectedBrands.length +
                      (filters.minSpend !== '' ? 1 : 0) +
                      (filters.maxSpend !== '' ? 1 : 0) +
                      (filters.minRoas !== '' ? 1 : 0) +
                      (filters.searchQuery.trim() ? 1 : 0)}
                  </span>
                )}
              </span>
              <span className="text-stone-400">{filtersOpen ? '▼' : '▶'}</span>
            </button>
            {filtersOpen && (
              <div className="px-4 pb-4 pt-0 border-t border-[#EADFD8] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Brand</label>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 border border-[#EADFD8] rounded-lg p-2 bg-stone-50/50">
                      {ALL_BRAND_NAMES.map((brand) => (
                        <label key={brand} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.selectedBrands.includes(brand)}
                            onChange={() => toggleBrand(brand)}
                            className="rounded border-stone-300 text-[#D6453D] focus:ring-[#D6453D]"
                          />
                          <span className="text-sm text-stone-700 group-hover:text-[#0B1221]">{brand}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-stone-400 mt-1">Vælg ingen = alle brands</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Søg i ad-navn</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        value={filters.searchQuery}
                        onChange={(e) => setFilters((p) => ({ ...p, searchQuery: e.target.value }))}
                        placeholder="Søg..."
                        className="w-full pl-9 pr-3 py-2 border border-[#EADFD8] rounded-lg text-sm focus:ring-2 focus:ring-[#D6453D]/20 focus:border-[#D6453D]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Spend (min – max)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={filters.minSpend}
                        onChange={(e) => setFilters((p) => ({ ...p, minSpend: e.target.value === '' ? '' : Number(e.target.value) }))}
                        placeholder="Min"
                        className="w-full px-3 py-2 border border-[#EADFD8] rounded-lg text-sm focus:ring-2 focus:ring-[#D6453D]/20 focus:border-[#D6453D]"
                      />
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={filters.maxSpend}
                        onChange={(e) => setFilters((p) => ({ ...p, maxSpend: e.target.value === '' ? '' : Number(e.target.value) }))}
                        placeholder="Max"
                        className="w-full px-3 py-2 border border-[#EADFD8] rounded-lg text-sm focus:ring-2 focus:ring-[#D6453D]/20 focus:border-[#D6453D]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Min. ROAS</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={filters.minRoas}
                      onChange={(e) => setFilters((p) => ({ ...p, minRoas: e.target.value === '' ? '' : Number(e.target.value) }))}
                      placeholder="f.eks. 2.0"
                      className="w-full px-3 py-2 border border-[#EADFD8] rounded-lg text-sm focus:ring-2 focus:ring-[#D6453D]/20 focus:border-[#D6453D]"
                    />
                  </div>
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-[#D6453D] transition-colors"
                  >
                    <X size={16} />
                    Nulstil filtre
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-12 w-12 rounded-full border-2 border-[#EADFD8] border-t-[#D6453D] animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {metricCards.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="bg-white p-6 rounded-2xl border border-[#EADFD8] shadow-sm flex items-center gap-5"
                >
                  <div className="w-14 h-14 rounded-xl bg-[#FFF2EB] flex items-center justify-center text-[#D6453D] flex-shrink-0">
                    <Icon size={28} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">{label}</p>
                    <p className="text-2xl font-semibold tracking-tight text-[#0B1221] truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#EADFD8] shadow-sm overflow-hidden">
              {sortedAds.length === 0 ? (
                <div className="py-16 text-center text-stone-500">
                  <ImageIcon size={48} className="mx-auto mb-3 opacity-40 text-[#D6453D]" />
                  <p className="font-medium">
                    {ads.length === 0
                      ? 'Ingen performance data'
                      : 'Ingen annoncer matcher dine filtre'}
                  </p>
                  <p className="text-sm mt-1">
                    {ads.length === 0
                      ? 'Kør sync fra Meta for at hente indsigt.'
                      : 'Prøv at ændre eller nulstille filtrene.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#EADFD8] bg-[#FFF8F5]">
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-stone-500 pl-6 pr-4 py-4 w-24">Creative</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-stone-500 px-4 py-4">Brand</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-stone-500 px-4 py-4">Ad Name</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-stone-500 px-4 py-4">
                          <button
                            type="button"
                            onClick={() => handleSort('spend')}
                            className="inline-flex items-center gap-1 hover:text-[#D6453D] font-semibold"
                          >
                            Spend
                            {sortKey === 'spend' && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                          </button>
                        </th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-stone-500 px-4 py-4">
                          <button
                            type="button"
                            onClick={() => handleSort('roas')}
                            className="inline-flex items-center gap-1 hover:text-[#D6453D] font-semibold"
                          >
                            ROAS
                            {sortKey === 'roas' && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                          </button>
                        </th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-stone-500 px-4 py-4">CTR</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-stone-500 px-4 py-4">Impressions</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-stone-500 pl-4 pr-6 py-4">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAds.map((row) => {
                        const roasVal = row.roas != null ? Number(row.roas) : null;
                        const roasHigh = roasVal != null && roasVal > 2.0;
                        return (
                          <tr key={row.id} className="border-b border-[#EADFD8] hover:bg-[#FFF8F5] transition-colors">
                            <td className="pl-6 pr-4 py-3">
                              {row.thumbnail && row.thumbnail.trim() !== '' ? (
                                <img
                                  src={row.thumbnail}
                                  alt=""
                                  className="w-16 h-16 object-cover rounded-lg bg-stone-100"
                                />
                              ) : row.video_url && row.video_url.trim() !== '' ? (
                                <div className="w-16 h-16 rounded-lg bg-stone-200 flex items-center justify-center text-stone-400">
                                  <span className="text-xs">Video</span>
                                </div>
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-[#FFF2EB] border border-[#EADFD8] flex items-center justify-center text-stone-400">
                                  <ImageIcon size={20} />
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium text-[#0B1221] whitespace-nowrap">
                              {getBrandName(row.account_id)}
                            </td>
                            <td className="px-4 py-3 text-stone-700 max-w-[220px] truncate" title={row.page_name || row.id}>
                              {row.page_name || row.id}
                            </td>
                            <td className="px-4 py-3 text-stone-700">
                              {formatCurrency(Number(row.spend ?? 0))}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={
                                  roasHigh
                                    ? 'font-bold text-emerald-600'
                                    : 'text-stone-700'
                                }
                              >
                                {roasVal != null ? Number(roasVal).toFixed(2) : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-stone-700">{formatPct(row.ctr)}</td>
                            <td className="px-4 py-3 text-stone-700">
                              {(row.impressions ?? 0).toLocaleString()}
                            </td>
                            <td className="pl-4 pr-6 py-3 text-stone-700">
                              {(row.clicks ?? 0).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdIndex;
