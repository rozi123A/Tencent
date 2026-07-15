import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import './ChatPanel.css';

interface ChatPanelProps {
  onSend: (text: string) => void;
}

export default function ChatPanel({ onSend, onTyping }: ChatPanelProps & { onTyping?: (typing: boolean) => void }) {
  const chatMessages = useAppStore((s) => s.chatMessages);
  const typingUsers = useAppStore((s) => s.typingUsers);
  const displayNames = useAppStore((s) => s.displayNames);
  const [input, setInput] = useState('');
  const typingTimeoutRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      onTyping?.(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    if (onTyping) {
      if (!input && val) {
        onTyping(true);
      } else if (input && !val) {
        onTyping(false);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 3000);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat-panel">
      <h3 className="chat-title">💬 الدردشة</h3>
      <div className="chat-messages">
        {chatMessages.length === 0 && (
          <p className="chat-empty">لا توجد رسائل بعد...</p>
        )}
        {chatMessages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.self ? 'self' : 'other'}`}>
            {!msg.self && <span className="chat-author">{displayNames[msg.userId] || msg.userId}</span>}
            <span className="chat-text">{msg.text}</span>
            <span className="chat-time">{formatTime(msg.ts)}</span>
          </div>
        ))}
        {typingUsers.length > 0 && (
          <div className="chat-typing-indicator">
            {typingUsers.map((u) => displayNames[u] || u).join(', ')} {typingUsers.length > 1 ? 'يكتبون الآن...' : 'يكتب الآن...'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder="اكتب رسالة..."
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKey}
          maxLength={300}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}
