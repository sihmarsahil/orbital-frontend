import React from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ isDark, toggleTheme }) {
  return (
    <button 
      onClick={toggleTheme} 
      className="fixed top-6 left-6 z-[999] p-3 rounded-full bg-indigo-100/50 dark:bg-black/40 backdrop-blur-md border border-indigo-200 dark:border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-none transition-transform hover:scale-110 active:scale-95 text-indigo-800 dark:text-gray-300 hover:text-fuchsia-600 dark:hover:text-fuchsia-300"
      title="Toggle Light/Dark Mode"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
