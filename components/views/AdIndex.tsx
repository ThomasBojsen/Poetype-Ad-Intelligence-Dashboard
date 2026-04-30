import React, { useEffect, useState, useMemo } from 'react';
import { AdData } from '../../types';
import { fetchPerformanceInsights, syncMetaInsights } from '../../services/adService';
import { ALL_BRAND_NAMES, getBrandName } from '../../lib/brandMap';
import {
  DollarSign,
  TrendingUp,
  Eye,
  MousePointer,
  Image as ImageIcon,
  Filter,
  Search,
  X,
  RefreshCw,
  Calendar,
  LayoutGrid,
  Rows,
  Play,
} from 'lucide-react';

const CURRENCY = 'kr';

function formatDateForInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start: formatDateForInput(start), end: formatDateForInput(end) };
}

function formatPeriod(raw: string | null | undefined): string {
  if (!raw) return '—';
  if (raw.includes(' - ')) return raw.replace(' - ', ' → ');
  if (raw.includes(' → ')) return raw;
  return raw.replace(/_/g, ' ');
}

function formatCompact(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '0';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const x = v / 1_000_000;
    return `${x.toFixed(x >= 10 ? 0 : 1).replace('.0', '')}M`;
  }
  if (abs >= 1_000) {
    const x = v / 1_000;
    return `${x.toFixed(x >= 10 ? 0 : 1).replace('.0', '')}K`;
  }
  return Math.round(v).toLocaleString();
}

function formatMoney(n: number | null | undefined): string {
  return `${CURRENCY} ${formatCompact(n)}`;
}

function formatDecimal(n: number | null | undefined, digits = 2): string {
  return n != null ? Number(n).toFixed(digits) : '—';
}

function formatPct(n: number | null | undefined): string {
  return n != null ? `${Number(n).toFixed(2)}%` : '—';
}

interface RoasStyle {
  label: string;
  classes: string;
}

function roasBucket(roas: number | null | undefined): RoasStyle {
  if (roas == null || !Number.isFinite(Number(roas))) {
    return { label: '—', classes: 'bg-stone-100 text-stone-400' };
  }
  const v = Number(roas);
  const label = v.toFixed(2);
  if (v < 1) return { label, classes: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' };
  if (v < 2) return { label, classes: 'bg-stone-100 text-stone-700' };
  if (v < 3) return { label, classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' };
  return { label, classes: 'bg-emerald-600 text-white font-semibold' };
}

const SpendBar: React.FC<{ value: number; max: number }> = ({ value, max }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1 mt-1 bg-stone-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-[#D6453D]/70 rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

const RoasPill: React.FC<{ roas: number | null | undefined; size?: 'sm' | 'md' }> = ({
  roas,
  size = 'sm',
}) => {
  const style = roasBucket(roas);
  const sizeClass = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center rounded-full tabular-nums ${sizeClass} ${style.classes}`}>
      {style.label}×
    </span>
  );
};

const CreativeBlock: React.FC<{ ad: AdData; aspect?: 'square' | 'video' }> = ({
  ad,
  aspect = 'square',
}) => {
  const isVideo = ad.creative_type === 'video';
  const aspectClass = aspect === 'video' ? 'aspect-video' : 'aspect-[5/4]';
  return (
    <div className={`${aspectClass} relative bg-stone-100 overflow-hidden`}>
      {ad.thumbnail && ad.thumbnail.trim() !== '' ? (
        <img
          src={ad.thumbnail}
          alt={ad.page_name || ''}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#FFF2EB]">
          <ImageIcon size={36} strokeWidth={1.5} className="text-stone-300" />
        </div>
      )}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/55 flex items-center justify-center backdrop-blur-sm">
            <Play size={22} className="text-white ml-0.5" fill="white" />
          </div>
        </div>
      )}
    </div>
  );
};

const AdCard: React.FC<{ ad: AdData }> = ({ ad }) => {
  const brand = getBrandName(ad.account_id);
  return (
    <div className="bg-white rounded-2xl border border-[#EADFD8] shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <CreativeBlock ad={ad} aspect="square" />
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
            {brand}
          </div>
          <div
            className="font-medium text-[#0B1221] text-sm truncate mt-0.5"
            title={ad.page_name || ad.id}
          >
            {ad.page_name || ad.id}
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-3 border-t border-[#EADFD8]">
          <MetricRow label="Spend" value={formatMoney(ad.spend)} />
          <MetricRow label="ROAS" valueNode={<RoasPill roas={ad.roas} />} />
          <MetricRow label="Purchases" value={(ad.purchases ?? 0).toLocaleString()} />
          <MetricRow label="Revenue" value={formatMoney(ad.purchase_value)} />
        </div>
      </div>
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value?: string; valueNode?: React.ReactNode }> = ({
  label,
  value,
  valueNode,
}) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="text-stone-500">{label}</span>
    {valueNode ?? (
      <span className="font-semibold tabular-nums text-[#0B1221]">{value}</span>
    )}
  </div>
);

type SortKey = 'spend' | 'roas' | 'purchases' | 'revenue';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'spend', label: 'Spend' },
  { key: 'roas', label: 'ROAS' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'revenue', label: 'Revenue' },
];

function getSortValue(ad: AdData, key: SortKey): number {
  switch (key) {
    case 'spend':
      return ad.spend ?? 0;
    case 'roas':
      return ad.roas ?? 0;
    case 'purchases':
      return ad.purchases ?? 0;
    case 'revenue':
      return ad.purchase_value ?? 0;
  }
}

interface SyncErrorEntry {
  account?: string;
  ad_id?: string;
  error: string;
}

interface SyncReport {
  ok: number;
  skipped: number;
  errors: SyncErrorEntry[];
  fatal?: string | null;
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

type ViewMode = 'cards' | 'table';

const AdIndex: React.FC = () => {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [ads, setAds] = useState<AdData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [dateStart, setDateStart] = useState(defaultRange.start);
  const [dateEnd, setDateEnd] = useState(defaultRange.end);
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<AdIndexFilters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

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
    setSyncReport(null);
    setSyncProgress({ done: 0, total: 0 });
    const aggregatedErrors: SyncErrorEntry[] = [];
    let totalSynced = 0;
    let totalSkipped = 0;
    let offset = 0;
    let fatal: string | null = null;
    try {
      for (;;) {
        const json = await syncMetaInsights({
          since: dateStart,
          until: dateEnd,
          accountOffset: offset,
          accountsPerBatch: 1,
          maxAdsPerAccount: 100,
        });
        if (!json.success) {
          fatal = json.error || 'Sync failed';
          break;
        }
        totalSynced += json.synced ?? 0;
        totalSkipped += json.skipped ?? 0;
        if (json.errors) aggregatedErrors.push(...json.errors);
        const nextOffset = json.accountOffset ?? offset + 1;
        const total = json.totalAccounts ?? 0;
        setSyncProgress({ done: nextOffset, total });
        if (!json.hasMore || nextOffset >= total) {
          break;
        }
        offset = nextOffset;
      }
      await loadData();
    } catch (e) {
      fatal = e instanceof Error ? e.message : 'Network error';
    } finally {
      setSyncReport({
        ok: totalSynced,
        skipped: totalSkipped,
        errors: aggregatedErrors,
        fatal,
      });
      setSyncing(false);
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
    return [...filteredAds].sort((a, b) => {
      const cmp = getSortValue(a, sortKey) - getSortValue(b, sortKey);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredAds, sortKey, sortDir]);

  const maxSpend = useMemo(
    () => filteredAds.reduce((m, a) => Math.max(m, a.spend ?? 0), 0),
    [filteredAds]
  );

  const totalSpend = filteredAds.reduce((s, a) => s + (a.spend ?? 0), 0);
  const totalImpressions = filteredAds.reduce((s, a) => s + (a.impressions ?? 0), 0);
  const totalClicks = filteredAds.reduce((s, a) => s + (a.clicks ?? 0), 0);
  const globalRoas =
    totalSpend > 0
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

  const metricCards = [
    { label: 'Total Spend', value: formatMoney(totalSpend), icon: DollarSign },
    { label: 'Global ROAS', value: `${globalRoas.toFixed(2)}×`, icon: TrendingUp },
    { label: 'Total Impressions', value: formatCompact(totalImpressions), icon: Eye },
    { label: 'Outbound Clicks', value: formatCompact(totalClicks), icon: MousePointer },
  ];

  const syncButtonLabel = syncing
    ? syncProgress && syncProgress.total > 0
      ? `Syncing ${syncProgress.done}/${syncProgress.total}...`
      : 'Syncing...'
    : 'Sync from Meta';

  const handleHeaderSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF2EB] min-h-0">
      <div className="max-w-7xl mx-auto px-8 py-10">
        <header className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                {syncButtonLabel}
              </button>
              {syncReport && (
                <div className="text-sm flex flex-col items-start sm:items-end gap-1 max-w-md">
                  {syncReport.fatal ? (
                    <p className="text-amber-700">{syncReport.fatal}</p>
                  ) : (
                    <p className="text-stone-600">
                      {syncReport.ok > 0
                        ? `Synced ${syncReport.ok} ad(s)${
                            syncReport.skipped > 0
                              ? `; ${syncReport.skipped} had no activity in this period`
                              : ''
                          }.`
                        : syncReport.skipped > 0
                        ? `${syncReport.skipped} ad(s) had no activity in this period.`
                        : 'No new data.'}
                    </p>
                  )}
                  {syncReport.errors.length > 0 && (
                    <details className="text-xs text-amber-700 w-full">
                      <summary className="cursor-pointer">
                        {syncReport.errors.length} error(s) — click to expand
                      </summary>
                      <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto pr-2">
                        {syncReport.errors.map((e, i) => (
                          <li key={i} className="font-mono">
                            {e.account ?? '?'}/{e.ad_id ?? '—'}: {e.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-[#EADFD8] bg-white/80">
            <div className="flex items-center gap-2 text-stone-600">
              <Calendar size={18} strokeWidth={1.5} className="text-[#D6453D]" />
              <span className="text-sm font-medium">Data period</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-sm text-stone-500 whitespace-nowrap">From</span>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  max={dateEnd}
                  className="px-3 py-2 border border-[#EADFD8] rounded-lg text-sm focus:ring-2 focus:ring-[#D6453D]/20 focus:border-[#D6453D]"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm text-stone-500 whitespace-nowrap">To</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  min={dateStart}
                  max={formatDateForInput(new Date())}
                  className="px-3 py-2 border border-[#EADFD8] rounded-lg text-sm focus:ring-2 focus:ring-[#D6453D]/20 focus:border-[#D6453D]"
                />
              </label>
            </div>
            <p className="text-xs text-stone-400">
              Sync will fetch insights for this range. Default: last 30 days.
            </p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {metricCards.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="bg-white p-6 rounded-2xl border border-[#EADFD8] shadow-sm flex items-center gap-5"
                >
                  <div className="w-14 h-14 rounded-xl bg-[#FFF2EB] flex items-center justify-center text-[#D6453D] flex-shrink-0">
                    <Icon size={28} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                      {label}
                    </p>
                    <p className="text-2xl font-semibold tracking-tight text-[#0B1221] truncate tabular-nums">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Sort
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SORT_OPTIONS.map((opt) => {
                    const active = sortKey === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleHeaderSort(opt.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          active
                            ? 'bg-[#0B1221] text-white'
                            : 'bg-white border border-[#EADFD8] text-stone-600 hover:text-[#0B1221]'
                        }`}
                      >
                        {opt.label} {active && (sortDir === 'desc' ? '↓' : '↑')}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="inline-flex items-center bg-white border border-[#EADFD8] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-[#0B1221] text-white'
                      : 'text-stone-500 hover:text-[#0B1221]'
                  }`}
                  title="Card view"
                >
                  <LayoutGrid size={14} strokeWidth={2} />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'table'
                      ? 'bg-[#0B1221] text-white'
                      : 'text-stone-500 hover:text-[#0B1221]'
                  }`}
                  title="Dense table"
                >
                  <Rows size={14} strokeWidth={2} />
                  Table
                </button>
              </div>
            </div>

            {sortedAds.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#EADFD8] shadow-sm py-16 text-center text-stone-500">
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
            ) : viewMode === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {sortedAds.map((ad) => (
                  <AdCard key={ad.id} ad={ad} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#EADFD8] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="border-b border-[#EADFD8] bg-[#FFF8F5] text-xs font-semibold uppercase tracking-wider text-stone-500">
                        <th className="text-left pl-6 pr-3 py-3 w-[88px]">Creative</th>
                        <th className="text-left px-3 py-3">Ad</th>
                        <th className="text-right px-3 py-3 w-[140px]">
                          <button
                            type="button"
                            onClick={() => handleHeaderSort('spend')}
                            className="inline-flex items-center gap-1 hover:text-[#D6453D] font-semibold uppercase tracking-wider"
                          >
                            Spend
                            {sortKey === 'spend' && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                          </button>
                        </th>
                        <th className="text-right px-3 py-3 w-[80px]">
                          <button
                            type="button"
                            onClick={() => handleHeaderSort('roas')}
                            className="inline-flex items-center gap-1 hover:text-[#D6453D] font-semibold uppercase tracking-wider"
                          >
                            ROAS
                            {sortKey === 'roas' && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                          </button>
                        </th>
                        <th className="text-right px-3 py-3">Purchases</th>
                        <th className="text-right px-3 py-3">Revenue</th>
                        <th className="text-right px-3 py-3">CPM</th>
                        <th className="text-right px-3 py-3">CPC</th>
                        <th className="text-right px-3 py-3">CTR</th>
                        <th className="text-right px-3 py-3">Impr.</th>
                        <th className="text-right px-3 py-3">Out. Clicks</th>
                        <th className="text-left pl-3 pr-6 py-3 text-[10px]">Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAds.map((row) => {
                        const brand = getBrandName(row.account_id);
                        const isVideo = row.creative_type === 'video';
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-[#EADFD8] hover:bg-[#FFF8F5] transition-colors"
                          >
                            <td className="pl-6 pr-3 py-3 align-top">
                              <div className="flex flex-col items-start gap-1">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-stone-100">
                                  {row.thumbnail && row.thumbnail.trim() !== '' ? (
                                    <img
                                      src={row.thumbnail}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#FFF2EB] border border-[#EADFD8]">
                                      <ImageIcon size={20} className="text-stone-400" />
                                    </div>
                                  )}
                                  {isVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                                        <Play size={12} className="text-white ml-0.5" fill="white" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <span className="inline-block max-w-[64px] truncate text-[10px] font-medium uppercase tracking-wider text-stone-500">
                                  {brand}
                                </span>
                              </div>
                            </td>
                            <td
                              className="px-3 py-3 align-top text-stone-700 max-w-[240px]"
                              title={row.page_name || row.id}
                            >
                              <div className="truncate font-medium text-[#0B1221]">
                                {row.page_name || row.id}
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top text-right">
                              <div className="font-semibold text-[#0B1221]">
                                {formatMoney(row.spend)}
                              </div>
                              <SpendBar value={row.spend ?? 0} max={maxSpend} />
                            </td>
                            <td className="px-3 py-3 align-top text-right">
                              <RoasPill roas={row.roas} />
                            </td>
                            <td className="px-3 py-3 align-top text-right text-stone-700">
                              {(row.purchases ?? 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-3 align-top text-right text-stone-700">
                              {formatMoney(row.purchase_value)}
                            </td>
                            <td className="px-3 py-3 align-top text-right text-stone-700">
                              {formatDecimal(row.cpm)}
                            </td>
                            <td className="px-3 py-3 align-top text-right text-stone-700">
                              {formatDecimal(row.cpc)}
                            </td>
                            <td className="px-3 py-3 align-top text-right text-stone-700">
                              {formatPct(row.ctr)}
                            </td>
                            <td className="px-3 py-3 align-top text-right text-stone-700">
                              {formatCompact(row.impressions)}
                            </td>
                            <td className="px-3 py-3 align-top text-right text-stone-700">
                              {formatCompact(row.clicks)}
                            </td>
                            <td
                              className="pl-3 pr-6 py-3 align-top text-stone-500 text-[10px] whitespace-nowrap"
                              title={row.insights_date_preset ?? undefined}
                            >
                              {formatPeriod(row.insights_date_preset)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdIndex;
