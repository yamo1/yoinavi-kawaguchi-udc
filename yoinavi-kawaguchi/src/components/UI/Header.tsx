'use client';

import { Beer, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isLateNight, setIsLateNight] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      setCurrentTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      setIsLateNight(hours >= 22 || hours < 5);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Beer className="w-6 h-6" />
            <h1 className="text-xl font-bold">酔ナビ</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" />
            <span>{currentTime}</span>
            {isLateNight && (
              <span className="bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-medium">
                深夜
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-purple-200 mt-1">
          飲み会帰りのセーフルートマップ - 川口市
        </p>
      </div>
    </header>
  );
}
