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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1221]/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-[#EADFD8] overflow-hidden p-8 text-center animate-in fade-in zoom-in duration-200">
        
        <Loader2 size={48} className="animate-spin text-[#D6453D] mx-auto mb-6" />
        
        <h2 className="text-2xl font-bold text-[#0B1221] mb-2">Opdaterer Indsigter</h2>
        <p className="text-stone-500 mb-4 text-sm leading-relaxed">
          Vent venligst – dine annoncer bliver hentet fra Meta. Dette tager normalt et øjeblik.
        </p>
        <p className="text-sm font-semibold text-[#D6453D] uppercase tracking-wide">
          Vent venligst...
        </p>
      </div>
    </div>
  );
};

export default ProgressModal;