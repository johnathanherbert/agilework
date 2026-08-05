"use client";

import { useEffect, useState } from 'react';
import { Clock as ClockIcon, Calendar, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClockProps {
  showDate?: boolean;
  showShift?: boolean;
  className?: string;
}

export const Clock = ({
  showDate = true,
  showShift = false,
  className,
}: ClockProps) => {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('00:00:00');
  const [date, setDate] = useState('01/01/2026');
  const [shift, setShift] = useState('1º Turno');
  const [shiftColor, setShiftColor] = useState('bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800');

  useEffect(() => {
    setMounted(true);

    const updateTime = () => {
      const now = new Date();
      
      // Formatação de horário HH:MM:SS
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}:${seconds}`);
      
      // Formatação de data (DD/MM/YYYY)
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      setDate(`${day}/${month}/${year}`);
      
      // Determinação do Turno
      const currentHours = now.getHours();
      if (currentHours >= 6 && currentHours < 14) {
        setShift('1º Turno');
        setShiftColor('bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800');
      } else if (currentHours >= 14 && currentHours < 22) {
        setShift('2º Turno');
        setShiftColor('bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800');
      } else {
        setShift('3º Turno');
        setShiftColor('bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 font-mono text-xs", className)}>
        <ClockIcon className="w-5 h-5 animate-spin mb-1 text-primary" />
        Carregando...
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm backdrop-blur-md", className)}>
      <div className="flex items-center gap-2">
        <ClockIcon className="w-5 h-5 text-primary animate-pulse" />
        <span className="text-2xl sm:text-3xl font-mono font-black tracking-widest tabular-nums text-slate-900 dark:text-slate-100">
          {time}
        </span>
      </div>

      {(showDate || showShift) && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {showDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {date}
            </span>
          )}

          {showDate && showShift && <span className="text-slate-300 dark:text-slate-700">•</span>}

          {showShift && (
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider", shiftColor)}>
              {shift}
            </span>
          )}
        </div>
      )}
    </div>
  );
};