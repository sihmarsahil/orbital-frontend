import { useRef, useCallback, useEffect, useState } from 'react';
import io from 'socket.io-client';

// ✅ ADD THIS ICE CONFIGURATION
const ICE_SERVERS = {
  iceServers: [
    // STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // FREE TURN servers (CRITICAL for different networks)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

export const useWebRTC = (roomId, isHost = false) => {
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const socketRef = useRef(null);
  const [connectionState, setConnectionState] = useState('new');
  const [dataChannelState, setDataChannelState] = useState('closed');

  // Initialize peer connection
  const initPeerConnection = useCallback(() => {
    // ✅ Use updated ICE servers
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      
      if (pc.connectionState === 'failed') {
        console.error('Connection failed! Check network/TURN servers');
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState);
    };
    
    pc.onicegatheringstatechange = () => {
      console.log('ICE gathering:', pc.iceGatheringState);
    };
    
    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          roomId: roomId
        });
      }
    };
    
    // ✅ For HOST: Create data channel
    if (isHost) {
      try {
        const dataChannel = pc.createDataChannel('chat');
        dataChannelRef.current = dataChannel;
        
        dataChannel.onopen = () => {
          console.log('✅ Data channel OPEN (Host)');
          setDataChannelState('open');
        };
        
        dataChannel.onclose = () => {
          console.log('Data channel closed');
          setDataChannelState('closed');
        };
        
        dataChannel.onerror = (error) => {
          console.error('Data channel error:', error);
        };
        
        dataChannel.onmessage = (event) => {
          console.log('Message received:', event.data);
          // Handle incoming messages
        };
      } catch (error) {
        console.error('Error creating data channel:', error);
      }
    }
    
    // ✅ For VIEWER: Handle incoming data channel
    if (!isHost) {
      pc.ondatachannel = (event) => {
        console.log('📡 Data channel received!');
        const channel = event.channel;
        dataChannelRef.current = channel;
        
        channel.onopen = () => {
          console.log('✅ Data channel OPEN (Viewer)');
          setDataChannelState('open');
        };
        
        channel.onclose = () => {
          console.log('Data channel closed');
          setDataChannelState('closed');
        };
        
        channel.onerror = (error) => {
          console.error('Data channel error:', error);
        };
        
        channel.onmessage = (event) => {
          console.log('Message received:', event.data);
          // Handle messages
        };
      };
    }
    
    // Track handler for receiving streams
    pc.ontrack = (event) => {
      console.log('Track received:', event.track.kind);
    };
    
    peerConnectionRef.current = pc;
    return pc;
  }, [roomId, isHost]);

  // Send message function
  const sendMessage = useCallback((message) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(message);
      return true;
    } else {
      console.warn('Data channel not ready. State:', dataChannelRef.current?.readyState);
      return false;
    }
  }, []);

  // Send file function
  const sendFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileData = {
            type: 'file',
            name: file.name,
            size: file.size,
            data: e.target.result
          };
          dataChannelRef.current.send(JSON.stringify(fileData));
          resolve(true);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else {
        reject(new Error('Data channel not ready'));
      }
    });
  }, []);

  // Create offer (Host)
  const createOffer = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);
      
      // Wait for ICE gathering
      await waitForIceGathering(pc);
      
      return pc.localDescription;
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }, []);

  // Helper to wait for ICE gathering
  const waitForIceGathering = (pc) => {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 5000); // Timeout after 5 seconds
      }
    });
  };

  // Create answer (Viewer)
  const createAnswer = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    
    try {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Error creating answer:', error);
      throw error;
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  return {
    initPeerConnection,
    createOffer,
    createAnswer,
    sendMessage,
    sendFile,
    cleanup,
    connectionState,
    dataChannelState,
    peerConnection: peerConnectionRef,
    dataChannel: dataChannelRef
  };
};
