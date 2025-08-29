import React from 'react';
import { CheckIcon, XIcon, TrophyIcon } from 'lucide-react';
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
export function PredictionCard({
  prediction,
  isPast,
  isFuture,
  isPremium
}: {
  prediction: Prediction;
  isPast: boolean;
  isFuture: boolean;
  isPremium: boolean;
}) {
  // Determine if this prediction should be locked (future + non-premium)
  const isLocked = isFuture && !isPremium;
  // Sport icon mapping
  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'football':
        return <div className="w-5 h-5" />;
      case 'basketball':
        return <div className="w-5 h-5" />;
      default:
        return <TrophyIcon className="w-5 h-5" />;
    }
  };
  return <div className={`rounded-lg border ${isLocked ? 'border-[#333] bg-[#111] opacity-70' : 'border-[#222] bg-[#121212]'} overflow-hidden`}>
      {/* Level 1: Context */}
      <div className="flex items-center justify-between p-3 border-b border-[#222] bg-[#0F0F0F]">
        <div className="flex items-center gap-2">
          {getSportIcon(prediction.sport)}
          <span className="text-sm">{prediction.league}</span>
        </div>
        <span className="text-sm font-mono">{prediction.time}</span>
      </div>
      {/* Level 2: Teams */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="font-medium">{prediction.teamA}</span>
          <span className="text-[#666]">vs</span>
          <span className="font-medium">{prediction.teamB}</span>
        </div>
        {/* Level 3: Prediction */}
        {!isLocked ? <div className="mb-3">
            <div className="text-center mb-2">
              <span className="text-[#00FF41] font-mono font-bold">
                {prediction.prediction}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs">Confidence:</span>
              <div className="flex-1 bg-[#222] h-2 rounded-full overflow-hidden">
                <div className="h-full bg-[#00FF41]" style={{
              width: `${prediction.confidence * 100}%`
            }}></div>
              </div>
              <span className="font-mono text-xs">
                {(prediction.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div> : <div className="text-center py-4 px-2 border border-dashed border-[#333] rounded bg-[#0A0A0A] bg-opacity-50">
            <p className="text-[#888] text-sm mb-1">Future prediction locked</p>
            <p className="text-[#00FF41] text-xs">Upgrade to access</p>
          </div>}
        {/* Level 4: Result (for past predictions) */}
        {isPast && prediction.result !== undefined && <div className={`mt-3 p-2 rounded flex justify-center items-center gap-2 ${prediction.result ? 'bg-[#0A2A0A]' : 'bg-[#2A0A0A]'}`}>
            {prediction.result ? <>
                <CheckIcon className="w-4 h-4 text-green-500" />
                <span className="text-green-500 font-medium">Correct</span>
              </> : <>
                <XIcon className="w-4 h-4 text-red-500" />
                <span className="text-red-500 font-medium">Incorrect</span>
              </>}
          </div>}
      </div>
    </div>;
}