import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { getSavedId, getChatHistory, saveChatHistory } from './utils/storage';
import { ConnectionScreen } from './components/ConnectionScreen';
import { ChatScreen } from './components/ChatScreen';
import { ShieldAlert, Wifi } from 'lucide-react';
import './App.css';
import clsx from "clsx";

function App() {
  const [myId, setMyId] = useState('');
  const [peer, setPeer] = useState(null);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [remoteId, setRemoteId] = useState('');

  // Setup PeerJS on mount
  useEffect(() => {
    const id = getSavedId();
    setMyId(id);

    const newPeer = new Peer(id, {
      debug: 2,
    });

    newPeer.on('open', (id) => {
      console.log('My peer ID is: ' + id);
    });

    // Listen for incoming connections
    newPeer.on('connection', (conn) => {
      console.log('Incoming connection from: ', conn.peer);
      handleConnection(conn);
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      setIsConnecting(false);
      alert(`Connection Error: ${err.message}`);
    });

    setPeer(newPeer);

    return () => {
      newPeer.destroy();
    };
  }, []);

  // Load chat history when connection is established
  useEffect(() => {
    if (isConnected && remoteId) {
      // In a real app, you might want to scope history by remoteId.
      // For simplicity, we just use a global history or clear it per session.
      // Let's scope it:
      const history = getChatHistory();
      setMessages(history);
    }
  }, [isConnected, remoteId]);

  // Save chat history whenever messages change (only if connected)
  useEffect(() => {
    if (isConnected) {
      saveChatHistory(messages);
    }
  }, [messages, isConnected]);

  const handleConnection = (conn) => {
    conn.on('open', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setConnection(conn);
      setRemoteId(conn.peer);
    });

    conn.on('data', (data) => {
      console.log('Received data', data);

      // Handle received files/images (sent as objects with type, fileName, fileData)
      if (data.type === 'file' || data.type === 'image') {
        const blob = new Blob([data.fileData]);
        const url = URL.createObjectURL(blob);

        const fileMsg = {
          id: data.id || Date.now().toString(),
          type: data.type,
          fileName: data.fileName,
          fileSize: data.fileSize,
          fileUrl: url,
          timestamp: data.timestamp,
          sender: 'peer',
        };
        setMessages((prev) => [...prev, fileMsg]);
      } else if (data.type === 'text') {
        setMessages((prev) => [...prev, { ...data, sender: 'peer' }]);
      }
    });

    conn.on('close', () => {
      setIsConnected(false);
      setConnection(null);
      alert('Connection closed by peer');
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      setIsConnected(false);
      setConnection(null);
    });
  };

  const connectToPeer = (peerId) => {
    if (!peer || peerId === myId) return;
    setIsConnecting(true);
    const conn = peer.connect(peerId, { reliable: true });
    handleConnection(conn);
  };

  const sendMessage = (text) => {
    if (!connection) return;

    const msg = {
      id: Date.now().toString(),
      type: 'text',
      content: text,
      timestamp: Date.now(),
    };

    connection.send(msg);
    setMessages((prev) => [...prev, { ...msg, sender: 'me' }]);
  };

  const sendFile = (file) => {
    if (!connection) return;

    const isImage = file.type.startsWith('image/');
    const type = isImage ? 'image' : 'file';

    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;

      const msgData = {
        id: Date.now().toString(),
        type,
        fileName: file.name,
        fileSize: file.size,
        fileData: arrayBuffer,
        timestamp: Date.now(),
      };

      // Send to peer
      connection.send(msgData);

      // Create local URL for preview
      const blobURL = URL.createObjectURL(file);
      const localMsg = {
        id: msgData.id,
        type,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: blobURL,
        timestamp: msgData.timestamp,
        sender: 'me',
      };

      setMessages((prev) => [...prev, localMsg]);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <ShieldAlert className="brand-icon" size={28} />
          <span>SecureShare</span>
        </div>

        <div className={clsx('status-badge', isConnected && 'status-connected')}>
          <div className="status-dot"></div>
          {isConnected ? `Connected to ${remoteId}` : 'Not Connected'}
        </div>
      </header>

      <main className="main-content">
        {!isConnected ? (
          <ConnectionScreen
            myId={myId}
            onConnect={connectToPeer}
            isConnecting={isConnecting}
          />
        ) : (
          <ChatScreen
            messages={messages}
            onSendMessage={sendMessage}
            onSendFile={sendFile}
          />
        )}
      </main>
    </div>
  );
}

export default App;
