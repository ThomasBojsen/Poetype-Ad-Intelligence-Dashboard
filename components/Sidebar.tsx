import React, { useState, useEffect } from 'react';
import { FilterState } from '../types';
import { Filter, Video, Image, Trash2, X } from 'lucide-react';
import { fetchBrands, deleteBrand } from '../services/adService';

interface Brand {
  id: number | string;
  name: string;
  ad_library_url: string;
  is_active: boolean;
}

interface SidebarProps {
  allBrands: string[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  maxReachAvailable: number;
  sessionId: string | null;
  onBrandDeleted?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ allBrands, filters, setFilters, maxReachAvailable, sessionId, onBrandDeleted }) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  // Fetch brands on mount and when sessionId changes
  useEffect(() => {
    if (!sessionId) return;
    
    const loadBrands = async () => {
      setLoadingBrands(true);
      try {
        const fetchedBrands = await fetchBrands(sessionId);
        setBrands(fetchedBrands);
      } catch (error) {
        console.error('Error loading brands:', error);
      } finally {
        setLoadingBrands(false);
      }
    };

    loadBrands();
  }, [sessionId]);

  const handleDeleteBrand = async (brandId: number | string) => {
    if (!sessionId) return;
    
    // Confirm deletion
    if (!confirm('Are you sure you want to remove this brand? This will hide its ads from future scrapes.')) {
      return;
    }

    setDeletingId(brandId);
    try {
      const success = await deleteBrand(sessionId, brandId);
      if (success) {
        // Remove from local state
        setBrands(prev => prev.filter(b => b.id !== brandId));
        // Notify parent to refresh data
        if (onBrandDeleted) {
          onBrandDeleted();
        }
      } else {
        alert('Failed to delete brand. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting brand:', error);
      alert('Failed to delete brand. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

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
        
        {/* Manage Brands */}
        <div>
          <div className="flex items-center gap-2 mb-5 text-stone-500">
            <Filter size={16} strokeWidth={1.5} />
            <h3 className="text-xs font-semibold tracking-wide uppercase">Manage Brands</h3>
          </div>
          {loadingBrands ? (
            <p className="text-sm text-stone-400">Loading brands...</p>
          ) : brands.length === 0 ? (
            <p className="text-sm text-stone-400">No brands added yet. Use "Update Data" to add brands.</p>
          ) : (
            <div className="space-y-2">
              {brands.filter(b => b.is_active).map(brand => (
                <div 
                  key={brand.id} 
                  className="flex items-center justify-between group p-2 rounded-lg hover:bg-[#FFF8F5] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-700 truncate">{brand.name}</p>
                    <p className="text-xs text-stone-400 truncate">{brand.ad_library_url}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteBrand(brand.id)}
                    disabled={deletingId === brand.id}
                    className="ml-2 p-1.5 text-stone-400 hover:text-[#D6453D] hover:bg-[#FFF2EB] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete brand"
                  >
                    {deletingId === brand.id ? (
                      <X size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
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

        {/* Media Type Filter */}
        <div>
          <div className="flex items-center gap-2 mb-5 text-stone-500">
            <Filter size={16} strokeWidth={1.5} />
            <h3 className="text-xs font-semibold tracking-wide uppercase">Media Type</h3>
          </div>
          <div className="space-y-3">
            <label className="flex items-center group cursor-pointer">
              <input 
                type="radio" 
                name="mediaType"
                value="all"
                checked={filters.mediaType === 'all'}
                onChange={() => setFilters(prev => ({ ...prev, mediaType: 'all' }))}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border rounded-full bg-white peer-checked:bg-[#D6453D] peer-checked:border-[#D6453D] peer-focus:ring-2 peer-focus:ring-[#D6453D]/20 transition-all flex items-center justify-center border-stone-300">
                <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
              </div>
              <span className="ml-3 text-base font-medium transition-colors text-stone-600 group-hover:text-stone-900">All Media</span>
            </label>
            
            <label className="flex items-center group cursor-pointer">
              <input 
                type="radio" 
                name="mediaType"
                value="video"
                checked={filters.mediaType === 'video'}
                onChange={() => setFilters(prev => ({ ...prev, mediaType: 'video' }))}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border rounded-full bg-white peer-checked:bg-[#D6453D] peer-checked:border-[#D6453D] peer-focus:ring-2 peer-focus:ring-[#D6453D]/20 transition-all flex items-center justify-center border-stone-300">
                <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
              </div>
              <div className="ml-3 flex items-center gap-2">
                <Video size={16} strokeWidth={1.5} className="text-stone-400" />
                <span className="text-base font-medium transition-colors text-stone-600 group-hover:text-stone-900">Videos</span>
              </div>
            </label>
            
            <label className="flex items-center group cursor-pointer">
              <input 
                type="radio" 
                name="mediaType"
                value="image"
                checked={filters.mediaType === 'image'}
                onChange={() => setFilters(prev => ({ ...prev, mediaType: 'image' }))}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border rounded-full bg-white peer-checked:bg-[#D6453D] peer-checked:border-[#D6453D] peer-focus:ring-2 peer-focus:ring-[#D6453D]/20 transition-all flex items-center justify-center border-stone-300">
                <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
              </div>
              <div className="ml-3 flex items-center gap-2">
                <Image size={16} strokeWidth={1.5} className="text-stone-400" />
                <span className="text-base font-medium transition-colors text-stone-600 group-hover:text-stone-900">Images</span>
              </div>
            </label>
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
          onClick={() => setFilters({ selectedBrands: [], minReach: 0, maxReach: maxReachAvailable, mediaType: 'all' })}
          className="w-full py-3 text-sm font-medium hover:text-[#D6453D] hover:bg-[#FFF2EB] rounded-lg transition-colors duration-200 text-stone-500"
        >
          Reset All Filters
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;