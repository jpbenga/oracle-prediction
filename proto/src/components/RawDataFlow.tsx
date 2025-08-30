import React from 'react';
import { XIcon, CheckIcon, ActivityIcon, TrophyIcon } from 'lucide-react';
type Prediction = {
  id: string;
  sport: string;
  league: string;
  time: string;
  teamA: string;
  teamB: string;
  prediction: string;
  confidence: number;
  result?: boolean;
};
export function RawDataFlow({
  predictions,
  onClose,
  dayOffset
}: {
  predictions: Prediction[];
  onClose: () => void;
  dayOffset: number;
}) {
  const isPast = dayOffset < 0;
  // Sort predictions by time
  const sortedPredictions = [...predictions].sort((a, b) => a.time.localeCompare(b.time));
  // Calculate success rate if past
  const successRate = isPast ? (predictions.filter(p => p.result).length / predictions.length * 100).toFixed(0) : null;
  // Sport icon mapping
  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'football':
        return <div className="w-4 h-4" />;
      case 'basketball':
        return <ActivityIcon className="w-4 h-4" />;
      default:
        return <TrophyIcon className="w-4 h-4" />;
    }
  };
  return <div className="fixed inset-0 bg-black bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="max-w-3xl w-full bg-[#080808] border border-[#222] rounded-lg overflow-hidden relative">
        {/* Matrix-inspired scanline effect */}
        <div className="absolute inset-0 pointer-events-none opacity-5">
          {Array.from({
          length: 100
        }).map((_, i) => <div key={i} className="h-px bg-[#00FF41]" style={{
          position: 'absolute',
          top: `${i * 5}px`,
          left: 0,
          right: 0,
          opacity: Math.random() * 0.5 + 0.5
        }}></div>)}
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#222] bg-[#0A0A0A] relative z-10">
          <div>
            <h3 className="text-sm font-mono text-[#666]">
              FLUX DE DONNÉES BRUT
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[#00FF41] font-mono">
                {dayOffset === 0 ? "AUJOURD'HUI" : dayOffset < 0 ? `J${dayOffset}` : `J+${dayOffset}`}
              </span>
              {successRate && <span className="text-xs font-mono bg-[#111] py-1 px-2 rounded">
                  TAUX DE RÉUSSITE:{' '}
                  <span className="text-[#00FF41]">{successRate}%</span>
                </span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#111] rounded-full transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        {/* Raw Data Table */}
        <div className="p-2 max-h-[70vh] overflow-y-auto relative z-10">
          <table className="w-full border-collapse font-mono text-xs">
            <thead className="text-[#666]">
              <tr className="border-b border-[#222]">
                <th className="p-2 text-left">SPORT</th>
                <th className="p-2 text-left">HEURE</th>
                <th className="p-2 text-left">COMPÉTITION</th>
                <th className="p-2 text-left">MATCH</th>
                <th className="p-2 text-left">PRÉDICTION</th>
                <th className="p-2 text-left">CONF.</th>
                {isPast && <th className="p-2 text-center">RÉS.</th>}
              </tr>
            </thead>
            <tbody>
              {sortedPredictions.map(prediction => <tr key={prediction.id} className="border-b border-[#111] hover:bg-[#0A0A0A]">
                  <td className="p-2">{getSportIcon(prediction.sport)}</td>
                  <td className="p-2">{prediction.time}</td>
                  <td className="p-2">{prediction.league}</td>
                  <td className="p-2">
                    {prediction.teamA} vs {prediction.teamB}
                  </td>
                  <td className="p-2 text-[#00FF41]">
                    {prediction.prediction}
                  </td>
                  <td className="p-2">
                    {(prediction.confidence * 100).toFixed(0)}%
                  </td>
                  {isPast && prediction.result !== undefined && <td className="p-2 text-center">
                      {prediction.result ? <CheckIcon className="w-4 h-4 text-green-500 inline" /> : <XIcon className="w-4 h-4 text-red-500 inline" />}
                    </td>}
                </tr>)}
            </tbody>
          </table>
        </div>
        {/* Footer */}
        <div className="p-3 border-t border-[#222] bg-[#0A0A0A] text-center relative z-10">
          <span className="text-[#666] text-xs font-mono">
            TOTAL: {predictions.length} PRÉDICTIONS
          </span>
        </div>
      </div>
    </div>;
}