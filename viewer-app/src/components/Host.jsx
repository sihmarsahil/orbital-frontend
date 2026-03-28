import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const S_URL = 'https://orbital-backend-kfdf.onrender.com';

const Host = () => {
  const [roomId] = useState(Math.floor(100000 + Math.random() * 900000).toString());
  const [passcode] = useState(Math.floor(1000 + Math.random() * 9000).toString());
  const [status, setStatus] = useState('OFFLINE');
  
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
      setStatus('VIEWER CONNECTED! CLICK BELOW');
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

  // YE FUNCTION POP-UP LAYEGA
  const forceStartShare = async () => {
    try {
      setStatus('REQUESTING PERMISSION...');
      // Step 1: Sabse pehle screen maango (Browser click ke turant baad ye pasand karta hai)
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      streamRef.current = stream;

      // Step 2: Peer connection setup karo
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerRef.current = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate && viewerIdRef.current) {
          socketRef.current.emit('signal', { target: viewerIdRef.current, type: 'candidate', payload: e.candidate });
        }
      };

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (viewerIdRef.current) {
        socketRef.current.emit('signal', { target: viewerIdRef.current, type: 'offer', payload: offer });
        setStatus('STREAMING LIVE! 🎥');
      } else {
        alert("Viewer connect hone ka wait karein!");
      }
    } catch (err) {
      console.error(err);
      setStatus('ERROR: Check Browser Settings');
      alert("Pop-up blocked! Browser ke top right mein check karein.");
    }
  };

  return (
    <div className="p-10 text-white bg-slate-900 min-h-screen flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-3xl border-2 border-blue-600 shadow-2xl">
        <h2 className="text-2xl font-bold text-center mb-6">Orbital Nexus Host</h2>
        <div className="bg-slate-900 p-4 rounded-xl mb-6 text-center border border-slate-700">
          <p className="text-sm text-gray-400">ROOM ID</p>
          <p className="text-2xl font-mono font-bold text-blue-400 tracking-widest">{roomId}</p>
          <p className="text-sm text-gray-400 mt-2">PASSCODE</p>
          <p className="text-xl font-mono font-bold text-yellow-500">{passcode}</p>
        </div>
        <p className="text-center mb-6 text-sm italic">{status}</p>
        
        <button 
          onClick={forceStartShare}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-lg rounded-2xl shadow-xl transform active:scale-95 transition-all"
        >
          START BROADCASTING
        </button>
      </div>
    </div>
  );
};

export default Host;
