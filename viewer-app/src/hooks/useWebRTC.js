import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = 'https://orbital-backend-kfdf.onrender.com';

const useWebRTC = (roomId, mode, passcode) => {
  const [status, setStatus] = useState('CONNECTING...');
  const [fileChannel, setFileChannel] = useState(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    // Basic polling-first configuration
    const socket = io(BACKEND_URL, { 
      transports: ['polling', 'websocket'],
      secure: true 
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log("Socket Connected! ✅");
      setStatus(`READY: ${mode.toUpperCase()}`);
      if (mode === 'host') {
        socket.emit('create-room', { roomId, passcode });
      }
    });

    socket.on('connect_error', (err) => {
      console.error("Socket Error:", err.message);
      setStatus("RECONNECTING...");
    });

    const createPeer = (targetId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('signal', { target: targetId, type: 'candidate', payload: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        console.log("Stream received on Viewer!");
        const videoElement = document.getElementById('remote-video') || document.querySelector('video');
        if (videoElement && event.streams[0]) {
          videoElement.srcObject = event.streams[0];
          videoElement.play().catch(() => console.log("User must click to play"));
        }
      };

      return pc;
    };

    socket.on('viewer-joined', async (viewerId) => {
      console.log("Viewer detected, capturing screen...");
      const pc = createPeer(viewerId);
      peerRef.current = pc;
      try {
        // Simplified capture constraints
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        streamRef.current = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal', { target: viewerId, type: 'offer', payload: offer });
        console.log("Offer sent.");
      } catch (err) {
        console.error("Screen Capture Failed:", err);
      }
    });

    socket.on('signal', async (data) => {
      const { sender, type, payload } = data;
      try {
        if (type === 'offer') {
          console.log("Offer received.");
          const pc = createPeer(sender);
          peerRef.current = pc;
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { target: sender, type: 'answer', payload: answer });
        } else if (type === 'answer' && peerRef.current) {
          console.log("Answer received.");
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (type === 'candidate' && peerRef.current) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
        }
      } catch (e) {
        console.error("Signaling error", e);
      }
    });

    return () => {
      socket.disconnect();
      if (peerRef.current) peerRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [roomId, mode, passcode]);

  // Make sure this matches your Host.jsx / Viewer.jsx structure
  return { status, socketRef, peerRef, fileChannel, setFileChannel };
};

export default useWebRTC;
