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

            pc.ontrack = (event) => {
                const remoteVideo = document.getElementById('remote-video');
                if (remoteVideo) remoteVideo.srcObject = event.streams[0];
            };

            return pc;
        };

        socket.on('viewer-joined', async (viewerId) => {
            const pc = createPeer(viewerId);
            peerRef.current = pc;
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                streamRef.current = stream;
                stream.getTracks().forEach(track => pc.addTrack(track, stream));
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('signal', { target: viewerId, type: 'offer', payload: offer });
            } catch (err) {
                console.error("Media Error:", err);
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
            } catch (e) { console.error(e); }
        });

        return () => {
            if (socket) socket.disconnect();
            if (peerRef.current) peerRef.current.close();
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        };
    }, [roomId, mode, passcode]);

    return { status, socketRef, peerRef, fileChannel, setFileChannel };
};

// YAHI MISSING THA:
export default useWebRTC;
