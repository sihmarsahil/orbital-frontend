import React, { useState } from 'react';
import Viewer from './components/Viewer';
import Host from './components/Host';
import ThemeToggle from './components/ThemeToggle';
import { Monitor, Orbit } from 'lucide-react';

function App() {
  const [mode, setMode] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isWelcomeScreen, setIsWelcomeScreen] = useState(true);
  const [isLeavingWelcome, setIsLeavingWelcome] = useState(false);
  const [isDark, setIsDark] = useState(true);

  React.useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const handleToggleTheme = () => setIsDark(!isDark);

  const handleInitialize = () => {
      setIsLeavingWelcome(true);
      setTimeout(() => {
          setIsWelcomeScreen(false);
      }, 500);
  };

  const generateHostSession = () => {
    setRoomId('HOST-' + Math.floor(1000 + Math.random() * 9000));
    setPasscode(Math.floor(100000 + Math.random() * 900000).toString());
    setMode('host');
  };

  if (mode === 'host') return <div className={isDark ? 'dark' : ''}><Host roomId={roomId} passcode={passcode} isDark={isDark} toggleTheme={handleToggleTheme} /></div>;
  if (mode === 'viewer') return <div className={isDark ? 'dark' : ''}><Viewer roomId={roomId} passcode={passcode} isDark={isDark} toggleTheme={handleToggleTheme} /></div>;

  if (isWelcomeScreen) {
      return (
          <div className={isDark ? 'dark' : ''}>
          <ThemeToggle isDark={isDark} toggleTheme={handleToggleTheme} />
          <div className={`min-h-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-50 via-slate-100 to-white dark:from-indigo-950 dark:via-[#0a0514] dark:to-black text-slate-800 dark:text-white flex flex-col items-center justify-center w-full relative overflow-hidden font-sans transition-colors duration-700 ${isLeavingWelcome ? 'animate-fade-out pointer-events-none' : ''}`}>
              {/* Ultra-Premium Cinematic Animated Background Blobs */}
              <div className="absolute top-[5%] left-[10%] w-[600px] h-[600px] bg-indigo-200/40 dark:bg-purple-600/20 rounded-full dark:mix-blend-screen filter blur-[120px] animate-blob pointer-events-none transition-colors duration-700"></div>
              <div className="absolute bottom-[5%] right-[10%] w-[600px] h-[600px] bg-fuchsia-200/40 dark:bg-fuchsia-600/20 rounded-full dark:mix-blend-screen filter blur-[120px] animate-blob [animation-delay:2s] pointer-events-none transition-colors duration-700"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-sky-200/30 dark:bg-indigo-600/20 rounded-full dark:mix-blend-screen filter blur-[120px] animate-blob [animation-delay:4s] pointer-events-none transition-colors duration-700"></div>
              
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-300/50 dark:via-fuchsia-500/20 to-transparent"></div>
              
              <div className="relative z-10 flex flex-col items-center justify-center animate-[float_6s_ease-in-out_infinite] scale-100 md:scale-110">
                  <div className="relative group">
                      <div className="absolute inset-0 bg-fuchsia-400/20 dark:bg-fuchsia-500/30 rounded-full filter blur-[60px] animate-pulse group-hover:bg-fuchsia-400/40 dark:group-hover:bg-fuchsia-400/50 transition-colors duration-1000"></div>
                      <Orbit className="text-indigo-600 dark:text-fuchsia-400 w-32 h-32 mb-8 animate-[spin_15s_linear_infinite] opacity-90 relative z-10 drop-shadow-[0_0_15px_rgba(99,102,241,0.3)] dark:drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]" />
                  </div>
                  
                  <h1 className="text-5xl md:text-7xl font-extrabold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-rose-500 dark:from-violet-300 dark:via-fuchsia-400 dark:to-rose-500 mb-6 drop-shadow-sm dark:drop-shadow-[0_0_40px_rgba(217,70,239,0.5)] text-center px-4">
                      ORBITAL NEXUS
                  </h1>
                  
                  <p className="text-sm md:text-lg text-indigo-800/80 dark:text-fuchsia-200/80 font-mono tracking-widest uppercase mb-12 text-center max-w-3xl px-6 leading-loose drop-shadow-none dark:drop-shadow-[0_0_10px_rgba(217,70,239,0.2)]">
                      Next-Generation Autonomous Relays <br className="hidden md:block"/> 
                      <span className="text-indigo-500/80 dark:text-fuchsia-400/80">&times;</span> Zero-Latency Desktop Interconnectivity
                  </p>
                  
                  <button 
                      onClick={handleInitialize}
                      className="group relative overflow-hidden bg-white/50 dark:bg-black/40 border border-indigo-300 dark:border-violet-500/30 hover:border-indigo-400 dark:hover:border-fuchsia-400/80 text-indigo-700 dark:text-fuchsia-300 font-mono font-bold tracking-[0.3em] py-5 px-10 rounded-full transform transition-all duration-500 hover:scale-[1.03] active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.2)] dark:shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(99,102,241,0.4)] dark:hover:shadow-[0_0_60px_rgba(217,70,239,0.6)] backdrop-blur-md"
                  >
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-indigo-200/50 dark:via-fuchsia-400/20 to-transparent -translate-x-full group-hover:animate-[gradient-x_1.5s_ease-in-out_infinite]"></div>
                      <span className="relative z-10 flex items-center justify-center gap-3">
                          INITIALIZE PROTOCOL <Monitor className="w-5 h-5 group-hover:text-indigo-900 dark:group-hover:text-white transition-colors drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]"/>
                      </span>
                  </button>
              </div>
              
              <div className="absolute bottom-10 left-0 right-0 text-center font-mono text-[10px] text-slate-500 dark:text-gray-500 tracking-widest uppercase opacity-70 dark:opacity-50 transition-colors">
                  
              </div>
          </div>
          </div>
      );
  }

  return (
      <div className={isDark ? 'dark' : ''}>
      <ThemeToggle isDark={isDark} toggleTheme={handleToggleTheme} />
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-100 to-white dark:from-[#0a0514] dark:via-[#050508] dark:to-black text-slate-800 dark:text-white flex flex-col items-center justify-center w-full relative overflow-hidden font-sans p-4 transition-colors duration-700">
      {/* Background moving fluid blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-200/40 dark:bg-violet-600/30 rounded-full dark:mix-blend-screen filter blur-[100px] animate-blob z-0 transition-colors duration-700"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-200/40 dark:bg-fuchsia-700/20 rounded-full dark:mix-blend-screen filter blur-[100px] animate-blob [animation-delay:2000ms] z-0 transition-colors duration-700"></div>

      <div className="animate-pop-up max-w-md w-full relative z-10 px-4">
        <div className="glass-panel p-6 md:p-10 space-y-4 rounded-3xl w-full transition-transform duration-700 hover:scale-[1.02] animate-float">
        <div className="flex flex-col items-center mb-8">
          <div className="flex gap-4 mb-4 relative">
            <div className="absolute inset-0 bg-indigo-200/50 dark:bg-violet-500/20 blur-[30px] rounded-full animate-pulse-glow"></div>
            <div className="bg-white/80 dark:bg-black/50 p-4 rounded-full border border-indigo-200 dark:border-violet-500/30 shadow-md dark:shadow-[0_0_15px_rgba(139,92,246,0.2)] relative z-10 transition-colors">
               <Orbit className="text-indigo-600 dark:text-violet-400 w-10 h-10 animate-[spin_10s_linear_infinite]" />
            </div>
            <div className="bg-white/80 dark:bg-black/50 p-4 rounded-full border border-fuchsia-200 dark:border-fuchsia-500/30 shadow-md dark:shadow-[0_0_15px_rgba(217,70,239,0.2)] relative z-10 transition-colors">
               <Monitor className="text-fuchsia-500 dark:text-fuchsia-400 w-10 h-10 animate-float" />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-500 drop-shadow-sm dark:drop-shadow-[0_0_10px_rgba(217,70,239,0.3)]">
            ORBITAL NEXUS
          </h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-2 font-mono transition-colors">Select Telemetry Operation</p>
        </div>

        <div className="space-y-6">
          <div className="border-b border-indigo-100 dark:border-white/5 pb-6 w-full flex flex-col items-center transition-colors">
             <button 
                onClick={generateHostSession}
                className="w-full relative group overflow-hidden bg-gradient-to-r from-violet-600 to-fuchsia-600 text-slate-900 dark:text-white font-bold py-4 px-4 rounded-xl transform transition-all active:scale-95 shadow-[0_0_20px_rgba(217,70,239,0.2)] hover:shadow-[0_0_40px_rgba(217,70,239,0.6)] border border-slate-300 dark:border-white/10"
             >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[gradient-x_1.5s_ease-in-out_infinite]"></div>
                <span className="relative z-10 flex items-center justify-center gap-2">START BROADCAST (HOST)</span>
             </button>
             <p className="text-slate-500 dark:text-gray-500 text-xs mt-3 font-mono">Will prompt for screen share and generate a link.</p>
          </div>

          <div className="w-full flex flex-col gap-4">
             <p className="text-slate-500 dark:text-gray-500 text-xs font-mono uppercase text-center mb-2">Or Join an Existing Broadcast</p>
             <div className="group">
               <input 
                 type="text" 
                 className="w-full bg-white/50 dark:bg-black/40 border border-indigo-200 dark:border-violet-900/50 rounded-xl px-4 py-3 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 dark:focus:ring-fuchsia-500/50 focus:border-fuchsia-500 transition-all font-mono text-center shadow-inner"
                 value={roomId}
                 onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                 placeholder="SESSION ID (Ex: HOST-1234)"
               />
             </div>
             <div className="group">
               <input 
                 type="password" 
                 className="w-full bg-white/50 dark:bg-black/40 border border-indigo-200 dark:border-violet-900/50 rounded-xl px-4 py-3 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 dark:focus:ring-fuchsia-500/50 focus:border-fuchsia-500 transition-all font-mono tracking-widest text-center shadow-inner"
                 value={passcode}
                 onChange={(e) => setPasscode(e.target.value)}
                 placeholder="6-DIGIT PASSCODE"
               />
             </div>
              <button 
               onClick={() => {
                 if(roomId && passcode) setMode('viewer');
               }}
               disabled={!roomId || !passcode}
               className="mt-2 w-full bg-white/60 hover:bg-white dark:bg-white/5 dark:hover:bg-violet-900/30 text-indigo-700 dark:text-fuchsia-100 font-bold py-4 px-4 rounded-xl transform transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-indigo-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-fuchsia-500/50 shadow-md dark:shadow-none hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(217,70,239,0.3)] backdrop-blur-md"
             >
               CONNECT TO UPLINK
             </button>
          </div>
        </div>
      </div>
      </div>
    </div>
    </div>
  );
}

export default App;
