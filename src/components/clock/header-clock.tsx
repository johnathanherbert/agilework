   "use client";

import { useEffect, useState } from 'react';

export const HeaderClock = () => {
  const [time, setTime] = useState('00:00:00');
  const [date, setDate] = useState('01/01/2023');

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
    };

    // Update immediately
    updateTime();
    
    // Then update every second
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Determine which shift is active based on the current time
  const getShift = () => {
    const hours = new Date().getHours();
    const minutes = new Date().getMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    // 1º Turno: 7:20 às 15:50
    if (totalMinutes >= 440 && totalMinutes < 950) {
      return '1º Turno';
    // 2º Turno: 15:50 às 23:00
    } else if (totalMinutes >= 950 && totalMinutes < 1380) {
      return '2º Turno';
    // 3º Turno: 23:00 às 7:20
    } else {
      return '3º Turno';
    }
  };

  return (
    <div className="flex flex-col items-start">
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {date} • {getShift()}
      </div>
      <div className="text-lg font-bold">{time}</div>
    </div>
  );
};