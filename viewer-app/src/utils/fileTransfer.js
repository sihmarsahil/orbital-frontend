export function sendFile(file, dataChannel) {
  if (!dataChannel || dataChannel.readyState !== 'open') {
      alert("File Transfer pipeline is not open. Ensure DataChannel is established.");
      return;
  }
  
  // 1. Send initialization manifest payload
  const metadata = { cmd: 'METADATA', name: file.name, size: file.size, type: file.type };
  dataChannel.send(JSON.stringify(metadata));

  // 2. Transmit high-performance binary ArrayBuffers
  const chunkSize = 16384;  // Safe WebRTC limit (16KB)
  let offset = 0;
  
  file.arrayBuffer().then((buffer) => {
      const sendNextChunk = () => {
         while (offset < buffer.byteLength) {
             // Handle browser datachannel congestion
             if (dataChannel.bufferedAmount > 1024 * 1024) { // wait if > 1MB buffered locally
                 dataChannel.onbufferedamountlow = () => {
                     dataChannel.onbufferedamountlow = null;
                     sendNextChunk();
                 };
                 return;
             }
             const end = Math.min(offset + chunkSize, buffer.byteLength);
             dataChannel.send(buffer.slice(offset, end));
             offset += chunkSize;
         }
         // 3. Send Termination package marker
         dataChannel.send(JSON.stringify({ cmd: 'EOF' }));
      };
      sendNextChunk();
  });
}

// 4. Receives binary blocks into a unified file Blob, initiating direct browser download
export function receiveFileChunk(data, fileStateRef, onComplete) {
  if (typeof data === 'string') {
     try {
         const msg = JSON.parse(data);
         if (msg.cmd === 'METADATA') {
            console.log("Receiving File Transfer:", msg.name);
            fileStateRef.current = { name: msg.name, type: msg.type, size: msg.size, chunks: [] };
         } else if (msg.cmd === 'EOF') {
            console.log("File Transfer Complete. Reconstructing blob...");
            const blob = new Blob(fileStateRef.current.chunks, { type: fileStateRef.current.type });
            const url = URL.createObjectURL(blob);
            onComplete({ url, name: fileStateRef.current.name, size: fileStateRef.current.size });
            fileStateRef.current = null;
         }
     } catch (e) { 
         // Ignore purely invalid parse attempts (might just be a string we didn't mean to log here)
     }
  } else {
     // If raw binary ArrayBuffer payload arrives, chunk it safely into memory RAM
     if (fileStateRef.current) {
         fileStateRef.current.chunks.push(data);
     }
  }
}
