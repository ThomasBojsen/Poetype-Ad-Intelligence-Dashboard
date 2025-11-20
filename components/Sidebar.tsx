import React from 'react';
import { FilterState } from '../types';
import { Filter } from 'lucide-react';

interface SidebarProps {
  allBrands: string[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  maxReachAvailable: number;
}

const Sidebar: React.FC<SidebarProps> = ({ allBrands, filters, setFilters, maxReachAvailable }) => {
  
  const handleBrandToggle = (brand: string) => {
    setFilters(prev => {
      const newBrands = prev.selectedBrands.includes(brand)
        ? prev.selectedBrands.filter(b => b !== brand)
        : [...prev.selectedBrands, brand];
      return { ...prev, selectedBrands: newBrands };
    });
  };

  const handleReachChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'min' | 'max') => {
    const val = parseInt(e.target.value);
    setFilters(prev => ({
      ...prev,
      [type === 'min' ? 'minReach' : 'maxReach']: val
    }));
  };

  return (
    <aside className="w-full md:w-72 bg-white border-r border-[#F3DED7] h-screen sticky top-0 overflow-y-auto flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      {/* Brand Logo Section */}
      <div className="p-8 border-b border-[#F3DED7]">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[#D94E41] text-2xl tracking-wide font-[Roboto_Slab] font-bold">POETYPE</span>
          <div className="w-2 h-2 bg-[#D94E41] mt-2"></div> {/* The square dot from logo */}
        </div>
        <p className="text-[10px] text-[#8B8680] uppercase tracking-widest font-bold pl-1">Ad Intelligence Dashboard</p>
      </div>

      <div className="p-8 space-y-10 flex-1">
        {/* Brand Filter */}
        <div>
          <div className="flex items-center gap-2 mb-5 text-[#111827]">
            <Filter size={16} className="text-[#D94E41]" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Filter by Brand</h3>
          </div>
          <div className="space-y-3">
            {allBrands.map(brand => (
              <label key={brand} className="flex items-center space-x-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.selectedBrands.includes(brand)}
                    onChange={() => handleBrandToggle(brand)}
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 transition-all checked:border-[#D94E41] checked:bg-[#D94E41]"
                  />
                  <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <span className={`text-sm transition-colors ${filters.selectedBrands.includes(brand) ? 'text-[#111827] font-semibold' : 'text-[#57534E] group-hover:text-[#D94E41]'}`}>
                    {brand}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Reach Slider */}
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wider text-[#111827] mb-5">Reach Range</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-xs text-[#57534E] mb-2">
                <span>Min Reach</span>
                <span className="font-mono font-bold text-[#D94E41]">{filters.minReach.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="0"
                max={maxReachAvailable}
                value={filters.minReach}
                onChange={(e) => handleReachChange(e, 'min')}
                className="w-full h-1.5 bg-[#F3DED7] rounded-lg appearance-none cursor-pointer accent-[#D94E41]"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-[#57534E] mb-2">
                <span>Max Reach</span>
                <span className="font-mono font-bold text-[#D94E41]">{filters.maxReach.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="0"
                max={maxReachAvailable}
                value={filters.maxReach}
                onChange={(e) => handleReachChange(e, 'max')}
                className="w-full h-1.5 bg-[#F3DED7] rounded-lg appearance-none cursor-pointer accent-[#D94E41]"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6 bg-[#FFF8F4] border-t border-[#F3DED7]">
        <button 
            onClick={() => setFilters({ selectedBrands: [], minReach: 0, maxReach: maxReachAvailable })}
            className="w-full py-3 text-sm text-[#57534E] hover:text-[#D94E41] hover:bg-[#FCDCD8] rounded-lg transition-colors font-bold uppercase tracking-wide"
        >
            Reset All Filters
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;