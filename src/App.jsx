import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { getSavedId, getChatHistory, saveChatHistory } from './utils/storage';
import { ConnectionScreen } from './components/ConnectionScreen';
import { ChatScreen } from './components/ChatScreen';
import { ShieldAlert, Users } from 'lucide-react';
import './App.css';
import clsx from "clsx";

function App() {
  const [myId, setMyId] = useState('');
  const [peer, setPeer] = useState(null);
  const [connections, setConnections] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
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

    newPeer.on('connection', (conn) => {
      console.log('Incoming connection from: ', conn.peer);
      // Ensure we don't already have this connection
      if (!connections.find(c => c.peer === conn.peer)) {
          setIncomingConnection(conn);
      }
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      setIsConnecting(false);
      // Only alert if it's a fatal disconnect or unavailable peer
      if (err.type === 'peer-unavailable' || err.type === 'disconnected') {
        alert(`Connection Error: ${err.message}`);
      }
    });

    setPeer(newPeer);
    
    // Load global history
    const history = getChatHistory();
    setMessages(history);

    return () => {
      newPeer.destroy();
    };
  }, []);

  useEffect(() => {
    if (connections.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages, connections]);

  const addConnection = (conn) => {
    setConnections(prev => {
      if (prev.find(c => c.peer === conn.peer)) return prev;
      return [...prev, conn];
    });
    setIncomingConnection(null);
  };

  const disconnectPeer = (peerId) => {
    const conn = connections.find(c => c.peer === peerId);
    if (conn) {
      conn.close();
    }
    setConnections(prev => prev.filter(c => c.peer !== peerId));
  };

  const handleConnection = (conn) => {
    addConnection(conn);

    conn.on('data', (data) => {
      console.log('Received data from', conn.peer);
      
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
          sender: conn.peer,
        };
        setMessages((prev) => [...prev, fileMsg]);
      } else if (data.type === 'text') {
        setMessages((prev) => [...prev, { ...data, sender: conn.peer }]);
      }
    });

    conn.on('close', () => {
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
    });

    conn.on('error', (err) => {
      console.error(`Connection error with ${conn.peer}:`, err);
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
    });
  };

  const connectToPeer = (peerId) => {
    if (!peer || peerId === myId) return;
    if (connections.find(c => c.peer === peerId)) {
        alert("Already connected to this peer!");
        return;
    }
    
    setIsConnecting(true);
    const conn = peer.connect(peerId, { reliable: true });
    
    const timeout = setTimeout(() => {
      if (isConnecting) {
        setIsConnecting(false);
        alert('Connection timed out. The peer might be offline or on sleep mode.');
        conn.close();
      }
    }, 15000); // 15 sec timeout for mobile
    
    conn.on('open', () => {
      let isHandled = false;
      conn.on('data', (data) => {
        if (isHandled) return;
        if (data && data.type === 'signal_accept') {
          isHandled = true;
          clearTimeout(timeout);
          setIsConnecting(false);
          handleConnection(conn);
        } else if (data && data.type === 'signal_decline') {
          isHandled = true;
          clearTimeout(timeout);
          alert('Connection declined by peer.');
          setIsConnecting(false);
          conn.close();
        }
      });
    });
    
    conn.on('error', (err) => {
      clearTimeout(timeout);
      console.error('Connection error:', err);
      setIsConnecting(false);
      alert('Failed to connect to peer.');
    });
  };

  const broadcastData = (dataObj, msgObject) => {
    connections.forEach(conn => {
      conn.send(dataObj);
    });
    setMessages(prev => [...prev, msgObject]);
  };

  const sendMessage = (text) => {
    if (connections.length === 0) return;
    const msgData = {
      id: Date.now().toString(),
      type: 'text',
      content: text,
      timestamp: Date.now(),
    };
    broadcastData(msgData, { ...msgData, sender: 'me' });
  };

  const sendFile = (file) => {
    if (connections.length === 0) return;

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

      broadcastData(msgData, localMsg);
    };
    reader.readAsArrayBuffer(file);
  };

  const isConnected = connections.length > 0;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <ShieldAlert className="brand-icon" size={28} />
          <span>SecureShare</span>
        </div>
        
        <div className={clsx('status-badge', isConnected && 'status-connected')}>
          <div className="status-dot"></div>
          {isConnected ? `${connections.length} Peer(s) Connected` : 'Not Connected'}
        </div>
      </header>

      <main className="main-content">
        {incomingConnection && (
          <div className="modal-overlay">
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
                    const tryAccept = () => {
                      try {
                        incomingConnection.send({ type: 'signal_accept' });
                        handleConnection(incomingConnection);
                      } catch (e) {
                         if (!incomingConnection._retries) incomingConnection._retries = 0;
                         incomingConnection._retries++;
                         if (incomingConnection._retries > 50) {
                           alert("Failed to accept. Mobile connection timed out.");
                           setIncomingConnection(null);
                           return;
                         }
                         setTimeout(tryAccept, 200);
                      }
                    };
                    tryAccept();
                  }}
                >
                  Accept
                </button>
                <button 
                  className="btn-primary" 
                  style={{ background: 'var(--error)', minWidth: '100px' }}
                  onClick={() => {
                    const tryDecline = () => {
                      try { incomingConnection.send({ type: 'signal_decline' }); } catch(e){}
                      incomingConnection.close();
                      setIncomingConnection(null);
                    };
                    tryDecline();
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
