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
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log("PeerJS connected:", id);
      setStatus(`READY: ${mode.toUpperCase()}`);
      
      if (mode === 'host') {
        setStatus(`WAITING FOR VIEWER - ROOM: ${roomId}`);
      } else if (mode === 'viewer') {
        setStatus("CONNECTING TO HOST...");
        const conn = peer.connect(roomId);
        connRef.current = conn;
        
        conn.on('open', () => {
          console.log("Connected to host");
          setStatus("REQUESTING SCREEN...");
          
          const call = peer.call(roomId, null);
          callRef.current = call;
          
          call.on('stream', (stream) => {
            console.log("Screen stream received!");
            setRemoteStream(stream);
            setStatus("LIVE STREAMING");
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
          setStatus("CONNECTION FAILED");
        });
      }
    });

    peer.on('connection', (conn) => {
      console.log("Viewer connected:", conn.peer);
      connRef.current = conn;
      
      conn.on('data', (data) => {
        if (data.type === 'chat') {
          setChatMessages(prev => [...prev, { text: data.text, timestamp: data.timestamp, isOwn: false }]);
        } else if (data.type === 'voice') {
          setIsReceivingVoice(true);
          setTimeout(() => setIsReceivingVoice(false), 2000);
        }
      });
    });

    peer.on('call', (call) => {
      console.log("Screen share requested");
      callRef.current = call;
      
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          call.answer(stream);
          setStatus("STREAMING LIVE");
          
          call.on('close', () => {
            console.log("Call ended");
            setStatus("VIEWER DISCONNECTED");
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(t => t.stop());
            }
          });
        })
        .catch((err) => {
          console.error("Screen capture failed:", err);
          setStatus("SCREEN CAPTURE FAILED");
          call.close();
        });
    });

    peer.on('error', (err) => {
      console.error("Peer error:", err);
      setStatus(`ERROR: ${err.type}`);
    });

    if (mode === 'host') {
      const interval = setInterval(() => {
        if (connRef.current && connRef.current.open) {
          const cpu = (Math.random() * 40 + 20).toFixed(1);
          const ram = (Math.random() * 30 + 40).toFixed(1);
          connRef.current.send({ type: 'telemetry', data: { cpu, ram } });
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
