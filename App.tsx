import React, { useEffect, useState } from 'react';
import CompetitorAnalysis from './components/views/CompetitorAnalysis';
import AdIndex from './components/views/AdIndex';

const SESSION_STORAGE_KEY = 'poetype_session_id';

export type ActiveView = 'konkurrentanalyse' | 'ad-index';

const generateSessionId = (): string => {
  return `${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
};

const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('konkurrentanalyse');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        setSessionId(stored);
        return;
      }
      const newId = generateSessionId();
      window.localStorage.setItem(SESSION_STORAGE_KEY, newId);
      setSessionId(newId);
    } catch (error) {
      console.error('Failed to initialize session ID', error);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden text-stone-900">
      <header className="flex-shrink-0 border-b border-[#EADFD8] bg-white px-6 py-3 flex items-center gap-6">
        <button
          type="button"
          onClick={() => setActiveView('konkurrentanalyse')}
          className={`text-sm font-medium transition-colors ${
            activeView === 'konkurrentanalyse'
              ? 'text-[#D6453D] font-semibold border-b-2 border-[#D6453D] pb-0.5 -mb-px'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          Konkurrentanalyse
        </button>
        <button
          type="button"
          onClick={() => setActiveView('ad-index')}
          className={`text-sm font-medium transition-colors ${
            activeView === 'ad-index'
              ? 'text-[#D6453D] font-semibold border-b-2 border-[#D6453D] pb-0.5 -mb-px'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          Ad Index
        </button>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {activeView === 'konkurrentanalyse' && <CompetitorAnalysis sessionId={sessionId} />}
        {activeView === 'ad-index' && <AdIndex />}
      </div>
    </div>
  );
};

export default App;
