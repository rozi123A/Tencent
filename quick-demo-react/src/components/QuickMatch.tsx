import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store';
import { matchApi } from '@/utils/matchApi';
import { generateRandomUserId } from '@/utils/utils';
import './QuickMatch.css';

const NAME_KEY = 'vc_saved_name';
const POLL_MS = 2000;

interface QuickMatchProps {
  onJoin: () => Promise<void>;
}

/**
 * "Talk to someone right now" flow: no room number, no PIN. The user is
 * paired with whoever else is searching at the same time, then both are
 * dropped straight into a freshly generated room together.
 */
export default function QuickMatch({ onJoin }: QuickMatchProps) {
  const { setUserId, setStrRoomId } = useAppStore();
  const [name, setName] = useState<string>(() => {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  });
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myUserIdRef = useRef<string>('');

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const handleMatched = async (roomId: string) => {
    stopPolling();
    setStrRoomId(roomId);
    setSearching(false);
    try {
      await onJoin();
    } catch (e: any) {
      setError('فشل الاتصال: ' + (e?.message || 'خطأ غير معروف'));
    }
  };

  const handleSearch = async () => {
    const trimName = name.trim() || `زائر${Math.floor(Math.random() * 10000)}`;
    try { localStorage.setItem(NAME_KEY, trimName); } catch {}

    const myUserId = generateRandomUserId();
    myUserIdRef.current = myUserId;
    setUserId(trimName);
    setError('');
    setSearching(true);

    try {
      const result = await matchApi.join(myUserId);
      if (result.matched && result.roomId) {
        await handleMatched(result.roomId);
        return;
      }
      pollRef.current = setInterval(async () => {
        try {
          const status = await matchApi.status(myUserId);
          if (status.matched && status.roomId) {
            await handleMatched(status.roomId);
          } else if (!status.waiting) {
            // expired/cancelled server-side
            stopPolling();
            setSearching(false);
          }
        } catch {
          // transient network hiccup during polling — keep trying
        }
      }, POLL_MS);
    } catch (e: any) {
      setSearching(false);
      setError('فشل البحث: ' + (e?.message || 'خطأ غير معروف'));
    }
  };

  const handleCancel = async () => {
    stopPolling();
    setSearching(false);
    if (myUserIdRef.current) {
      try { await matchApi.cancel(myUserIdRef.current); } catch {}
    }
  };

  return (
    <div className="quick-match-card">
      <div className="quick-match-icon">🎲</div>
      <h2 className="quick-match-title">تحدث مع شخص عشوائي الآن</h2>
      <p className="quick-match-subtitle">بدون رقم غرفة وبدون رمز حماية — اضغط بحث وسنصلك بأول شخص متاح</p>

      {!searching && (
        <input
          className="quick-match-input"
          type="text"
          placeholder="اسمك (اختياري)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
        />
      )}

      {error && <p className="quick-match-error">{error}</p>}

      {searching ? (
        <>
          <div className="quick-match-searching">
            <span className="quick-match-spinner" />
            جارٍ البحث عن شخص متاح...
          </div>
          <button className="quick-match-btn quick-match-btn-cancel" onClick={handleCancel}>
            إلغاء البحث
          </button>
        </>
      ) : (
        <button className="quick-match-btn quick-match-btn-search" onClick={handleSearch}>
          🔎 بحث عن شخص للتحدث
        </button>
      )}
    </div>
  );
}
