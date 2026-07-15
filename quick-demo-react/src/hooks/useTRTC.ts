import { useRef, useState, useCallback, useEffect } from 'react';
import TRTC from 'trtc-sdk-v5';
import { useAppStore, ChatMessage } from '@/store';
import { fetchUserSig } from '@/utils/generateTestUserSig';
import { getPublicSettings } from '@/utils/adminApi';
import { reportSuccessEvent, reportFailedEvent } from '@/utils/aegis';

export type RoomStatus = 'idle' | 'entering' | 'entered' | 'exiting';
export type MediaStatus = 'idle' | 'starting' | 'started' | 'stopping';

const CHAT_CMD = 1;
const LOCK_CMD = 2;
const TYPING_CMD = 3;
const PRESENCE_CMD = 4;

// Rooms above this size get kicked back out right after joining -- TRTC has
// no way to reject a join before it happens, so this is enforced reactively
// once the current member count is known (see enterRoom). Fallback value
// used until /api/settings responds; the admin dashboard can change the
// real value at runtime without a redeploy.
let maxParticipants = 10;
getPublicSettings()
  .then((s) => { maxParticipants = s.maxParticipants; })
  .catch(() => {});

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
  // Holds the latest exitRoom() so the over-capacity check inside enterRoom
  // can call it without a circular useCallback dependency (exitRoom is
  // declared further down, after state it depends on).
  const exitRoomRef = useRef<() => Promise<void>>();

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
      const trtc = trtcRef.current;
      trtcRef.current = null;
      if (!trtc) return;
      trtc
        .exitRoom()
        .catch(() => {})
        .finally(() => {
          try { trtc.destroy(); } catch (e) { console.error('trtc.destroy() failed', e); }
        });
    };
  }, []);

  const createShareLink = useCallback(async (sdkAppId: number, strRoomId: string) => {
    const inviteUserId = String(Math.floor(Math.random() * 1000000));
    const { userSig } = await fetchUserSig({ userId: inviteUserId });
    const basePath = `${window.location.origin}${window.location.pathname}`;
    return `${basePath}#/invite?userSig=${userSig}&SDKAppId=${sdkAppId}&userId=${inviteUserId}&strRoomId=${strRoomId}`;
  }, []);

  const refreshLink = useCallback(async () => {
    const { sdkAppId, strRoomId } = useAppStore.getState();
    if (sdkAppId && strRoomId) {
      setShareLink(await createShareLink(Number(sdkAppId), strRoomId));
    }
  }, [createShareLink]);

  const bindEvents = useCallback(() => {
    const trtc = trtcRef.current;
    if (!trtc) return;

    trtc.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, ({ userId, streamType }: any) => {
      console.log('REMOTE_VIDEO_AVAILABLE', userId, streamType);
      const elementId = `${userId}_${streamType}`;
      const s = useAppStore.getState();
      
      // Force UI update
      s.addRemoteUser({ userId, streamType, elementId });
      
      // Auto-subscribe to audio as well
      if (streamType === TRTC.TYPE.STREAM_TYPE_MAIN) {
        trtc.startRemoteAudio({ userId })
          .then(() => console.log('Auto-subscribed to audio for', userId))
          .catch((e: any) => console.error('Failed to auto-subscribe audio', e));
      }
      
      // Robust retry logic for video rendering
      let retries = 0;
      const tryStartVideo = () => {
        const view = document.getElementById(elementId);
        if (view) {
          trtc.startRemoteVideo({ userId, streamType, view: elementId })
            .then(() => {
              console.log('Successfully started remote video for', userId);
              playBeep();
            })
            .catch((e: any) => {
              console.error('Failed to start remote video, retrying...', e);
              if (retries < 10) {
                retries++;
                setTimeout(tryStartVideo, 500);
              }
            });
        } else {
          if (retries < 20) {
            retries++;
            setTimeout(tryStartVideo, 200);
          }
        }
      };
      tryStartVideo();
    });

    trtc.on(TRTC.EVENT.REMOTE_VIDEO_UNAVAILABLE, async ({ userId, streamType }: any) => {
      const elementId = `${userId}_${streamType}`;
      try {
        await trtc.stopRemoteVideo({ userId, streamType });
      } catch (e) {
        console.error('stopRemoteVideo failed', e);
      } finally {
        useAppStore.getState().removeRemoteUser(elementId);
      }
    });

    // Track participants enter/leave
    trtc.on(TRTC.EVENT.REMOTE_USER_ENTER, ({ userId }: any) => {
      console.log('REMOTE_USER_ENTER', userId);
      const s = useAppStore.getState();
      s.addParticipant(userId);
      const label = s.displayNames[userId] || userId;
      s.addSuccessLog(`🟢 ${label} دخل الغرفة`);
      s.addToast(`🟢 ${label} انضم للمكالمة`);
      playBeep();
      // The newcomer has no way to know who was already in the room (they
      // weren't there for our initial join-time broadcast), so re-announce
      // our own display name whenever someone new enters.
      const myName = s.displayName || s.userId;
      trtc.sendCustomMessage({ cmdId: PRESENCE_CMD, data: encodeMsg({ name: myName }) }).catch(() => {});
    });

    trtc.on(TRTC.EVENT.REMOTE_USER_EXIT, ({ userId }: any) => {
      const s = useAppStore.getState();
      const label = s.displayNames[userId] || userId;
      s.removeParticipant(userId);
      s.addSuccessLog(`🔴 ${label} غادر الغرفة`);
      s.addToast(`🔴 ${label} غادر المكالمة`);
    });

    // Network quality
    trtc.on(TRTC.EVENT.NETWORK_QUALITY, ({ uplinkNetworkQuality, downlinkNetworkQuality }: any) => {
      useAppStore.getState().setNetworkQuality({
        uplink: uplinkNetworkQuality,
        downlink: downlinkNetworkQuality,
      });
    });

    // Custom messages (chat + lock + typing)
    trtc.on(TRTC.EVENT.CUSTOM_MESSAGE, ({ cmdId, userId, data }: any) => {
      if (cmdId === TYPING_CMD) {
        const obj = decodeMsg(data);
        if (obj && typeof obj.typing === 'boolean') {
          useAppStore.getState().setTyping(userId, obj.typing);
        }
      }
      if (cmdId === CHAT_CMD) {
        console.log('CHAT_CMD received from', userId);
        const obj = decodeMsg(data);
        if (!obj?.text) return;
        
        const s = useAppStore.getState();
        // Avoid duplicate messages
        const exists = s.chatMessages.some(m => m.text === obj.text && Math.abs(m.ts - (obj.ts || Date.now())) < 1000);
        if (exists) return;

        const msg: ChatMessage = {
          id: `${userId}_${Date.now()}_${Math.random()}`,
          userId,
          text: obj.text,
          ts: obj.ts || Date.now(),
          self: false,
        };
        s.addChatMessage(msg);
      }
      if (cmdId === LOCK_CMD) {
        const obj = decodeMsg(data);
        if (obj && typeof obj.locked === 'boolean') {
          useAppStore.getState().setRoomLocked(obj.locked);
        }
      }
      if (cmdId === PRESENCE_CMD) {
        const obj = decodeMsg(data);
        if (obj && typeof obj.name === 'string' && obj.name) {
          useAppStore.getState().setDisplayNameFor(userId, obj.name);
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
  const enterRoom = useCallback(async (pin?: string) => {
    const { userId, strRoomId, displayName } = useAppStore.getState();

    if (!userId || !strRoomId) {
      store.addFailedLog('بيانات الاتصال غير مكتملة (الاسم أو رقم الغرفة)');
      return;
    }
    setRoomStatus('entering');
    bindEvents();
    try {
      const { sdkAppId: signedSdkAppId, userSig } = await fetchUserSig({ userId, strRoomId, pin });
      store.setSdkAppId(String(signedSdkAppId));
      await trtcRef.current.enterRoom({ strRoomId, sdkAppId: signedSdkAppId, userId, userSig });
      reportSuccessEvent('enterRoom', signedSdkAppId);
      store.addSuccessLog(`[${displayName || userId}] دخل الغرفة`);
      store.addParticipant(userId);
      store.setDisplayNameFor(userId, displayName || userId);
      // Announce our display name immediately in case peers already in the
      // room are listening (also re-announced reactively on their
      // REMOTE_USER_ENTER handler once they see us appear).
      trtcRef.current
        .sendCustomMessage({ cmdId: PRESENCE_CMD, data: encodeMsg({ name: displayName || userId }) })
        .catch(() => {});
      setRoomStatus('entered');
      setShareLink(await createShareLink(signedSdkAppId, strRoomId));

      // TRTC has no way to check room occupancy before joining, so the max
      // participants cap can only be enforced reactively: give the initial
      // burst of REMOTE_USER_ENTER events (for anyone already in the room) a
      // moment to arrive, then check the real count and leave if it's over
      // the cap -- checking participants.length before this point is always
      // 0/1 and would never catch a genuinely full room.
      setTimeout(async () => {
        const count = useAppStore.getState().participants.length;
        if (count > maxParticipants && useAppStore.getState().userId === userId) {
          store.addToast(`❌ الغرفة ممتلئة (الحد الأقصى ${maxParticipants} مستخدمين)`, 'error');
          store.addFailedLog(`الغرفة ممتلئة (${count}/${maxParticipants}) — تم إخراجك تلقائيًا`);
          await exitRoomRef.current?.();
        }
      }, 1500);
    } catch (error: any) {
      console.error('enterRoom error', error);
      reportFailedEvent({ name: 'enterRoom', error, roomId: strRoomId });
      
      let friendlyMsg = error.message || error;
      if (friendlyMsg.includes('NotAllowedError') || friendlyMsg.includes('Permission denied')) {
        friendlyMsg = '❌ تم رفض الوصول للكاميرا أو الميكروفون. يرجى السماح للمتصفح بالوصول.';
      } else if (friendlyMsg.includes('Network Error') || friendlyMsg.includes('Failed to fetch')) {
        friendlyMsg = '🌐 مشكلة في الشبكة. تأكد من اتصالك بالإنترنت.';
      } else if (friendlyMsg.includes('403') || friendlyMsg.includes('userSig')) {
        friendlyMsg = '🔑 خطأ في التحقق من الهوية. يرجى إعادة تحميل الصفحة.';
      }

      store.addFailedLog(`[${userId}] فشل الدخول: ${friendlyMsg}`);
      store.addToast(friendlyMsg, 'error');
      setRoomStatus('idle');
      unbindEvents();
      throw error;
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
      store.clearDisplayNames();
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

  useEffect(() => {
    exitRoomRef.current = exitRoom;
  }, [exitRoom]);

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

  // Send typing status
  const sendTypingStatus = useCallback(async (typing: boolean) => {
    if (!trtcRef.current) return;
    try {
      await trtcRef.current.sendCustomMessage({
        cmdId: TYPING_CMD,
        data: encodeMsg({ typing }),
      });
    } catch {}
  }, []);

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
      sendTypingStatus(false);
    } catch (e) {
      console.error('sendCustomMessage error', e);
    }
  }, [store, sendTypingStatus]);

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
    sendTypingStatus,
    toggleRoomLock,
  };
}
