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
  const [incomingConnection, setIncomingConnection] = useState(null);

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
      // Prompt user to accept the connection
      setIncomingConnection(conn);
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
    setIsConnected(true);
    setIsConnecting(false);
    setConnection(conn);
    setRemoteId(conn.peer);
    setIncomingConnection(null);

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
    
    // For the initiator, we wait for open
    conn.on('open', () => {
      let isHandled = false;
      conn.on('data', (data) => {
        if (isHandled) return;
        if (data && data.type === 'signal_accept') {
          isHandled = true;
          handleConnection(conn);
        } else if (data && data.type === 'signal_decline') {
          isHandled = true;
          alert('Connection declined by peer.');
          setIsConnecting(false);
          conn.close();
        }
      });
    });
    
    conn.on('error', (err) => {
      console.error('Connection error:', err);
      setIsConnecting(false);
      alert('Failed to connect to peer.');
    });
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
        {incomingConnection && !isConnected && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5,5,5,0.85)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)' }}>
            <div className="connect-card" style={{ textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
              <ShieldAlert size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Incoming Connection</h3>
              <p style={{ margin: '1rem 0', color: 'var(--text-secondary)' }}>
                Peer <strong>{incomingConnection.peer}</strong> wants to connect.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                <button 
                  className="btn-primary" 
                  style={{ background: 'var(--success)', minWidth: '100px' }}
                  onClick={() => {
                    const acceptConn = () => {
                      incomingConnection.send({ type: 'signal_accept' });
                      handleConnection(incomingConnection);
                    };
                    if (incomingConnection.open) acceptConn(); else incomingConnection.on('open', acceptConn);
                  }}
                >
                  Accept
                </button>
                <button 
                  className="btn-primary" 
                  style={{ background: 'var(--error)', minWidth: '100px' }}
                  onClick={() => {
                    const declineConn = () => {
                      incomingConnection.send({ type: 'signal_decline' });
                      incomingConnection.close();
                      setIncomingConnection(null);
                    };
                    if (incomingConnection.open) declineConn(); else incomingConnection.on('open', declineConn);
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
            onSendMessage={sendMessage}
            onSendFile={sendFile}
          />
        )}
      </main>
    </div>
  );
}

export default App;
