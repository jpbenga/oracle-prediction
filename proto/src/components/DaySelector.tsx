import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, LockIcon } from 'lucide-react';
export function DaySelector({
  selectedDayOffset,
  onSelectDay,
  isPremium
}: {
  selectedDayOffset: number;
  onSelectDay: (offset: number) => void;
  isPremium: boolean;
}) {
  // Generate array of day offsets from -6 to +6
  const dayOffsets = Array.from({
    length: 13
  }, (_, i) => i - 6);
  // Get date for a given offset
  const getDateForOffset = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date;
  };
  // Format date as "Mon 21" or "Today" for offset 0
  const formatDate = (date: Date, offset: number) => {
    if (offset === 0) return 'Today';
    const day = date.toLocaleDateString('en-US', {
      weekday: 'short'
    });
    const dateNum = date.getDate();
    return `${day} ${dateNum}`;
  };
  return <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => onSelectDay(Math.max(selectedDayOffset - 1, -6))} className="p-2 rounded-full hover:bg-[#222] transition-colors" disabled={selectedDayOffset <= -6}>
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold">
          {formatDate(getDateForOffset(selectedDayOffset), selectedDayOffset)}
        </h2>
        <button onClick={() => onSelectDay(Math.min(selectedDayOffset + 1, 6))} className="p-2 rounded-full hover:bg-[#222] transition-colors" disabled={selectedDayOffset >= 6}>
          <ChevronRightIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="flex overflow-x-auto pb-4 space-x-2 scrollbar-hide">
        {dayOffsets.map(offset => <button key={offset} onClick={() => onSelectDay(offset)} className={`flex flex-col items-center justify-center min-w-[60px] h-16 rounded p-2 transition-all ${offset === selectedDayOffset ? 'bg-[#222] border border-[#00FF41]' : 'bg-[#111] hover:bg-[#1A1A1A]'} ${!isPremium && offset > 0 ? 'opacity-60' : ''}`}>
            <span className="text-xs">
              {offset === 0 ? 'Today' : offset > 0 ? `D+${offset}` : `D${offset}`}
            </span>
            <span className="text-sm font-mono">
              {getDateForOffset(offset).getDate()}
            </span>
            {!isPremium && offset > 0 && <LockIcon className="w-3 h-3 text-[#666] absolute top-1 right-1" />}
          </button>)}
      </div>
    </div>;
}