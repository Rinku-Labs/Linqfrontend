import React, { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const WhatsAppWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  const phoneNumber = '2349023172973'; // Business Support Number

  const handleSend = () => {
    if (!message.trim()) return;
    
    // Construct the message with the username
    const usernameContext = user?.username ? `\n\n— Sent by: ${user.username}` : '';
    const fullMessage = `${message.trim()}${usernameContext}`;
    const encodedMessage = encodeURIComponent(fullMessage);
    
    const waUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    // Open in new tab
    window.open(waUrl, '_blank');
    
    // Optionally close and clear the window
    setIsOpen(false);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '90px', // slightly above the bottom nav
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      fontFamily: 'var(--font-family, Inter, sans-serif)'
    }}>
      {isOpen && (
        <div style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          width: '300px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          marginBottom: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fade-in-up 0.3s ease-out forwards'
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: 'var(--primary, #00A859)',
            color: '#fff',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageCircle size={20} fill="#fff" />
              <span style={{ fontWeight: 600, fontSize: '16px' }}>Chat with Support</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--background)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: '1.4'
            }}>
              Hi {user?.firstName || 'there'}! 👋<br />
              How can we help you today?
            </p>
            <div style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--card)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  background: 'var(--primary, #00A859)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: message.trim() ? 'pointer' : 'not-allowed',
                  opacity: message.trim() ? 1 : 0.5,
                  transition: 'opacity 0.2s ease'
                }}
              >
                <Send size={14} style={{ marginLeft: '-2px' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary, #25D366)', // WhatsApp Green default
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(37, 211, 102, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          transform: isOpen ? 'scale(0.9)' : 'scale(1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = isOpen ? 'scale(0.9)' : 'scale(1)';
        }}
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} fill="#fff" />}
      </button>

      {/* Add keyframes globally using a style block or ensure it's in css. Let's do a simple inline approach without keyframes if possible, or embed a style tag */}
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default WhatsAppWidget;
