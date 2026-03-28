import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function SessionTimer({ isActive }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval;
    if (isActive) {
      interval = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const displayTime = () => {
    const hrs = Math.floor(elapsed / 3600);
    const mins = Math.floor((elapsed % 3600) / 60);
    const secs = elapsed % 60;
    
    const parts = [
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ];
    if (hrs > 0) parts.unshift(hrs.toString().padStart(2, '0'));
    
    return parts.join(':');
  };

  if (!isActive && elapsed === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs font-mono bg-white/60 dark:bg-black/40 px-4 py-2 rounded-xl border border-slate-300 dark:border-white/5 shadow-inner backdrop-blur-md">
       <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
       <span className="text-slate-700 dark:text-gray-300 font-bold tracking-widest">{displayTime()}</span>
    </div>
  );
}
