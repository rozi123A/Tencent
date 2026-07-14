import { useEffect } from 'react';
import { useAppStore } from '@/store';
import { generateRandomUserId, generateRandomRoomId } from '@/utils/utils';

export default function Inputs() {
  const { setSdkAppId, setSdkSecretKey, setUserId, setStrRoomId } = useAppStore();

  useEffect(() => {
    setSdkAppId(import.meta.env.VITE_SDK_APP_ID || '');
    setSdkSecretKey(import.meta.env.VITE_SDK_SECRET_KEY || '');
    setUserId(generateRandomUserId());
    setStrRoomId(generateRandomRoomId());
  }, []);

  return null;
}
