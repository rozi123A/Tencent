import { create } from 'zustand';
import { LogItem, RemoteUser, DeviceItem } from '@/types';

export interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  ts: number;
  self: boolean;
}

interface AppState {
  sdkAppId: string;
  userId: string;
  strRoomId: string;
  cameras: DeviceItem[];
  microphones: DeviceItem[];
  selectedCameraId: string;
  selectedMicrophoneId: string;
  logs: LogItem[];
  remoteUsers: RemoteUser[];
  inviteRemoteUsers: RemoteUser[];
  // New features
  chatMessages: ChatMessage[];
  participants: string[];
  // Human-entered nickname (can contain Arabic/spaces/etc). This is kept
  // separate from `userId`, which must stay ASCII-safe because it is sent
  // to the TRTC signaling server and validated by a strict regex there.
  displayName: string;
  // userId -> displayName, populated for ourselves on join and for peers
  // as their PRESENCE custom messages arrive. UI should read through this
  // (falling back to the raw userId) instead of showing userId directly.
  displayNames: Record<string, string>;
  theme: 'dark' | 'light';
  networkQuality: { uplink: number; downlink: number };
  roomLocked: boolean;
  toasts: { id: string; message: string; type: 'info' | 'error' }[];
  recentRooms: string[];
  typingUsers: string[];
  // Setters
  setSdkAppId: (val: string) => void;
  setUserId: (val: string) => void;
  setDisplayName: (val: string) => void;
  setDisplayNameFor: (userId: string, name: string) => void;
  clearDisplayNames: () => void;
  setStrRoomId: (val: string) => void;
  setCameras: (devices: DeviceItem[]) => void;
  setMicrophones: (devices: DeviceItem[]) => void;
  setSelectedCameraId: (id: string) => void;
  setSelectedMicrophoneId: (id: string) => void;
  addSuccessLog: (content: string) => void;
  addFailedLog: (content: string) => void;
  addRemoteUser: (user: RemoteUser) => void;
  removeRemoteUser: (elementId: string) => void;
  clearRemoteUsers: () => void;
  addInviteRemoteUser: (user: RemoteUser) => void;
  removeInviteRemoteUser: (elementId: string) => void;
  clearInviteRemoteUsers: () => void;
  // New setters
  addChatMessage: (msg: ChatMessage) => void;
  clearChatMessages: () => void;
  addParticipant: (userId: string) => void;
  removeParticipant: (userId: string) => void;
  clearParticipants: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setNetworkQuality: (q: { uplink: number; downlink: number }) => void;
  setRoomLocked: (locked: boolean) => void;
  addToast: (message: string, type?: 'info' | 'error') => void;
  removeToast: (id: string) => void;
  addRecentRoom: (roomId: string) => void;
  setTyping: (userId: string, typing: boolean) => void;
}

const savedTheme = (() => {
  try { return (localStorage.getItem('vc_theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
})();

export const useAppStore = create<AppState>((set) => ({
  sdkAppId: '',
  userId: '',
  strRoomId: '',
  cameras: [],
  microphones: [],
  selectedCameraId: '',
  selectedMicrophoneId: '',
  logs: [],
  remoteUsers: [],
  inviteRemoteUsers: [],
  chatMessages: [],
  participants: [],
  displayName: '',
  displayNames: {},
  theme: savedTheme,
  networkQuality: { uplink: 0, downlink: 0 },
  roomLocked: false,
  toasts: [],
  recentRooms: (() => { try { return JSON.parse(localStorage.getItem('vc_recent_rooms') || '[]'); } catch { return []; } })(),
  typingUsers: [],

  setSdkAppId: (val) => { try { localStorage.setItem('trtc_sdkAppId', val); } catch {} set({ sdkAppId: val }); },
  setUserId: (val) => set({ userId: val }),
  setDisplayName: (val) => set({ displayName: val }),
  setDisplayNameFor: (userId, name) => set((s) => (
    s.displayNames[userId] === name ? s : { displayNames: { ...s.displayNames, [userId]: name } }
  )),
  clearDisplayNames: () => set({ displayNames: {} }),
  setStrRoomId: (val) => set({ strRoomId: val }),
  setCameras: (devices) => set({ cameras: devices }),
  setMicrophones: (devices) => set({ microphones: devices }),
  setSelectedCameraId: (id) => set({ selectedCameraId: id }),
  setSelectedMicrophoneId: (id) => set({ selectedMicrophoneId: id }),
  addSuccessLog: (content) => set((s) => ({ logs: [...s.logs, { type: 'success', content }] })),
  addFailedLog: (content) => set((s) => ({ logs: [...s.logs, { type: 'failed', content }] })),
  // Dedupe by elementId: TRTC can fire REMOTE_VIDEO_AVAILABLE twice in a row
  // for the same user/streamType (e.g. quick camera toggles, reconnects).
  // Pushing a second entry would render two DOM nodes with the same React
  // key/id, and when one gets cleaned up React and the SDK fight over the
  // same node and throw "removeChild: node is not a child of this node".
  addRemoteUser: (user) => set((s) => (
    s.remoteUsers.some((u) => u.elementId === user.elementId) ? s : { remoteUsers: [...s.remoteUsers, user] }
  )),
  removeRemoteUser: (elementId) => set((s) => ({ remoteUsers: s.remoteUsers.filter((u) => u.elementId !== elementId) })),
  clearRemoteUsers: () => set({ remoteUsers: [] }),
  addInviteRemoteUser: (user) => set((s) => (
    s.inviteRemoteUsers.some((u) => u.elementId === user.elementId) ? s : { inviteRemoteUsers: [...s.inviteRemoteUsers, user] }
  )),
  removeInviteRemoteUser: (elementId) => set((s) => ({ inviteRemoteUsers: s.inviteRemoteUsers.filter((u) => u.elementId !== elementId) })),
  clearInviteRemoteUsers: () => set({ inviteRemoteUsers: [] }),

  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  clearChatMessages: () => set({ chatMessages: [] }),
  addParticipant: (uid) => set((s) => ({ participants: s.participants.includes(uid) ? s.participants : [...s.participants, uid] })),
  removeParticipant: (uid) => set((s) => ({ participants: s.participants.filter((u) => u !== uid) })),
  clearParticipants: () => set({ participants: [] }),
  setTheme: (theme) => { try { localStorage.setItem('vc_theme', theme); } catch {} set({ theme }); },
  setNetworkQuality: (q) => set({ networkQuality: q }),
  setRoomLocked: (locked) => set({ roomLocked: locked }),
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  addRecentRoom: (roomId) => set((s) => {
    const updated = [roomId, ...s.recentRooms.filter(r => r !== roomId)].slice(0, 5);
    try { localStorage.setItem('vc_recent_rooms', JSON.stringify(updated)); } catch {}
    return { recentRooms: updated };
  }),
  setTyping: (userId, typing) => set((s) => ({
    typingUsers: typing 
      ? (s.typingUsers.includes(userId) ? s.typingUsers : [...s.typingUsers, userId])
      : s.typingUsers.filter(u => u !== userId)
  })),
}));
