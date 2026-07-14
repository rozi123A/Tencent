import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import './ChatPanel.css';

interface ChatPanelProps {
  onSend: (text: string) => void;
}

export default function ChatPanel({ onSend }: ChatPanelProps) {
  const chatMessages = useAppStore((s) => s.chatMessages);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
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
            {!msg.self && <span className="chat-author">{msg.userId}</span>}
            <span className="chat-text">{msg.text}</span>
            <span className="chat-time">{formatTime(msg.ts)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder="اكتب رسالة..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
