'use client';
// Ported from Zoro: home.php JS countdown (updateCountdowns function)
import { useEffect, useState } from 'react';

export default function CountdownTimer({ timestamp }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!timestamp) return;

    const tick = () => {
      const now = Date.now();
      const target = typeof timestamp === 'number' ? timestamp * 1000 : new Date(timestamp).getTime();
      const diffSec = Math.floor((target - now) / 1000);

      if (diffSec > 0) {
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        setDisplay(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      } else if (diffSec < 0) {
        const abs = Math.abs(diffSec);
        const h = Math.floor(abs / 3600);
        const m = Math.floor((abs % 3600) / 60);
        const s = abs % 60;
        setDisplay(`-${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} (Aired)`);
      } else {
        setDisplay('00:00:00 (Live)');
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timestamp]);

  if (!display) return null;

  return (
    <span style={{ fontSize: 11, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
      {display}
    </span>
  );
}
