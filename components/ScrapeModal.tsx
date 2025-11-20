import React, { useState } from 'react';
import { X, UploadCloud, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';

interface ScrapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartScrape: (urls: string[]) => void;
}

const ScrapeModal: React.FC<ScrapeModalProps> = ({ isOpen, onClose, onStartScrape }) => {
  // State to hold array of URL strings. Starts with one empty field.
  const [urls, setUrls] = useState<string[]>(['']);

  if (!isOpen) return null;

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const addField = () => {
    setUrls([...urls, '']);
  };

  const removeField = (index: number) => {
    const newUrls = urls.filter((_, i) => i !== index);
    // Ensure we always have at least one field
    setUrls(newUrls.length ? newUrls : ['']);
  };

  const handleSubmit = () => {
    const validUrls = urls
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (validUrls.length === 0) return;
    
    onStartScrape(validUrls);
    // Reset form slightly delayed or handled by parent unmount, 
    // but good to reset state if reused.
    setUrls(['']); 
  };

  // Helper to check if there is at least one valid URL to enable submit
  const hasValidUrl = urls.some(u => u.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-[#F3DED7] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#F3DED7] flex justify-between items-center bg-[#FFF8F4] shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-[#D94E41]/10 p-2 rounded-md">
              <UploadCloud className="text-[#D94E41]" size={20} />
            </div>
            <h2 className="text-lg font-bold text-[#111827]">Add New Competitors</h2>
          </div>
          <button onClick={onClose} className="text-[#8B8680] hover:text-[#111827] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <p className="text-sm text-[#57534E] mb-4">
            Enter Facebook Ad Library links (or Page URLs) below. We will scrape new data and update the dashboard automatically.
          </p>

          <div className="space-y-3">
            {urls.map((url, index) => (
              <div key={index} className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
                <div className="relative flex-1">
                  <div className="absolute top-1/2 -translate-y-1/2 left-3 text-[#8B8680]">
                      <LinkIcon size={16} />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-9 pr-4 py-3 text-sm bg-white border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#D94E41] focus:border-[#D94E41] outline-none placeholder:text-gray-400 transition-all"
                    placeholder="https://www.facebook.com/ads/library/..."
                    value={url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    autoFocus={index === urls.length - 1 && urls.length > 1} // Auto focus on new fields
                  />
                </div>
                
                {/* Show delete button if there is more than 1 field */}
                {urls.length > 1 && (
                  <button 
                    onClick={() => removeField(index)}
                    className="p-3 text-[#8B8680] hover:text-[#D94E41] hover:bg-[#FFF8F4] rounded-lg transition-colors"
                    title="Remove link"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button 
            onClick={addField}
            className="mt-4 flex items-center gap-2 text-sm font-bold text-[#D94E41] hover:text-[#B9382C] transition-colors px-2 py-1 rounded-md hover:bg-[#FFF8F4]"
          >
            <Plus size={18} />
            Add another link
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#F3DED7] bg-gray-50 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-[#57534E] hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!hasValidUrl}
            className="px-4 py-2 text-sm font-bold text-white bg-[#D94E41] hover:bg-[#B9382C] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
          >
            Start Scraping
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScrapeModal;