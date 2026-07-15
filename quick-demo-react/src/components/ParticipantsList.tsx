import { useAppStore } from '@/store';
import './ParticipantsList.css';

export default function ParticipantsList() {
  const participants = useAppStore((s) => s.participants);
  const roomLocked = useAppStore((s) => s.roomLocked);
  const displayNames = useAppStore((s) => s.displayNames);

  return (
    <div className="participants-panel">
      <h3 className="participants-title">
        👥 المشاركون ({participants.length})
        {roomLocked && <span className="lock-badge">🔒 مقفلة</span>}
      </h3>
      <ul className="participants-list">
        {participants.map((uid) => {
          const name = displayNames[uid] || uid;
          return (
            <li key={uid} className="participant-item">
              <span className="participant-avatar">{name.charAt(0).toUpperCase()}</span>
              <span className="participant-name">{name}</span>
              <span className="participant-dot" />
            </li>
          );
        })}
        {participants.length === 0 && (
          <li className="participant-empty">لا أحد في الغرفة بعد</li>
        )}
      </ul>
    </div>
  );
}
