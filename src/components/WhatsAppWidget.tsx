import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';

// WhatsApp SVG icon component
const WhatsAppIcon = ({ size = 24, color = '#fff' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
import { useAuth } from '../context/AuthContext';

const WhatsAppWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [botPhase, setBotPhase] = useState<'idle' | 'typing' | 'message'>('idle');
  const { user } = useAuth();
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const phoneNumber = '2349023172973'; // Business Support Number

  const userName = user?.username || 'there';

  // When the chat window opens, start the bot typing animation
  useEffect(() => {
    if (isOpen) {
      setBotPhase('typing');
      const timer = setTimeout(() => {
        setBotPhase('message');
      }, 1500); // Show typing dots for 1.5 seconds
      return () => clearTimeout(timer);
    } else {
      setBotPhase('idle');
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!message.trim()) return;

    // Construct the message with the username
    const usernameContext = user?.username ? `\n\n— Sent by: ${user.username}` : '';
    const fullMessage = `${message.trim()}${usernameContext}`;
    const encodedMessage = encodeURIComponent(fullMessage);

    const waUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    // Open in new tab
    window.open(waUrl, '_blank');

    // Close and clear the window
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
      bottom: '90px',
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
          width: '320px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          marginBottom: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'wa-fade-in-up 0.3s ease-out forwards'
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: 'var(--primary, #00A859)',
            color: '#fff',
            padding: '14px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Bot Avatar */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <WhatsAppIcon size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px', lineHeight: '1.2' }}>Linq Support</div>
                <div style={{ fontSize: '11px', opacity: 0.85, lineHeight: '1.2' }}>
                  {botPhase === 'typing' ? 'typing...' : 'online'}
                </div>
              </div>
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

          {/* Chat Body */}
          <div
            ref={chatBodyRef}
            style={{
              padding: '16px',
              backgroundColor: 'var(--background)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              minHeight: '120px',
            }}
          >
            {/* Typing Indicator */}
            {botPhase === 'typing' && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '8px',
                animation: 'wa-fade-in 0.2s ease-out forwards'
              }}>
                {/* Mini avatar */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary, #00A859)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <WhatsAppIcon size={14} />
                </div>
                <div style={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span className="wa-typing-dot" style={{ animationDelay: '0ms' }} />
                  <span className="wa-typing-dot" style={{ animationDelay: '200ms' }} />
                  <span className="wa-typing-dot" style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            )}

            {/* Bot Message */}
            {botPhase === 'message' && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '8px',
                animation: 'wa-fade-in 0.3s ease-out forwards'
              }}>
                {/* Mini avatar */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary, #00A859)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <MessageCircle size={14} fill="#fff" color="#fff" />
                </div>
                <div style={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '12px 14px',
                  maxWidth: '220px',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  lineHeight: '1.45'
                }}>
                  Hi there, <strong>{userName}</strong>! 👋<br />
                  How can we help you today?
                </div>
              </div>
            )}

            {/* Input Area — only show after bot message appears */}
            {botPhase === 'message' && (
              <div style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                animation: 'wa-fade-in 0.3s ease-out 0.1s forwards',
                opacity: 0
              }}>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  autoFocus
                  style={{
                    width: '100%',
                    minHeight: '72px',
                    padding: '12px 44px 12px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--card)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
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
            )}
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
          backgroundColor: 'var(--primary, #25D366)',
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
        {isOpen ? <X size={28} /> : <WhatsAppIcon size={28} />}
      </button>

      <style>{`
        @keyframes wa-fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wa-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes wa-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .wa-typing-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: var(--text-secondary, #888);
          animation: wa-bounce 1.4s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default WhatsAppWidget;
