import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = 'https://orbital-backend-kfdf.onrender.com';

const useWebRTC = (roomId, mode, passcode) => {
  const [status, setStatus] = useState('CONNECTING...');
  const [fileChannel, setFileChannel] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [metrics, setMetrics] = useState({ telemetry: null });
  const [chatMessages, setChatMessages] = useState([]);
  const [isReceivingVoice, setIsReceivingVoice] = useState(false);
  
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  // Mock functions for chat and voice
  const sendChatMessage = (msg) => {
    if (socketRef.current) {
      socketRef.current.emit('chat-message', { text: msg, timestamp: Date.now() });
    }
  };

  const sendVoiceMessage = (audioBlob) => {
    if (socketRef.current) {
      socketRef.current.emit('voice-message', { audio: audioBlob, timestamp: Date.now() });
    }
  };

  useEffect(() => {
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
        console.log("📡 Host created room:", roomId);
      } else if (mode === 'viewer') {
        socket.emit('join-room', { roomId, passcode });
        console.log("📡 Viewer joining room:", roomId);
      }
    });

    socket.on('connect_error', (err) => {
      console.error("Socket Error:", err.message);
      setStatus("RECONNECTING...");
    });

    socket.on('chat-message', (data) => {
      setChatMessages(prev => [...prev, { ...data, isOwn: false }]);
    });

    socket.on('voice-message', (data) => {
      setIsReceivingVoice(true);
      setTimeout(() => setIsReceivingVoice(false), 2000);
    });

    socket.on('telemetry', (data) => {
      setMetrics({ telemetry: data });
    });

    const createPeer = (targetId, isInitiator = false) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { 
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          { 
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('signal', { target: targetId, type: 'candidate', payload: event.candidate });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE State:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          setStatus('LIVE - CONNECTED ✅');
        } else if (pc.iceConnectionState === 'failed') {
          setStatus('CONNECTION FAILED');
        }
      };

      pc.ontrack = (event) => {
        console.log("🎥 Stream received on Viewer!");
        setRemoteStream(event.streams[0]);
        setStatus('LIVE STREAMING ✅');
      };

      return pc;
    };

    socket.on('viewer-joined', async (viewerId) => {
      console.log("👁️ Viewer detected, capturing screen...");
      setStatus("CAPTURING SCREEN...");
      
      const pc = createPeer(viewerId, true);
      peerRef.current = pc;
      
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, 
          audio: false 
        });
        streamRef.current = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal', { target: viewerId, type: 'offer', payload: offer });
        console.log("📤 Offer sent.");
        setStatus("WAITING FOR VIEWER...");
      } catch (err) {
        console.error("Screen Capture Failed:", err);
        setStatus("SCREEN CAPTURE FAILED");
      }
    });

    socket.on('signal', async (data) => {
      const { sender, type, payload } = data;
      try {
        if (type === 'offer') {
          console.log("📥 Offer received.");
          const pc = createPeer(sender, false);
          peerRef.current = pc;
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { target: sender, type: 'answer', payload: answer });
          setStatus("CONNECTING...");
        } else if (type === 'answer' && peerRef.current) {
          console.log("📥 Answer received.");
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (type === 'candidate' && peerRef.current) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
        }
      } catch (e) {
        console.error("Signaling error", e);
      }
    });

    socket.on('error', (msg) => {
      console.error("Server Error:", msg);
      setStatus(`ERROR: ${msg}`);
    });

    return () => {
      socket.disconnect();
      if (peerRef.current) peerRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [roomId, mode, passcode]);

  return { 
    status, 
    remoteStream, 
    metrics, 
    fileChannel, 
    setFileChannel,
    chatMessages,
    sendChatMessage,
    isReceivingVoice,
    sendVoiceMessage
  };
};

export default useWebRTC;
