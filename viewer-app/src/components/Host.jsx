import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const S_URL = 'https://orbital-backend-kfdf.onrender.com';

const Host = () => {
  const [roomId] = useState(Math.floor(100000 + Math.random() * 900000).toString());
  const [passcode] = useState(Math.floor(1000 + Math.random() * 9000).toString());
  const [status, setStatus] = useState('CONNECTING...');
  
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const socket = io(S_URL, { transports: ['polling', 'websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('READY TO SHARE');
      socket.emit('create-room', { roomId, passcode });
    });

    socket.on('viewer-joined', async (viewerId) => {
      setStatus('VIEWER CONNECTED. STARTING SHARE...');
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerRef.current = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('signal', { target: viewerId, type: 'candidate', payload: e.candidate });
      };

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        streamRef.current = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal', { target: viewerId, type: 'offer', payload: offer });
        setStatus('STREAMING ACTIVE');
      } catch (err) {
        setStatus('SHARE CANCELLED');
        console.error(err);
      }
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

  return (
    <div className="p-10 text-white bg-slate-900 min-h-screen">
      <h1 className="text-3xl font-bold mb-4">Host Dashboard</h1>
      <div className="bg-slate-800 p-6 rounded-xl border border-blue-500">
        <p className="text-xl">Status: <span className="text-green-400">{status}</span></p>
        <div className="mt-4 p-4 bg-slate-700 rounded-lg">
          <p className="text-lg">Room ID: <span className="font-mono font-bold text-yellow-400">{roomId}</span></p>
          <p className="text-lg">Passcode: <span className="font-mono font-bold text-yellow-400">{passcode}</span></p>
        </div>
        <p className="mt-4 text-sm text-gray-400 italic">Share these details with the viewer.</p>
      </div>
    </div>
  );
};

export default Host;
