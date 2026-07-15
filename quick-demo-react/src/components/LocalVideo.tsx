import cameraSvg from '@/assets/camera.svg';
import cameraMuteSvg from '@/assets/camera-mute.svg';
import micSvg from '@/assets/mic.svg';
import micMuteSvg from '@/assets/mic-mute.svg';
import './LocalVideo.css';

interface LocalVideoProps {
  name?: string;
  audioMuted: boolean;
  videoMuted: boolean;
  showControls: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
}

export default function LocalVideo({ name, audioMuted, videoMuted, showControls, onToggleAudio, onToggleVideo }: LocalVideoProps) {
  return (
    <div className="local-video-container">
      <div className="local-video" id="local" />
      {name && <div className="local-video-label">{name}</div>}
      {showControls && (
        <div className="local-controls">
          <button className="mute-btn" onClick={onToggleVideo} title={videoMuted ? 'Unmute Video' : 'Mute Video'}>
            <img src={videoMuted ? cameraMuteSvg : cameraSvg} alt="camera" width="20" height="20" />
          </button>
          <button className="mute-btn" onClick={onToggleAudio} title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}>
            <img src={audioMuted ? micMuteSvg : micSvg} alt="mic" width="20" height="20" />
          </button>
        </div>
      )}
    </div>
  );
}
