import { useState } from 'react';
import { useAppStore } from '@/store';
import { generateRandomRoomId } from '@/utils/utils';
import './Inputs.css';

const NAME_KEY = 'vc_saved_name';

interface InputsProps {
  onJoin: () => Promise<void>;
}

export default function Inputs({ onJoin }: InputsProps) {
  const { setUserId, setStrRoomId, setSdkAppId, recentRooms, addRecentRoom } = useAppStore();

  // Load saved name from localStorage — empty string forces user to enter name
  const [name, setName] = useState<string>(() => {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  });
  const [room, setRoom] = useState(() => generateRandomRoomId());
  const [pin, setPin] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleNewRoom = () => setRoom(generateRandomRoomId());

  const handleJoin = async () => {
    const trimName = name.trim();
    const trimRoom = room.trim();
    if (!trimName || !trimRoom) return;

    setError('');

    // Security fix: SDKSecretKey must never be shipped to the browser (it was
    // previously read from a VITE_ env var, which Vite inlines into the public
    // client bundle — anyone could extract it from devtools). Only the
    // non-secret SDKAppID is needed on the client; userSig is fetched from the
    // backend signing server (see /server) which is the only place holding the key.
    // Default to your SDKAppID if env var is missing
    const appId = import.meta.env.VITE_SDK_APP_ID || '20044885';

    if (!appId) {
      setError('⚠️ SDKAppID مفقود، يرجى التحقق من الإعدادات');
      return;
    }

    // Save name permanently in browser
    try { localStorage.setItem(NAME_KEY, trimName); } catch {}

    setSdkAppId(appId);
    setUserId(trimName);
    setStrRoomId(trimRoom);
    addRecentRoom(trimRoom);

    setJoining(true);
    try {
      // In a real production app, we would verify the PIN on the server
      // For this demo, we'll pass it and it can be used for room validation logic
      await onJoin(pin);
    } catch (e: any) {
      setError('فشل الاتصال: ' + (e?.message || 'خطأ غير معروف'));
      setJoining(false);
    }
  };

  const savedName = (() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } })();
  const isReturning = !!savedName;

  return (
    <div className="lobby-card">
      <div className="lobby-logo">📹</div>
      <h1 className="lobby-title">Video Call</h1>
      <p className="lobby-subtitle">
        {isReturning
          ? `👋 أهلاً بعودتك، ${savedName}!`
          : 'أدخل اسمك ورقم الغرفة للانضمام'}
      </p>

      <div className="lobby-field">
        <label className="lobby-label">
          👤 اسمك
          {isReturning && (
            <span className="lobby-saved-badge">✅ محفوظ</span>
          )}
        </label>
        <input
          className="lobby-input"
          type="text"
          placeholder="أدخل اسمك..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          disabled={joining}
          autoFocus={!isReturning}
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
            autoFocus={isReturning}
          />
          <button
            className="lobby-btn-new"
            onClick={handleNewRoom}
            title="توليد غرفة جديدة"
            disabled={joining}
          >🔄</button>
        </div>
        {recentRooms.length > 0 && (
          <div className="recent-rooms">
            {recentRooms.map(r => (
              <span key={r} className="recent-room-tag" onClick={() => setRoom(r)}>{r}</span>
            ))}
          </div>
        )}
      </div>

      <div className="lobby-field">
        <label className="lobby-label">🔑 رمز الدخول (PIN - اختياري)</label>
        <input
          className="lobby-input"
          type="password"
          placeholder="اتركه فارغاً إذا لا يوجد رمز..."
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          maxLength={6}
          disabled={joining}
        />
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
