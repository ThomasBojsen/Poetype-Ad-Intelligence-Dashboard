import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import AdCard from './components/AdCard';
import ScrapeModal from './components/ScrapeModal';
import ProgressModal from './components/ProgressModal';
import { AdData, FilterState } from './types';
import { fetchAdData, triggerScrapeWorkflow, SCRAPE_WAIT_TIME_SECONDS } from './services/adService';
import { LayoutGrid, Target, Zap, Trophy, RefreshCw } from 'lucide-react';

const SESSION_STORAGE_KEY = 'poetype_session_id';

const generateSessionId = (): string => {
  return `${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
};

const App: React.FC = () => {
  const [rawData, setRawData] = useState<AdData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Scrape Logic States
  const [isScrapeModalOpen, setIsScrapeModalOpen] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeTimeLeft, setScrapeTimeLeft] = useState(0);

  const [filters, setFilters] = useState<FilterState>({
    selectedBrands: [],
    minReach: 0,
    maxReach: 1000000, // Default max
    mediaType: 'all',
  });

  useEffect(() => {
    try {
      const storedId = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (storedId) {
        setSessionId(storedId);
        return;
      }
      const newSessionId = generateSessionId();
      window.localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
      setSessionId(newSessionId);
    } catch (error) {
      console.error('Failed to initialize session ID', error);
    }
  }, []);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (!sessionId) return;
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const result = await fetchAdData(true, sessionId);
      const data = Array.isArray(result) ? result : result.ads;
      const updated = Array.isArray(result) ? null : result.lastUpdated;
      
      setRawData(data);
      setLastUpdated(updated);
      
      // Set dynamic max reach based on data
      if (data.length > 0) {
        const maxR = Math.max(...data.map(d => d.reach), 0);
        setFilters(prev => ({ ...prev, maxReach: maxR }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    loadData();
  }, [sessionId, loadData]);

  const handleStartScrape = async (urls: string[]) => {
    if (!sessionId) {
      alert("Session is not ready yet. Please retry in a moment.");
      return;
    }
    setIsScrapeModalOpen(false);
    
    const success = await triggerScrapeWorkflow(urls, sessionId);
    if (success) {
      setIsScraping(true);
      setScrapeTimeLeft(SCRAPE_WAIT_TIME_SECONDS);
    } else {
      alert("Failed to start scrape process. Check configuration.");
    }
  };

  // Continuous countdown + polling while scraping
  useEffect(() => {
    if (!isScraping || !sessionId) return;

    let countdownTimer: ReturnType<typeof setInterval> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    let hasSwitchedToFastPolling = false;

    const applyFetchedData = (result: any) => {
      const data = Array.isArray(result) ? result : result.ads;
      const updated = Array.isArray(result) ? null : result.lastUpdated;
      
      setRawData(data);
      setLastUpdated(updated);
      if (data.length > 0) {
        const maxR = Math.max(...data.map(d => d.reach), 0);
        setFilters(prev => ({ ...prev, maxReach: maxR }));
      }
      setLoading(false);
    };

    const checkData = async () => {
      if (cancelled) return;
      try {
        const result = await fetchAdData(true, sessionId);
        const data = Array.isArray(result) ? result : result.ads;
        if (data.length > 0) {
          applyFetchedData(result);
          console.log("Data fetched early!");
          setIsScraping(false);
        }
      } catch (error) {
        console.error("Polling failed", error);
      }
    };

    const startPolling = (intervalMs: number) => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(checkData, intervalMs);
    };

    // Initial poll cadence: every 30 seconds
    startPolling(30000);
    checkData(); // Fire an immediate check once scraping starts

    countdownTimer = setInterval(() => {
      setScrapeTimeLeft(prev => {
        const next = prev - 1;

        if (!hasSwitchedToFastPolling && next <= 0) {
          hasSwitchedToFastPolling = true;
          startPolling(15000); // Faster polling once we hit overtime
        }

        if (next <= -180) {
          alert("Data is delayed by Google. Please refresh the page in a few minutes.");
          setIsScraping(false);
          return -180;
        }

        return next;
      });
    }, 1000);

    return () => {
      cancelled = true;
      if (countdownTimer) clearInterval(countdownTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [isScraping, sessionId]);

  // Derived State: Unique Brands
  const allBrands = useMemo(() => {
    return Array.from(new Set(rawData.map(d => d.page_name))).sort();
  }, [rawData]);

  // Derived State: Filtered Data
  const filteredData = useMemo(() => {
    return rawData.filter(item => {
      const matchesBrand = filters.selectedBrands.length === 0 || filters.selectedBrands.includes(item.page_name);
      const matchesReach = item.reach >= filters.minReach && item.reach <= filters.maxReach;
      
      // Media type filter: video has video_url, image has thumbnail but no video_url
      const isVideo = item.video_url && item.video_url.trim() !== '';
      const isImage = !isVideo && item.thumbnail && item.thumbnail.trim() !== '';
      
      let matchesMediaType = true;
      if (filters.mediaType === 'video') {
        matchesMediaType = isVideo;
      } else if (filters.mediaType === 'image') {
        matchesMediaType = isImage;
      }
      // 'all' matches everything (matchesMediaType stays true)
      
      return matchesBrand && matchesReach && matchesMediaType;
    });
  }, [rawData, filters]);

  // Derived State: Stats
  const totalAds = filteredData.length;
  const totalReach = filteredData.reduce((sum, item) => sum + item.reach, 0);

  return (
    <div className="flex h-screen overflow-hidden text-stone-900 selection:bg-[#D6453D]/20 selection:text-[#D6453D]">
      
      {/* Progress Modal (Popup instead of Full Screen) */}
      <ProgressModal 
        isOpen={isScraping} 
        timeLeft={scrapeTimeLeft} 
        totalTime={SCRAPE_WAIT_TIME_SECONDS} 
      />

      {/* Scrape Modal */}
      <ScrapeModal 
        isOpen={isScrapeModalOpen} 
        onClose={() => setIsScrapeModalOpen(false)} 
        onStartScrape={handleStartScrape} 
      />

      {/* Filter Sidebar */}
      <Sidebar 
        allBrands={allBrands} 
        filters={filters} 
        setFilters={setFilters}
        maxReachAvailable={rawData.length > 0 ? Math.max(...rawData.map(d => d.reach)) : 100000}
        sessionId={sessionId}
        onBrandDeleted={() => loadData(true)}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#FFF2EB]">
        <div className="max-w-7xl mx-auto px-8 py-10">
          
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 animate-reveal" style={{ animationDelay: '100ms' }}>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-[#D6453D]">
                  <Trophy size={28} strokeWidth={1.5} />
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-[#0B1221]">Top Performing Video Ads</h2>
              </div>
              <p className="text-lg pl-10 text-stone-500 font-medium">Live insight in the best performing ads</p>
              {lastUpdated && (
                <p className="text-sm pl-10 text-stone-400 mt-1">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 text-stone-600 px-4 py-2.5 rounded-full text-sm font-medium transition-all border border-[#EADFD8] bg-white hover:bg-[#FFF8F5] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={16} strokeWidth={1.5} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <button 
                onClick={() => setIsScrapeModalOpen(true)}
                className="inline-flex items-center gap-2 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm ring-1 ring-white/10 bg-[#0B1221] hover:bg-stone-800"
              >
                <RefreshCw size={16} strokeWidth={1.5} />
                Update Data
              </button>
            </div>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-reveal" style={{ animationDelay: '200ms' }}>
            {/* Stat Card 1 */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-5 border-[#EADFD8]">
              <div className="w-14 h-14 rounded-xl bg-[#FFF2EB] flex items-center justify-center text-[#D6453D] flex-shrink-0">
                <LayoutGrid size={28} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-stone-400">Active Ads</p>
                <p className="text-4xl font-semibold tracking-tight text-[#0B1221]">{totalAds}</p>
              </div>
            </div>

            {/* Stat Card 2 */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-5 border-[#EADFD8]">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-stone-50 text-stone-600">
                <Target size={28} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-stone-400">Total Reach</p>
                <p className="text-4xl font-semibold tracking-tight text-[#0B1221]">{totalReach.toLocaleString()}</p>
              </div>
            </div>

            {/* Stat Card 3 (Tip) */}
            <div className="bg-[#D6453D] p-6 rounded-2xl border border-[#D6453D] shadow-[0_8px_30px_rgb(214,69,61,0.12)] flex items-center gap-5 text-white">
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0 backdrop-blur-sm">
                <Zap size={28} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80 mb-1">Poetype Tip</p>
                <p className="text-lg font-medium leading-tight">The only real insight is datadriven.</p>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D6453D]"></div>
            </div>
          ) : (
            <div className="relative">
              {/* Refresh Loading Overlay */}
              {isRefreshing && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl border border-[#EADFD8] flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw size={24} strokeWidth={1.5} className="animate-spin text-[#D6453D]" />
                    <p className="text-sm font-medium text-stone-600">Refreshing data...</p>
                  </div>
                </div>
              )}
              
              {filteredData.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center h-80 text-stone-400 border-2 border-dashed border-[#EADFD8] rounded-2xl bg-white/50">
                  <LayoutGrid size={48} className="mb-4 opacity-20 text-[#D6453D]" />
                  <p className="text-lg font-medium text-stone-500">No ads found matching your filters</p>
                  <button 
                    onClick={() => setFilters(prev => ({ ...prev, selectedBrands: [], minReach: 0, mediaType: 'all' }))}
                    className="mt-4 text-[#D6453D] font-bold hover:underline cursor-pointer"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                /* Video Grid */
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 ${isRefreshing ? 'opacity-50' : ''}`}>
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

export default App;