import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const S_URL = 'https://orbital-backend-kfdf.onrender.com';

export default function useWebRTC(roomId, mode, passcode) {
  const [status, setStatus] = useState('CONNECTING...');
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    // Force polling first to bypass WebSocket block
    const socket = io(S_URL, { 
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log("Socket Connected! ✅");
      setStatus(`READY: ${mode.toUpperCase()}`);
      if (mode === 'host') socket.emit('create-room', { roomId, passcode });
    });

    socket.on('connect_error', (err) => {
      console.error("Connection Error:", err.message);
      setStatus("RECONNECTING...");
    });

    const createPeer = (tid) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('signal', { target: tid, type: 'candidate', payload: e.candidate });
      };

      pc.ontrack = (e) => {
        const v = document.getElementById('remote-video') || document.querySelector('video');
        if (v && e.streams[0]) {
          v.srcObject = e.streams[0];
          v.play().catch(() => {});
        }
      };
      return pc;
    };

    socket.on('viewer-joined', async (vid) => {
      console.log("Viewer Joined, starting capture...");
      const pc = createPeer(vid);
      peerRef.current = pc;
      try {
        const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
        streamRef.current = s;
        s.getTracks().forEach(t => pc.addTrack(t, s));
        const o = await pc.createOffer();
        await pc.setLocalDescription(o);
        socket.emit('signal', { target: vid, type: 'offer', payload: o });
      } catch (err) { console.error("Capture failed", err); }
    });

    socket.on('signal', async (data) => {
      const { sender, type, payload } = data;
      try {
        if (type === 'offer') {
          const pc = createPeer(sender);
          peerRef.current = pc;
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const a = await pc.createAnswer();
          await pc.setLocalDescription(a);
          socket.emit('signal', { target: sender, type: 'answer', payload: a });
        } else if (type === 'answer' && peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (type === 'candidate' && peerRef.current) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
        }
      } catch (e) { console.error("Signal error", e); }
    });

    return () => {
      socket.disconnect();
      if (peerRef.current) peerRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [roomId, mode, passcode]);

  return { status, socketRef, peerRef, fileChannel: null, setFileChannel: () => {} };
}
