import React from 'react';
import { PredictionCard } from './PredictionCard';
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
export function PredictionsList({
  dayOffset,
  isPremium
}: {
  dayOffset: number;
  isPremium: boolean;
}) {
  const predictions = generateMockPredictions(dayOffset);
  // Calculate success rate for past days
  const successRate = dayOffset < 0 ? (predictions.filter(p => p.result).length / predictions.length * 100).toFixed(0) : null;
  return <div>
      {successRate && <div className="mb-4 p-3 bg-[#111] rounded border border-[#333] text-center">
          <span className="font-mono text-sm">Success Rate: </span>
          <span className="font-mono font-bold text-[#00FF41]">
            {successRate}%
          </span>
        </div>}
      <div className="space-y-4">
        {predictions.map(prediction => <PredictionCard key={prediction.id} prediction={prediction} isPast={dayOffset < 0} isFuture={dayOffset > 0} isPremium={isPremium} />)}
      </div>
    </div>;
}