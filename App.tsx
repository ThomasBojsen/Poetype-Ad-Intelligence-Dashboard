import React, { useEffect, useState, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import AdCard from './components/AdCard';
import ScrapeModal from './components/ScrapeModal';
import ProgressModal from './components/ProgressModal';
import { AdData, FilterState } from './types';
import { fetchAdData, triggerScrapeWorkflow, SCRAPE_WAIT_TIME_SECONDS } from './services/adService';
import { LayoutGrid, Target, Zap, PlusCircle } from 'lucide-react';

const App: React.FC = () => {
  const [rawData, setRawData] = useState<AdData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Scrape Logic States
  const [isScrapeModalOpen, setIsScrapeModalOpen] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeTimeLeft, setScrapeTimeLeft] = useState(0);

  const [filters, setFilters] = useState<FilterState>({
    selectedBrands: [],
    minReach: 0,
    maxReach: 1000000, // Default max
  });

  // 1. GENERER UNIKT SESSION ID (Lever så længe fanen er åben)
  const sessionId = useRef(Math.random().toString(36).substring(2, 15));

  // Initial Data Fetch
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // 2. Pass true to ensure we use the real CSV URL AND pass sessionId
    const data = await fetchAdData(true, sessionId.current); 
    setRawData(data);
    
    // Set dynamic max reach based on data
    if (data.length > 0) {
      const maxR = Math.max(...data.map(d => d.reach), 0);
      setFilters(prev => ({ ...prev, maxReach: maxR }));
    }
    
    setLoading(false);
  };

  const handleStartScrape = async (urls: string[]) => {
    setIsScrapeModalOpen(false);
    
    // 3. Send sessionId med til trigger
    const success = await triggerScrapeWorkflow(urls, sessionId.current);
    if (success) {
      setIsScraping(true);
      setScrapeTimeLeft(SCRAPE_WAIT_TIME_SECONDS);
    } else {
      alert("Failed to start scrape process. Check configuration.");
    }
  };

  // Countdown Timer Effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isScraping && scrapeTimeLeft > 0) {
      timer = setInterval(() => {
        setScrapeTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isScraping && scrapeTimeLeft === 0) {
      // Time is up! Refresh data
      setIsScraping(false);
      loadData(); // Reloads CSV
    }

    return () => clearInterval(timer);
  }, [isScraping, scrapeTimeLeft]);


  // Derived State: Unique Brands
  const allBrands = useMemo(() => {
    return Array.from(new Set(rawData.map(d => d.page_name))).sort();
  }, [rawData]);

  // Derived State: Filtered Data
  const filteredData = useMemo(() => {
    return rawData.filter(item => {
      const matchesBrand = filters.selectedBrands.length === 0 || filters.selectedBrands.includes(item.page_name);
      const matchesReach = item.reach >= filters.minReach && item.reach <= filters.maxReach;
      return matchesBrand && matchesReach;
    });
  }, [rawData, filters]);

  // Derived State: Stats
  const totalAds = filteredData.length;
  const totalReach = filteredData.reduce((sum, item) => sum + item.reach, 0);

  return (
    <div className="flex min-h-screen bg-[#FFF8F4] text-slate-900 font-sans relative">
      
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
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-[#FFF8F4] border-b border-[#F3DED7] px-8 py-6 flex justify-between items-center sticky top-0 z-10">
          <div>
             <h1 className="text-3xl font-bold text-[#111827] flex items-center gap-2 tracking-tight">
                🏆 Top Performing Video Ads
             </h1>
             <p className="text-[#57534E] mt-2 text-sm font-medium">
               Live insight in the best performing ads
             </p>
          </div>
          
          <button 
            onClick={() => setIsScrapeModalOpen(true)}
            className="bg-[#111827] text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-[#2D3748] transition-colors shadow-lg flex items-center gap-2"
          >
            <PlusCircle size={18} className="text-[#D94E41]" />
            Update Data
          </button>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#F3DED7] flex items-center gap-5">
                <div className="p-3 bg-[#FFF8F4] text-[#D94E41] rounded-lg">
                    <LayoutGrid size={26} />
                </div>
                <div>
                    <p className="text-xs text-[#8B8680] uppercase tracking-wider font-semibold">Active Ads</p>
                    <p className="text-3xl font-bold text-[#111827] mt-1">{totalAds}</p>
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#F3DED7] flex items-center gap-5">
                <div className="p-3 bg-[#FFF8F4] text-[#111827] rounded-lg">
                    <Target size={26} />
                </div>
                <div>
                    <p className="text-xs text-[#8B8680] uppercase tracking-wider font-semibold">Total Reach</p>
                    <p className="text-3xl font-bold text-[#111827] mt-1">{totalReach.toLocaleString()}</p>
                </div>
            </div>

            <div className="bg-[#D94E41] p-6 rounded-xl shadow-lg border border-[#D94E41] flex items-center gap-5 lg:col-span-2 text-white relative overflow-hidden">
                {/* Decorative circle */}
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="p-3 bg-white/20 rounded-lg text-white z-10">
                    <Zap size={26} />
                </div>
                <div className="z-10">
                    <p className="text-xs text-orange-100 uppercase tracking-wider font-semibold">Poetype Tip</p>
                    <p className="text-lg font-medium mt-1 leading-snug">The only real insight is datadriven.</p>
                </div>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
             <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D94E41]"></div>
             </div>
          ) : filteredData.length === 0 ? (
            /* Empty State */
             <div className="flex flex-col items-center justify-center h-80 text-gray-400 border-2 border-dashed border-[#E5E7EB] rounded-2xl bg-white/50">
                <LayoutGrid size={48} className="mb-4 opacity-20 text-[#D94E41]" />
                <p className="text-lg font-medium text-[#57534E]">No ads found matching your filters</p>
                <button 
                    onClick={() => setFilters(prev => ({ ...prev, selectedBrands: [], minReach: 0 }))}
                    className="mt-4 text-[#D94E41] font-bold hover:underline cursor-pointer"
                >
                    Clear Filters
                </button>
             </div>
          ) : (
             /* Video Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-10">
                {filteredData.map((ad) => (
                    <AdCard key={ad.id} data={ad} />
                ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;