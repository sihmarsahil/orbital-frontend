import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const WEBSOCKET_URL = 'https://orbital-backend-kfdf.onrender.com';

const useWebRTC = (roomId, mode, passcode) => {
    const [status, setStatus] = useState('CONNECTING...');
    const [fileChannel, setFileChannel] = useState(null);
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        const socket = io(WEBSOCKET_URL, {
            transports: ['websocket', 'polling']
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log("Socket Connected ✅");
            setStatus(`CONNECTED. ROLE: ${mode.toUpperCase()}`);
            if (mode === 'host') {
                socket.emit('create-room', { roomId, passcode });
            }
        });

        socket.on('error', (msg) => {
            setStatus(`ERROR: ${msg}`);
        });

        const createPeer = (targetId) => {
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('signal', { target: targetId, type: 'candidate', payload: event.candidate });
                }
            };

            // VIEWER SIDE: Jab video stream aaye
            pc.ontrack = (event) => {
                console.log("STREAM RECEIVED FROM HOST! 🎥");
                const remoteVideo = document.getElementById('remote-video') || document.querySelector('video');
                if (remoteVideo) {
                    remoteVideo.srcObject = event.streams[0];
                    // Autoplay fix: browser block na kare
                    remoteVideo.play().catch(e => console.warn("Autoplay blocked, user must click first."));
                }
            };

            return pc;
        };

        socket.on('viewer-joined', async (viewerId) => {
            console.log("Viewer detected, starting screen capture...");
            const pc = createPeer(viewerId);
            peerRef.current = pc;
            try {
                // Screen Capture Options
                const stream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: { cursor: "always" }, 
                    audio: true 
                });
                streamRef.current = stream;
                stream.getTracks().forEach(track => pc.addTrack(track, stream));
                
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('signal', { target: viewerId, type: 'offer', payload: offer });
                console.log("Offer sent to viewer");
            } catch (err) {
                console.error("Screen Capture Error:", err);
            }
        });

        socket.on('signal', async ({ sender, type, payload }) => {
            try {
                if (type === 'offer') {
                    console.log("Offer received, creating answer...");
                    const pc = createPeer(sender);
                    peerRef.current = pc;
                    await pc.setRemoteDescription(new RTCSessionDescription(payload));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('signal', { target: sender, type: 'answer', payload: answer });
                } else if (type === 'answer' && peerRef.current) {
                    console.log("Answer received, connection establishing...");
                    await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
                } else if (type === 'candidate' && peerRef.current) {
                    await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
                }
            } catch (e) { console.error("Signaling error:", e); }
        });

        return () => {
            if (socket) socket.disconnect();
            if (peerRef.current) peerRef.current.close();
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        };
    }, [roomId, mode, passcode]);

    return { status, socketRef, peerRef, fileChannel, setFileChannel };
};

export default useWebRTC;
