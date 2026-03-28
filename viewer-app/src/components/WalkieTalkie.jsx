import React, { useRef, useState, useEffect } from 'react';
import { Mic, RadioReceiver } from 'lucide-react';

export default function WalkieTalkie({ onSendVoice, isReceiving }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          audioChunksRef.current = [];
          
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };
          
          mediaRecorder.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              onSendVoice(audioBlob);
              if (streamRef.current) {
                  streamRef.current.getTracks().forEach(track => track.stop());
              }
          };
          
          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.start();
          setIsRecording(true);
      } catch (err) {
          console.error("Mic access denied or failed", err);
          alert("Could not access microphone for Walkie Talkie.");
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  return (
    <div className="flex items-center gap-2">
        {isReceiving && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded-xl animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]">
               <RadioReceiver className="w-4 h-4" />
               <span className="text-xs font-bold tracking-widest hidden md:block">INCOMING COMMS...</span>
            </div>
        )}
        
        <button 
           onMouseDown={startRecording}
           onMouseUp={stopRecording}
           onMouseLeave={stopRecording}
           onTouchStart={startRecording}
           onTouchEnd={stopRecording}
           className={`flex items-center justify-center p-2 rounded-xl transition-all border shadow-sm select-none ${isRecording ? 'bg-red-500 border-red-400 text-slate-900 dark:text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.8)] scale-110' : 'bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300/50 dark:hover:bg-white/10 border-slate-300 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:text-white'}`} 
           title="Hold to Speak (Walkie Talkie)"
        >
           <Mic className={`w-5 h-5 ${isRecording ? 'opacity-100' : 'opacity-80'}`} />
        </button>
    </div>
  );
}
