   "use client";

import { useEffect, useState } from 'react';
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
  const [time, setTime] = useState('00:00:00');
  const [date, setDate] = useState('01/01/2023');
  const [shift, setShift] = useState('1º Turno');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Format time as HH:MM:SS
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}:${seconds}`);
      
      // Format date in Brazilian format (DD/MM/YYYY)
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      setDate(`${day}/${month}/${year}`);
      
      // Determine shift
      const currentHours = now.getHours();
      if (currentHours >= 6 && currentHours < 14) {
        setShift('1º Turno');
      } else if (currentHours >= 14 && currentHours < 22) {
        setShift('2º Turno');
      } else {
        setShift('3º Turno');
      }
    };

    // Update immediately
    updateTime();
    
    // Then update every second
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="text-xl font-bold">{time}</div>
      {showDate && (
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {date}
          {showShift && ` • ${shift}`}
        </div>
      )}
    </div>
  );
};