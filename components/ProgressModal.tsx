import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProgressModalProps {
  isOpen: boolean;
  timeLeft: number;
  totalTime: number;
}

const ProgressModal: React.FC<ProgressModalProps> = ({ isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#111827]/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-[#F3DED7] overflow-hidden p-8 text-center animate-in fade-in zoom-in duration-200">
        
        <Loader2 size={48} className="animate-spin text-[#D94E41] mx-auto mb-6" />
        
        <h2 className="text-2xl font-bold text-[#111827] mb-2">Updating Intelligence</h2>
        <p className="text-[#57534E] mb-4 text-sm leading-relaxed">
          Hang tight—your ads are being fetched from Meta. This usually takes a moment.
        </p>
        <p className="text-sm font-semibold text-[#D94E41] uppercase tracking-wide">
          Please wait...
        </p>
      </div>
    </div>
  );
};

export default ProgressModal;