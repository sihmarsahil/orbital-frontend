import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { receiveInputData } from '../utils/rtcOps';

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function useWebRTC(roomId, passcode, mode, securityToggles = { mouse: true, clicks: true }) {
  const [status, setStatus] = useState('CONNECTING TO RELAY SERVER...');
  const [remoteStream, setRemoteStream] = useState(null);
  const [activeViewers, setActiveViewers] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [isReceivingVoice, setIsReceivingVoice] = useState(false);
  
  // Enterprise Analytics State
  const [metrics, setMetrics] = useState({ ping: 0, fps: 0 });
  const metricsIntervalRef = useRef(null);
  
  const securityRef = useRef(securityToggles);
  useEffect(() => { securityRef.current = securityToggles; }, [securityToggles]);

  const socketRef = useRef(null);
  const peersRef = useRef({}); 
  const localStreamRef = useRef(null);

  // Expose primary DataChannels references for external UI usage
  const [fileChannel, setFileChannel] = useState(null);

  useEffect(() => {
    const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3001';
    const socket = io(WEBSOCKET_URL);
    socketRef.current = socket;
    window.__PRIMARY_SOCKET = socket;
    window.__ROOM_ID = roomId;

    socket.on('connect', () => {
      setStatus(`CONNECTED. ROLE: ${mode.toUpperCase()}`);
      if (mode === 'host') socket.emit('create-room', { roomId, passcode });
      else socket.emit('join-room', { roomId, passcode });
    });

    socket.on('error', (msg) => { setStatus(`ERROR: ${msg}`); socket.disconnect(); });

    socket.on('telemetry', (data) => {
        setMetrics(prev => ({ ...prev, telemetry: data }));
        setStatus('LIVE (SOCKET RELAY)');
    });

    socket.on('chat-message', (msg) => {
        setChatMessages(prev => [...prev, msg]);
    });

    socket.on('voice-message', async (data) => {
        setIsReceivingVoice(true);
        try {
            const blob = new Blob([data.audioBlob], { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => setIsReceivingVoice(false);
            audio.play().catch(console.error);
        } catch(e) {
            setIsReceivingVoice(false);
        }
    });

    socket.on('viewer-joined', async (viewerSocketId) => {
      setStatus(`NEW VIEWER DETECTED: ${viewerSocketId.substring(0,4)}...`);
      const pc = createPeerConnection(viewerSocketId);
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current);
        });
      }

      // Track 1: Telemetry DataChannel
      const tele_dc = pc.createDataChannel('telemetry');
      setupTelemetryChannel(tele_dc, viewerSocketId);
      
      // Track 2: File Transfer DataChannel
      const file_dc = pc.createDataChannel('file-transfer');
      // Host receives files from viewers easily!
      setFileChannel(file_dc);
      window.__PRIMARY_FILE_CHANNEL = file_dc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('signal', { roomId, target: viewerSocketId, type: 'offer', payload: offer });
    });

    socket.on('viewer-left', (viewerSocketId) => {
       if (peersRef.current[viewerSocketId]) {
           peersRef.current[viewerSocketId].close();
           delete peersRef.current[viewerSocketId];
           setActiveViewers(Object.keys(peersRef.current).length);
       }
    });

    socket.on('signal', async ({ sender, type, payload }) => {
      const pc = peersRef.current[sender] || createPeerConnection(sender);

      if (type === 'offer') {
        setStatus('HANDSHAKE RECEIVED. BUILDING ANSWER...');
        
        pc.ondatachannel = (event) => {
           if (event.channel.label === 'telemetry') setupTelemetryChannel(event.channel, sender);
           if (event.channel.label === 'file-transfer') {
              setFileChannel(event.channel);
              window.__PRIMARY_FILE_CHANNEL = event.channel;
           }
        };
        
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit('signal', { roomId, target: sender, type: 'answer', payload: answer });
      } else if (type === 'answer') {
        setStatus(`ANSWER VERIFIED. SECURING LINK...`);
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (type === 'ice-candidate') {
        if (payload) await pc.addIceCandidate(new RTCIceCandidate(payload));
      }
    });

    return () => {
      socket.disconnect();
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
    };
  }, [roomId, passcode, mode]);

  const createPeerConnection = (targetSocketId) => {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    peersRef.current[targetSocketId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('signal', {
          roomId, target: targetSocketId, type: 'ice-candidate', payload: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected') {
            setStatus('LIVE P2P UPLINK ESTABLISHED');
            setActiveViewers(Object.keys(peersRef.current).length);
            
            // Initiate live metrics engine
            if (!metricsIntervalRef.current) {
                metricsIntervalRef.current = setInterval(async () => {
                    if (pc.iceConnectionState !== 'connected') return;
                    const stats = await pc.getStats();
                    let newPing = metrics.ping;
                    let newFps = metrics.fps;
                    
                    stats.forEach(report => {
                        if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
                             newPing = (report.roundTripTime || 0) * 1000;
                        } else if (report.type === 'candidate-pair' && report.state === 'succeeded' && newPing === 0) {
                             newPing = (report.currentRoundTripTime || 0) * 1000;
                        }
                        if (report.type === 'inbound-rtp' && report.kind === 'video') {
                             newFps = report.framesPerSecond || 0;
                        } else if (mode === 'host' && report.type === 'outbound-rtp' && report.kind === 'video') {
                             newFps = report.framesPerSecond || 0;
                        }
                    });
                    setMetrics({ ping: Math.round(newPing), fps: Math.round(newFps) });
                }, 1500);
            }

        } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            if (peersRef.current[targetSocketId]) {
                peersRef.current[targetSocketId].close();
                delete peersRef.current[targetSocketId];
            }
            setActiveViewers(Object.keys(peersRef.current).length);
        }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    return pc;
  };

  const setupTelemetryChannel = (dc, senderSocketId) => {
    if (mode === 'viewer') window.__PRIMARY_DATA_CHANNEL = dc; 

    dc.onmessage = (event) => {
        if (mode === 'host') {
            const parsed = receiveInputData(event.data);
            if (parsed) {
                if (parsed.type === 'mousemove' && !securityRef.current.mouse) return;
                if ((parsed.type === 'mousedown' || parsed.type === 'mouseup') && !securityRef.current.clicks) return;
                
                // POST to Local IPC Agent bypassing browser security sandboxes
                fetch('http://localhost:3002/mouse', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsed)
                }).catch(err => {
                    console.log("Failed to hit local Node agent.", err);
                });
            }
        }
    };
  };

  const attachLocalStream = (stream) => { localStreamRef.current = stream; };

  const sendChatMessage = (text) => {
      const msg = { senderType: mode, text, timestamp: Date.now() };
      socketRef.current?.emit('chat-message', msg);
      setChatMessages(prev => [...prev, msg]);
  };

  const sendVoiceMessage = (blob) => {
      socketRef.current?.emit('voice-message', { audioBlob: blob });
  };

  return { status, remoteStream, attachLocalStream, activeViewers, metrics, fileChannel, chatMessages, sendChatMessage, isReceivingVoice, sendVoiceMessage };
}
