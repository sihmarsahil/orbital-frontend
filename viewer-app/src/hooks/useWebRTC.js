import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

// 1. Sidha Render ka backend URL (Environment variable ki jhanjhat khatam)
const WEBSOCKET_URL = 'https://orbital-backend-kfdf.onrender.com';

export const useWebRTC = (roomId, mode, passcode) => {
    const [status, setStatus] = useState('CONNECTING...');
    const [fileChannel, setFileChannel] = useState(null);
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        // 2. Socket Connection Setup
        const socket = io(WEBSOCKET_URL, {
            transports: ['websocket', 'polling']
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setStatus(`CONNECTED. ROLE: ${mode.toUpperCase()}`);
            if (mode === 'host') {
                socket.emit('create-room', { roomId, passcode });
            }
        });

        socket.on('error', (msg) => {
            setStatus(`ERROR: ${msg}`);
        });

        // 3. WebRTC Peer Connection with GOOGLE STUN SERVERS (Zaroori for Cloud)
        const createPeer = (targetId) => {
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            });

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('signal', { target: targetId, type: 'candidate', payload: event.candidate });
                }
            };

            pc.ontrack = (event) => {
                const remoteVideo = document.getElementById('remote-video');
                if (remoteVideo) remoteVideo.srcObject = event.streams[0];
            };

            return pc;
        };

        // Signaling Logic
        socket.on('viewer-joined', async (viewerId) => {
            const pc = createPeer(viewerId);
            peerRef.current = pc;

            // Get Screen/Camera Stream
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                stream.getTracks().forEach(track => pc.addTrack(track, stream));
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('signal', { target: viewerId, type: 'offer', payload: offer });
            } catch (err) {
                console.error("Media Error:", err);
            }
        });

        socket.on('signal', async ({ sender, type, payload }) => {
            if (type === 'offer') {
                const pc = createPeer(sender);
                peerRef.current = pc;
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('signal', { target: sender, type: 'answer', payload: answer });
            } else if (type === 'answer') {
                await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
            } else if (type === 'candidate') {
                await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
            }
        });

        return () => {
            socket.disconnect();
            if (peerRef.current) peerRef.current.close();
        };
    }, [roomId, mode, passcode]);

    return { status };
};
