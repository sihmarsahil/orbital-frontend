import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const S_URL = 'https://orbital-backend-kfdf.onrender.com';

const Host = () => {
  const [roomId] = useState(Math.floor(100000 + Math.random() * 900000).toString());
  const [passcode] = useState(Math.floor(1000 + Math.random() * 9000).toString());
  const [status, setStatus] = useState('CONNECTING...');
  const [isViewerConnected, setIsViewerConnected] = useState(false);
  
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const viewerIdRef = useRef(null);

  useEffect(() => {
    const socket = io(S_URL, { transports: ['polling', 'websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('WAITING FOR VIEWER...');
      socket.emit('create-room', { roomId, passcode });
    });

    socket.on('viewer-joined', (viewerId) => {
      viewerIdRef.current = viewerId;
      setIsViewerConnected(true);
      setStatus('VIEWER JOINED! CLICK BUTTON TO SHARE');
    });

    socket.on('signal', async ({ type, payload }) => {
      if (type === 'answer' && peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (type === 'candidate' && peerRef.current) {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
      }
    });

    return () => socket.disconnect();
  }, [roomId, passcode]);

  const handleStartShare = async () => {
    if (!viewerIdRef.current) return;
    
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current.emit('signal', { target: viewerIdRef.current, type: 'candidate', payload: e.candidate });
    };

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      streamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('signal', { target: viewerIdRef.current, type: 'offer', payload: offer });
      setStatus('STREAMING LIVE 🎥');
    } catch (err) {
      console.error(err);
      setStatus('PERMISSION DENIED');
    }
  };

  return (
    <div className="p-10 text-white bg-slate-900 min-h-screen flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">Orbital Host Dashboard</h1>
      
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-blue-500 shadow-2xl">
        <p className="mb-4 text-center">Status: <span className={`font-bold ${status.includes('LIVE') ? 'text-green-400' : 'text-yellow-400'}`}>{status}</span></p>
        
        <div className="bg-slate-700 p-6 rounded-xl mb-6 space-y-2">
          <p className="text-lg">Room ID: <span className="font-mono font-bold text-cyan-400">{roomId}</span></p>
          <p className="text-lg">Passcode: <span className="font-mono font-bold text-cyan-400">{passcode}</span></p>
        </div>

        {isViewerConnected && (
          <button 
            onClick={handleStartShare}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95"
          >
            🚀 START SCREEN SHARE
          </button>
        )}
      </div>
    </div>
  );
};

export default Host;
