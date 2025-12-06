import React, { useState, useEffect } from 'react';
import { FilterState } from '../types';
import { Filter, Video, Image, Trash2, X } from 'lucide-react';
import { fetchBrands, deleteBrand } from '../services/adService';

// Poetype Logo SVG Component
const PoetypeLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    xmlnsXlink="http://www.w3.org/1999/xlink" 
    viewBox="0 0 788.6 112.6" 
    className={className}
    style={{ enableBackground: 'new 0 0 788.6 112.6' }}
  >
    <style type="text/css">{`.st0{fill:#FF9073;}.st1{fill:#D33600;}`}</style>
    <path className="st0" d="M54.5,73.9h-13v12.6h17.9v16.2H7V86.5h9.7V32.3H8.2V16.1h47.6c19.7,0,29.6,12.8,29.6,29.5C85.5,63.7,73.8,73.9,54.5,73.9z M49.1,32.3h-7.7v26.3h7.7c7.4,0,12.5-4.7,12.5-13.2C61.6,37.1,56.8,32.3,49.1,32.3z"/>
    <path className="st0" d="M142.7,104.5c-23.6,0-39.7-16.2-39.7-45.4c0-28.7,15.6-44.9,39.7-44.9c26,0,39,16.2,39,44.9C181.7,88.1,167.8,104.5,142.7,104.5z M142.7,31.1c-10,0-13.9,9.8-13.9,28.1c0,19.1,4.2,28.6,13.9,28.6c9.5,0,13.2-9.1,13.2-28.6C155.9,40.4,152.7,31.1,142.7,31.1z"/>
    <path className="st0" d="M200.6,102.7V86.5h9.5V32.3h-9.6V16.1h71.8v27.2h-19.6v-11h-17.9v16.8h20.6v16.2h-20.6v21.2h19.1V71h21.2v31.7H200.6z"/>
    <path className="st0" d="M357.6,51.7V32.3h-8.9v54.2h16.6v16.2h-56.6V86.5h15.1V32.3h-8.9v19.4h-18V16.1h79.2v35.6C376.1,51.7,357.6,51.7,357.6,51.7z"/>
    <path className="st0" d="M468.3,32.3l-21.7,39.2v15h17v16.2h-62V86.5h17.6v-15l-21.7-39.2h-5.2V16.1h40.1v16.2h-6.8l9.6,19.8h0.7l9.5-19.8H439V16.1h34.9v16.2L468.3,32.3z"/>
    <path className="st0" d="M538.7,73.9h-13.1v12.6h17.9v16.2h-52.3V86.5h9.7V32.3h-8.5V16.1H540c19.7,0,29.6,12.8,29.6,29.5C569.7,63.7,558,73.9,538.7,73.9z M533.3,32.3h-7.7v26.3h7.7c7.4,0,12.5-4.7,12.5-13.2C545.8,37.1,541,32.3,533.3,32.3L533.3,32.3z"/>
    <path className="st0" d="M587.9,102.7V86.5h9.5V32.3h-9.6V16.1h71.8v27.2H640v-11h-17.9v16.8h20.6v16.2h-20.6v21.2h19.1V71h21.2v31.7H587.9z"/>
    <path className="st1" d="M47.5,73.9H34.4v12.6h17.9v16.2H0V86.5h9.7V32.3H1.2V16.1h47.6c19.7,0,29.6,12.8,29.6,29.5C78.5,63.7,66.8,73.9,47.5,73.9z M42.1,32.3h-7.7v26.3h7.7c7.4,0,12.5-4.7,12.5-13.2C54.6,37.1,49.8,32.3,42.1,32.3z"/>
    <path className="st1" d="M135.7,104.5c-23.6,0-39.7-16.2-39.7-45.4c0-28.7,15.6-44.9,39.7-44.9c26,0,39,16.2,39,44.9C174.7,88.1,160.8,104.5,135.7,104.5z M135.7,31.1c-10,0-13.9,9.8-13.9,28.1c0,19.1,4.2,28.6,13.9,28.6c9.5,0,13.2-9.1,13.2-28.6C148.9,40.4,145.7,31.1,135.7,31.1z"/>
    <path className="st1" d="M193.6,102.7V86.5h9.4V32.3h-9.6V16.1h71.8v27.2h-19.6v-11h-17.9v16.8h20.6v16.2h-20.6v21.2h19.1V71H268v31.7H193.6z"/>
    <path className="st1" d="M350.6,51.7V32.3h-8.9v54.2h16.6v16.2h-56.6V86.5h15.1V32.3h-8.9v19.4h-18V16.1h79.2v35.6C369.1,51.7,350.6,51.7,350.6,51.7z"/>
    <path className="st1" d="M461.3,32.3l-21.7,39.2v15h17v16.2h-62V86.5h17.6v-15l-21.7-39.2h-5.2V16.1h40.1v16.2h-6.8l9.6,19.8h0.7l9.5-19.8H432V16.1h34.9v16.2L461.3,32.3z"/>
    <path className="st1" d="M531.7,73.9h-13.1v12.6h17.9v16.2h-52.3V86.5h9.7V32.3h-8.5V16.1H533c19.7,0,29.6,12.8,29.6,29.5C562.7,63.7,551,73.9,531.7,73.9z M526.3,32.3h-7.7v26.3h7.7c7.4,0,12.5-4.7,12.5-13.2C538.8,37.1,534,32.3,526.3,32.3L526.3,32.3z"/>
    <path className="st1" d="M580.9,102.7V86.5h9.5V32.3h-9.6V16.1h71.8v27.2H633v-11h-17.9v16.8h20.6v16.2h-20.6v21.2h19.1V71h21.2v31.7H580.9z"/>
    <rect x="699.6" className="st0" width="89" height="112.6"/>
    <rect x="706.6" className="st1" width="82" height="112.6"/>
  </svg>
);

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
  refreshTrigger?: number; // Trigger refresh when this changes
}

const Sidebar: React.FC<SidebarProps> = ({ allBrands, filters, setFilters, maxReachAvailable, sessionId, onBrandDeleted, refreshTrigger }) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  // Function to load brands (can be called externally)
  const loadBrands = React.useCallback(async () => {
    if (!sessionId) return;
    
    setLoadingBrands(true);
    try {
      const fetchedBrands = await fetchBrands(sessionId);
      setBrands(fetchedBrands);
    } catch (error) {
      console.error('Error loading brands:', error);
    } finally {
      setLoadingBrands(false);
    }
  }, [sessionId]);

  // Fetch brands on mount, when sessionId changes, or when refreshTrigger changes
  useEffect(() => {
    loadBrands();
  }, [loadBrands, refreshTrigger]);

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
        <div className="mb-3">
          <PoetypeLogo className="w-full h-auto max-h-8" />
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
            {brands.filter(b => b.is_active).map(brand => (
              <label key={brand.id} className="flex items-center group cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={filters.selectedBrands.includes(brand.name)}
                  onChange={() => handleBrandToggle(brand.name)}
                  className="peer sr-only"
                />
                <div className="w-5 h-5 border rounded bg-white peer-checked:bg-[#D6453D] peer-checked:border-[#D6453D] peer-focus:ring-2 peer-focus:ring-[#D6453D]/20 transition-all flex items-center justify-center border-stone-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100">
                    <path d="M20 6 9 17l-5-5"></path>
                  </svg>
                </div>
                <span className="ml-3 text-base font-medium transition-colors text-stone-600 group-hover:text-stone-900">{brand.name}</span>
              </label>
            ))}
            {brands.filter(b => b.is_active).length === 0 && (
              <p className="text-sm text-stone-400">No brands available</p>
            )}
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