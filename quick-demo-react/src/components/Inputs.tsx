import { useState } from 'react';
import { useAppStore } from '@/store';
import { generateRandomRoomId } from '@/utils/utils';
import './Inputs.css';

const NAME_KEY = 'vc_saved_name';

interface InputsProps {
  onJoin: () => Promise<void>;
}

export default function Inputs({ onJoin }: InputsProps) {
  const { setUserId, setStrRoomId } = useAppStore();

  // Load saved name from localStorage — empty string forces user to enter name
  const [name, setName] = useState<string>(() => {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  });
  const [room, setRoom] = useState(() => generateRandomRoomId());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleNewRoom = () => setRoom(generateRandomRoomId());

  const handleJoin = async () => {
    const trimName = name.trim();
    const trimRoom = room.trim();
    if (!trimName || !trimRoom) return;

    setError('');

    // Security fix: SDKSecretKey must never be shipped to the browser. The
    // SDKAppID is also no longer guessed/hardcoded on the client — it is read
    // from the backend signing server's response inside enterRoom(), which is
    // the only place that can guarantee it matches the userSig it just signed.
    // A mismatched client-side SDKAppID would make TRTC silently reject the
    // join, which looked like "it enters and immediately bounces back".

    // Save name permanently in browser
    try { localStorage.setItem(NAME_KEY, trimName); } catch {}

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

  const savedName = (() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } })();
  const isReturning = !!savedName;

  return (
    <div className="lobby-card">
      <div className="lobby-logo-badge">
        <span className="lobby-logo">📹</span>
      </div>
      <h1 className="lobby-title">مكالمة فيديو</h1>
      <p className="lobby-subtitle">
        {isReturning
          ? `👋 أهلاً بعودتك، ${savedName}!`
          : 'اتصال فيديو سريع وآمن — أدخل اسمك ورقم الغرفة للانضمام'}
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
          ><span className="lobby-btn-new-icon">🔄</span></button>
        </div>
        <p className="lobby-hint">شارك رقم الغرفة مع أصدقائك ليدخلوا معك</p>
      </div>

      {error && <p className="lobby-error">{error}</p>}

      <button
        className="lobby-btn-join"
        onClick={handleJoin}
        disabled={joining || !name.trim() || !room.trim()}
      >
        <span className="lobby-btn-join-content">
          {joining ? (
            <>
              <span className="lobby-btn-spinner" />
              جاري الاتصال...
            </>
          ) : (
            <>
              <span className="lobby-btn-join-icon">🚀</span>
              انضم للغرفة
            </>
          )}
        </span>
      </button>
    </div>
  );
}
