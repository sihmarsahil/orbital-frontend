import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

const useWebRTC = (roomId, mode, passcode) => {
  const [status, setStatus] = useState('CONNECTING...');
  const [remoteStream, setRemoteStream] = useState(null);
  const [fileChannel, setFileChannel] = useState(null);
  const [metrics, setMetrics] = useState({ telemetry: { cpu: '0.00', ram: '0.00' } });
  const [chatMessages, setChatMessages] = useState([]);
  const [isReceivingVoice, setIsReceivingVoice] = useState(false);
  
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const connRef = useRef(null);
  const streamRef = useRef(null);

  const sendChatMessage = (msg) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'chat', text: msg, timestamp: Date.now() });
      setChatMessages(prev => [...prev, { text: msg, timestamp: Date.now(), isOwn: true }]);
    }
  };

  const sendVoiceMessage = (audioBlob) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'voice', audio: audioBlob, timestamp: Date.now() });
      setIsReceivingVoice(true);
      setTimeout(() => setIsReceivingVoice(false), 2000);
    }
  };

  useEffect(() => {
    // Create Peer with free default server
    const peer = new Peer({
      debug: 2,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });
    
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log("✅ PeerJS connected! ID:", id);
      setStatus(`READY: ${mode.toUpperCase()}`);
      
      if (mode === 'host') {
        // Host waits for viewer to connect
        setStatus(`WAITING FOR VIEWER... ROOM: ${roomId}`);
      } else if (mode === 'viewer') {
        // Viewer connects to host
        setStatus("CONNECTING TO HOST...");
        const conn = peer.connect(roomId);
        connRef.current = conn;
        
        conn.on('open', () => {
          console.log("🔗 Data connection opened with host");
          setStatus("REQUESTING SCREEN...");
          
          // Call the host for screen share
          const call = peer.call(roomId, null);
          callRef.current = call;
          
          call.on('stream', (stream) => {
            console.log("🎥 Received screen stream!");
            setRemoteStream(stream);
            setStatus("LIVE STREAMING ✅");
          });
          
          call.on('error', (err) => {
            console.error("Call error:", err);
            setStatus("CONNECTION FAILED");
          });
        });
        
        conn.on('data', (data) => {
          if (data.type === 'chat') {
            setChatMessages(prev => [...prev, { text: data.text, timestamp: data.timestamp, isOwn: false }]);
          } else if (data.type === 'voice') {
            setIsReceivingVoice(true);
            setTimeout(() => setIsReceivingVoice(false), 2000);
          } else if (data.type === 'telemetry') {
            setMetrics({ telemetry: data.data });
          }
        });
        
        conn.on('error', (err) => {
          console.error("Connection error:", err);
          setStatus("CONNECTION FAILED - Wrong Room ID?");
        });
      }
    });

    // Host: Handle incoming connections
    peer.on('connection', (conn) => {
      console.log("📡 Viewer connected:", conn.peer);
      connRef.current = conn;
      
      conn.on('data', (data) => {
        if (data.type === 'chat') {
          setChatMessages(prev => [...prev, { text: data.text, timestamp: data.timestamp, isOwn: false }]);
        } else if (data.type === 'voice') {
          setIsReceivingVoice(true);
          setTimeout(() => setIsReceivingVoice(false), 2000);
        }
      });
      
      conn.on('open', () => {
        console.log("Data channel ready");
      });
    });

    // Host: Handle incoming calls (viewer requesting screen)
    peer.on('call', (call) => {
      console.log("📞 Viewer requesting screen share");
      callRef.current = call;
      
      // Start screen capture
      navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: false 
      }).then((stream) => {
        streamRef.current = stream;
        call.answer(stream);
        setStatus("STREAMING LIVE ✅");
        
        call.on('stream', (remoteStream) => {
          // This is for host if viewer also shares (not needed)
          console.log("Remote stream received");
        });
        
        call.on('close', () => {
          console.log("Call ended");
          setStatus("VIEWER DISCONNECTED");
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
          }
        });
      }).catch((err) => {
        console.error("Screen capture failed:", err);
        setStatus("SCREEN CAPTURE FAILED - Allow permission");
        call.close();
      });
    });

    peer.on('error', (err) => {
      console.error("Peer error:", err);
      setStatus(`ERROR: ${err.type}`);
    });

    peer.on('disconnected', () => {
      console.log("Peer disconnected");
      setStatus("DISCONNECTED - Reconnecting...");
      peer.reconnect();
    });

    // Send telemetry data (host only)
    if (mode === 'host') {
      const interval = setInterval(() => {
        if (connRef.current && connRef.current.open) {
          // Simulate CPU/RAM usage (replace with real metrics if needed)
          const cpu = (Math.random() * 40 + 20).toFixed(1);
          const ram = (Math.random() * 30 + 40).toFixed(1);
          connRef.current.send({ 
            type: 'telemetry', 
            data: { cpu, ram } 
          });
        }
      }, 2000);
      
      return () => {
        clearInterval(interval);
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (peerRef.current) peerRef.current.destroy();
      };
    }

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (callRef.current) callRef.current.close();
      if (connRef.current) connRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
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
