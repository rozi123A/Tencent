import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store';
import { matchApi } from '@/utils/matchApi';
import { generateRandomUserId, generateRandomRoomId } from '@/utils/utils';
import './QuickMatch.css';

const NAME_KEY = 'vc_saved_name';
const POLL_MS = 2000;
// Random matching only works if another real person happens to be
// searching at the same moment -- with few concurrent users that can take
// a while. Rather than let the spinner run forever (which reads as "broken"
// and scares people off), we surface reassurance/escape hatches over time.
const REASSURE_AFTER_MS = 10000;
const OFFER_INVITE_AFTER_MS = 25000;

interface QuickMatchProps {
  onJoin: () => Promise<void>;
}

/**
 * "Talk to someone right now" flow: no room number, no PIN. The user is
 * paired with whoever else is searching at the same time, then both are
 * dropped straight into a freshly generated room together.
 */
export default function QuickMatch({ onJoin }: QuickMatchProps) {
  const { setUserId, setDisplayName, setStrRoomId, setIsRandomMatch } = useAppStore();
  const [name, setName] = useState<string>(() => {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  });
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myUserIdRef = useRef<string>('');

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
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
    const trimName = name.trim();
    if (!trimName) {
      setError('يرجى إدخال اسم مستعار أولاً');
      return;
    }
    try { localStorage.setItem(NAME_KEY, trimName); } catch {}

    const myUserId = generateRandomUserId();
    myUserIdRef.current = myUserId;
    // userId must stay ASCII-safe (it's validated by a strict regex on the
    // signing server); the user's actual nickname -- which may be Arabic,
    // contain spaces, etc. -- is tracked separately as displayName.
    setUserId(myUserId);
    setDisplayName(trimName);
    setIsRandomMatch(true);
    setError('');
    setSearching(true);
    setElapsedMs(0);
    const startedAt = Date.now();
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);

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

  // Escape hatch for when no one else is searching: stop waiting on a
  // stranger and go straight into a private room the user can invite a
  // specific friend to (via the invite link shown once inside the call).
  const handleCreateOwnRoom = async () => {
    stopPolling();
    if (myUserIdRef.current) {
      try { await matchApi.cancel(myUserIdRef.current); } catch {}
    }
    setStrRoomId(generateRandomRoomId());
    setIsRandomMatch(false);
    setSearching(false);
    try {
      await onJoin();
    } catch (e: any) {
      setError('فشل الاتصال: ' + (e?.message || 'خطأ غير معروف'));
    }
  };

  return (
    <div className="quick-match-card">
      <div className="quick-match-icon">🎲</div>
      <h2 className="quick-match-title">تحدث مع شخص عشوائي الآن</h2>
      <p className="quick-match-subtitle">بدون رقم غرفة وبدون رمز حماية — أدخل اسمًا مستعارًا وسنصلك بأول شخص متاح</p>

      {!searching && (
        <input
          className="quick-match-input"
          type="text"
          placeholder="الاسم المستعار..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          autoFocus
        />
      )}

      {error && <p className="quick-match-error">{error}</p>}

      {searching ? (
        <>
          <div className="quick-match-searching">
            <span className="quick-match-spinner" />
            جارٍ البحث عن شخص متاح...
          </div>

          {elapsedMs >= REASSURE_AFTER_MS && (
            <p className="quick-match-hint">
              لا يوجد خلل — البحث مستمر، لكن قد لا يوجد أحد آخر يبحث في نفس اللحظة.
            </p>
          )}

          {elapsedMs >= OFFER_INVITE_AFTER_MS && (
            <button className="quick-match-btn quick-match-btn-search" onClick={handleCreateOwnRoom}>
              ↗ أنشئ غرفة الآن وادعُ صديقًا برابط مباشر
            </button>
          )}

          <button className="quick-match-btn quick-match-btn-cancel" onClick={handleCancel}>
            إلغاء البحث
          </button>
        </>
      ) : (
        <button
          className="quick-match-btn quick-match-btn-search"
          onClick={handleSearch}
          disabled={!name.trim()}
        >
          🔎 بحث عن شخص للتحدث
        </button>
      )}
    </div>
  );
}
