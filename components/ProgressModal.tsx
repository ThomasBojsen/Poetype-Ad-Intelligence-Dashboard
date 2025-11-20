import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProgressModalProps {
  isOpen: boolean;
  timeLeft: number;
  totalTime: number;
}

const ProgressModal: React.FC<ProgressModalProps> = ({ isOpen, timeLeft, totalTime }) => {
  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = ((totalTime - timeLeft) / totalTime) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#111827]/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-[#F3DED7] overflow-hidden p-8 text-center animate-in fade-in zoom-in duration-200">
        
        <Loader2 size={48} className="animate-spin text-[#D94E41] mx-auto mb-6" />
        
        <h2 className="text-2xl font-bold text-[#111827] mb-2">Updating Intelligence</h2>
        <p className="text-[#57534E] mb-8 text-sm leading-relaxed">
          We are gathering fresh data from Meta Ads Library. Please wait while we update your dashboard.
        </p>
        
        <div className="text-5xl font-mono font-bold tracking-tighter text-[#D94E41] mb-2">
            {formatTime(timeLeft)}
        </div>
        <p className="text-xs uppercase tracking-widest text-[#8B8680] font-bold mb-8">Remaining</p>

        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div 
                className="h-full bg-[#D94E41] transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercentage}%` }}
            ></div>
        </div>
      </div>
    </div>
  );
};

export default ProgressModal;