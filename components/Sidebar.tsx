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
    <aside className="w-80 flex flex-col border-r bg-white hidden md:flex h-full flex-shrink-0 border-[#EADFD8] animate-sidebar">
      {/* Logo Area */}
      <div className="p-8 border-b border-[#F5EBE6]">
        <div className="flex items-center gap-1 mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-[#D6453D]">POETYPE</h1>
          <div className="w-1.5 h-1.5 bg-[#D6453D] mt-1"></div>
        </div>
        <p className="text-xs font-medium tracking-wider uppercase text-stone-400">Ad Intelligence Dashboard</p>
      </div>

      {/* Filters */}
      <div className="flex-1 overflow-y-auto p-8 space-y-10">
        
        {/* Brand Filter */}
        <div>
          <div className="flex items-center gap-2 mb-5 text-stone-500">
            <Filter size={16} strokeWidth={1.5} />
            <h3 className="text-xs font-semibold tracking-wide uppercase">Filter by Brand</h3>
          </div>
          <div className="space-y-4">
            {allBrands.map(brand => (
              <label key={brand} className="flex items-center group cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={filters.selectedBrands.includes(brand)}
                  onChange={() => handleBrandToggle(brand)}
                  className="peer sr-only"
                />
                <div className="w-5 h-5 border rounded bg-white peer-checked:bg-[#D6453D] peer-checked:border-[#D6453D] peer-focus:ring-2 peer-focus:ring-[#D6453D]/20 transition-all flex items-center justify-center border-stone-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100">
                    <path d="M20 6 9 17l-5-5"></path>
                  </svg>
                </div>
                <span className="ml-3 text-base font-medium transition-colors text-stone-600 group-hover:text-stone-900">{brand}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Range Filter */}
        <div>
          <h3 className="text-xs font-semibold tracking-wide uppercase mb-6 text-stone-500">Reach Range</h3>
          
          <div className="space-y-6">
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-stone-500">Min Reach</label>
                <span className="text-sm font-semibold text-[#D6453D]">{filters.minReach.toLocaleString()}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={maxReachAvailable} 
                value={filters.minReach}
                onChange={(e) => handleReachChange(e, 'min')}
              />
            </div>

            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-stone-500">Max Reach</label>
                <span className="text-sm font-semibold text-[#D6453D]">{filters.maxReach.toLocaleString()}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={maxReachAvailable} 
                value={filters.maxReach}
                onChange={(e) => handleReachChange(e, 'max')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-8 border-t border-[#F5EBE6] bg-[#FFF8F5]">
        <button 
          onClick={() => setFilters({ selectedBrands: [], minReach: 0, maxReach: maxReachAvailable })}
          className="w-full py-3 text-sm font-medium hover:text-[#D6453D] hover:bg-[#FFF2EB] rounded-lg transition-colors duration-200 text-stone-500"
        >
          Reset All Filters
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;