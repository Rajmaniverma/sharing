import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, FileText, Download, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const ChatScreen = ({ messages, onSendMessage, onSendFile }) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage(text);
      setText('');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert('File size must be less than 20MB');
      return;
    }

    onSendFile(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderMessageContent = (msg) => {
    if (msg.type === 'text') {
      return <span>{msg.content}</span>;
    }

    if (msg.type === 'image') {
      return (
        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
          <img src={msg.fileUrl} alt={msg.fileName} className="message-image" style={{ width: '100%', maxWidth: '250px', maxHeight: '200px', objectFit: 'cover' }} />
        </a>
      );
    }

    if (msg.type === 'file') {
      return (
        <a href={msg.fileUrl} download={msg.fileName} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="message-file">
            <div className="file-icon">
              <FileText size={20} />
            </div>
            <div className="file-info">
              <span className="file-name">{msg.fileName}</span>
              <span className="file-size">{(msg.fileSize / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <Download size={18} style={{ marginLeft: 'auto', opacity: 0.7 }} />
          </div>
        </a>
      );
    }

    return null;
  };

  return (
    <div className="chat-screen">
      <div className="messages-list">
        {messages.map((msg, index) => (
          <div key={msg.id || index} className={clsx('message', msg.sender === 'me' ? 'sent' : 'received')}>
            <div className="message-bubble">
              {renderMessageContent(msg)}
            </div>
            <div className="message-meta">
              <span>{new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' }).format(new Date(msg.timestamp))}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-area">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn-icon"
          onClick={() => fileInputRef.current?.click()}
          title="Attach File (<20MB)"
        >
          <Paperclip size={20} />
        </button>
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="send-btn" disabled={!text.trim()}>
          <Send size={20} style={{ marginLeft: '2px' }} />
        </button>
      </form>
    </div>
  );
};
