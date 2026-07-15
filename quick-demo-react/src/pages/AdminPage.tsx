import { useEffect, useState, useCallback } from 'react';
import { adminApi, AdminRoom, AdminStats } from '@/utils/adminApi';
import './AdminPage.css';

const SESSION_KEY = 'vc_admin_password';

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('ar-DZ');
}

export default function AdminPage() {
  const [password, setPassword] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
  });
  const [authed, setAuthed] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [maxParticipantsInput, setMaxParticipantsInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');

  const loadAll = useCallback(async (pwd: string) => {
    setError('');
    try {
      const [{ rooms: r }, s] = await Promise.all([adminApi.getRooms(pwd), adminApi.getStats(pwd)]);
      setRooms(r);
      setStats(s);
      setMaxParticipantsInput(String(s.maxParticipants));
    } catch (e: any) {
      setError(e.message || 'فشل تحميل البيانات');
      if (e.message?.includes('كلمة')) {
        // password became invalid (e.g. server restarted with a new one)
        try { sessionStorage.removeItem(SESSION_KEY); } catch {}
        setAuthed(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!password) return;
    setLoading(true);
    adminApi
      .login(password)
      .then(() => {
        setAuthed(true);
        return loadAll(password);
      })
      .catch(() => {
        try { sessionStorage.removeItem(SESSION_KEY); } catch {}
        setPassword('');
      })
      .finally(() => setLoading(false));
  }, [password, loadAll]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      await adminApi.login(loginInput);
      try { sessionStorage.setItem(SESSION_KEY, loginInput); } catch {}
      setPassword(loginInput);
      setAuthed(true);
      await loadAll(loginInput);
    } catch (e: any) {
      setLoginError(e.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    setPassword('');
    setAuthed(false);
    setLoginInput('');
  };

  const handleResetPin = async (roomId: string) => {
    try {
      await adminApi.resetPin(password, roomId);
      await loadAll(password);
    } catch (e: any) {
      setError(e.message || 'فشل إلغاء الرمز');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm(`حذف سجل الغرفة "${roomId}"؟`)) return;
    try {
      await adminApi.deleteRoom(password, roomId);
      await loadAll(password);
    } catch (e: any) {
      setError(e.message || 'فشل حذف الغرفة');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError('');
    try {
      await adminApi.updateSettings(password, Number(maxParticipantsInput));
      await loadAll(password);
    } catch (e: any) {
      setError(e.message || 'فشل حفظ الإعدادات');
    } finally {
      setSavingSettings(false);
    }
  };

  if (!authed) {
    return (
      <div className="admin-page admin-login-page">
        <form className="admin-login-card" onSubmit={handleLogin} dir="rtl">
          <h2>لوحة تحكم الأدمن</h2>
          <p className="admin-hint">أدخل كلمة مرور الأدمن للوصول إلى لوحة التحكم.</p>
          <input
            type="password"
            className="admin-input"
            placeholder="كلمة المرور"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            autoFocus
          />
          {loginError && <div className="admin-error">{loginError}</div>}
          <button className="admin-btn admin-btn-primary" type="submit" disabled={loading || !loginInput}>
            {loading ? 'جارٍ التحقق...' : 'دخول'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-page" dir="rtl">
      <div className="admin-header">
        <h2>لوحة تحكم الأدمن</h2>
        <button className="admin-btn admin-btn-ghost" onClick={handleLogout}>تسجيل الخروج</button>
      </div>

      {error && <div className="admin-error admin-banner">{error}</div>}

      {stats && (
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-value">{stats.totalRooms}</div>
            <div className="admin-stat-label">غرفة نشطة/سابقة</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-value">{stats.protectedRooms}</div>
            <div className="admin-stat-label">غرفة محمية برمز</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-value">{stats.totalSignRequests}</div>
            <div className="admin-stat-label">إجمالي محاولات الدخول</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-value">{Math.floor(stats.uptimeSeconds / 3600)}س</div>
            <div className="admin-stat-label">مدة تشغيل السيرفر</div>
          </div>
        </div>
      )}

      <div className="admin-section">
        <h3>الإعدادات</h3>
        <form className="admin-settings-form" onSubmit={handleSaveSettings}>
          <label>
            الحد الأقصى للمشاركين في الغرفة
            <input
              type="number"
              min={2}
              max={100}
              className="admin-input admin-input-inline"
              value={maxParticipantsInput}
              onChange={(e) => setMaxParticipantsInput(e.target.value)}
            />
          </label>
          <button className="admin-btn admin-btn-primary" type="submit" disabled={savingSettings}>
            {savingSettings ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </form>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <h3>الغرف</h3>
          <button className="admin-btn admin-btn-ghost" onClick={() => loadAll(password)}>تحديث ↻</button>
        </div>
        {rooms.length === 0 ? (
          <p className="admin-hint">لا توجد غرف مسجّلة حتى الآن.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>رقم الغرفة</th>
                  <th>محمية؟</th>
                  <th>عدد محاولات الدخول</th>
                  <th>آخر نشاط</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.roomId}>
                    <td className="admin-room-id">{r.roomId}</td>
                    <td>{r.hasPin ? '🔒 نعم' : '—'}</td>
                    <td>{r.joinCount}</td>
                    <td>{formatDate(r.updatedAt)}</td>
                    <td className="admin-row-actions">
                      {r.hasPin && (
                        <button className="admin-btn admin-btn-small" onClick={() => handleResetPin(r.roomId)}>
                          إلغاء الرمز
                        </button>
                      )}
                      <button className="admin-btn admin-btn-small admin-btn-danger" onClick={() => handleDeleteRoom(r.roomId)}>
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
