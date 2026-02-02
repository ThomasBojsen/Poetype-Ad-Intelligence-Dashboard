import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Sidebar from '../Sidebar';
import AdCard from '../AdCard';
import ScrapeModal from '../ScrapeModal';
import ProgressModal from '../ProgressModal';
import { AdData, FilterState } from '../../types';
import { fetchAdData, triggerScrapeWorkflow, refreshSessionScrape, checkScrapeStatus, SCRAPE_WAIT_TIME_SECONDS } from '../../services/adService';
import { LayoutGrid, RefreshCw, Eye, Trophy } from 'lucide-react';

const SESSION_STORAGE_KEY = 'poetype_session_id';

const generateSessionId = (): string => {
  return `${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
};

const PoetypeP: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 90 113"
    className={className}
    style={{ enableBackground: 'new 0 0 90 113' }}
  >
    <path fill="#FF9073" d="M54.5,73.9h-13v12.6h17.9v16.2H7V86.5h9.7V32.3H8.2V16.1h47.6c19.7,0,29.6,12.8,29.6,29.5C85.5,63.7,73.8,73.9,54.5,73.9z M49.1,32.3h-7.7v26.3h7.7c7.4,0,12.5-4.7,12.5-13.2C61.6,37.1,56.8,32.3,49.1,32.3z"/>
    <path fill="#D33600" d="M47.5,73.9H34.4v12.6h17.9v16.2H0V86.5h9.7V32.3H1.2V16.1h47.6c19.7,0,29.6,12.8,29.6,29.5C78.5,63.7,66.8,73.9,47.5,73.9z M42.1,32.3h-7.7v26.3h7.7c7.4,0,12.5-4.7,12.5-13.2C54.6,37.1,49.8,32.3,42.1,32.3z"/>
  </svg>
);

interface CompetitorAnalysisProps {
  sessionId?: string | null;
}

const CompetitorAnalysis: React.FC<CompetitorAnalysisProps> = ({ sessionId: sessionIdProp }) => {
  const [rawData, setRawData] = useState<AdData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionId, setSessionIdState] = useState<string | null>(sessionIdProp ?? null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [brandsRefreshTrigger, setBrandsRefreshTrigger] = useState<number>(0);

  const [isScrapeModalOpen, setIsScrapeModalOpen] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeTimeLeft, setScrapeTimeLeft] = useState(0);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    selectedBrands: [],
    minReach: 0,
    maxReach: 1000000,
    mediaType: 'all',
  });

  const effectiveSessionId = sessionIdProp !== undefined ? sessionIdProp : sessionId;

  useEffect(() => {
    if (sessionIdProp !== undefined) return;
    try {
      const storedId = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (storedId) {
        setSessionIdState(storedId);
        return;
      }
      const newSessionId = generateSessionId();
      window.localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
      setSessionIdState(newSessionId);
    } catch (error) {
      console.error('Failed to initialize session ID', error);
    }
  }, [sessionIdProp]);

  const loadData = useCallback(async () => {
    if (!effectiveSessionId) return;
    setLoading(true);
    try {
      const result = await fetchAdData(true, effectiveSessionId);
      const data = Array.isArray(result) ? result : result.ads;
      const updated = Array.isArray(result) ? null : result.lastUpdated;
      setRawData(data);
      setLastUpdated(updated);
      if (data.length > 0) {
        const maxR = Math.max(...data.map(d => d.reach), 0);
        setFilters(prev => ({ ...prev, maxReach: maxR }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [effectiveSessionId]);

  useEffect(() => {
    if (!effectiveSessionId) return;
    loadData();
  }, [effectiveSessionId, loadData]);

  const handleStartScrape = async (urls: string[]) => {
    if (!effectiveSessionId) {
      alert("Sessionen er ikke klar endnu. Prøv igen om et øjeblik.");
      return;
    }
    setIsScrapeModalOpen(false);
    const result = await triggerScrapeWorkflow(urls, effectiveSessionId);
    if (result.success && result.runId) {
      setCurrentRunId(result.runId);
      setBrandsRefreshTrigger(prev => prev + 1);
      setIsScraping(true);
      setScrapeTimeLeft(SCRAPE_WAIT_TIME_SECONDS);
    } else {
      alert("Kunne ikke starte indsamlingsprocessen. Tjek konfigurationen.");
    }
  };

  const handleForceRefresh = async () => {
    if (!effectiveSessionId) return;
    setIsRefreshing(true);
    const result = await refreshSessionScrape(effectiveSessionId);
    if (result.success && result.runId) {
      setCurrentRunId(result.runId);
    } else {
      alert("Kunne ikke opdatere data. Prøv igen.");
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if ((!isScraping && !isRefreshing) || !effectiveSessionId || !currentRunId) return;
    let countdownTimer: ReturnType<typeof setInterval> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    let hasSwitchedToFastPolling = false;

    const applyFetchedData = (ads: any[]) => {
      const now = new Date();
      const mappedAds = ads.map((ad: any) => {
        let days_active = 1;
        const startDate = ad.start_date_formatted || ad.start_date || ad.started_running || ad.first_seen || ad.firstSeen;
        if (startDate) {
          try {
            let dateString = String(startDate);
            if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) dateString = dateString.replace(' ', 'T');
            const firstSeenDate = new Date(dateString);
            if (!isNaN(firstSeenDate.getTime())) {
              const diffDays = Math.floor((now.getTime() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24));
              days_active = diffDays < 1 ? 1 : diffDays;
            }
          } catch (_) {}
        }
        const viral_score = Math.round(ad.reach / days_active);
        return {
          id: ad.id,
          page_name: ad.page_name,
          reach: ad.reach,
          ad_library_url: ad.ad_library_url,
          video_url: ad.video_url || '',
          thumbnail: ad.thumbnail_url || '',
          heading: ad.heading || '',
          ad_copy: ad.ad_copy || '',
          days_active,
          viral_score,
          brand_ad_library_url: ad.brand_ad_library_url,
        };
      });
      const sortedAds = mappedAds.sort((a, b) => (b.reach || 0) - (a.reach || 0));
      setRawData(sortedAds);
      setLastUpdated(new Date().toISOString());
      if (sortedAds.length > 0) setFilters(prev => ({ ...prev, maxReach: Math.max(...sortedAds.map(d => d.reach)) }));
      setLoading(false);
    };

    const checkScrape = async () => {
      if (cancelled || !currentRunId) return;
      try {
        const result = await checkScrapeStatus(currentRunId, effectiveSessionId);
        if (result.status === 'RUNNING') return;
        if (result.status === 'COMPLETED' && result.ads) {
          applyFetchedData(result.ads);
          setIsScraping(false);
          setIsRefreshing(false);
          setCurrentRunId(null);
        }
        if (result.status === 'FAILED') {
          setIsScraping(false);
          setIsRefreshing(false);
          setCurrentRunId(null);
          alert(result.message || "Indsamlingen fejlede. Prøv igen.");
        }
      } catch (error) {
        console.error('Error checking scrape status:', error);
      }
    };

    const startPolling = (intervalMs: number) => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(checkScrape, intervalMs);
      checkScrape();
    };
    startPolling(5000);

    if (isScraping) {
      countdownTimer = setInterval(() => {
        setScrapeTimeLeft(prev => {
          const next = prev - 1;
          if (!hasSwitchedToFastPolling && next <= 0) {
            hasSwitchedToFastPolling = true;
            startPolling(3000);
          }
          if (next <= -180) {
            alert("Data er forsinket. Opdater venligst siden om et par minutter.");
            setIsScraping(false);
            setIsRefreshing(false);
            setCurrentRunId(null);
            return -180;
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      cancelled = true;
      if (countdownTimer) clearInterval(countdownTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [isScraping, isRefreshing, effectiveSessionId, currentRunId]);

  const allBrands = useMemo(() => Array.from(new Set(rawData.map(d => d.page_name))).sort(), [rawData]);
  const filteredData = useMemo(() => {
    const filtered = rawData.filter(item => {
      const matchesBrand = filters.selectedBrands.length === 0 || filters.selectedBrands.includes(item.page_name);
      const matchesReach = item.reach >= filters.minReach && item.reach <= filters.maxReach;
      const isVideo = item.video_url && item.video_url.trim() !== '';
      const isImage = !isVideo && item.thumbnail && item.thumbnail.trim() !== '';
      let matchesMediaType = true;
      if (filters.mediaType === 'video') matchesMediaType = isVideo;
      else if (filters.mediaType === 'image') matchesMediaType = isImage;
      return matchesBrand && matchesReach && matchesMediaType;
    });
    return filtered.sort((a, b) => (b.reach || 0) - (a.reach || 0));
  }, [rawData, filters]);

  const totalAds = filteredData.length;
  const totalReach = filteredData.reduce((sum, item) => sum + item.reach, 0);

  return (
    <div className="flex h-full overflow-hidden text-stone-900">
      <ProgressModal isOpen={isScraping} timeLeft={scrapeTimeLeft} totalTime={SCRAPE_WAIT_TIME_SECONDS} />
      <ScrapeModal isOpen={isScrapeModalOpen} onClose={() => setIsScrapeModalOpen(false)} onStartScrape={handleStartScrape} />
      <Sidebar
        allBrands={allBrands}
        filters={filters}
        setFilters={setFilters}
        maxReachAvailable={rawData.length > 0 ? Math.max(...rawData.map(d => d.reach)) : 100000}
        sessionId={effectiveSessionId}
        onBrandDeleted={() => { loadData(); setBrandsRefreshTrigger(prev => prev + 1); }}
        refreshTrigger={brandsRefreshTrigger}
        rawData={rawData}
      />
      <main className="flex-1 overflow-y-auto bg-[#FFF2EB]">
        <div className="max-w-7xl mx-auto px-8 py-10">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 animate-reveal" style={{ animationDelay: '100ms' }}>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-[#D6453D]"><Trophy size={28} strokeWidth={1.5} /></div>
                <h2 className="text-3xl font-semibold tracking-tight text-[#0B1221]">Top Præsterende Annoncer</h2>
              </div>
              <p className="text-lg pl-10 text-stone-500 font-medium">Live indsigt i de bedst præsterende annoncer</p>
              {lastUpdated && <p className="text-sm pl-10 text-stone-400 mt-1">Sidst opdateret: {new Date(lastUpdated).toLocaleString('da-DK')}</p>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleForceRefresh} disabled={isRefreshing || isScraping} className="inline-flex items-center gap-2 text-stone-600 px-4 py-2.5 rounded-full text-sm font-medium transition-all border border-[#EADFD8] bg-white hover:bg-[#FFF8F5] disabled:opacity-50 disabled:cursor-not-allowed">
                <RefreshCw size={16} strokeWidth={1.5} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'Opdaterer...' : 'Opdater'}
              </button>
              <button onClick={() => setIsScrapeModalOpen(true)} disabled={isRefreshing || isScraping} className="inline-flex items-center gap-2 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm ring-1 ring-white/10 bg-[#0B1221] hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed">
                <RefreshCw size={16} strokeWidth={1.5} /> Tilføj Brands
              </button>
            </div>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-reveal" style={{ animationDelay: '200ms' }}>
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-5 border-[#EADFD8] min-w-0">
              <div className="w-14 h-14 rounded-xl bg-[#FFF2EB] flex items-center justify-center text-[#D6453D] flex-shrink-0"><LayoutGrid size={28} strokeWidth={1.5} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-stone-400 truncate">Aktive Annoncer</p>
                <p className="text-2xl lg:text-3xl xl:text-4xl font-semibold tracking-tight text-[#0B1221] truncate">{totalAds}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-5 border-[#EADFD8] min-w-0">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#0B1221] text-white"><Eye size={28} strokeWidth={1.5} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-stone-400 truncate">Total Reach</p>
                <p className="text-2xl lg:text-3xl xl:text-4xl font-semibold tracking-tight text-[#0B1221] truncate">{totalReach.toLocaleString('da-DK')}</p>
              </div>
            </div>
            <div className="bg-[#D6453D] p-6 rounded-2xl border border-[#D6453D] shadow-[0_8px_30px_rgb(214,69,61,0.12)] flex items-center gap-5 text-white min-w-0">
              <div className="w-14 h-14 rounded-xl bg-[#FFF2EB] flex items-center justify-center flex-shrink-0 p-3"><PoetypeP className="w-full h-full" /></div>
              <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
                <div className="bg-white/20 rounded-lg px-2 py-1.5 text-center text-[10px] xl:text-xs font-bold tracking-wide shadow-sm backdrop-blur-sm border border-white/10 truncate">Ærlighed</div>
                <div className="bg-white/20 rounded-lg px-2 py-1.5 text-center text-[10px] xl:text-xs font-bold tracking-wide shadow-sm backdrop-blur-sm border border-white/10 truncate">Now</div>
                <div className="bg-white/20 rounded-lg px-2 py-1.5 text-center text-[10px] xl:text-xs font-bold tracking-wide shadow-sm backdrop-blur-sm border border-white/10 truncate">Proaktivitet</div>
                <div className="bg-white/20 rounded-lg px-2 py-1.5 text-center text-[10px] xl:text-xs font-bold tracking-wide shadow-sm backdrop-blur-sm border border-white/10 truncate">Øjenhøjde</div>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D6453D]" />
            </div>
          ) : (
            <div className="relative">
              {isRefreshing && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl border border-[#EADFD8] flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw size={24} strokeWidth={1.5} className="animate-spin text-[#D6453D]" />
                    <p className="text-sm font-medium text-stone-600">Tjekker for nye data...</p>
                  </div>
                </div>
              )}
              {filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 text-stone-400 border-2 border-dashed border-[#EADFD8] rounded-2xl bg-white/50">
                  <LayoutGrid size={48} className="mb-4 opacity-20 text-[#D6453D]" />
                  <p className="text-lg font-medium text-stone-500">Ingen annoncer fundet med dine filtre</p>
                  <button onClick={() => setFilters(prev => ({ ...prev, selectedBrands: [], minReach: 0, mediaType: 'all' }))} className="mt-4 text-[#D6453D] font-bold hover:underline cursor-pointer">Ryd Filtre</button>
                </div>
              ) : (
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10 ${isRefreshing ? 'opacity-50' : ''}`}>
                  {filteredData.map((ad, index) => (
                    <div key={ad.id} className="animate-reveal" style={{ animationDelay: `${300 + index * 100}ms` }}>
                      <AdCard data={ad} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CompetitorAnalysis;
