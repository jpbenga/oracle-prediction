import React, { useState } from 'react';
import { TemporalDashboard } from './components/TemporalDashboard';
export function App() {
  const [isPremium, setIsPremium] = useState(false);
  return <div className="w-full min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans">
      <header className="p-4 border-b border-[#222] flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[#00FF41]">The Oracle</h1>
        <button onClick={() => setIsPremium(!isPremium)} className={`px-4 py-2 rounded ${isPremium ? 'bg-[#333] text-[#E0E0E0]' : 'bg-[#00FF41] text-black'}`}>
          {isPremium ? 'Switch to Free View' : 'Activate Premium'}
        </button>
      </header>
      <main className="container mx-auto p-4">
        <TemporalDashboard isPremium={isPremium} />
      </main>
      <footer className="p-4 border-t border-[#222] text-center text-sm text-[#666]">
        The Oracle © 2023 — Trust the signal, not the noise.
      </footer>
    </div>;
}