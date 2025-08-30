import React from 'react';
// Calculate 7-day success rate for the paywall
const calculate7DaySuccessRate = () => {
  // This is a simplified version that returns a fixed number
  // In a real application, this would calculate based on actual data
  return 82;
};
export function Paywall({
  onClose
}: {
  onClose: () => void;
}) {
  const successRate = calculate7DaySuccessRate();
  return <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="max-w-md w-full bg-[#0A0A0A] border border-[#00FF41] rounded-lg p-6 relative overflow-hidden">
        {/* Matrix-inspired scanline effect */}
        <div className="absolute inset-0 pointer-events-none opacity-10">
          {Array.from({
          length: 50
        }).map((_, i) => <div key={i} className="h-px bg-[#00FF41]" style={{
          position: 'absolute',
          top: `${i * 10}px`,
          left: 0,
          right: 0,
          opacity: Math.random() * 0.5 + 0.5
        }}></div>)}
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-[#00FF41] mb-4 text-center">
            Le Voile
          </h2>
          <p className="mb-6 text-center">
            Le Signal a été correct à{' '}
            <span className="text-[#00FF41] font-mono font-bold">
              {successRate}%
            </span>{' '}
            sur les 7 derniers jours.
          </p>
          <p className="mb-8 text-center">
            Ne manquez pas les données de demain. Choisissez de savoir.
          </p>
          <div className="flex flex-col gap-3">
            <button className="w-full py-3 bg-[#00FF41] text-black font-bold rounded hover:bg-opacity-90 transition-colors">
              Accéder à la Réalité
            </button>
            <button onClick={onClose} className="w-full py-3 bg-transparent border border-[#333] text-[#CCC] rounded hover:bg-[#111] transition-colors">
              Retourner à la Simulation
            </button>
          </div>
          <div className="mt-6 text-center text-xs text-[#666]">
            <p>Accès premium: 9.99€/mois</p>
            <p>Annulation à tout moment</p>
          </div>
        </div>
      </div>
    </div>;
}