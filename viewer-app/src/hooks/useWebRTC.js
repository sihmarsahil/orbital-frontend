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

  // Send chat message
  const sendChatMessage = (msg) => {
    if (socketRef.current) {
      socketRef.current.emit('chat-message', { text: msg, timestamp: Date.now(), sender: mode });
      setChatMessages(prev => [...prev, { text: msg, timestamp: Date.now(), isOwn: true }]);
    }
  };

  // Send voice message
  const sendVoiceMessage = (audioBlob) => {
    if (socketRef.current) {
      socketRef.current.emit('voice-message', { audio: audioBlob, timestamp: Date.now() });
    }
  };

  useEffect(() => {
    // Create socket connection
    const socket = io(BACKEND_URL, { 
      transports: ['polling', 'websocket'],
      secure: true,
      timeout: 10000
    });
    socketRef.current = socket;

    // Socket events
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

    // Chat message received
    socket.on('chat-message', (data) => {
      if (data.sender !== mode) {
        setChatMessages(prev => [...prev, { ...data, isOwn: false }]);
      }
    });

    // Voice message received
    socket.on('voice-message', (data) => {
      setIsReceivingVoice(true);
      setTimeout(() => setIsReceivingVoice(false), 2000);
    });

    // Telemetry data from host
    socket.on('telemetry', (data) => {
      setMetrics({ telemetry: data });
    });

    // Server errors
    socket.on('error', (msg) => {
      console.error("❌ Server Error:", msg);
      setStatus(`ERROR: ${msg}`);
    });

    // Create PeerConnection with TURN servers
    const createPeer = (targetId) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          // Google STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          // Free TURN servers (Metered.ca)
          { 
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          { 
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          { 
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceCandidatePoolSize: 10
      });

      // ICE Candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("📡 Sending ICE candidate");
          socket.emit('signal', { target: targetId, type: 'candidate', payload: event.candidate });
        }
      };

      // ICE Connection State (for debugging)
      pc.oniceconnectionstatechange = () => {
        console.log("🔌 ICE Connection State:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          setStatus('LIVE STREAMING ✅');
        } else if (pc.iceConnectionState === 'failed') {
          setStatus('CONNECTION FAILED');
          console.error("ICE Failed - Trying to restart");
          // Try to restart ICE
          pc.restartIce();
        } else if (pc.iceConnectionState === 'disconnected') {
          setStatus('DISCONNECTED');
        } else if (pc.iceConnectionState === 'checking') {
          setStatus('CONNECTING...');
        }
      };

      // ICE Gathering State
      pc.onicegatheringstatechange = () => {
        console.log("🔄 ICE Gathering State:", pc.iceGatheringState);
      };

      // Signaling State
      pc.onsignalingstatechange = () => {
        console.log("📡 Signaling State:", pc.signalingState);
      };

      // Track event (receiving stream)
      pc.ontrack = (event) => {
        console.log("🎥 Stream received!", event.streams[0]);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          setStatus('LIVE STREAMING ✅');
        }
      };

      // Data channel for file transfer
      const dc = pc.createDataChannel('fileTransfer');
      dc.onopen = () => {
        console.log("📁 File channel opened");
        setFileChannel(dc);
        window.__PRIMARY_FILE_CHANNEL = dc;
      };
      dc.onclose = () => console.log("📁 File channel closed");
      dc.onerror = (err) => console.error("File channel error:", err);

      return pc;
    };

    // Host: Viewer joined
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
        
        // Also capture system audio if possible
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getTracks().forEach(track => pc.addTrack(track, audioStream));
        } catch (e) {
          console.log("No audio capture:", e);
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal', { target: viewerId, type: 'offer', payload: offer });
        console.log("📤 Offer sent to viewer");
        setStatus("WAITING FOR VIEWER...");
      } catch (err) {
        console.error("❌ Screen capture failed:", err);
        setStatus("SCREEN CAPTURE FAILED - Allow permission");
      }
    });

    // Signaling handler
    socket.on('signal', async (data) => {
      const { sender, type, payload } = data;
      console.log("📨 Signal received:", type, "from", sender);
      
      try {
        if (type === 'offer') {
          console.log("📥 Offer received, creating answer");
          const pc = createPeer(sender);
          peerRef.current = pc;
          
          // Handle incoming data channel
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
          console.log("📥 ICE candidate received");
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

    // Cleanup
    return () => {
      console.log("🧹 Cleaning up WebRTC connection");
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerRef.current) {
        peerRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
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
