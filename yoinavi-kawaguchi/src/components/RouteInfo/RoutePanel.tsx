'use client';

import { useMapStore } from '@/stores/mapStore';
import { getScoreColor, getScoreLabel } from '@/lib/safety-score';
import { Clock, MapPin, Shield, Route as RouteIcon } from 'lucide-react';

export default function RoutePanel() {
  const { routes, selectedRouteType, setSelectedRouteType } = useMapStore();

  if (routes.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <RouteIcon className="w-5 h-5" />
        ルート選択
      </h3>

      <div className="space-y-3">
        {routes.map((route) => {
          const isSelected = route.type === selectedRouteType;
          const scoreColor = getScoreColor(route.safety_score);
          const scoreLabel = getScoreLabel(route.safety_score);

          return (
            <button
              key={route.type}
              onClick={() => setSelectedRouteType(route.type)}
              className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {/* ルート色インジケーター */}
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: route.type === 'recommended' ? '#8b5cf6' : '#f97316',
                    }}
                  />
                  <span className="font-medium text-gray-800">{route.name}</span>
                </div>
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-sm text-white"
                  style={{ backgroundColor: scoreColor }}
                >
                  <Shield className="w-3 h-3" />
                  {scoreLabel}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {route.duration_minutes}分
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {route.distance_meters >= 1000
                    ? `${(route.distance_meters / 1000).toFixed(1)}km`
                    : `${route.distance_meters}m`}
                </div>
              </div>

              {/* 安全スコアバー */}
              <div className="mt-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${route.safety_score}%`,
                      backgroundColor: scoreColor,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  安全スコア: {route.safety_score}/100
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 周辺施設 */}
      {routes[0]?.nearby_pois?.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-2">ルート周辺の施設</h4>
          <div className="flex flex-wrap gap-2">
            {routes[0].nearby_pois.map((poi) => (
              <span
                key={poi.id}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
              >
                {poi.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
