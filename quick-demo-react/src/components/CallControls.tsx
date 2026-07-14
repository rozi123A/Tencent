import type { RoomStatus, MediaStatus } from '@/hooks/useTRTC';
import './Controls.css';

interface CallControlsProps {
  roomStatus: RoomStatus;
  camStatus: MediaStatus;
  micStatus: MediaStatus;
  shareStatus: MediaStatus;
  onStartLocalAudio: () => void;
  onStopLocalAudio: () => void;
  onStartLocalVideo: () => void;
  onStopLocalVideo: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
}

export default function CallControls({
  roomStatus,
  camStatus,
  micStatus,
  shareStatus,
  onStartLocalAudio,
  onStopLocalAudio,
  onStartLocalVideo,
  onStopLocalVideo,
  onStartScreenShare,
  onStopScreenShare,
}: CallControlsProps) {
  const isEntered = roomStatus === 'entered';
  const entering = roomStatus === 'entering';

  if (entering) {
    return (
      <div className="call-controls-entering">
        <span className="loading-spinner" /> جاري الاتصال بالغرفة...
      </div>
    );
  }

  return (
    <div className="controls-container">
      {/* Audio */}
      <div className="controls-row">
        <button
          className="ctrl-btn ctrl-btn-primary"
          onClick={onStartLocalAudio}
          disabled={!isEntered || micStatus !== 'idle'}
        >
          {micStatus === 'starting' && <span className="loading-spinner" />}
          🎙️ تشغيل الميكروفون
        </button>
        <button
          className="ctrl-btn ctrl-btn-outline"
          onClick={onStopLocalAudio}
          disabled={!isEntered || micStatus !== 'started'}
        >
          {micStatus === 'stopping' && <span className="loading-spinner" />}
          🔇 إيقاف الميكروفون
        </button>
      </div>

      {/* Video */}
      <div className="controls-row">
        <button
          className="ctrl-btn ctrl-btn-primary"
          onClick={onStartLocalVideo}
          disabled={!isEntered || camStatus !== 'idle'}
        >
          {camStatus === 'starting' && <span className="loading-spinner" />}
          📷 تشغيل الكاميرا
        </button>
        <button
          className="ctrl-btn ctrl-btn-outline"
          onClick={onStopLocalVideo}
          disabled={!isEntered || camStatus !== 'started'}
        >
          {camStatus === 'stopping' && <span className="loading-spinner" />}
          📵 إيقاف الكاميرا
        </button>
      </div>

      {/* Screen Share */}
      <div className="controls-row">
        <button
          className="ctrl-btn ctrl-btn-primary"
          onClick={onStartScreenShare}
          disabled={!isEntered || shareStatus !== 'idle'}
          title={!isEntered ? 'يجب الدخول للغرفة أولاً' : ''}
        >
          {shareStatus === 'starting' && <span className="loading-spinner" />}
          🖥️ بدء مشاركة الشاشة
        </button>
        <button
          className="ctrl-btn ctrl-btn-outline"
          onClick={onStopScreenShare}
          disabled={!isEntered || shareStatus !== 'started'}
        >
          {shareStatus === 'stopping' && <span className="loading-spinner" />}
          ⏹️ إيقاف مشاركة الشاشة
        </button>
      </div>
    </div>
  );
}
