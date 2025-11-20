import React, { useState } from 'react';
import { AdData } from '../types';
import { ExternalLink, Eye, MessageSquareText, VideoOff } from 'lucide-react';

interface AdCardProps {
  data: AdData;
}

const AdCard: React.FC<AdCardProps> = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#F3DED7] overflow-hidden hover:shadow-lg hover:border-[#D94E41]/30 transition-all duration-300 flex flex-col group">
      {/* Video/Thumbnail Section */}
      <div className="relative aspect-video bg-[#111827] flex items-center justify-center overflow-hidden">
        {data.video_url && !videoError ? (
          <video 
            src={data.video_url}
            className="w-full h-full object-cover"
            controls
            onError={() => setVideoError(true)}
            poster={data.thumbnail} 
          />
        ) : data.thumbnail ? (
           // Fallback to just showing the thumbnail if no video or video error
           <img 
             src={data.thumbnail} 
             alt="Ad Thumbnail" 
             className="w-full h-full object-cover opacity-90"
           />
        ) : (
          <div className="flex flex-col items-center text-[#8B8680] p-4 text-center">
            <VideoOff className="mb-2 opacity-50" size={32} />
            <span className="text-sm font-medium">No video available</span>
          </div>
        )}
        
        <div className="absolute top-3 right-3 bg-[#111827]/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1.5 border border-white/10 shadow-sm z-10">
          <Eye size={14} className="text-[#D94E41]" />
          {data.reach >= 1000 ? `${(data.reach / 1000).toFixed(1)}k` : data.reach}
        </div>
      </div>

      {/* Content Body */}
      <div className="p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-3">
          <span className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wide bg-[#FFF8F4] text-[#D94E41] border border-[#F3DED7]">
            {data.page_name}
          </span>
        </div>

        <h3 className="font-bold text-[#111827] text-lg leading-tight mb-5 line-clamp-2 min-h-[3.5rem]">
            {data.heading || "No Heading"}
        </h3>

        {/* Expandable Section */}
        <div className="mt-auto">
            <div className={`bg-[#FFF8F4] rounded-lg border border-[#F3DED7] overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[600px] mb-4' : 'max-h-0 opacity-0'}`}>
                <div className="p-5 text-sm text-[#57534E]">
                    <p className="font-bold text-[#111827] mb-2 uppercase text-xs tracking-wider">Ad Copy</p>
                    <p className="italic leading-relaxed whitespace-pre-wrap">{data.ad_copy}</p>
                </div>
            </div>

            <div className="flex gap-3">
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex-1 py-2.5 px-4 border-2 border-[#F3DED7] rounded-lg text-sm font-bold text-[#111827] hover:border-[#111827] hover:bg-white transition-all flex items-center justify-center gap-2"
                >
                    <MessageSquareText size={16} className={isExpanded ? "text-[#D94E41]" : "text-[#8B8680]"} />
                    {isExpanded ? 'Hide Details' : 'View Copy'}
                </button>
                
                <a 
                    href={data.ad_library_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex-1 py-2.5 px-4 bg-[#D94E41] rounded-lg text-sm font-bold text-white hover:bg-[#B9382C] transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                    <span>Ad Library</span>
                    <ExternalLink size={16} />
                </a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AdCard;