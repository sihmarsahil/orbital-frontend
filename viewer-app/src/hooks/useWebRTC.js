import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = 'https://orbital-backend-kfdf.onrender.com';

const useWebRTC = (roomId, mode, passcode) => {
  const [status, setStatus] = useState('CONNECTING...');
  const [fileChannel, setFileChannel] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [metrics, setMetrics] = useState({ telemetry: { cpu: '0.00', ram: '0.00' } });
  const [chatMessages, setChatMessages] = useState([]);
  const [isReceivingVoice, setIsReceivingVoice] = useState(false);
  
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  const sendChatMessage = (msg) => {
    if (socketRef.current) {
      socketRef.current.emit('chat-message', { text: msg, timestamp: Date.now(), sender: mode });
      setChatMessages(prev => [...prev, { text: msg, timestamp: Date.now(), isOwn: true }]);
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
      secure: true,
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log("✅ Socket Connected! Socket ID:", socket.id);
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
      console.error("❌ Socket Error:", err.message);
      setStatus("RECONNECTING...");
    });

    socket.on('chat-message', (data) => {
      if (data.sender !== mode) {
        setChatMessages(prev => [...prev, { ...data, isOwn: false }]);
      }
    });

    socket.on('voice-message', () => {
      setIsReceivingVoice(true);
      setTimeout(() => setIsReceivingVoice(false), 2000);
    });

    socket.on('telemetry', (data) => {
      setMetrics({ telemetry: data });
    });

    socket.on('error', (msg) => {
      console.error("❌ Server Error:", msg);
      setStatus(`ERROR: ${msg}`);
    });

    const createPeer = (targetId) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:stun.ekiga.net' },
          { urls: 'stun:stun.ideasip.com' },
          {
            urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
            username: 'webrtc',
            credential: 'webrtc'
          },
          {
            urls: 'turn:turn.anyfirewall.com:80?transport=udp',
            username: 'webrtc',
            credential: 'webrtc'
          },
          {
            urls: 'turn:turn2.anyfirewall.com:443?transport=tcp',
            username: 'webrtc',
            credential: 'webrtc'
          },
          {
            urls: 'turn:turn.nexstorm.net:3478',
            username: 'webrtc',
            credential: 'webrtc'
          }
        ],
        iceCandidatePoolSize: 10
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("📡 Sending ICE candidate");
          socket.emit('signal', { target: targetId, type: 'candidate', payload: event.candidate });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("🔌 ICE Connection State:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          setStatus('LIVE STREAMING ✅');
        } else if (pc.iceConnectionState === 'failed') {
          setStatus('CONNECTION FAILED - Try different network');
          console.error("ICE Failed");
        } else if (pc.iceConnectionState === 'checking') {
          setStatus('CONNECTING...');
        }
      };

      pc.onicegatheringstatechange = () => {
        console.log("🔄 ICE Gathering State:", pc.iceGatheringState);
      };

      pc.onsignalingstatechange = () => {
        console.log("📡 Signaling State:", pc.signalingState);
      };

      pc.ontrack = (event) => {
        console.log("🎥 Stream received!", event.streams[0]);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          setStatus('LIVE STREAMING ✅');
        }
      };

      const dc = pc.createDataChannel('fileTransfer');
      dc.onopen = () => {
        console.log("📁 File channel opened");
        setFileChannel(dc);
        window.__PRIMARY_FILE_CHANNEL = dc;
      };

      return pc;
    };

    socket.on('viewer-joined', async (viewerId) => {
      console.log("👁️ Viewer joined, capturing screen...");
      setStatus("CAPTURING SCREEN...");
      
      const pc = createPeer(viewerId);
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
        console.log("📤 Offer sent");
        setStatus("WAITING FOR VIEWER...");
      } catch (err) {
        console.error("❌ Screen capture failed:", err);
        setStatus("SCREEN CAPTURE FAILED");
      }
    });

    socket.on('signal', async (data) => {
      const { sender, type, payload } = data;
      console.log("📨 Signal received:", type);
      
      try {
        if (type === 'offer') {
          console.log("📥 Offer received");
          const pc = createPeer(sender);
          peerRef.current = pc;
          
          pc.ondatachannel = (event) => {
            console.log("📁 Data channel received");
            setFileChannel(event.channel);
            window.__PRIMARY_FILE_CHANNEL = event.channel;
          };
          
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { target: sender, type: 'answer', payload: answer });
          setStatus("CONNECTING...");
          
        } else if (type === 'answer' && peerRef.current) {
          console.log("📥 Answer received");
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
          
        } else if (type === 'candidate' && peerRef.current) {
          try {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
          } catch (e) {
            console.error("Error adding ICE candidate:", e);
          }
        }
      } catch (e) {
        console.error("❌ Signaling error:", e);
      }
    });

    return () => {
      console.log("🧹 Cleanup");
      if (socketRef.current) socketRef.current.disconnect();
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
