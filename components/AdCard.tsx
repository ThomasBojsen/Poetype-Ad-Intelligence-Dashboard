import React, { useState } from 'react';
import { AdData } from '../types';
import { ExternalLink, Eye, MessageSquareText, VideoOff, Play } from 'lucide-react';

interface AdCardProps {
  data: AdData;
}

const AdCard: React.FC<AdCardProps> = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const reachDisplay = data.reach >= 1000 ? `${(data.reach / 1000).toFixed(1)}k` : data.reach.toString();

  return (
    <div className="bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group border-[#EADFD8]">
      {/* Video/Thumbnail Section */}
      <div className="relative aspect-video overflow-hidden bg-stone-100">
        {data.video_url && !videoError ? (
          <video 
            src={data.video_url}
            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
            controls
            onError={() => setVideoError(true)}
            poster={data.thumbnail} 
          />
        ) : data.thumbnail ? (
          <img 
            src={data.thumbnail} 
            alt="Ad Thumbnail" 
            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-stone-400 p-4 text-center">
            <VideoOff className="mb-2 opacity-50" size={32} />
            <span className="text-sm font-medium">No video available</span>
          </div>
        )}
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 bg-black/10 flex items-center justify-center group-hover:bg-black/20 transition-colors">
          <div className="flex group-hover:scale-110 transition-transform text-white bg-black/30 w-14 h-14 border-white/20 border rounded-full backdrop-blur-sm items-center justify-center">
            <Play size={24} strokeWidth={1.5} className="fill-current ml-1" />
          </div>
        </div>
        
        {/* Reach Badge */}
        <div className="absolute top-3 right-3 backdrop-blur text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-white/10 shadow-sm bg-[#0B1221]/80">
          <Eye size={14} strokeWidth={1.5} />
          {reachDisplay}
        </div>
      </div>

      {/* Content Body */}
      <div className="p-6">
        <div className="inline-block bg-[#FFF2EB] border border-[#F5E6DE] text-[#D6453D] text-[11px] font-semibold px-2.5 py-1 rounded-full mb-3 tracking-wide uppercase">
          {data.page_name}
        </div>
        
        <h3 className="text-lg font-semibold mb-6 truncate text-[#0B1221]">
          {data.heading || "No Heading"}
        </h3>

        {/* Expandable Section */}
        <div className={`bg-[#FFF2EB] rounded-lg border border-[#F5E6DE] overflow-hidden transition-all duration-300 ease-in-out mb-4 ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-5 text-sm text-stone-600">
            <p className="font-semibold text-[#0B1221] mb-2 uppercase text-xs tracking-wider">Ad Copy</p>
            <p className="leading-relaxed whitespace-pre-wrap">{data.ad_copy}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 flex items-center justify-center gap-2 border py-2.5 px-4 rounded-full text-sm font-medium transition-colors border-[#EADFD8] hover:bg-[#FFF8F5] text-stone-600 hover:text-[#D6453D]"
          >
            <MessageSquareText size={16} strokeWidth={1.5} className="opacity-50" />
            View Copy
          </button>
          
          <a 
            href={data.ad_library_url} 
            target="_blank" 
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-[#D6453D] hover:bg-[#C03E36] text-white py-2.5 px-4 rounded-full text-sm font-medium transition-all shadow-md shadow-[#D6453D]/20"
          >
            Ad Library
            <ExternalLink size={16} strokeWidth={1.5} className="opacity-80" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdCard;