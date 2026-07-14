import { create } from 'zustand';
    import { LogItem, RemoteUser, DeviceItem } from '@/types';

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

    // invite page remote users
    inviteRemoteUsers: RemoteUser[];

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
    }

    const DEFAULT_SDK_APP_ID = '20044885';
    const DEFAULT_SDK_SECRET_KEY = '47ddea4077bcd9b3e2c5b84cdb38fef1ae9f107281a90f26ca65e8a969885fff';

    export const useAppStore = create<AppState>((set) => ({
    sdkAppId: localStorage.getItem('trtc_sdkAppId') || DEFAULT_SDK_APP_ID,
    sdkSecretKey: localStorage.getItem('trtc_sdkSecretKey') || DEFAULT_SDK_SECRET_KEY,
    userId: '',
    strRoomId: '',

    cameras: [],
    microphones: [],
    selectedCameraId: '',
    selectedMicrophoneId: '',

    logs: [],
    remoteUsers: [],
    inviteRemoteUsers: [],

    setSdkAppId: (val) => {
      try { localStorage.setItem('trtc_sdkAppId', val); } catch (e) {}
      set({ sdkAppId: val });
    },
    setSdkSecretKey: (val) => {
      try { localStorage.setItem('trtc_sdkSecretKey', val); } catch (e) {}
      set({ sdkSecretKey: val });
    },
    setUserId: (val) => set({ userId: val }),
    setStrRoomId: (val) => set({ strRoomId: val }),

    setCameras: (devices) => set({ cameras: devices }),
    setMicrophones: (devices) => set({ microphones: devices }),
    setSelectedCameraId: (id) => set({ selectedCameraId: id }),
    setSelectedMicrophoneId: (id) => set({ selectedMicrophoneId: id }),

    addSuccessLog: (content) =>
      set((state) => ({
        logs: [...state.logs, { type: 'success', content }],
      })),
    addFailedLog: (content) =>
      set((state) => ({
        logs: [...state.logs, { type: 'failed', content }],
      })),

    addRemoteUser: (user) =>
      set((state) => ({
        remoteUsers: [...state.remoteUsers, user],
      })),
    removeRemoteUser: (elementId) =>
      set((state) => ({
        remoteUsers: state.remoteUsers.filter((u) => u.elementId !== elementId),
      })),
    clearRemoteUsers: () => set({ remoteUsers: [] }),

    addInviteRemoteUser: (user) =>
      set((state) => ({
        inviteRemoteUsers: [...state.inviteRemoteUsers, user],
      })),
    removeInviteRemoteUser: (elementId) =>
      set((state) => ({
        inviteRemoteUsers: state.inviteRemoteUsers.filter((u) => u.elementId !== elementId),
      })),
    clearInviteRemoteUsers: () => set({ inviteRemoteUsers: [] }),
    }));
    