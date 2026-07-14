import { useState } from 'react';
import { useAppStore } from '@/store';
import { generateRandomUserId, generateRandomRoomId } from '@/utils/utils';
import './Inputs.css';

interface InputsProps {
  onJoin: () => Promise<void>;
}

export default function Inputs({ onJoin }: InputsProps) {
  const { setUserId, setStrRoomId, setSdkAppId, setSdkSecretKey } = useAppStore();

  const [name, setName] = useState(() => generateRandomUserId());
  const [room, setRoom] = useState(() => generateRandomRoomId());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleNewRoom = () => setRoom(generateRandomRoomId());

  const handleJoin = async () => {
    const trimName = name.trim();
    const trimRoom = room.trim();
    if (!trimName || !trimRoom) return;

    setError('');

    // Set ALL values in store synchronously before calling enterRoom
    const appId = import.meta.env.VITE_SDK_APP_ID || '';
    const secretKey = import.meta.env.VITE_SDK_SECRET_KEY || '';

    if (!appId || !secretKey) {
      setError('⚠️ VITE_SDK_APP_ID أو VITE_SDK_SECRET_KEY غير مضبوطة في Render Environment Variables');
      return;
    }

    setSdkAppId(appId);
    setSdkSecretKey(secretKey);
    setUserId(trimName);
    setStrRoomId(trimRoom);

    setJoining(true);
    try {
      await onJoin();
    } catch (e: any) {
      setError('فشل الاتصال: ' + (e?.message || 'خطأ غير معروف'));
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
          value={name}
          onChange={(e) => setName(e.target.value)}
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
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            maxLength={20}
            disabled={joining}
          />
          <button
            className="lobby-btn-new"
            onClick={handleNewRoom}
            title="توليد غرفة جديدة"
            disabled={joining}
          >🔄</button>
        </div>
        <p className="lobby-hint">شارك رقم الغرفة مع أصدقائك ليدخلوا معك</p>
      </div>

      {error && <p className="lobby-error">{error}</p>}

      <button
        className="lobby-btn-join"
        onClick={handleJoin}
        disabled={joining || !name.trim() || !room.trim()}
      >
        {joining ? '⏳ جاري الاتصال...' : '🚀 انضم للغرفة'}
      </button>
    </div>
  );
}
