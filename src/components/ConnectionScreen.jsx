import React, { useState } from 'react';
import { Copy, Check, Radio, Link } from 'lucide-react';
import clsx from 'clsx';

export const ConnectionScreen = ({ myId, onConnect, isConnecting }) => {
  const [remoteId, setRemoteId] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (remoteId.trim().length === 12) {
      onConnect(remoteId.trim());
    }
  };

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="my-id-section">
          <p className="text-secondary" style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Your 12-Digit Connection Code
          </p>
          <div className="id-display">{myId}</div>
          <button className="copy-btn" onClick={handleCopyId}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied to clipboard' : 'Copy Code'}
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Enter a peer's code to connect
          </p>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. 123456789012"
            value={remoteId}
            onChange={(e) => setRemoteId(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
            maxLength={12}
            required
            disabled={isConnecting}
          />
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={remoteId.length !== 12 || isConnecting}
            style={{ width: '100%' }}
          >
            {isConnecting ? (
              <>
                <Radio className="animate-pulse" size={18} />
                Connecting...
              </>
            ) : (
              <>
                <Link size={18} />
                Connect to Peer
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
