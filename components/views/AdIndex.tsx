import React, { useEffect, useState, useMemo } from 'react';
import { AdData } from '../../types';
import { fetchPerformanceInsights } from '../../services/adService';
import { DollarSign, TrendingUp, Eye, MousePointer, Image as ImageIcon } from 'lucide-react';

type SortKey = 'spend' | 'roas' | null;
type SortDir = 'asc' | 'desc';

const CURRENCY = 'DKK';

const AdIndex: React.FC = () => {
  const [ads, setAds] = useState<AdData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedAds = useMemo(() => {
    if (!sortKey) return ads;
    return [...ads].sort((a, b) => {
      const aVal = sortKey === 'spend' ? (a.spend ?? 0) : (a.roas ?? 0);
      const bVal = sortKey === 'spend' ? (b.spend ?? 0) : (b.roas ?? 0);
      const cmp = aVal - bVal;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [ads, sortKey, sortDir]);

  const totalSpend = ads.reduce((s, a) => s + (a.spend ?? 0), 0);
  const totalImpressions = ads.reduce((s, a) => s + (a.impressions ?? 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (a.clicks ?? 0), 0);
  const globalRoas = totalSpend > 0
    ? ads.reduce((s, a) => s + (a.purchase_value ?? 0), 0) / totalSpend
    : 0;

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
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[#0B1221]">Ad Index</h1>
          <p className="text-stone-500 mt-1">Performance data from your Meta Ads</p>
        </header>

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
                  <p className="font-medium">Ingen performance data</p>
                  <p className="text-sm mt-1">Kør sync fra Meta for at hente indsigt.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#EADFD8] bg-[#FFF8F5]">
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-stone-500 pl-6 pr-4 py-4 w-24">Creative</th>
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
                            <td className="px-4 py-3 font-medium text-[#0B1221] max-w-[220px] truncate" title={row.page_name || row.id}>
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
