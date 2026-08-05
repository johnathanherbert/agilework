"use client";

import { useEffect, useState } from 'react';
import { Clock as ClockIcon, Calendar, Sun, Moon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export const HeaderClock = () => {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('00:00:00');
  const [dateStr, setDateStr] = useState('');
  const [shiftInfo, setShiftInfo] = useState({ label: '1º Turno', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });

  useEffect(() => {
    setMounted(true);

    const updateTime = () => {
      const now = new Date();
      
      // Formatação de horário HH:MM:SS
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}:${seconds}`);
      
      // Formatação de data amigável: Ex. "Qua, 05 de Ago"
      try {
        const formattedDate = now.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: 'short'
        });
        setDateStr(formattedDate.replace('.', ''));
      } catch (e) {
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        setDateStr(`${day}/${month}`);
      }
      
      // Determinação do Turno Ativo
      const currentHours = now.getHours();
      if (currentHours >= 6 && currentHours < 14) {
        setShiftInfo({
          label: '1º Turno',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        });
      } else if (currentHours >= 14 && currentHours < 22) {
        setShiftInfo({
          label: '2º Turno',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        });
      } else {
        setShiftInfo({
          label: '3º Turno',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
        });
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 text-white/40 text-xs font-mono">
        <ClockIcon className="w-4 h-4 animate-spin" />
        Carregando horário...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Relógio Digital com Números Monospace */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md shadow-xs">
        <ClockIcon className="w-3.5 h-3.5 text-blue-300 animate-pulse" />
        <span className="font-mono font-black text-sm text-white tracking-widest tabular-nums">
          {time}
        </span>
      </div>

      {/* Data & Badge do Turno */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
        <span className="capitalize font-semibold text-blue-100 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-blue-300" />
          {dateStr}
        </span>
        <span className="text-white/30">•</span>
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider", shiftInfo.color)}>
          {shiftInfo.label}
        </span>
      </div>
    </div>
  );
};