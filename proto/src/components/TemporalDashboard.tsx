import React, { useState } from 'react';
import { DaySelector } from './DaySelector';
import { PredictionsList } from './PredictionsList';
import { Paywall } from './Paywall';
export function TemporalDashboard({
  isPremium
}: {
  isPremium: boolean;
}) {
  const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 is today
  const [showPaywall, setShowPaywall] = useState(false);
  const handleDaySelect = (dayOffset: number) => {
    if (!isPremium && dayOffset > 0) {
      setShowPaywall(true);
    } else {
      setSelectedDayOffset(dayOffset);
    }
  };
  const closePaywall = () => {
    setShowPaywall(false);
  };
  return <div className="relative">
      <DaySelector selectedDayOffset={selectedDayOffset} onSelectDay={handleDaySelect} isPremium={isPremium} />
      <PredictionsList dayOffset={selectedDayOffset} isPremium={isPremium} />
      {showPaywall && <Paywall onClose={closePaywall} />}
    </div>;
}