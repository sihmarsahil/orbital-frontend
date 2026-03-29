import React, { useRef, useEffect, useState } from 'react';
import { Monitor, Shield, Zap, X, Video, Upload, Activity, MessageSquare, Mouse, Keyboard } from 'lucide-react';
import { sendInputData } from '../utils/rtcOps';
import { sendFile } from '../utils/fileTransfer';
import useWebRTC from '../hooks/useWebRTC';
import ChatPanel from './ChatPanel';
import SessionTimer from './SessionTimer';
import WalkieTalkie from './WalkieTalkie';
import ThemeToggle from './ThemeToggle';

export default function Viewer({ roomId, passcode, isDark, toggleTheme }) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [chatOpen, setChatOpen] = useState(false);
  
  const { status, remoteStream, metrics, fileChannel, chatMessages, sendChatMessage, isReceivingVoice, sendVoiceMessage } = useWebRTC(roomId, 'viewer', passcode);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
        videoRef.current.srcObject = remoteStream;
        videoRef.current.play().catch(console.error);
    }
  }, [remoteStream]);

  const toggleRecording = () => {
    if (!remoteStream) return;
    if (isRecording) {
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      recordedChunks.current = [];
      const mr = new MediaRecorder(remoteStream, { mimeType: 'video/webm' });
      mr.ondataavailable = e => { if (e.data.size > 0) recordedChunks.current.push(e.data); };
      mr.onstop = () => {
          const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `ORBITAL_REC_${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    }
  };

  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (file && window.__PRIMARY_FILE_CHANNEL) {
          console.log(`Sending file: ${file.name}`);
          sendFile(file, window.__PRIMARY_FILE_CHANNEL);
          // Briefly reset input so same file can be selected again
          e.target.value = null; 
      }
  };

  return (
    <>
    <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-50 via-slate-100 to-slate-200 dark:from-[#0a0514] dark:via-[#050508] dark:to-black text-slate-800 dark:text-slate-300 font-sans p-4 md:p-8 flex flex-col items-center relative overflow-hidden transition-colors">
      {/* Decorative Orbs */}
      <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-fuchsia-300/40 dark:bg-fuchsia-600/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] pointer-events-none animate-blob"></div>
      <div className="absolute top-[60%] left-[-10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none animate-blob [animation-delay:2000ms]"></div>

      {/* Top Navigation */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-6 glass-panel p-4 rounded-2xl z-10 transition-all gap-4 ring-1 ring-white/5 shadow-[0_0_30px_rgba(139,92,246,0.1)]">
        <div className="flex items-center gap-4 w-full md:w-auto overflow-hidden">
          <div className="p-3 bg-fuchsia-500/10 rounded-xl border border-fuchsia-500/20 shrink-0 shadow-[0_0_15px_rgba(217,70,239,0.2)]">
             <Monitor className="text-fuchsia-400 w-6 h-6 animate-float" />
          </div>
          <div className="min-w-0 flex-1">
             <h1 className="text-xl font-extrabold tracking-wider text-slate-900 dark:text-white leading-none truncate">ORBITAL<span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-violet-400 drop-shadow-[0_0_10px_rgba(217,70,239,0.3)]">VIEW</span></h1>
             <span className="text-xs text-fuchsia-200/50 font-mono truncate block mt-1">Uplink: <span className="text-fuchsia-300 shadow-fuchsia-500/50 drop-shadow-md">{roomId}</span></span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 md:gap-3 w-full md:w-auto mt-4 md:mt-0">
          {/* Action Tools */}
          {status.includes('LIVE') && (
            <div className="flex items-center justify-center gap-2 mb-2 md:mb-0 mr-0 md:mr-3 w-full md:w-auto relative">
                 <button onClick={() => setChatOpen(!chatOpen)} className={`flex items-center justify-center p-2 rounded-xl transition-all shadow-sm ${chatOpen ? 'bg-fuchsia-500/20 border border-fuchsia-500/50 text-fuchsia-400' : 'bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300/50 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-fuchsia-300'}`} title="Server Chat">
                    <MessageSquare className="w-5 h-5" />
                    {chatMessages.length > 0 && !chatOpen && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>}
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                 <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center p-2 rounded-xl bg-slate-200/50 dark:bg-white/5 hover:bg-violet-500/20 border border-slate-300 dark:border-white/10 hover:border-violet-500/50 text-slate-600 dark:text-gray-400 hover:text-violet-400 transition-all shadow-sm" title="Send File to Host">
                    <Upload className="w-5 h-5" />
                 </button>
                 <button onClick={toggleRecording} className={`flex items-center justify-center p-2 rounded-xl transition-all border shadow-sm ${isRecording ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300/50 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:text-white'}`} title="Record Session">
                    <Video className="w-5 h-5" />
                 </button>
                 <WalkieTalkie onSendVoice={sendVoiceMessage} isReceiving={isReceivingVoice} />
                 
                 <div className="ml-2 hidden sm:block">
                    <SessionTimer isActive={status.includes('LIVE')} />
                 </div>
            </div>
          )}

          {/* Connection Status Badge */}
          {status.includes('LIVE') && (
            <div className="hidden lg:flex items-center gap-4 text-xs font-mono bg-white/60 dark:bg-black/40 px-4 py-2 rounded-xl border border-slate-300 dark:border-white/5 shadow-[0_0_20px_rgba(217,70,239,0.05)] backdrop-blur-md">
               <span className="text-slate-600 dark:text-gray-400 flex items-center gap-1.5 border-l border-slate-300 dark:border-white/5 pl-4"><Activity className="w-3.5 h-3.5 text-fuchsia-400 animate-pulse"/> CPU: <span className="text-fuchsia-300 font-bold bg-slate-200/50 dark:bg-white/5 px-1.5 py-0.5 rounded">{metrics.telemetry?.cpu || '0.00'}%</span></span>
               <span className="text-slate-600 dark:text-gray-400 flex items-center gap-1.5 border-l border-slate-300 dark:border-white/5 pl-4">RAM: <span className="text-violet-400 font-bold bg-slate-200/50 dark:bg-white/5 px-1.5 py-0.5 rounded">{metrics.telemetry?.ram || '0.00'}%</span></span>
               {metrics.telemetry && parseFloat(metrics.telemetry.cpu) > 85 && (
                  <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded text-[10px] font-bold ml-2 animate-pulse border border-red-500/50 tracking-widest">! AI ALERT !</span>
               )}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs font-mono bg-white/60 dark:bg-black/40 px-4 py-2 rounded-xl border border-slate-300 dark:border-white/5 shadow-inner backdrop-blur-md">
            <Zap className={`w-4 h-4 ${status.includes('LIVE') ? 'text-fuchsia-400 animate-pulse' : 'text-slate-500 dark:text-gray-500 animate-pulse'}`} /> 
            <span className={status.includes('LIVE') ? "text-fuchsia-300 font-bold shadow-fuchsia-500/50 drop-shadow-[0_0_8px_rgba(217,70,239,0.6)]" : "text-slate-600 dark:text-gray-400 font-bold"}>
               {status.includes('LIVE') ? 'LIVE UPLINK' : 'AWAITING CONNECTION...'}
            </span>
          </div>
          <button className="p-2 hover:bg-red-500/20 text-slate-500 dark:text-gray-500 hover:text-red-400 rounded-xl transition-all ml-1 md:ml-2" onClick={() => window.location.reload()}>
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Render Viewport */}
      <div className="relative w-full max-w-7xl aspect-video glass-panel rounded-3xl overflow-hidden group flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-slate-300 dark:border-white/5">
        
        {isRecording && (
           <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-red-900/80 border border-red-500 text-red-200 px-3 py-1 rounded backdrop-blur-sm text-xs font-mono shadow-xl animate-pulse">
               <div className="w-2 h-2 rounded-full bg-red-500"></div> RECORDING
           </div>
        )}

        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          className={`w-full h-full object-contain cursor-crosshair relative z-10 transition-opacity duration-1000 ${remoteStream ? 'opacity-100' : 'opacity-0'}`}
          onMouseMove={(e) => sendInputData(e, videoRef, 'mousemove')}
          onMouseDown={(e) => sendInputData(e, videoRef, 'mousedown')}
          onMouseUp={(e) => sendInputData(e, videoRef, 'mouseup')}
          onTouchMove={(e) => { const touch = e.touches[0]; sendInputData({ clientX: touch.clientX, clientY: touch.clientY }, videoRef, 'mousemove'); }}
          onTouchStart={(e) => { const touch = e.touches[0]; sendInputData({ clientX: touch.clientX, clientY: touch.clientY }, videoRef, 'mousedown'); }}
          onTouchEnd={(e) => { const touch = e.changedTouches[0]; sendInputData({ clientX: touch.clientX, clientY: touch.clientY }, videoRef, 'mouseup'); }}
        />
        
        {!status.includes('LIVE') && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950/90 backdrop-blur-md z-20">
                <div className="text-center flex flex-col items-center">
                    <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-gray-800 rounded-full"></div>
                        <div className="absolute inset-0 border-2 border-cyan-500 border-t-transparent rounded-full animate-[spin_2s_linear_infinite]"></div>
                        <Zap className="text-cyan-500/50 w-6 h-6 animate-pulse" />
                    </div>
                    <p className="text-cyan-400 font-mono tracking-widest text-sm animate-pulse">ESTABLISHING SECURE P2P LINK</p>
                    <p className="text-gray-600 font-mono text-xs mt-2 text-center max-w-xs">{status}<br/>{">>>"} {roomId}</p>
                </div>
            </div>
        )}
      </div>

      <ChatPanel messages={chatMessages} sendMessage={sendChatMessage} mode="viewer" isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Control Panel Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none flex justify-center z-50">
        <div className="glass-panel px-6 py-2 rounded-full pointer-events-auto flex items-center justify-center gap-6 text-[10px] font-mono shadow-lg transition-colors">
           <span className="flex items-center gap-2 text-slate-600 dark:text-gray-400"><Mouse className="w-3 h-3 text-slate-400 dark:text-gray-500" /> SYNCED</span>
           <span className="flex items-center gap-2 text-slate-600 dark:text-gray-400 border-x border-slate-300 dark:border-white/10 px-6">
              <span className="sm:hidden"><SessionTimer isActive={status.includes('LIVE')} /></span>
              <span className="hidden sm:inline-flex items-center gap-2"><Keyboard className="w-3 h-3 text-slate-400 dark:text-gray-500" /> ACTIVE</span>
           </span>
           <span className="flex items-center gap-2 text-slate-600 dark:text-gray-400"><Activity className="w-3 h-3 text-slate-400 dark:text-gray-500" /> LATENCY: ~12ms</span>
        </div>
      </div>
    </div>
    </>
  );
}
