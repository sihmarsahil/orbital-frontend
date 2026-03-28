import CryptoJS from 'crypto-js';

const AES_SECRET = 'PLACEHOLDER_PASSCODE_DERIVED_KEY'; // Derived from user 6-digit pin in real app

export function sendInputData(event, canvasRef, type) {
  if (!canvasRef.current) return;
  // Dynamic extraction from new useWebRTC architecture
  const dataChannel = window.__PRIMARY_DATA_CHANNEL;

  const canvas = canvasRef.current;
  const rect = canvas.getBoundingClientRect();
  
  // Normalize coordinates (0.0 to 1.0) so host interpolates to their target resolution
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  const normalizedX = (localX / rect.width).toFixed(4);
  const normalizedY = (localY / rect.height).toFixed(4);

  const payload = {
    type,
    x: normalizedX,
    y: normalizedY,
    timestamp: Date.now()
  };

  // Perform AES-256 Encryption mapping
  const stringified = JSON.stringify(payload);
  const encrypted = CryptoJS.AES.encrypt(stringified, AES_SECRET).toString();
  const outgoingPacket = JSON.stringify({ enc: encrypted });

  if (dataChannel && dataChannel.readyState === 'open') {
     dataChannel.send(outgoingPacket);
  } else if (window.__PRIMARY_SOCKET) {
     window.__PRIMARY_SOCKET.emit('os-control', { roomId: window.__ROOM_ID, x: payload.x, y: payload.y, type: payload.type });
  }
}

// Host-side decryption snippet mapping
export function receiveInputData(packet) {
  try {
    const raw = JSON.parse(packet);
    const decrypted = CryptoJS.AES.decrypt(raw.enc, AES_SECRET).toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (err) {
    console.error("AES Decryption failed", err);
    return null;
  }
}
