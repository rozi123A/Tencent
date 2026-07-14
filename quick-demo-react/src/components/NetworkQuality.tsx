import { useAppStore } from '@/store';

const labels: Record<number, { text: string; color: string }> = {
  0: { text: '–', color: '#888' },
  1: { text: 'ممتاز', color: '#22c55e' },
  2: { text: 'جيد', color: '#84cc16' },
  3: { text: 'مقبول', color: '#f59e0b' },
  4: { text: 'ضعيف', color: '#f97316' },
  5: { text: 'سيء', color: '#ef4444' },
  6: { text: 'منقطع', color: '#7f1d1d' },
};

export default function NetworkQuality() {
  const { uplink, downlink } = useAppStore((s) => s.networkQuality);
  const worst = Math.max(uplink, downlink);
  const { text, color } = labels[worst] ?? labels[0];
  const bars = Math.max(0, 5 - worst);

  return (
    <span className="net-quality" title={`↑${uplink} ↓${downlink}`} style={{ color }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{
          display: 'inline-block',
          width: 3,
          height: 8 + i * 3,
          background: i < bars ? color : '#333',
          borderRadius: 1,
          marginRight: 1,
          verticalAlign: 'bottom',
        }} />
      ))}
      &nbsp;{text}
    </span>
  );
}
