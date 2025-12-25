'use client';

import { useMapStore } from '@/stores/mapStore';
import { Moon, Sun, Eye, EyeOff, Store, Toilet, Shield, Train, Camera } from 'lucide-react';

const POI_TYPES = [
  { type: 'convenience_store', label: 'コンビニ', icon: Store },
  { type: 'toilet', label: 'トイレ', icon: Toilet },
  { type: 'koban', label: '交番', icon: Shield },
  { type: 'station', label: '駅', icon: Train },
];

export default function ControlPanel() {
  const {
    isNightMode,
    toggleNightMode,
    showSafetyLayer,
    toggleSafetyLayer,
    showCameras,
    toggleCameras,
    visiblePoiTypes,
    togglePoiType,
  } = useMapStore();

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="font-bold text-gray-800 mb-3">表示設定</h3>

      {/* ナイトモード */}
      <button
        onClick={toggleNightMode}
        className={`w-full flex items-center justify-between p-2 rounded-lg mb-2 ${
          isNightMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'
        }`}
      >
        <span className="flex items-center gap-2">
          {isNightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          ナイトモード
        </span>
        <span className="text-sm">{isNightMode ? 'ON' : 'OFF'}</span>
      </button>

      {/* 安全レイヤー */}
      <button
        onClick={toggleSafetyLayer}
        className={`w-full flex items-center justify-between p-2 rounded-lg mb-2 ${
          showSafetyLayer ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}
      >
        <span className="flex items-center gap-2">
          {showSafetyLayer ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          安全スコア表示
        </span>
        <span className="text-sm">{showSafetyLayer ? 'ON' : 'OFF'}</span>
      </button>

      {/* 防犯カメラ表示 */}
      <button
        onClick={toggleCameras}
        className={`w-full flex items-center justify-between p-2 rounded-lg mb-4 ${
          showCameras ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
        }`}
      >
        <span className="flex items-center gap-2">
          <Camera className="w-4 h-4" />
          防犯カメラ表示
        </span>
        <span className="text-sm">{showCameras ? 'ON' : 'OFF'}</span>
      </button>

      {/* POI表示設定 */}
      <h4 className="text-sm font-medium text-gray-700 mb-2">施設表示</h4>
      <div className="grid grid-cols-2 gap-2">
        {POI_TYPES.map(({ type, label, icon: Icon }) => {
          const isActive = visiblePoiTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => togglePoiType(type)}
              className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                isActive
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-gray-100 text-gray-600 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="mt-4 pt-4 border-t">
        <h4 className="text-sm font-medium text-gray-700 mb-2">安全スコア凡例</h4>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }} />
            <span className="text-gray-600">90-100: 安全</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#84cc16' }} />
            <span className="text-gray-600">80-89: やや安全</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }} />
            <span className="text-gray-600">70-79: 注意</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }} />
            <span className="text-gray-600">60-69: 要注意</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
            <span className="text-gray-600">50-59: 危険</span>
          </div>
        </div>
      </div>
    </div>
  );
}
