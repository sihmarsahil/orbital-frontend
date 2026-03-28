import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';

export default function ChatPanel({ messages, sendMessage, mode, isOpen, onClose }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) {
        endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e) => {
    e.preventDefault();
    if (text.trim()) {
      sendMessage(text);
      setText('');
    }
  };

  const formatTime = (ts) => {
      const d = new Date(ts);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-80 md:bottom-6 md:right-6 glass-panel rounded-2xl flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-slate-300 dark:border-white/10 z-[100] transform transition-all duration-300 pointer-events-auto h-[400px] md:h-[450px]">
      <div className="flex justify-between items-center bg-gray-900 border-b border-gray-800 p-3">
        <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold tracking-widest text-emerald-400">SECURE COMMS</span>
        </div>
        <button onClick={onClose} className="text-slate-500 dark:text-gray-500 hover:text-red-400 focus:outline-none transition-colors">
            <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-grow p-4 overflow-y-auto flex flex-col gap-3 scrollbar-hide">
        {messages.map((m, i) => {
            const isMe = m.senderType === mode;
            return (
               <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                 <div className="flex items-center gap-1 mb-1">
                     <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-500">{m.senderType}</span>
                     <span className="text-[10px] text-gray-700 font-mono">{formatTime(m.timestamp)}</span>
                 </div>
                 <div className={`px-3 py-2 rounded-lg text-sm max-w-[90%] shadow-md ${isMe ? 'bg-emerald-900/60 text-emerald-100 rounded-tr-none border border-emerald-800' : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'}`}>
                    {m.text}
                 </div>
               </div>
            );
        })}
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 font-mono text-xs text-center opacity-50">
               <MessageSquare className="w-8 h-8 mb-2 opacity-50 block" />
               E2E Encrypted Chat Session <br/> Started
            </div>
        )}
        <div ref={endRef} className="h-0" />
      </div>

      <form onSubmit={handleSend} className="bg-gray-900 border-t border-gray-800 p-2 flex gap-2">
         <input 
            type="text" 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Type message..." 
            className="flex-grow bg-gray-950 border border-gray-800 rounded px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-left font-sans"
         />
         <button type="submit" disabled={!text.trim()} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-900 dark:text-white rounded p-1.5 flex items-center justify-center transition-colors">
            <Send className="w-4 h-4 ml-0.5" />
         </button>
      </form>
    </div>
  );
}
