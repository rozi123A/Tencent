import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { generateRandomUserId, generateRandomRoomId } from '@/utils/utils';
import './Inputs.css';

interface InputsProps {
  onJoin: () => void;
}

export default function Inputs({ onJoin }: InputsProps) {
  const { setUserId, setStrRoomId, setSdkAppId, setSdkSecretKey } = useAppStore();
  const [localName, setLocalName] = useState('');
  const [localRoom, setLocalRoom] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // Set hidden credentials from env vars
    setSdkAppId(import.meta.env.VITE_SDK_APP_ID || '');
    setSdkSecretKey(import.meta.env.VITE_SDK_SECRET_KEY || '');

    // Generate random defaults
    const name = generateRandomUserId();
    const room = generateRandomRoomId();
    setLocalName(name);
    setLocalRoom(room);
    setUserId(name);
    setStrRoomId(room);
  }, []);

  const handleNewRoom = () => {
    const room = generateRandomRoomId();
    setLocalRoom(room);
    setStrRoomId(room);
  };

  const handleJoin = async () => {
    if (!localName.trim() || !localRoom.trim()) return;
    // Sync latest values to store
    setUserId(localName.trim());
    setStrRoomId(localRoom.trim());
    setJoining(true);
    try {
      await onJoin();
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="lobby-card">
      <div className="lobby-logo">📹</div>
      <h1 className="lobby-title">Video Call</h1>
      <p className="lobby-subtitle">أدخل اسمك ورقم الغرفة للانضمام</p>

      <div className="lobby-field">
        <label className="lobby-label">👤 اسمك</label>
        <input
          className="lobby-input"
          type="text"
          placeholder="أدخل اسمك..."
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            setUserId(e.target.value);
          }}
          maxLength={30}
          disabled={joining}
        />
      </div>

      <div className="lobby-field">
        <label className="lobby-label">🚪 رقم الغرفة</label>
        <div className="lobby-room-row">
          <input
            className="lobby-input"
            type="text"
            placeholder="أدخل رقم الغرفة..."
            value={localRoom}
            onChange={(e) => {
              setLocalRoom(e.target.value);
              setStrRoomId(e.target.value);
            }}
            maxLength={20}
            disabled={joining}
          />
          <button
            className="lobby-btn-new"
            onClick={handleNewRoom}
            title="غرفة جديدة"
            disabled={joining}
          >🔄</button>
        </div>
        <p className="lobby-hint">شارك رقم الغرفة مع أصدقائك ليدخلوا معك</p>
      </div>

      <button
        className="lobby-btn-join"
        onClick={handleJoin}
        disabled={joining || !localName.trim() || !localRoom.trim()}
      >
        {joining ? '⏳ جاري الاتصال...' : '🚀 انضم للغرفة'}
      </button>
    </div>
  );
}
