import { useRef, useState, useCallback, useEffect } from 'react';
import TRTC from 'trtc-sdk-v5';
import { useAppStore, ChatMessage } from '@/store';
import { genTestUserSig } from '@/utils/generateTestUserSig';
import { reportSuccessEvent, reportFailedEvent } from '@/utils/aegis';

export type RoomStatus = 'idle' | 'entering' | 'entered' | 'exiting';
export type MediaStatus = 'idle' | 'starting' | 'started' | 'stopping';

const CHAT_CMD = 1;
const LOCK_CMD = 2;

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 520;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

function encodeMsg(obj: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}
function decodeMsg(data: Uint8Array): any {
  try { return JSON.parse(new TextDecoder().decode(data)); } catch { return null; }
}

export function useTRTC() {
  const trtcRef = useRef<any>(null);

  const [roomStatus, setRoomStatus] = useState<RoomStatus>('idle');
  const [camStatus, setCamStatus] = useState<MediaStatus>('idle');
  const [micStatus, setMicStatus] = useState<MediaStatus>('idle');
  const [shareStatus, setShareStatus] = useState<MediaStatus>('idle');
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [shareLink, setShareLink] = useState('');

  const store = useAppStore();

  useEffect(() => {
    if (!trtcRef.current) {
      trtcRef.current = TRTC.create();
      TRTC.setLogLevel(1);
    }
    return () => {
      if (trtcRef.current) {
        trtcRef.current.destroy();
        trtcRef.current = null;
      }
    };
  }, []);

  const createShareLink = useCallback((sdkAppId: number, sdkSecretKey: string, strRoomId: string) => {
    const inviteUserId = String(Math.floor(Math.random() * 1000000));
    const { userSig } = genTestUserSig({ sdkAppId, userId: inviteUserId, sdkSecretKey });
    const basePath = `${window.location.origin}${window.location.pathname}`;
    return `${basePath}#/invite?userSig=${userSig}&SDKAppId=${sdkAppId}&userId=${inviteUserId}&strRoomId=${strRoomId}`;
  }, []);

  const refreshLink = useCallback(() => {
    const { sdkAppId, sdkSecretKey, strRoomId } = useAppStore.getState();
    if (sdkAppId && sdkSecretKey && strRoomId) {
      setShareLink(createShareLink(Number(sdkAppId), sdkSecretKey, strRoomId));
    }
  }, [createShareLink]);

  const bindEvents = useCallback(() => {
    const trtc = trtcRef.current;
    if (!trtc) return;

    trtc.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, ({ userId, streamType }: any) => {
      const elementId = `${userId}_${streamType}`;
      const s = useAppStore.getState();
      s.addRemoteUser({ userId, streamType, elementId });
      setTimeout(() => { trtc.startRemoteVideo({ userId, streamType, view: elementId }); }, 0);
    });

    trtc.on(TRTC.EVENT.REMOTE_VIDEO_UNAVAILABLE, ({ userId, streamType }: any) => {
      const elementId = `${userId}_${streamType}`;
      const s = useAppStore.getState();
      s.removeRemoteUser(elementId);
      trtc.stopRemoteVideo({ userId, streamType });
    });

    // Track participants enter/leave
    trtc.on(TRTC.EVENT.REMOTE_USER_ENTER, ({ userId }: any) => {
      useAppStore.getState().addParticipant(userId);
      useAppStore.getState().addSuccessLog(`🟢 ${userId} دخل الغرفة`);
      playBeep();
    });

    trtc.on(TRTC.EVENT.REMOTE_USER_LEAVE, ({ userId }: any) => {
      useAppStore.getState().removeParticipant(userId);
      useAppStore.getState().addSuccessLog(`🔴 ${userId} غادر الغرفة`);
    });

    // Network quality
    trtc.on(TRTC.EVENT.NETWORK_QUALITY, ({ uplinkNetworkQuality, downlinkNetworkQuality }: any) => {
      useAppStore.getState().setNetworkQuality({
        uplink: uplinkNetworkQuality,
        downlink: downlinkNetworkQuality,
      });
    });

    // Custom messages (chat + lock)
    trtc.on(TRTC.EVENT.CUSTOM_MESSAGE, ({ cmdId, userId, data }: any) => {
      if (cmdId === CHAT_CMD) {
        const obj = decodeMsg(data);
        if (!obj?.text) return;
        const msg: ChatMessage = {
          id: `${userId}_${Date.now()}`,
          userId,
          text: obj.text,
          ts: obj.ts || Date.now(),
          self: false,
        };
        useAppStore.getState().addChatMessage(msg);
      }
      if (cmdId === LOCK_CMD) {
        const obj = decodeMsg(data);
        if (obj && typeof obj.locked === 'boolean') {
          useAppStore.getState().setRoomLocked(obj.locked);
        }
      }
    });

    trtc.on(TRTC.EVENT.SCREEN_SHARE_STOPPED, () => {
      setShareStatus('idle');
      useAppStore.getState().addSuccessLog('تم إيقاف مشاركة الشاشة');
    });

    trtc.on(TRTC.EVENT.DEVICE_CHANGED, async ({ type }: any) => {
      if (type === 'camera') {
        const cameras = await TRTC.getCameraList();
        useAppStore.getState().setCameras(cameras.map((c: MediaDeviceInfo) => ({ deviceId: c.deviceId, label: c.label })));
      }
      if (type === 'microphone') {
        const microphones = await TRTC.getMicrophoneList();
        useAppStore.getState().setMicrophones(microphones.map((m: MediaDeviceInfo) => ({ deviceId: m.deviceId, label: m.label })));
      }
    });
  }, []);

  const unbindEvents = useCallback(() => {
    if (trtcRef.current) trtcRef.current.off('*');
  }, []);

  // Enter Room
  const enterRoom = useCallback(async () => {
    const { sdkAppId, sdkSecretKey, userId, strRoomId } = useAppStore.getState();
    const numericSdkAppId = Number(sdkAppId);
    if (!numericSdkAppId || !sdkSecretKey || !userId || !strRoomId) {
      store.addFailedLog('بيانات الاتصال غير مكتملة (SDKAppId / SecretKey)');
      return;
    }
    setRoomStatus('entering');
    bindEvents();
    try {
      const { userSig } = genTestUserSig({ sdkAppId: numericSdkAppId, userId, sdkSecretKey });
      await trtcRef.current.enterRoom({ strRoomId, sdkAppId: numericSdkAppId, userId, userSig });
      reportSuccessEvent('enterRoom', numericSdkAppId);
      store.addSuccessLog(`[${userId}] دخل الغرفة`);
      store.addParticipant(userId);
      setRoomStatus('entered');
      setShareLink(createShareLink(numericSdkAppId, sdkSecretKey, strRoomId));
    } catch (error: any) {
      console.error('enterRoom error', error);
      reportFailedEvent({ name: 'enterRoom', error, roomId: strRoomId });
      store.addFailedLog(`[${userId}] فشل الدخول: ${error.message || error}`);
      setRoomStatus('idle');
      unbindEvents();
    }
  }, [store, bindEvents, unbindEvents, createShareLink]);

  // Exit Room
  const exitRoom = useCallback(async () => {
    const { userId } = useAppStore.getState();
    setRoomStatus('exiting');
    try {
      if (micStatus === 'started') { await trtcRef.current.stopLocalAudio(); setMicStatus('idle'); }
      if (camStatus === 'started') { await trtcRef.current.stopLocalVideo(); setCamStatus('idle'); }
      if (shareStatus === 'started') { await trtcRef.current.stopScreenShare(); setShareStatus('idle'); }
      await trtcRef.current.exitRoom();
      reportSuccessEvent('exitRoom', 0);
      store.addSuccessLog(`[${userId}] غادر الغرفة`);
      store.clearRemoteUsers();
      store.clearParticipants();
      store.clearChatMessages();
      store.setRoomLocked(false);
      unbindEvents();
      setRoomStatus('idle');
      setShareLink('');
      setAudioMuted(false);
      setVideoMuted(false);
    } catch (error: any) {
      console.error('exitRoom error', error);
      store.addFailedLog(`فشل الخروج: ${error.message || error}`);
      setRoomStatus('entered');
    }
  }, [store, micStatus, camStatus, shareStatus, unbindEvents]);

  // Start Local Audio
  const startLocalAudio = useCallback(async () => {
    const { userId, selectedMicrophoneId } = useAppStore.getState();
    setMicStatus('starting');
    try {
      await trtcRef.current.startLocalAudio({ option: { microphoneId: selectedMicrophoneId || undefined } });
      setMicStatus('started');
      setAudioMuted(false);
      reportSuccessEvent('startLocalAudio', 0);
      store.addSuccessLog(`[${userId}] تشغيل الميكروفون`);
    } catch (error: any) {
      store.addFailedLog(`فشل تشغيل الميكروفون: ${error.message || error}`);
      setMicStatus('idle');
    }
  }, [store]);

  const stopLocalAudio = useCallback(async () => {
    const { userId } = useAppStore.getState();
    if (micStatus !== 'started') return;
    setMicStatus('stopping');
    try {
      await trtcRef.current.stopLocalAudio();
      setMicStatus('idle');
      store.addSuccessLog(`[${userId}] إيقاف الميكروفون`);
    } catch (error: any) {
      store.addFailedLog(`فشل إيقاف الميكروفون: ${error.message || error}`);
      setMicStatus('started');
    }
  }, [store, micStatus]);

  // Start Local Video
  const startLocalVideo = useCallback(async (viewId: string = 'local') => {
    const { userId, selectedCameraId } = useAppStore.getState();
    setCamStatus('starting');
    try {
      await trtcRef.current.startLocalVideo({
        view: document.getElementById(viewId),
        option: { cameraId: selectedCameraId || undefined, profile: '1080p' },
      });
      setCamStatus('started');
      setVideoMuted(false);
      reportSuccessEvent('startLocalVideo', 0);
      store.addSuccessLog(`[${userId}] تشغيل الكاميرا`);
    } catch (error: any) {
      store.addFailedLog(`فشل تشغيل الكاميرا: ${error.message || error}`);
      setCamStatus('idle');
    }
  }, [store]);

  const stopLocalVideo = useCallback(async () => {
    const { userId } = useAppStore.getState();
    if (camStatus !== 'started') return;
    setCamStatus('stopping');
    try {
      await trtcRef.current.stopLocalVideo();
      setCamStatus('idle');
      store.addSuccessLog(`[${userId}] إيقاف الكاميرا`);
    } catch (error: any) {
      store.addFailedLog(`فشل إيقاف الكاميرا: ${error.message || error}`);
      setCamStatus('started');
    }
  }, [store, camStatus]);

  // Screen Share
  const startScreenShare = useCallback(async () => {
    if (!trtcRef.current) return;
    const { userId } = useAppStore.getState();
    setShareStatus('starting');
    try {
      await trtcRef.current.startScreenShare();
      setShareStatus('started');
      reportSuccessEvent('startScreenShare', 0);
      store.addSuccessLog(`[${userId}] بدأ مشاركة الشاشة`);
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.message?.includes('cancel')) {
        store.addSuccessLog('تم إلغاء مشاركة الشاشة');
      } else {
        store.addFailedLog(`فشل مشاركة الشاشة: ${error.message || error}`);
      }
      setShareStatus('idle');
    }
  }, [store]);

  const stopScreenShare = useCallback(async () => {
    if (shareStatus !== 'started') return;
    const { userId } = useAppStore.getState();
    setShareStatus('stopping');
    try {
      await trtcRef.current.stopScreenShare();
      setShareStatus('idle');
      store.addSuccessLog(`[${userId}] أوقف مشاركة الشاشة`);
    } catch (error: any) {
      store.addFailedLog(`فشل إيقاف المشاركة: ${error.message || error}`);
      setShareStatus('started');
    }
  }, [store, shareStatus]);

  // Toggle mute
  const toggleAudioMute = useCallback(async () => {
    try {
      const newMuted = !audioMuted;
      await trtcRef.current.updateLocalAudio({ mute: newMuted });
      setAudioMuted(newMuted);
    } catch (error: any) {
      store.addFailedLog(`فشل كتم الصوت: ${error.message}`);
    }
  }, [store, audioMuted]);

  const toggleVideoMute = useCallback(async () => {
    try {
      const newMuted = !videoMuted;
      await trtcRef.current.updateLocalVideo({ mute: newMuted });
      setVideoMuted(newMuted);
    } catch (error: any) {
      store.addFailedLog(`فشل كتم الصورة: ${error.message}`);
    }
  }, [store, videoMuted]);

  // Devices
  const updateLocalAudioDevice = useCallback(async (microphoneId: string) => {
    try { await trtcRef.current.updateLocalAudio({ option: { microphoneId } }); } catch {}
  }, []);

  const updateLocalVideoDevice = useCallback(async (cameraId: string) => {
    try { await trtcRef.current.updateLocalVideo({ option: { cameraId } }); } catch {}
  }, []);

  const getDevices = useCallback(async () => {
    try {
      const cameras = await TRTC.getCameraList();
      store.setCameras(cameras.map((c: MediaDeviceInfo) => ({ deviceId: c.deviceId, label: c.label })));
      const microphones = await TRTC.getMicrophoneList();
      store.setMicrophones(microphones.map((m: MediaDeviceInfo) => ({ deviceId: m.deviceId, label: m.label })));
    } catch {}
  }, [store]);

  const initDevice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    await getDevices();
  }, [getDevices]);

  // Send chat message
  const sendChatMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !trtcRef.current) return;
    const { userId } = useAppStore.getState();
    const msg: ChatMessage = {
      id: `local_${Date.now()}`,
      userId,
      text: trimmed,
      ts: Date.now(),
      self: true,
    };
    store.addChatMessage(msg);
    try {
      await trtcRef.current.sendCustomMessage({
        cmdId: CHAT_CMD,
        data: encodeMsg({ text: trimmed, ts: msg.ts }),
      });
    } catch (e) {
      console.error('sendCustomMessage error', e);
    }
  }, [store]);

  // Toggle room lock
  const toggleRoomLock = useCallback(async () => {
    const { roomLocked } = useAppStore.getState();
    const newLocked = !roomLocked;
    store.setRoomLocked(newLocked);
    try {
      await trtcRef.current.sendCustomMessage({
        cmdId: LOCK_CMD,
        data: encodeMsg({ locked: newLocked }),
      });
    } catch {}
    store.addSuccessLog(newLocked ? '🔒 تم قفل الغرفة' : '🔓 تم فتح الغرفة');
  }, [store]);

  return {
    trtcRef,
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
    getDevices,
    initDevice,
    refreshLink,
    sendChatMessage,
    toggleRoomLock,
  };
}
