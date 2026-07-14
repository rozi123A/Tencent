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
  sdkSecretKey: string;
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
  theme: 'dark' | 'light';
  networkQuality: { uplink: number; downlink: number };
  roomLocked: boolean;
  // Setters
  setSdkAppId: (val: string) => void;
  setSdkSecretKey: (val: string) => void;
  setUserId: (val: string) => void;
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
}

const savedTheme = (() => {
  try { return (localStorage.getItem('vc_theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
})();

export const useAppStore = create<AppState>((set) => ({
  sdkAppId: '',
  sdkSecretKey: '',
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
  theme: savedTheme,
  networkQuality: { uplink: 0, downlink: 0 },
  roomLocked: false,

  setSdkAppId: (val) => { try { localStorage.setItem('trtc_sdkAppId', val); } catch {} set({ sdkAppId: val }); },
  setSdkSecretKey: (val) => { try { localStorage.setItem('trtc_sdkSecretKey', val); } catch {} set({ sdkSecretKey: val }); },
  setUserId: (val) => set({ userId: val }),
  setStrRoomId: (val) => set({ strRoomId: val }),
  setCameras: (devices) => set({ cameras: devices }),
  setMicrophones: (devices) => set({ microphones: devices }),
  setSelectedCameraId: (id) => set({ selectedCameraId: id }),
  setSelectedMicrophoneId: (id) => set({ selectedMicrophoneId: id }),
  addSuccessLog: (content) => set((s) => ({ logs: [...s.logs, { type: 'success', content }] })),
  addFailedLog: (content) => set((s) => ({ logs: [...s.logs, { type: 'failed', content }] })),
  addRemoteUser: (user) => set((s) => ({ remoteUsers: [...s.remoteUsers, user] })),
  removeRemoteUser: (elementId) => set((s) => ({ remoteUsers: s.remoteUsers.filter((u) => u.elementId !== elementId) })),
  clearRemoteUsers: () => set({ remoteUsers: [] }),
  addInviteRemoteUser: (user) => set((s) => ({ inviteRemoteUsers: [...s.inviteRemoteUsers, user] })),
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
}));
