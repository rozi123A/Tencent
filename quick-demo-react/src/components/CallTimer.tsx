import { useState, useEffect } from 'react';

interface CallTimerProps {
  running: boolean;
}

export default function CallTimer({ running }: CallTimerProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const fmt = (n: number) => String(n).padStart(2, '0');

  return (
    <span className="call-timer">
      ⏱️ {h > 0 ? `${fmt(h)}:` : ''}{fmt(m)}:{fmt(s)}
    </span>
  );
}
