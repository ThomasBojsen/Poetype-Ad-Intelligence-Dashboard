import React, { useState, useRef } from 'react';
import { AdData } from '../types';
import { ExternalLink, Eye, MessageSquareText, VideoOff, Play, Pause, TrendingUp, Calendar } from 'lucide-react';

interface AdCardProps {
  data: AdData;
}

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

const AdCard: React.FC<AdCardProps> = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const reachDisplay = data.reach >= 1000 ? `${(data.reach / 1000).toFixed(1)}k` : data.reach.toString();

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleVideoPlay = () => setIsPlaying(true);
  const handleVideoPause = () => setIsPlaying(false);

  return (
    <div className="bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group border-[#EADFD8]">
      {/* Video/Thumbnail Section */}
      <div className="relative aspect-video overflow-hidden bg-stone-100">
        {data.video_url && !videoError ? (
          <video 
            ref={videoRef}
            src={data.video_url}
            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500 relative z-10"
            controls={isPlaying}
            onError={() => setVideoError(true)}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            poster={data.thumbnail && !data.thumbnail.includes('POETYPE-LOGO.svg') ? data.thumbnail : undefined}
          />
        ) : data.thumbnail && data.thumbnail.includes('POETYPE-LOGO.svg') ? (
          <div className="w-full h-full flex items-center justify-center bg-stone-50 p-12">
            <PoetypeLogo className="w-full h-auto max-w-[180px] opacity-50" />
          </div>
        ) : data.thumbnail ? (
          <img 
            src={data.thumbnail} 
            alt="Ad Thumbnail" 
            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-stone-400 p-4 text-center">
            <VideoOff className="mb-2 opacity-50" size={32} />
            <span className="text-sm font-medium">Ingen video tilgængelig</span>
          </div>
        )}
        
        {/* Play Button Overlay - Only show when video exists and not playing */}
        {data.video_url && !videoError && !isPlaying && (
          <div 
            className="absolute inset-0 bg-black/10 flex items-center justify-center group-hover:bg-black/20 transition-colors cursor-pointer z-10"
            onClick={handlePlayPause}
          >
            <div className="flex group-hover:scale-110 transition-transform text-white bg-black/30 w-14 h-14 border-white/20 border rounded-full backdrop-blur-sm items-center justify-center">
              <Play size={24} strokeWidth={1.5} className="fill-current ml-1" />
            </div>
          </div>
        )}
        
        {/* Pause Button Overlay - Show when playing */}
        {data.video_url && !videoError && isPlaying && (
          <div 
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
            onClick={handlePlayPause}
          >
            <div className="flex text-white bg-black/30 w-14 h-14 border-white/20 border rounded-full backdrop-blur-sm items-center justify-center">
              <Pause size={24} strokeWidth={1.5} className="fill-current" />
            </div>
          </div>
        )}
        
        {/* Reach Badge */}
        <div className="absolute top-3 right-3 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-[#0B1221] shadow-lg border border-white/20 z-30">
          <Eye size={14} strokeWidth={2} />
          {reachDisplay}
        </div>
      </div>

      {/* Content Body */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="inline-block bg-[#FFF2EB] border border-[#F5E6DE] text-[#D6453D] text-[11px] font-semibold px-2.5 py-1 rounded-full tracking-wide uppercase">
            {data.page_name}
          </div>
          {data.viral_score !== undefined && (
            <div className="inline-flex items-center gap-1.5 bg-[#0B1221] border border-white/20 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              <TrendingUp size={12} strokeWidth={2.5} className="text-white" />
              <span className="tracking-tight">{data.viral_score.toLocaleString('da-DK')}</span>
              <span className="text-[10px] font-semibold opacity-80">/dag</span>
            </div>
          )}
          {data.days_active !== undefined && (
            <div className="inline-flex items-center gap-1.5 bg-stone-100 border border-stone-200 text-stone-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              <Calendar size={12} strokeWidth={2.5} className="text-stone-700" />
              <span className="tracking-tight">{data.days_active}</span>
              <span className="text-[10px] font-semibold opacity-80">dage</span>
            </div>
          )}
        </div>
        
        <h3 className="text-lg font-semibold mb-6 truncate text-[#0B1221]">
          {data.heading || "Ingen Overskrift"}
        </h3>

        {/* Expandable Section */}
        <div className={`bg-[#FFF2EB] rounded-lg border border-[#F5E6DE] overflow-hidden transition-all duration-300 ease-in-out mb-4 ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-5 text-sm text-stone-600">
            <p className="font-semibold text-[#0B1221] mb-2 uppercase text-xs tracking-wider">Annoncetekst</p>
            <p className="leading-relaxed whitespace-pre-wrap">{data.ad_copy}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 flex items-center justify-center gap-2 border py-2.5 px-4 rounded-full text-sm font-medium transition-colors border-[#EADFD8] hover:bg-[#FFF8F5] text-stone-600 hover:text-[#D6453D]"
          >
            <MessageSquareText size={16} strokeWidth={1.5} className="opacity-50" />
            Se Tekst
          </button>
          
          {(() => {
            // Use specific ad URL if available, otherwise fall back to brand's generic URL
            const libraryUrl = (data.ad_library_url && typeof data.ad_library_url === 'string' && data.ad_library_url.trim() !== '')
              ? data.ad_library_url
              : (data.brand_ad_library_url && typeof data.brand_ad_library_url === 'string' && data.brand_ad_library_url.trim() !== '')
              ? data.brand_ad_library_url
              : null;

            if (libraryUrl) {
              return (
                <a 
                  href={libraryUrl} 
                  target="_blank" 
                  rel="noreferrer noopener"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#D6453D] hover:bg-[#C03E36] text-white py-2.5 px-4 rounded-full text-sm font-medium transition-all shadow-md shadow-[#D6453D]/20 cursor-pointer"
                >
                  Annoncebibliotek
                  <ExternalLink size={16} strokeWidth={1.5} className="opacity-80" />
                </a>
              );
            } else {
              return (
                <button 
                  disabled
                  className="flex-1 flex items-center justify-center gap-2 bg-stone-300 text-stone-500 py-2.5 px-4 rounded-full text-sm font-medium cursor-not-allowed"
                  title="Ad Library URL ikke tilgængelig"
                >
                  Annoncebibliotek
                  <ExternalLink size={16} strokeWidth={1.5} className="opacity-50" />
                </button>
              );
            }
          })()}
        </div>
      </div>
    </div>
  );
};

export default AdCard;