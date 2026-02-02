import React, { useEffect, useState, useMemo } from 'react';
import { PerformanceInsight } from '../types';
import { fetchPerformanceInsightsList } from '../services/adService';
import {
  DollarSign,
  TrendingUp,
  Eye,
  MousePointer,
  ShoppingCart,
  BarChart3,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type SortKey = keyof PerformanceInsight | null;
type SortDir = 'asc' | 'desc';

const AdIndex: React.FC = () => {
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const loadInsights = async () => {
    setLoading(true);
    try {
      const data = await fetchPerformanceInsightsList();
      setInsights(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedInsights = useMemo(() => {
    if (!sortKey) return insights;
    return [...insights].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const aNum = typeof aVal === 'number' ? aVal : 0;
      const bNum = typeof bVal === 'number' ? bVal : 0;
      const cmp = aNum - bNum;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [insights, sortKey, sortDir]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sync-meta-insights`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        await loadInsights();
      }
    } finally {
      setSyncing(false);
    }
  };

  const totalSpend = insights.reduce((s, i) => s + (i.spend ?? 0), 0);
  const totalImpressions = insights.reduce((s, i) => s + (i.impressions ?? 0), 0);
  const totalClicks = insights.reduce((s, i) => s + (i.clicks ?? 0), 0);
  const totalPurchases = insights.reduce((s, i) => s + (i.purchases ?? 0), 0);
  const totalPurchaseValue = insights.reduce((s, i) => s + (i.purchase_value ?? 0), 0);
  const weightedRoas = totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
  const withRoas = insights.filter((i) => i.roas != null && Number.isFinite(i.roas));
  const avgRoas = withRoas.length > 0 ? withRoas.reduce((s, i) => s + (i.roas ?? 0), 0) / withRoas.length : 0;
  const displayRoas = totalSpend > 0 ? weightedRoas : avgRoas;

  const formatNum = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString());
  const formatCurrency = (n: number, currency?: string | null) =>
    `${currency || 'DKK'} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const cards = [
    {
      label: 'Total Spend',
      value: formatCurrency(totalSpend, insights[0]?.currency),
      icon: <DollarSign size={22} strokeWidth={1.5} />,
    },
    {
      label: 'ROAS',
      value: displayRoas.toFixed(2),
      icon: <TrendingUp size={22} strokeWidth={1.5} />,
    },
    {
      label: 'Impressions',
      value: formatNum(totalImpressions),
      icon: <Eye size={22} strokeWidth={1.5} />,
    },
    {
      label: 'Clicks',
      value: formatNum(totalClicks),
      icon: <MousePointer size={22} strokeWidth={1.5} />,
    },
    {
      label: 'Purchases',
      value: formatNum(totalPurchases),
      icon: <ShoppingCart size={22} strokeWidth={1.5} />,
    },
    {
      label: 'Purchase Value',
      value: formatCurrency(totalPurchaseValue, insights[0]?.currency),
      icon: <BarChart3 size={22} strokeWidth={1.5} />,
    },
  ];

  const Th = ({
    label,
    sortKeyName,
    className = '',
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) => (
    <th className={`text-left text-xs font-semibold uppercase tracking-wider text-stone-500 whitespace-nowrap ${className}`}>
      <button
        type="button"
        onClick={() => handleSort(sortKeyName)}
        className="inline-flex items-center gap-1 hover:text-stone-800"
      >
        {label}
        {sortKey === sortKeyName ? (
          sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
        ) : (
          <ArrowUpDown size={14} className="opacity-50" />
        )}
      </button>
    </th>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50/80 min-h-0">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Ad Index</h1>
            <p className="text-sm text-stone-500 mt-0.5">Meta Ads performance from your connected accounts</p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={16} strokeWidth={1.5} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync from Meta'}
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-10 w-10 rounded-full border-2 border-stone-300 border-t-stone-900 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className="bg-white rounded-xl border border-stone-200/80 shadow-sm p-5 flex items-center gap-4"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600">
                    {card.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-400">{card.label}</p>
                    <p className="text-lg font-semibold text-stone-900 truncate">{card.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-stone-200/80 shadow-sm overflow-hidden">
              {sortedInsights.length === 0 ? (
                <div className="py-16 text-center text-stone-500">
                  <BarChart3 size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No performance data yet</p>
                  <p className="text-sm mt-1">Use &quot;Sync from Meta&quot; to pull the latest insights.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50/80">
                        <Th label="Ad" sortKeyName="name" className="pl-6 pr-4 py-4" />
                        <Th label="Account" sortKeyName="account_id" className="px-4 py-4" />
                        <Th label="Spend" sortKeyName="spend" className="px-4 py-4" />
                        <Th label="Impressions" sortKeyName="impressions" className="px-4 py-4" />
                        <Th label="Clicks" sortKeyName="clicks" className="px-4 py-4" />
                        <Th label="ROAS" sortKeyName="roas" className="px-4 py-4" />
                        <Th label="Purchases" sortKeyName="purchases" className="px-4 py-4" />
                        <Th label="Purchase Value" sortKeyName="purchase_value" className="px-4 py-4" />
                        <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                          Currency
                        </th>
                        <th className="pl-4 pr-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                          Date preset
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedInsights.map((row) => (
                        <tr
                          key={row.ad_id}
                          className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors"
                        >
                          <td className="pl-6 pr-4 py-3 font-medium text-stone-900 max-w-[200px] truncate" title={row.name ?? row.ad_id}>
                            {row.name || row.ad_id}
                          </td>
                          <td className="px-4 py-3 text-stone-600 font-mono text-xs">{row.account_id ?? '—'}</td>
                          <td className="px-4 py-3 text-stone-700">{row.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-4 py-3 text-stone-700">{row.impressions.toLocaleString()}</td>
                          <td className="px-4 py-3 text-stone-700">{row.clicks.toLocaleString()}</td>
                          <td className="px-4 py-3 text-stone-700">{row.roas != null ? Number(row.roas).toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 text-stone-700">{row.purchases.toLocaleString()}</td>
                          <td className="px-4 py-3 text-stone-700">{row.purchase_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-4 py-3 text-stone-500">{row.currency ?? '—'}</td>
                          <td className="pl-4 pr-6 py-3 text-stone-500">{row.date_preset ?? '—'}</td>
                        </tr>
                      ))}
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
