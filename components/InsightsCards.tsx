import React from 'react';
import { AdData } from '../types';
import { Eye, DollarSign, TrendingUp, PieChart } from 'lucide-react';

interface InsightsCardsProps {
  ads: AdData[];
}

const InsightsCards: React.FC<InsightsCardsProps> = ({ ads }) => {
  const totalReach = ads.reduce((sum, a) => sum + (a.reach || 0), 0);
  const totalSpend = ads.reduce((sum, a) => sum + (a.spend || 0), 0);
  const avgRoas = ads.length > 0 ? (ads.reduce((sum, a) => sum + (a.roas || 0), 0) / ads.length) : 0;
  const totalImpressions = ads.reduce((sum, a) => sum + (a.impressions || 0), 0);

  const cards = [
    {
      label: 'Total Reach',
      value: totalReach.toLocaleString('da-DK'),
      icon: <Eye size={24} />,
      color: 'bg-[#FFF2EB]',
    },
    {
      label: 'Total Spend',
      value: `DKK ${totalSpend.toFixed(0)}`,
      icon: <DollarSign size={24} />,
      color: 'bg-[#F1F5F9]',
    },
    {
      label: 'Avg ROAS',
      value: avgRoas.toFixed(2),
      icon: <TrendingUp size={24} />,
      color: 'bg-[#ECFEFF]',
    },
    {
      label: 'Impressions',
      value: totalImpressions.toLocaleString('da-DK'),
      icon: <PieChart size={24} />,
      color: 'bg-[#F8FAFC]',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border border-[#EADFD8] bg-white p-4 shadow-sm flex items-center gap-3 ${card.color}`}>
          <div className="text-[#D6453D]">{card.icon}</div>
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400 font-semibold">{card.label}</p>
            <p className="text-xl font-semibold text-[#0B1221]">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InsightsCards;
