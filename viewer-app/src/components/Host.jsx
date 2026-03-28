import React, { useRef, useEffect, useState } from 'react';
import { Orbit, Shield, Zap, X, UserCheck, Settings2, Activity, Upload, MessageSquare } from 'lucide-react';
import useWebRTC from '../hooks/useWebRTC';
import { receiveFileChunk, sendFile } from '../utils/fileTransfer';
import ChatPanel from './ChatPanel';
import SessionTimer from './SessionTimer';
import WalkieTalkie from './WalkieTalkie';
import ThemeToggle from './ThemeToggle';

export default function Host({ roomId, passcode, isDark, toggleTheme }) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [permissions, setPermissions] = useState({ mouse: true, clicks: true });
  const [chatOpen, setChatOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const { status, attachLocalStream, activeViewers, metrics, fileChannel, chatMessages, sendChatMessage, isReceivingVoice, sendVoiceMessage } = useWebRTC(roomId, passcode, 'host', permissions);

  // File Receiver Logic for Host
  const fileStateRef = useRef(null);
  useEffect(() => {
     if (fileChannel) {
        fileChannel.onmessage = (event) => {
            receiveFileChunk(event.data, fileStateRef, (completedFile) => {
                const a = document.createElement('a');
                a.href = completedFile.url;
                a.download = completedFile.name;
                document.body.appendChild(a);
                a.click();
            });
        };
     }
  }, [fileChannel]);

  const handleHostFileUpload = (e) => {
      const file = e.target.files[0];
      if (file && fileChannel) {
          console.log(`Sending file to viewer: ${file.name}`);
          sendFile(file, fileChannel);
          e.target.value = null; 
      }
  };

  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { cursor: "always", width: { ideal: 1920 }, frameRate: { ideal: 60 } }, 
          audio: false 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      attachLocalStream(stream);
      setIsStreaming(true);
      
      // Handle the user clicking "Stop sharing" natively in browser
      stream.getVideoTracks()[0].onended = () => {
          setIsStreaming(false);
      };
    } catch (err) {
      console.error("Screen capture failed:", err);
      setIsStreaming(false);
    }
  };

  useEffect(() => { startScreenCapture(); }, []);

  return (
    <>
    <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-50 via-slate-100 to-slate-200 dark:from-violet-950 dark:via-[#0a0514] dark:to-black text-slate-800 dark:text-slate-300 font-sans p-4 md:p-8 flex flex-col items-center relative overflow-hidden transition-colors duration-700">
      {/* Decorative Orbs */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-200/50 dark:bg-fuchsia-600/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] pointer-events-none animate-blob transition-colors duration-700"></div>
      <div className="absolute bottom-0 left-[20%] w-[600px] h-[600px] bg-fuchsia-200/50 dark:bg-violet-600/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] pointer-events-none animate-blob [animation-delay:4000ms] transition-colors duration-700"></div>
      
      {/* Top Header */}
      <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-6 glass-panel p-4 rounded-2xl z-10 transition-all gap-4 ring-1 ring-white/5 shadow-[0_0_30px_rgba(217,70,239,0.1)]">
        <div className="flex items-center gap-4 w-full md:w-auto overflow-hidden">
          <div className="p-2 bg-white/60 dark:bg-black/40 rounded-lg border border-fuchsia-500/20 shrink-0 shadow-[0_0_15px_rgba(217,70,239,0.2)]">
             <Orbit className="text-fuchsia-400 w-6 h-6 animate-[spin_6s_linear_infinite]" />
          </div>
          <div className="min-w-0 flex-1">
             <h1 className="text-xl font-extrabold tracking-wider text-slate-900 dark:text-white leading-none truncate">HOST <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500 drop-shadow-[0_0_10px_rgba(217,70,239,0.4)]">DASHBOARD</span></h1>
             <span className="text-xs text-fuchsia-200/50 font-mono truncate block mt-1">Uplink: <span className="text-fuchsia-300">{roomId}</span></span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 md:gap-3 w-full md:w-auto">
          {/* Action Tools */}
          {activeViewers > 0 && (
            <div className="flex items-center justify-center gap-2 mb-2 md:mb-0 mr-0 md:mr-2 w-full md:w-auto">
                 <button onClick={() => setChatOpen(!chatOpen)} className={`flex items-center justify-center p-2 md:p-2.5 rounded-xl transition-all shadow-sm ${chatOpen ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400' : 'bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300/50 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-emerald-300'}`} title="Toggle Chat">
                    <MessageSquare className="w-5 h-5 md:w-5 md:h-5" />
                    {chatMessages.length > 0 && !chatOpen && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>}
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" onChange={handleHostFileUpload} />
                 <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center p-2 md:p-2.5 rounded-xl bg-slate-200/50 dark:bg-white/5 hover:bg-blue-500/20 border border-slate-300 dark:border-white/10 hover:border-blue-500/50 text-slate-600 dark:text-gray-400 hover:text-blue-400 transition-all shadow-sm" title="Send File to Viewer">
                    <Upload className="w-5 h-5" /> <span className="text-[10px] md:text-xs ml-2 hidden sm:block uppercase font-bold tracking-widest text-slate-900 dark:text-white/80">Push File</span>
                 </button>
                 <WalkieTalkie onSendVoice={sendVoiceMessage} isReceiving={isReceivingVoice} />
            </div>
          )}

          {/* Real-time WebRTC HUD Metrics */}
          {activeViewers > 0 && (
             <div className="flex flex-wrap items-center justify-center gap-2 w-full md:w-auto">
               <SessionTimer isActive={activeViewers > 0} />
               <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs font-mono bg-white/60 dark:bg-black/40 px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-slate-300 dark:border-white/5 shadow-inner backdrop-blur-md">
                 <span className="text-slate-600 dark:text-gray-400 flex items-center gap-1"><Activity className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-500"/> FPS: <span className="text-blue-400 font-bold">{metrics.fps}</span></span>
                 <span className="text-slate-600 dark:text-gray-400">PING: <span className="text-emerald-400 font-bold">{metrics.ping}ms</span></span>
               </div>
             </div>
          )}
          <div className="flex items-center justify-center gap-2 w-full sm:w-auto text-[10px] md:text-xs font-mono bg-white/60 dark:bg-black/40 px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-slate-300 dark:border-white/5 shadow-inner backdrop-blur-md mt-2 md:mt-0">
            <UserCheck className={activeViewers > 0 ? 'text-cyan-400' : 'text-gray-600'} w="14" h="14" /> 
            <span className="text-slate-700 dark:text-gray-300">WATCHING: <span className={activeViewers > 0 ? 'text-cyan-400 font-bold text-sm' : ''}>{activeViewers}</span></span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono bg-white/60 dark:bg-black/40 px-4 py-2 rounded-xl border border-slate-300 dark:border-white/5 shadow-inner backdrop-blur-md">
            <Shield className="text-emerald-500 w-4 h-4" /> 
            <span className="text-slate-700 dark:text-gray-300 font-bold">PIN: {passcode}</span>
          </div>
          <button className="p-2 ml-1 md:ml-2 hover:bg-red-500/20 text-slate-500 dark:text-gray-500 hover:text-red-400 rounded-xl transition-all" onClick={() => window.location.reload()}>
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Security Permissions Bar */}
      <div className="w-full max-w-6xl flex flex-wrap justify-between items-center mb-8 glass-panel py-3 px-5 rounded-xl z-10">
         <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400 font-mono">
           <Settings2 className="w-4 h-4 text-purple-400"/> Security Overrides:
         </div>
         <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
              <input type="checkbox" checked={permissions.mouse} onChange={(e) => setPermissions(p => ({...p, mouse: e.target.checked}))} className="accent-blue-500" />
              Allow Cursor Movement
            </label>
            <label className="flex items-center gap-2 text-xs font-mono cursor-pointer mr-2">
              <input type="checkbox" checked={permissions.clicks} onChange={(e) => setPermissions(p => ({...p, clicks: e.target.checked}))} className="accent-blue-500" />
              Allow OS Clicking
            </label>
         </div>
      </div>

      {/* Main Status Element replacing recursive video element */}
      <div className="w-full max-w-6xl flex-grow glass-panel rounded-3xl overflow-hidden flex flex-col items-center justify-center relative p-12 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-violet-500/10">
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        
        {isStreaming ? (
            <div className="text-center relative z-10 max-w-xl">
                 <div className="inline-flex items-center justify-center p-6 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-fuchsia-500/30 rounded-[2rem] shadow-[0_0_50px_rgba(217,70,239,0.2)] mb-8 relative group">
                     <div className="absolute inset-0 rounded-[2rem] bg-fuchsia-500/10 animate-blob opacity-50"></div>
                     <Orbit className="text-fuchsia-400 w-24 h-24 animate-[spin_10s_linear_infinite] drop-shadow-[0_0_15px_rgba(217,70,239,0.6)]" />
                 </div>
                 <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-400 to-rose-400 mb-4 drop-shadow-[0_0_20px_rgba(217,70,239,0.5)]">UPLINK ACTIVE</h2>
                 <p className="font-sans text-lg text-fuchsia-100/70 mt-2 leading-relaxed">Secure protocol relay is maintaining real-time video streaming to <strong className="text-slate-900 dark:text-white">{activeViewers} connected endpoints.</strong></p>
                 <div className="mt-8 px-4 py-3 bg-white/60 dark:bg-black/40 rounded-xl border border-slate-300 dark:border-white/5 inline-block backdrop-blur-md">
                     <p className="text-xs text-slate-900 dark:text-white/40 font-mono tracking-widest">(MIRROR ENGINE DISABLED FOR OPTIMAL PERFORMANCE)</p>
                 </div>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center text-center z-20">
               <div className="relative group cursor-pointer mb-8" onClick={startScreenCapture}>
                   <div className="absolute inset-0 bg-violet-500/30 rounded-full filter blur-[40px] animate-pulse group-hover:bg-fuchsia-500/40 transition-colors duration-500"></div>
                   <button className="bg-white/60 dark:bg-black/40 p-8 rounded-full border border-violet-500/30 hover:border-fuchsia-400/80 shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_60px_rgba(217,70,239,0.5)] transform transition-all duration-500 hover:scale-110 active:scale-95 z-10 relative group">
                       <Upload className="text-violet-500 dark:text-fuchsia-300 w-16 h-16 group-hover:text-fuchsia-500 dark:group-hover:text-white transition-colors" />
                   </button>
               </div>
               <p className="text-fuchsia-300 font-bold tracking-[0.2em] text-xl mb-4 text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500">AWAITING SYSTEM PERMISSION</p>
               <button 
                  onClick={startScreenCapture}
                  className="bg-indigo-50/50 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 text-indigo-700 dark:text-fuchsia-100 font-mono tracking-widest font-bold py-3 px-8 rounded-xl border border-indigo-200 dark:border-violet-500/30 hover:border-indigo-400 dark:hover:border-fuchsia-500/80 shadow-md dark:shadow-none hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(217,70,239,0.3)] transition-all transform active:scale-95"
               >
                  ENGAGE SCREEN BROADCAST
               </button>
               <p className="text-slate-500 dark:text-gray-500 font-mono mt-6 text-sm transition-colors max-w-sm leading-relaxed">Please click above to authorize window or screen bounding box to broadcast to Orbital Nexus.</p>
            </div>
        )}
      </div>

      <ChatPanel messages={chatMessages} sendMessage={sendChatMessage} mode="host" isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
    </>
  );
}
