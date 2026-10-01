"use client";

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export const HeaderClock = () => {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('--:--:--');
  const [dateStr, setDateStr] = useState('');
  const [shiftLabel, setShiftLabel] = useState('1º turno');

  useEffect(() => {
    setMounted(true);

    const updateTime = () => {
      const now = new Date();
      
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}:${seconds}`);
      
      try {
        const formattedDate = now.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        });
        setDateStr(formattedDate.replace('.', ''));
      } catch (e) {
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        setDateStr(`${day}/${month}`);
      }
      
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes >= 7 * 60 + 20 && currentMinutes < 15 * 60 + 50) {
        setShiftLabel('1º turno');
      } else if (currentMinutes >= 15 * 60 + 50 && currentMinutes < 23 * 60 + 50) {
        setShiftLabel('2º turno');
      } else {
        setShiftLabel('3º turno');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-3 text-xs text-[var(--text-3)] font-mono">
        <span>--:--:--</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-[var(--text-2)] font-medium">{shiftLabel}</span>
      <span className="font-mono text-[var(--text)] tracking-wider tabular-nums font-medium">
        {time}
      </span>
      <span className="text-[var(--text-3)] hidden md:inline capitalize">
        {dateStr}
      </span>
    </div>
  );
};