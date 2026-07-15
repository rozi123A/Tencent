import { useEffect } from 'react';
import TRTC from 'trtc-sdk-v5';
import { useTRTC } from '@/hooks/useTRTC';
import QuickMatch from '@/components/QuickMatch';
import DeviceSelect from '@/components/DeviceSelect';
import InviteLink from '@/components/InviteLink';
import LocalVideo from '@/components/LocalVideo';
import RemoteVideos from '@/components/RemoteVideos';
import CallControls from '@/components/CallControls';
import ChatPanel from '@/components/ChatPanel';
import ParticipantsList from '@/components/ParticipantsList';
import CallTimer from '@/components/CallTimer';
import NetworkQuality from '@/components/NetworkQuality';
import { useAppStore } from '@/store';
import './HomePage.css';

export default function HomePage() {
  const { strRoomId, userId, displayName, theme, setTheme, roomLocked, isRandomMatch } = useAppStore();

  const {
    roomStatus,
    camStatus,
    micStatus,
    shareStatus,
    audioMuted,
    videoMuted,
    shareLink,
    enterRoom,
    exitRoom,
    startLocalAudio,
    stopLocalAudio,
    startLocalVideo,
    stopLocalVideo,
    startScreenShare,
    stopScreenShare,
    toggleAudioMute,
    toggleVideoMute,
    updateLocalAudioDevice,
    updateLocalVideoDevice,
    initDevice,
    refreshLink,
    sendChatMessage,
    sendTypingStatus,
    toggleRoomLock,
  } = useTRTC();

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.title = 'Video Call';
    TRTC.isSupported().then((r) => {
      if (!r.result) alert('المتصفح لا يدعم TRTC. استخدم أحدث إصدار من Chrome.');
    });
  }, []);

  const copyRoomCode = () => {
    try { navigator.clipboard.writeText(strRoomId); } catch {}
  };

  // ── LOBBY ─────────────────────────────────────────────────
  if (roomStatus === 'idle') {
    return (
      <div className="home-page lobby-page">
        <div className="lobby-glow lobby-glow-1" />
        <div className="lobby-glow lobby-glow-2" />
        <QuickMatch onJoin={() => enterRoom()} />
      </div>
    );
  }

  const isEntered = roomStatus === 'entered';

  // ── CALL SCREEN ───────────────────────────────────────────
  return (
    <div className="home-page">
      <div className="home-content">

        {/* Top bar */}
        <div className="room-badge">
          <span className="room-badge-dot" />
          <span>
            {!isRandomMatch && (
              <>
                غرفة: <strong>{strRoomId}</strong>
                &nbsp;|&nbsp;
              </>
            )}
            أنت: <strong>{displayName || userId}</strong>
          </span>

          {isEntered && <CallTimer running={isEntered} />}
          {isEntered && <NetworkQuality />}

          {!isRandomMatch && (
            <>
              <button className="badge-icon-btn" onClick={copyRoomCode} title="نسخ رقم الغرفة">📋</button>
              <button
                className={`badge-icon-btn ${roomLocked ? 'lock-active' : ''}`}
                onClick={toggleRoomLock}
                title={roomLocked ? 'فتح الغرفة' : 'قفل الغرفة'}
              >{roomLocked ? '🔒' : '🔓'}</button>
            </>
          )}
          <button
            className="badge-icon-btn theme-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="تغيير المظهر"
          >{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button className="room-exit-btn" onClick={exitRoom} disabled={roomStatus === 'exiting'}>
            {roomStatus === 'exiting' ? '⏳' : '🚪 خروج'}
          </button>
        </div>

        <DeviceSelect
          onCameraChange={updateLocalVideoDevice}
          onMicrophoneChange={updateLocalAudioDevice}
          initDevice={initDevice}
        />

        <CallControls
          roomStatus={roomStatus}
          camStatus={camStatus}
          micStatus={micStatus}
          shareStatus={shareStatus}
          onStartLocalAudio={startLocalAudio}
          onStopLocalAudio={stopLocalAudio}
          onStartLocalVideo={() => startLocalVideo('local')}
          onStopLocalVideo={stopLocalVideo}
          onStartScreenShare={startScreenShare}
          onStopScreenShare={stopScreenShare}
        />

        <InviteLink
          visible={isEntered && !isRandomMatch}
          link={shareLink}
          onCopied={refreshLink}
        />

        {/* Side panels: chat + participants */}
        {isEntered && (
          <div className="side-panels">
            <ChatPanel 
              onSend={sendChatMessage} 
              onTyping={(typing) => sendTypingStatus(typing)} 
            />
            <ParticipantsList />
          </div>
        )}

        {/* Call stage: partner's video on top, mine below -- both the same
            medium size so neither feels like the "main" or "small" one. */}
        <div className="call-stage">
          <RemoteVideos />
          <LocalVideo
            name={displayName || userId}
            audioMuted={audioMuted}
            videoMuted={videoMuted}
            showControls={camStatus === 'started'}
            onToggleAudio={toggleAudioMute}
            onToggleVideo={toggleVideoMute}
          />
        </div>
      </div>
    </div>
  );
}
