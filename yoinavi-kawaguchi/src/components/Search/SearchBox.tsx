'use client';

import { useState, useCallback } from 'react';
import { Search, MapPin, X } from 'lucide-react';
import { useMapStore } from '@/stores/mapStore';

// 川口市の主要駅
const STATIONS = [
  { name: '川口駅', lat: 35.8073, lng: 139.7244 },
  { name: '西川口駅', lat: 35.8218, lng: 139.7103 },
  { name: '東川口駅', lat: 35.8498, lng: 139.7413 },
  { name: '蕨駅', lat: 35.8238, lng: 139.6823 },
  { name: '南鳩ヶ谷駅', lat: 35.8309, lng: 139.7353 },
  { name: '鳩ヶ谷駅', lat: 35.8411, lng: 139.7386 },
  { name: '新井宿駅', lat: 35.8502, lng: 139.7399 },
  { name: '戸塚安行駅', lat: 35.8585, lng: 139.7509 },
  { name: '川口元郷駅', lat: 35.8147, lng: 139.7324 },
];

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<typeof STATIONS>([]);
  const [isOpen, setIsOpen] = useState(false);

  const { setDestination, destination, destinationName } = useMapStore();

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (value.length > 0) {
      const filtered = STATIONS.filter((s) =>
        s.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
      setIsOpen(true);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, []);

  const handleSelect = useCallback(
    (station: (typeof STATIONS)[0]) => {
      setDestination({ lat: station.lat, lng: station.lng }, station.name);
      setQuery(station.name);
      setIsOpen(false);
    },
    [setDestination]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setDestination(null, '');
    setSuggestions([]);
    setIsOpen(false);
  }, [setDestination]);

  const handleUseCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          useMapStore.getState().setCurrentLocation({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('現在地を取得できませんでした');
        }
      );
    }
  }, []);

  return (
    <div className="relative">
      {/* 検索ボックス */}
      <div className="flex items-center gap-2 bg-white rounded-lg shadow-lg p-3">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="目的地を検索（駅名など）"
          className="flex-1 outline-none text-gray-800"
        />
        {query && (
          <button onClick={handleClear} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* サジェストリスト */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg overflow-hidden z-50">
          {suggestions.map((station) => (
            <button
              key={station.name}
              onClick={() => handleSelect(station)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
            >
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-800">{station.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* 現在地ボタン */}
      <button
        onClick={handleUseCurrentLocation}
        className="mt-2 w-full flex items-center justify-center gap-2 bg-blue-500 text-white rounded-lg p-2 hover:bg-blue-600"
      >
        <MapPin className="w-4 h-4" />
        現在地を取得
      </button>

      {/* 目的地表示 */}
      {destination && destinationName && (
        <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-800">
            <span className="font-medium">目的地:</span> {destinationName}
          </p>
        </div>
      )}
    </div>
  );
}
