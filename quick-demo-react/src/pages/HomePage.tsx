import { useEffect } from 'react';
import TRTC from 'trtc-sdk-v5';
import { useTRTC } from '@/hooks/useTRTC';
import Inputs from '@/components/Inputs';
import DeviceSelect from '@/components/DeviceSelect';
import InviteLink from '@/components/InviteLink';
import LogPanel from '@/components/LogPanel';
import LocalVideo from '@/components/LocalVideo';
import RemoteVideos from '@/components/RemoteVideos';
import CallControls from '@/components/CallControls';
import { useAppStore } from '@/store';
import './HomePage.css';

export default function HomePage() {
  const { strRoomId, userId } = useAppStore();

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
  } = useTRTC();

  useEffect(() => {
    document.title = 'Video Call';
    TRTC.isSupported().then((r) => {
      if (!r.result) alert('المتصفح لا يدعم TRTC. استخدم أحدث إصدار من Chrome.');
    });
  }, []);

  // ── LOBBY ─────────────────────────────────────────────────
  if (roomStatus === 'idle') {
    return (
      <div className="home-page">
        <Inputs onJoin={enterRoom} />
      </div>
    );
  }

  // ── CALL SCREEN ───────────────────────────────────────────
  return (
    <div className="home-page">
      <div className="home-content">

        <div className="room-badge">
          <span className="room-badge-dot" />
          غرفة: <strong>{strRoomId}</strong>
          &nbsp;|&nbsp;
          أنت: <strong>{userId}</strong>
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
          visible={roomStatus === 'entered'}
          link={shareLink}
          onCopied={refreshLink}
        />

        <div className="home-media-section">
          <LogPanel />
          <LocalVideo
            audioMuted={audioMuted}
            videoMuted={videoMuted}
            showControls={camStatus === 'started'}
            onToggleAudio={toggleAudioMute}
            onToggleVideo={toggleVideoMute}
          />
        </div>

        <RemoteVideos />
      </div>
    </div>
  );
}
