import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

// Backend URL
const WEBSOCKET_URL = 'https://orbital-backend-kfdf.onrender.com';

const useWebRTC = (roomId, mode, passcode) => {
    const [status, setStatus] = useState('CONNECTING...');
    const [fileChannel, setFileChannel] = useState(null);
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);

    // Safari/Chrome Compatible Screen Capture Function
    const startCapture = async () => {
        try {
            // Safari Safe Constraints: Avoid complex objects
            const constraints = { 
                video: true, 
                audio: true 
            };
            
            // Check if getDisplayMedia is supported (Legacy Safari fix)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error("Browser does not support screen sharing.");
            }

            const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            streamRef.current = stream;
            return stream;
        } catch (err) {
            console.error("Capture Error:", err);
            // Permission denied or browser block
            if (err.name === 'NotAllowedError') {
                alert("Permission Denied: Please allow screen recording in System Preferences (Mac) and browser.");
            } else {
                alert("Screen capture failed. Please use Google Chrome for best compatibility.");
            }
            return null;
        }
    };

    useEffect(() => {
        // Socket initialization with fallback transports
        const socket = io(WEBSOCKET_URL, {
            transports: ['websocket', 'polling'],
            secure: true
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
            console.error("Socket Error:", msg);
        });

        // Robust Peer Connection Configuration
        const createPeer = (targetId) => {
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ],
                // Safari compatibility fix for bundle policy
                bundlePolicy: "max-bundle" 
            });

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('signal', { target: targetId, type: 'candidate', payload: event.candidate });
                }
            };

            pc.oniceconnectionstatechange = () => {
                console.log("ICE Connection State:", pc.iceConnectionState);
                if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                    setStatus("CONNECTION FAILED. TRY REFRESHING.");
                }
            };

            // VIEWER SIDE: Display Remote Stream
            pc.ontrack = (event) => {
                console.log("STREAM RECEIVED! 🎥");
                setStatus("UPLINK ACTIVE. STREAMING.");
                const remoteVideo = document.getElementById('remote-video') || document.querySelector('video');
                if (remoteVideo) {
                    if (remoteVideo.srcObject !== event.streams[0]) {
                        remoteVideo.srcObject = event.streams[0];
                        console.log("Stream assigned to video element.");
                    }
                    // Safari/Chrome Autoplay Fix
                    remoteVideo.play().catch(() => {
                        console.warn("Autoplay blocked. User must click to hear audio.");
                        // Show overlay if needed
                    });
                } else {
                    console.error("Video element not found. Ensure ID is 'remote-video'.");
                }
            };

            return pc;
        };

        // HOST SIDE: Viewer Joined
        socket.on('viewer-joined', async (viewerId) => {
            console.log("Viewer joined. Requesting screen share...");
            const pc = createPeer(viewerId);
            peerRef.current = pc;
            
            const stream = await startCapture();
            if (stream) {
                stream.getTracks().forEach(track => pc.addTrack(track, stream));
                
                try {
                    const offer = await pc.createOffer();
                    // Safari compatibility: handle plan B/unified plan if needed
                    await pc.setLocalDescription(offer);
                    socket.emit('signal', { target: viewerId, type: 'offer', payload: offer });
                    console.log("Offer sent.");
                } catch (e) { console.error("Offer Error:", e); }
            } else {
                setStatus("CAPTURE DENIED. CANNOT STREAM.");
            }
        });

        // SIGNALING BROKER
        socket.on('signal', async ({ sender, type, payload }) => {
            try {
                if (type === 'offer') {
                    console.log("Offer received.");
                    const pc = createPeer(sender);
                    peerRef.current = pc;
                    await pc.setRemoteDescription(new RTCSessionDescription(payload));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('signal', { target: sender, type: 'answer', payload: answer });
                } else if (type === 'answer' && peerRef.current) {
                    console.log("Answer received.");
                    await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
                } else if (type === 'candidate' && peerRef.current) {
                    // Check for null candidate (Safari compatibility)
                    if (payload) {
                        await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
                    }
                }
            } catch (e) { console.error("Signaling error:", e); }
        });

        // Cleanup on unmount
        return () => {
            console.log("Cleaning up WebRTC...");
            if (socket) socket.disconnect();
            if (peerRef.current) peerRef.current.close();
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [roomId, mode, passcode]);

    return { status, socketRef, peerRef, fileChannel, setFileChannel };
};

export default useWebRTC;
