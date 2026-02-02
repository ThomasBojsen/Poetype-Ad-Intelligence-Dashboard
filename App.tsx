import React, { useState } from 'react';
import CompetitorAnalysis from './components/CompetitorAnalysis';
import AdIndex from './components/AdIndex';

export type ActiveView = 'konkurrentanalyse' | 'ad-index';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('konkurrentanalyse');

  return (
    <div className="flex flex-col h-screen overflow-hidden text-stone-900">
      {/* Tab bar: always visible */}
      <header className="flex-shrink-0 border-b border-stone-200 bg-white px-6 py-3 flex items-center gap-6">
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
        {activeView === 'konkurrentanalyse' && <CompetitorAnalysis />}
        {activeView === 'ad-index' && <AdIndex />}
      </div>
    </div>
  );
};

export default App;
