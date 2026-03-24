import React, { useState, useEffect, use } from 'react';
import Peer from 'peerjs';
import { getSavedId, getChatHistory, saveChatHistory } from './utils/storage';
import { ConnectionScreen } from './components/ConnectionScreen';
import { ChatScreen } from './components/ChatScreen';
import { ShieldAlert } from 'lucide-react';
import './App.css';
import clsx from "clsx";

const fileChunksMap = new Map();

function App() {

  // ✅ FIX: initialize directly (no warning)
  const [myId] = useState(() => getSavedId());

  const [peer, setPeer] = useState(null);
  const [connections, setConnections] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [incomingConnection, setIncomingConnection] = useState(null);

  // ✅ Peer setup (with mobile fix TURN server)
  useEffect(() => {

    const newPeer = new Peer(myId, {
      debug: 2,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      },
    });

    newPeer.on('open', (id) => {
      console.log('My peer ID is:', id);
      setPeer(newPeer);
      setMessages(getChatHistory());
    });

    // ✅ FIX: simple incoming connection (no timeout mess)
    newPeer.on('connection', (conn) => {
      console.log('Incoming connection:', conn.peer);
      setIncomingConnection(conn); // show popup only
    });

    newPeer.on('error', (err) => {
      console.error(err);
      setIsConnecting(false);
      alert("Peer error: " + err.message);
    });

    return () => newPeer.destroy();

  }, [myId]);

  // save chat
  useEffect(() => {
    if (connections.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages, connections]);

  // add connection
  const addConnection = (conn) => {
    setConnections(prev => {
      if (prev.find(c => c.peer === conn.peer)) return prev;
      return [...prev, conn];
    });
    setIncomingConnection(null);
  };

  const disconnectPeer = (peerId) => {
    const conn = connections.find(c => c.peer === peerId);
    if (conn) conn.close();
    setConnections(prev => prev.filter(c => c.peer !== peerId));
  };

  // ✅ MAIN CONNECTION HANDLER
  const handleConnection = (conn) => {

    addConnection(conn);

    conn.on('data', (data) => {

      if (data.type === 'file-chunk') {
        const { fileId, fileName, fileSize, fileType, chunkIndex, totalChunks, data: chunkData } = data;
        
        if (!fileChunksMap.has(fileId)) {
          fileChunksMap.set(fileId, new Array(totalChunks));
        }
        
        const chunksArray = fileChunksMap.get(fileId);
        chunksArray[chunkIndex] = chunkData;
        
        const receivedCount = chunksArray.filter(Boolean).length;
        if (receivedCount === totalChunks) {
           const base64String = chunksArray.join('');
           fileChunksMap.delete(fileId);
           
           fetch(base64String)
             .then(res => res.blob())
             .then(blob => {
                 const url = URL.createObjectURL(blob);
                 setMessages(prev => [...prev, {
                    id: fileId,
                    type: fileType,
                    fileName: fileName,
                    fileSize: fileSize,
                    fileUrl: url,
                    sender: conn.peer,
                    timestamp: Date.now()
                 }]);
             })
             .catch(err => console.error("Could not convert base64 to blob", err));
        }
      } else if (data.type === 'file' || data.type === 'image') {
        const blob = new Blob([data.fileData]);
        const url = URL.createObjectURL(blob);

        setMessages(prev => [...prev, {
          ...data,
          fileData: undefined, // Avoid saving massive buffers to sessionStorage
          fileUrl: url,
          sender: conn.peer
        }]);

      } else {
        setMessages(prev => [...prev, { ...data, sender: conn.peer }]);
      }
    });

    conn.on('close', () => {
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
    });

    conn.on('error', () => {
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
    });
  };

  // ✅ FIXED connect (removed signal logic)
  const connectToPeer = (peerId) => {

    if (!peer || peerId === myId) return;

    if (connections.find(c => c.peer === peerId)) {
      alert("Already connected!");
      return;
    }

    setIsConnecting(true);

    const conn = peer.connect(peerId);

    const timeout = setTimeout(() => {
      setIsConnecting(prev => {
        if (prev) {
          alert("Connection timeout");
          conn.close();
        }
        return false;
      });
    }, 150000);

    conn.on('open', () => {
      clearTimeout(timeout);
      setIsConnecting(false);
      handleConnection(conn); // ✅ direct connect
    });

    conn.on('error', () => {
      clearTimeout(timeout);
      setIsConnecting(false);
      alert("Connection failed");
    });
  };

  const broadcastData = (dataObj, msgObject) => {
    connections.forEach(conn => conn.send(dataObj));
    if (msgObject) {
      setMessages(prev => [...prev, msgObject]);
    }
  };

  const sendMessage = (text) => {
    if (connections.length === 0) return;

    const msg = {
      id: Date.now().toString(),
      type: 'text',
      content: text,
      timestamp: Date.now(),
    };

    broadcastData(msg, { ...msg, sender: 'me' });
  };

  const sendFile = (file) => {
    const fileId = Date.now().toString();
    const isImage = file.type.startsWith('image');
    
    // Add msg to UI immediately without the massive payload
    const localMsg = {
      id: fileId,
      type: isImage ? 'image' : 'file',
      fileName: file.name,
      fileSize: file.size,
      fileUrl: URL.createObjectURL(file),
      sender: 'me',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, localMsg]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      const CHUNK_SIZE = 50 * 1024; // 50KB chunks
      const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
      let i = 0;
      
      const sendNextChunk = () => {
         if (i >= totalChunks) return;
         
         const chunk = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
         const msgChunk = {
            type: 'file-chunk',
            fileId,
            fileName: file.name,
            fileSize: file.size,
            fileType: isImage ? 'image' : 'file',
            chunkIndex: i,
            totalChunks,
            data: chunk
         };
         
         connections.forEach(conn => conn.send(msgChunk));
         i++;
         
         setTimeout(sendNextChunk, 20); // allow buffer to drain smoothly
      };
      
      sendNextChunk();
    };

    reader.readAsDataURL(file);
  };

  const isConnected = connections.length > 0;

  return (
    <div className="app-container">

      <header className="app-header">
        <div className="brand">
          <ShieldAlert size={28} />
          <span>SecureShare</span>
        </div>

        <div className={clsx('status-badge', isConnected && 'status-connected')}>
          {isConnected ? `${connections.length} Connected` : 'Not Connected'}
        </div>
      </header>

      <main className="main-content">

        {/* ✅ FIXED Accept / Decline */}
        {incomingConnection && (
          <div className="modal-overlay">
            <div className="connect-card" style={{ textAlign: 'center' }}>
              <h3>Incoming Connection</h3>
              <p>Peer <strong>{incomingConnection.peer}</strong> wants to connect</p>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                
                <button
                  className="btn-primary"
                  style={{ background: 'green' }}
                  onClick={() => {
                    handleConnection(incomingConnection); // ✅ FIX
                  }}
                >
                  Accept
                </button>

                <button
                  className="btn-primary"
                  style={{ background: 'red' }}
                  onClick={() => {
                    incomingConnection.close();
                    setIncomingConnection(null);
                  }}
                >
                  Decline
                </button>

              </div>
            </div>
          </div>
        )}

        {!isConnected ? (
          <ConnectionScreen
            myId={myId}
            onConnect={connectToPeer}
            isConnecting={isConnecting}
          />
        ) : (
          <ChatScreen
            messages={messages}
            connections={connections}
            onSendMessage={sendMessage}
            onSendFile={sendFile}
            onDisconnectPeer={disconnectPeer}
            onConnectNewPeer={connectToPeer}
            isConnecting={isConnecting}
          />
        )}

      </main>
    </div>
  );
}

export default App;