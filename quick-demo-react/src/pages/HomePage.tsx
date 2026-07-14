import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TRTC from 'trtc-sdk-v5';
import { useTRTC } from '@/hooks/useTRTC';
import Inputs from '@/components/Inputs';
import DeviceSelect from '@/components/DeviceSelect';
import Controls from '@/components/Controls';
import InviteLink from '@/components/InviteLink';
import LogPanel from '@/components/LogPanel';
import LocalVideo from '@/components/LocalVideo';
import RemoteVideos from '@/components/RemoteVideos';
import { useAppStore } from '@/store';
import './HomePage.css';

export default function HomePage() {
  const { i18n } = useTranslation();
  const [lobbyDone, setLobbyDone] = useState(false);
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
  }, []);

  useEffect(() => {
    TRTC.isSupported().then((checkResult) => {
      if (!checkResult.result) {
        const isZh = i18n.language.startsWith('zh');
        alert(isZh
          ? '当前浏览器不支持 TRTC，请使用最新版本的 Chrome 浏览器。'
          : 'Your browser does not support TRTC. Please use the latest version of Chrome.');
      }
    });
  }, []);

  const handleJoinFromLobby = async () => {
    setLobbyDone(true);
    await enterRoom();
  };

  const handleExitRoom = async () => {
    await exitRoom();
    setLobbyDone(false);
  };

  // ── Lobby Screen ──────────────────────────────────────────
  if (!lobbyDone) {
    return (
      <div className="home-page">
        <Inputs onJoin={handleJoinFromLobby} />
      </div>
    );
  }

  // ── Call Screen ───────────────────────────────────────────
  return (
    <div className="home-page">
      <div className="home-content">

        {/* Room badge */}
        <div className="room-badge">
          <span className="room-badge-dot" />
          غرفة: <strong>{strRoomId}</strong>
          &nbsp;|&nbsp;
          أنت: <strong>{userId}</strong>
        </div>

        <DeviceSelect
          onCameraChange={updateLocalVideoDevice}
          onMicrophoneChange={updateLocalAudioDevice}
          initDevice={initDevice}
        />

        <Controls
          roomStatus={roomStatus}
          camStatus={camStatus}
          micStatus={micStatus}
          shareStatus={shareStatus}
          onEnterRoom={enterRoom}
          onExitRoom={handleExitRoom}
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
