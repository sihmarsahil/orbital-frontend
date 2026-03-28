import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = 'https://orbital-backend-kfdf.onrender.com';

const useWebRTC = (roomId, mode, passcode) => {
    const [status, setStatus] = useState('CONNECTING...');
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const [fileChannel, setFileChannel] = useState(null);

    useEffect(() => {
        // Socket initialization with explicit settings
        const socket = io(BACKEND_URL, { 
            transports: ['websocket', 'polling'],
            secure: true 
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
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    socket.emit('signal', { target: targetId, type: 'candidate', payload: e.candidate });
                }
            };

            pc.ontrack = (e) => {
                const videoElement = document.getElementById('remote-video') || document.querySelector('video');
                if (videoElement && e.streams[0]) {
                    videoElement.srcObject = e.streams[0];
                    videoElement.play().catch(() => console.log("User interaction needed"));
                }
            };

            return pc;
        };

        socket.on('viewer-joined', async (viewerId) => {
            const pc = createPeer(viewerId);
            peerRef.current = pc;
            
            try {
                // Simplified constraints to avoid browser-specific TypeErrors
                const stream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: true, 
                    audio: false 
                });
                
                streamRef.current = stream;
                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('signal', { target: viewerId, type: 'offer', payload: offer });
            } catch (err) {
                console.error("Screen Share Denied:", err);
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
                console.error("Signaling error", e);
            }
        });

        return () => {
            socket.disconnect();
            if (peerRef.current) peerRef.current.close();
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        };
    }, [roomId, mode, passcode]);

    return { status, socketRef, peerRef, fileChannel, setFileChannel };
};

export default useWebRTC;
