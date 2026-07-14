import { useEffect } from 'react';
    import { useAppStore } from '@/store';
    import { generateRandomUserId, generateRandomRoomId } from '@/utils/utils';

    export default function Inputs() {
    const { setSdkAppId, setSdkSecretKey, setUserId, setStrRoomId } = useAppStore();

    useEffect(() => {
      // Read credentials from environment variables (set in Render dashboard)
      const appId = import.meta.env.VITE_SDK_APP_ID || '';
      const secretKey = import.meta.env.VITE_SDK_SECRET_KEY || '';
      const userId = generateRandomUserId();
      const roomId = 'room_1';

      setSdkAppId(appId);
      setSdkSecretKey(secretKey);
      setUserId(userId);
      setStrRoomId(roomId);
    }, []);

    // No UI shown — credentials come from environment variables
    return null;
    }
    