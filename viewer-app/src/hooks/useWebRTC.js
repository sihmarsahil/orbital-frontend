import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SIGNAL_SERVER = 'https://orbital-backend-kfdf.onrender.com';

const useWebRTC = (roomId, mode, passcode) => {
  const [status, setStatus] = useState('CONNECTING...');
  const [fileChannel, setFileChannel] = useState(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const socket = io(SIGNAL_SERVER, {
      transports: ['websocket', 'polling'],
      secure: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus(`READY: ${mode.toUpperCase()}`);
      if (mode === 'host') {
        socket.emit('create-room', { roomId, passcode });
      }
    });

    const createPeer = (targetId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('signal', { target: targetId, type: 'candidate', payload: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        console.log("Remote stream received");
        const video = document.getElementById('remote-video') || document.querySelector('video');
        if (video && e.streams[0]) {
          video.srcObject = e.streams[0];
          video.play().catch(() => console.log("Play blocked by browser"));
        }
      };

      return pc;
    };

    socket.on('viewer-joined', async (viewerId) => {
      const pc = createPeer(viewerId);
      peerRef.current = pc;
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        streamRef.current = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal', { target: viewerId, type: 'offer', payload: offer });
      } catch (err) {
        console.error("Capture Error:", err);
      }
    });

    socket.on('signal', async ({ sender, type, payload }) => {
      try {
        if (type === 'offer') {
          const pc = createPeer(sender);
          peerRef.current = pc;
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { target: sender, type: 'answer', payload: answer });
        } else if (type === 'answer' && peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (type === 'candidate' && peerRef.current) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
        }
      } catch (e) {
        console.error("Signal Error:", e);
      }
    });

    return () => {
      socket.disconnect();
      if (peerRef.current) peerRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, mode, passcode]);

  // Yahan se wahi return ho raha hai jo aapke components export expect kar rahe hain
  return {
    status,
    socketRef,
    peerRef,
    fileChannel,
    setFileChannel
  };
};

export default useWebRTC;
