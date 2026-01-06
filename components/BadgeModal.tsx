import React, { useEffect, useState } from 'react';
import { Award, X } from 'lucide-react';
import { getBadgeDetails } from '../utils';

interface BadgeModalProps {
  count: number;
  streak: number;
  onClose: () => void;
}

export const BadgeModal: React.FC<BadgeModalProps> = ({ count, streak, onClose }) => {
  const [details, setDetails] = useState<{title: string, quote: string, icon: string} | null>(null);

  useEffect(() => {
    // Determine which badge to show (Prioritize Streak if both happen, or logic in parent)
    const badge = getBadgeDetails(count, streak);
    if (badge) setDetails(badge);
  }, [count, streak]);

  if (!details) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-pop">
        
        {/* Header Background */}
        <div className="bg-vibrant-300 h-28 flex items-center justify-center relative overflow-hidden">
           <div className="absolute inset-0 bg-vibrant-500 opacity-20 transform -skew-y-6"></div>
          <div className="absolute top-2 right-2 z-10">
            <button onClick={onClose} className="p-1 bg-white/30 rounded-full hover:bg-white/50 text-white transition">
              <X size={20} />
            </button>
          </div>
          <div className="text-7xl filter drop-shadow-lg transform translate-y-4 animate-bounce">
            {details.icon}
          </div>
        </div>

        {/* Content */}
        <div className="pt-8 pb-8 px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">獲得勳章：{details.title}</h2>
          <div className="flex items-center justify-center gap-2 mb-4 text-mint-900 bg-mint-100 py-1 px-3 rounded-full text-sm font-semibold inline-block">
             <Award size={16} className="inline" /> 
             {details.title.includes('連續') ? `連續 ${streak} 個月` : `累積 ${count} 次`}
          </div>
          <p className="text-gray-600 italic text-lg leading-relaxed font-serif">
            "{details.quote}"
          </p>
          
          <button 
            onClick={onClose}
            className="mt-6 w-full py-3 bg-vibrant-500 hover:bg-vibrant-600 text-white rounded-xl font-bold shadow-lg shadow-vibrant-500/30 transition transform hover:-translate-y-1 active:scale-95"
          >
            領取祝福
          </button>
        </div>
      </div>
    </div>
  );
};
