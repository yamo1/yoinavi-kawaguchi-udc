'use client';

import { useMapStore } from '@/stores/mapStore';
import { getTimeDescription } from '@/lib/safety-score';
import { Clock, Sun, Moon, Sunrise, Sunset } from 'lucide-react';

export default function TimeSimulator() {
  const { simulatedHour, setSimulatedHour } = useMapStore();

  const currentHour = new Date().getHours();
  const displayHour = simulatedHour !== null ? simulatedHour : currentHour;

  const getTimeIcon = (hour: number) => {
    if (hour >= 6 && hour < 10) return <Sunrise className="w-4 h-4" />;
    if (hour >= 10 && hour < 17) return <Sun className="w-4 h-4" />;
    if (hour >= 17 && hour < 20) return <Sunset className="w-4 h-4" />;
    return <Moon className="w-4 h-4" />;
  };

  const getTimeColor = (hour: number) => {
    if (hour >= 0 && hour < 5) return 'bg-indigo-900 text-white';
    if (hour >= 5 && hour < 7) return 'bg-orange-300 text-gray-800';
    if (hour >= 7 && hour < 10) return 'bg-yellow-200 text-gray-800';
    if (hour >= 10 && hour < 17) return 'bg-sky-300 text-gray-800';
    if (hour >= 17 && hour < 20) return 'bg-orange-400 text-white';
    if (hour >= 20 && hour < 22) return 'bg-indigo-600 text-white';
    return 'bg-indigo-800 text-white';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        時間帯シミュレーション
      </h3>

      {/* 現在時刻 / シミュレーション時刻 */}
      <div className={`rounded-lg p-3 mb-3 ${getTimeColor(displayHour)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTimeIcon(displayHour)}
            <span className="font-bold text-lg">{displayHour}:00</span>
          </div>
          <span className="text-sm opacity-90">
            {simulatedHour !== null ? 'シミュレーション中' : '現在時刻'}
          </span>
        </div>
        <p className="text-sm mt-1 opacity-90">
          {getTimeDescription(displayHour)}
        </p>
      </div>

      {/* 時間スライダー */}
      <div className="space-y-2">
        <input
          type="range"
          min="0"
          max="23"
          value={displayHour}
          onChange={(e) => setSimulatedHour(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0時</span>
          <span>6時</span>
          <span>12時</span>
          <span>18時</span>
          <span>23時</span>
        </div>
      </div>

      {/* 現在時刻に戻すボタン */}
      {simulatedHour !== null && (
        <button
          onClick={() => setSimulatedHour(null)}
          className="w-full mt-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
        >
          現在時刻に戻す
        </button>
      )}

      {/* 時間帯別の安全度説明 */}
      <div className="mt-4 pt-3 border-t text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-700">時間帯と安全度の関係</p>
        <div className="flex items-center gap-2">
          <Sun className="w-3 h-3" />
          <span>日中 (7-17時): 最も安全</span>
        </div>
        <div className="flex items-center gap-2">
          <Sunset className="w-3 h-3" />
          <span>夕方 (17-20時): やや減点</span>
        </div>
        <div className="flex items-center gap-2">
          <Moon className="w-3 h-3" />
          <span>夜間 (20-24時): 注意が必要</span>
        </div>
        <div className="flex items-center gap-2">
          <Moon className="w-3 h-3 text-indigo-600" />
          <span>深夜 (0-5時): 危険度が高い</span>
        </div>
      </div>
    </div>
  );
}
