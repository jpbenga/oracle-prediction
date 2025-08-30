import React, { useState } from 'react';
import { PredictionCard } from './PredictionCard';
import { RawDataFlow } from './RawDataFlow';
// Mock data for predictions
const generateMockPredictions = (dayOffset: number) => {
  // Past predictions (with results)
  if (dayOffset < 0) {
    return [{
      id: `${dayOffset}-1`,
      sport: 'football',
      league: 'Premier League',
      time: '15:00',
      teamA: 'Arsenal',
      teamB: 'Chelsea',
      prediction: 'Arsenal to Win',
      confidence: 0.85,
      result: Math.random() > 0.3 // 70% success rate for demo
    }, {
      id: `${dayOffset}-2`,
      sport: 'basketball',
      league: 'NBA',
      time: '19:30',
      teamA: 'Lakers',
      teamB: 'Celtics',
      prediction: 'Over 210.5 Points',
      confidence: 0.75,
      result: Math.random() > 0.3
    }, {
      id: `${dayOffset}-3`,
      sport: 'tennis',
      league: 'ATP Tour',
      time: '13:00',
      teamA: 'Djokovic',
      teamB: 'Nadal',
      prediction: 'Nadal to Win',
      confidence: 0.65,
      result: Math.random() > 0.3
    }];
  }
  // Today or future predictions (no results yet)
  return [{
    id: `${dayOffset}-1`,
    sport: 'football',
    league: 'La Liga',
    time: '20:00',
    teamA: 'Barcelona',
    teamB: 'Real Madrid',
    prediction: 'Barcelona to Win',
    confidence: 0.8
  }, {
    id: `${dayOffset}-2`,
    sport: 'basketball',
    league: 'NBA',
    time: '18:00',
    teamA: 'Warriors',
    teamB: 'Nets',
    prediction: 'Warriors -4.5',
    confidence: 0.9
  }, {
    id: `${dayOffset}-3`,
    sport: 'tennis',
    league: 'WTA Tour',
    time: '14:30',
    teamA: 'Swiatek',
    teamB: 'Gauff',
    prediction: 'Swiatek in Straight Sets',
    confidence: 0.7
  }];
};
// Generate more predictions for raw data flow
const generateRawDataPredictions = (dayOffset: number) => {
  const basePredictions = generateMockPredictions(dayOffset);
  // Add more predictions to simulate a complete dataset
  const additionalPredictions = [{
    id: `${dayOffset}-4`,
    sport: 'football',
    league: 'Bundesliga',
    time: '16:30',
    teamA: 'Bayern',
    teamB: 'Dortmund',
    prediction: 'Over 2.5 Goals',
    confidence: 0.78,
    result: dayOffset < 0 ? Math.random() > 0.3 : undefined
  }, {
    id: `${dayOffset}-5`,
    sport: 'basketball',
    league: 'EuroLeague',
    time: '20:45',
    teamA: 'Real Madrid',
    teamB: 'CSKA Moscow',
    prediction: 'Real Madrid -3.5',
    confidence: 0.72,
    result: dayOffset < 0 ? Math.random() > 0.3 : undefined
  }, {
    id: `${dayOffset}-6`,
    sport: 'tennis',
    league: 'Grand Slam',
    time: '12:00',
    teamA: 'Medvedev',
    teamB: 'Zverev',
    prediction: 'Over 3.5 Sets',
    confidence: 0.81,
    result: dayOffset < 0 ? Math.random() > 0.3 : undefined
  }, {
    id: `${dayOffset}-7`,
    sport: 'football',
    league: 'Serie A',
    time: '19:45',
    teamA: 'Juventus',
    teamB: 'Inter',
    prediction: 'Under 2.5 Goals',
    confidence: 0.68,
    result: dayOffset < 0 ? Math.random() > 0.3 : undefined
  }, {
    id: `${dayOffset}-8`,
    sport: 'basketball',
    league: 'NBA',
    time: '22:00',
    teamA: 'Bucks',
    teamB: 'Suns',
    prediction: 'Bucks to Win',
    confidence: 0.77,
    result: dayOffset < 0 ? Math.random() > 0.3 : undefined
  }];
  return [...basePredictions, ...additionalPredictions];
};
// Calculate 7-day rolling success rate
const calculate7DaySuccessRate = () => {
  let totalPredictions = 0;
  let successfulPredictions = 0;
  // Gather predictions from past 7 days (including today)
  for (let i = -6; i <= 0; i++) {
    const dayPredictions = generateMockPredictions(i);
    // Only count predictions with results (past days)
    if (i < 0) {
      dayPredictions.forEach(prediction => {
        if (prediction.result !== undefined) {
          totalPredictions++;
          if (prediction.result) successfulPredictions++;
        }
      });
    }
  }
  return totalPredictions > 0 ? Math.round(successfulPredictions / totalPredictions * 100) : 0;
};
export function PredictionsList({
  dayOffset,
  isPremium
}: {
  dayOffset: number;
  isPremium: boolean;
}) {
  const [showRawData, setShowRawData] = useState(false);
  const predictions = generateMockPredictions(dayOffset);
  const rawDataPredictions = generateRawDataPredictions(dayOffset);
  // Calculate success rate for past days
  const successRate = dayOffset < 0 ? (predictions.filter(p => p.result).length / predictions.length * 100).toFixed(0) : null;
  // 7-day rolling success rate (constant for demo purposes)
  const sevenDayRate = calculate7DaySuccessRate();
  // Determine if raw data should be accessible
  const isRawDataLocked = !isPremium && dayOffset > 0;
  return <div>
      {/* 7-Day Rolling Success Rate Indicator */}
      <div className="mb-6 p-4 bg-[#0A0A0A] border border-[#222] rounded-lg relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-5">
          {Array.from({
          length: 20
        }).map((_, i) => <div key={i} className="h-px bg-[#00FF41]" style={{
          position: 'absolute',
          top: `${i * 5}px`,
          left: 0,
          right: 0,
          opacity: Math.random() * 0.5 + 0.5
        }}></div>)}
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="text-xs text-[#888] mb-1 font-mono">
              FIABILITÉ DU SIGNAL (7J)
            </div>
            <div className="text-2xl font-bold font-mono text-[#00FF41]">
              {sevenDayRate}%
            </div>
          </div>
          {!isRawDataLocked && <button onClick={() => setShowRawData(true)} className="text-xs font-mono text-[#888] hover:text-[#00FF41] transition-colors border border-[#333] px-3 py-1 rounded flex items-center gap-1">
              <span>&lt;&gt;</span>
              <span>VOIR LE FLUX COMPLET</span>
            </button>}
          {isRawDataLocked && <div className="text-xs font-mono text-[#444] border border-[#333] px-3 py-1 rounded flex items-center gap-1 opacity-60">
              <span>&lt;&gt;</span>
              <span>FLUX VERROUILLÉ</span>
            </div>}
        </div>
      </div>
      {/* Daily Success Rate (for past days) */}
      {successRate && <div className="mb-4 p-3 bg-[#111] rounded border border-[#333] text-center">
          <span className="font-mono text-sm">Success Rate: </span>
          <span className="font-mono font-bold text-[#00FF41]">
            {successRate}%
          </span>
        </div>}
      {/* Prediction Cards */}
      <div className="space-y-4">
        {predictions.map(prediction => <PredictionCard key={prediction.id} prediction={prediction} isPast={dayOffset < 0} isFuture={dayOffset > 0} isPremium={isPremium} />)}
      </div>
      {/* Raw Data Flow Modal */}
      {showRawData && <RawDataFlow predictions={rawDataPredictions} onClose={() => setShowRawData(false)} dayOffset={dayOffset} />}
    </div>;
}