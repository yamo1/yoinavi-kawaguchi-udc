'use client';

import { useMapStore } from '@/stores/mapStore';
import { Box, Building2, Layers } from 'lucide-react';

export default function View3DControls() {
  const {
    is3DMode,
    toggle3DMode,
    showBuildings,
    toggleBuildings,
  } = useMapStore();

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Layers className="w-5 h-5" />
        3D表示設定
      </h3>

      {/* 3Dモード切替 */}
      <button
        onClick={toggle3DMode}
        className={`w-full flex items-center justify-between p-2 rounded-lg mb-2 ${
          is3DMode ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
        }`}
      >
        <span className="flex items-center gap-2">
          <Box className="w-4 h-4" />
          3Dビュー
        </span>
        <span className="text-sm">{is3DMode ? 'ON' : 'OFF'}</span>
      </button>

      {/* 建物表示切替 */}
      <button
        onClick={toggleBuildings}
        disabled={!is3DMode}
        className={`w-full flex items-center justify-between p-2 rounded-lg ${
          showBuildings && is3DMode
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-600'
        } ${!is3DMode ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          PLATEAU建物
        </span>
        <span className="text-sm">{showBuildings ? 'ON' : 'OFF'}</span>
      </button>

      {/* 建物用途の凡例（3Dモード時のみ表示） */}
      {is3DMode && showBuildings && (
        <div className="mt-4 pt-3 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-2">建物用途</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#4ade80' }} />
              <span className="text-gray-600">商業施設</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#60a5fa' }} />
              <span className="text-gray-600">住宅</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f472b6' }} />
              <span className="text-gray-600">業務施設</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#a78bfa' }} />
              <span className="text-gray-600">公共施設</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#94a3b8' }} />
              <span className="text-gray-600">その他</span>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        ※ 建物データ: PLATEAU 川口市 2024
      </p>
    </div>
  );
}
