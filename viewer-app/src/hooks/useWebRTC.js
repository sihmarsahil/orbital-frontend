import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const URL = 'https://orbital-backend-kfdf.onrender.com';

const useWebRTC = (roomId, mode, passcode) => {
    const [status, setStatus] = useState('CONNECTING...');
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const [fileChannel, setFileChannel] = useState(null);

    useEffect(() => {
        const socket = io(URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            setStatus(`CONNECTED: ${mode.toUpperCase()}`);
            if (mode === 'host') socket.emit('create-room', { roomId, passcode });
        });

        const createPeer = (tid) => {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            pc.onicecandidate = (e) => {
                if (e.candidate) socket.emit('signal', { target: tid, type: 'candidate', payload: e.candidate });
            };

            pc.ontrack = (e) => {
                const vid = document.getElementById('remote-video') || document.querySelector('video');
                if (vid) {
                    vid.srcObject = e.streams[0];
                    vid.play().catch(() => console.log("Click to play video"));
                }
            };
            return pc;
        };

        socket.on('viewer-joined', async (vid) => {
            const pc = createPeer(vid);
            peerRef.current = pc;
            try {
                // Ekdam simple constraints for Safari/Chrome
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                streamRef.current = stream;
                stream.getTracks().forEach(t => pc.addTrack(t, stream));
                
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('signal', { target: vid, type: 'offer', payload: offer });
            } catch (err) {
                console.error("Capture Failed", err);
            }
        });

        socket.on('signal', async ({ sender, type, payload }) => {
            try {
                if (type === 'offer') {
                    const pc = createPeer(sender);
                    peerRef.current = pc;
                    await pc.setRemoteDescription(new RTCSessionDescription(payload));
                    const ans = await pc.createAnswer();
                    await pc.setLocalDescription(ans);
                    socket.emit('signal', { target: sender, type: 'answer', payload: ans });
                } else if (type === 'answer' && peerRef.current) {
                    await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
                } else if (type === 'candidate' && peerRef.current) {
                    await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
                }
            } catch (e) { console.error(e); }
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
