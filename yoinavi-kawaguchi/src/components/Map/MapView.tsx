'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Deck } from '@deck.gl/core';
import { PolygonLayer } from '@deck.gl/layers';
import { useMapStore, Building } from '@/stores/mapStore';
import { getScoreColor } from '@/lib/safety-score';

// POIアイコンの設定
const POI_ICONS: Record<string, { icon: string; color: string }> = {
  convenience_store: { icon: '🏪', color: '#22c55e' },
  toilet: { icon: '🚻', color: '#3b82f6' },
  koban: { icon: '👮', color: '#ef4444' },
  station: { icon: '🚉', color: '#8b5cf6' },
  taxi_stand: { icon: '🚕', color: '#f59e0b' },
  park: { icon: '🌳', color: '#10b981' },
};

// 建物用途に基づく色を取得
function getBuildingColor(usageCode: string): [number, number, number, number] {
  const colors: Record<string, [number, number, number, number]> = {
    '401': [244, 114, 182, 200], // 業務施設 - ピンク
    '402': [74, 222, 128, 200],  // 商業施設 - 緑
    '403': [251, 191, 36, 200],  // 宿泊施設 - 黄
    '404': [74, 222, 128, 200],  // 商業系複合 - 緑
    '411': [96, 165, 250, 200],  // 住宅 - 青
    '412': [96, 165, 250, 200],  // 共同住宅 - 青
    '413': [129, 230, 217, 200], // 店舗併用住宅 - シアン
    '414': [129, 230, 217, 200], // 店舗併用共同 - シアン
    '421': [248, 113, 113, 200], // 医療施設 - 赤
    '422': [167, 139, 250, 200], // 教育施設 - 紫
    '431': [253, 186, 116, 200], // 運輸倉庫 - オレンジ
    '441': [156, 163, 175, 200], // 工場 - グレー
    '451': [167, 139, 250, 200], // 官公庁 - 紫
    '452': [167, 139, 250, 200], // 文化施設 - 紫
    '453': [167, 139, 250, 200], // 体育館 - 紫
  };
  return colors[usageCode] || [148, 163, 184, 180]; // デフォルト - スレートグレー
}

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const deck = useRef<Deck | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const cameraMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const isInitialMount = useRef(true);

  const {
    currentLocation,
    destination,
    routes,
    selectedRouteType,
    pois,
    visiblePoiTypes,
    isNightMode,
    showSafetyLayer,
    roads,
    buildings,
    cameras,
    showCameras,
    is3DMode,
    showBuildings,
    simulatedHour,
  } = useMapStore();

  // 川口市南部エリアの中心座標
  const CENTER: [number, number] = [139.7266, 35.8072];

  // deck.glレイヤーを更新
  const updateDeckLayers = useCallback(() => {
    if (!deck.current || !is3DMode) return;

    const layers = [];

    // 建物レイヤー
    if (showBuildings && buildings.length > 0) {
      layers.push(
        new PolygonLayer({
          id: 'buildings-layer',
          data: buildings,
          extruded: true,
          wireframe: false,
          getPolygon: (d: Building) => d.polygon,
          getElevation: (d: Building) => d.height,
          getFillColor: (d: Building) => getBuildingColor(d.usageCode),
          getLineColor: [80, 80, 80, 100],
          lineWidthMinPixels: 1,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 100],
        })
      );
    }

    deck.current.setProps({ layers });
  }, [is3DMode, showBuildings, buildings]);

  // マップ初期化
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initialPitch = is3DMode ? 60 : 0;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: isNightMode
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: CENTER,
      zoom: 15,
      pitch: initialPitch,
      bearing: -17,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right'
    );

    map.current.on('load', () => {
      setMapLoaded(true);
      setStyleLoaded(true);
    });

    // deck.gl初期化
    if (is3DMode) {
      const canvas = mapContainer.current.querySelector('.maplibregl-canvas') as HTMLCanvasElement;
      if (canvas) {
        deck.current = new Deck({
          parent: mapContainer.current,
          controller: false,
          style: {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          },
          viewState: {
            longitude: CENTER[0],
            latitude: CENTER[1],
            zoom: 15,
            pitch: 60,
            bearing: -17,
          },
          layers: [],
          getTooltip: ({ object }: { object?: Building }) => {
            if (!object) return null;
            return {
              html: `<div style="padding: 8px; background: white; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                <strong>${object.usage}</strong><br/>
                <span style="color: #666;">高さ: ${object.height.toFixed(1)}m</span><br/>
                <span style="color: #666;">階数: ${object.storeys}階</span>
              </div>`,
              style: {
                backgroundColor: 'transparent',
              },
            };
          },
        });

        // マップの移動に合わせてdeck.glを更新
        map.current.on('move', () => {
          if (!map.current || !deck.current) return;
          const { lng, lat } = map.current.getCenter();
          deck.current.setProps({
            viewState: {
              longitude: lng,
              latitude: lat,
              zoom: map.current.getZoom(),
              pitch: map.current.getPitch(),
              bearing: map.current.getBearing(),
            },
          });
        });
      }
    }

    return () => {
      deck.current?.finalize();
      deck.current = null;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3Dモードと建物表示の変更を監視
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    // ピッチを更新
    map.current.easeTo({
      pitch: is3DMode ? 60 : 0,
      duration: 500,
    });

    // deck.glの初期化・破棄
    if (is3DMode && !deck.current && mapContainer.current) {
      deck.current = new Deck({
        parent: mapContainer.current,
        controller: false,
        style: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        },
        viewState: {
          longitude: map.current.getCenter().lng,
          latitude: map.current.getCenter().lat,
          zoom: map.current.getZoom(),
          pitch: 60,
          bearing: map.current.getBearing(),
        },
        layers: [],
        getTooltip: ({ object }: { object?: Building }) => {
          if (!object) return null;
          return {
            html: `<div style="padding: 8px; background: white; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
              <strong>${object.usage}</strong><br/>
              <span style="color: #666;">高さ: ${object.height.toFixed(1)}m</span><br/>
              <span style="color: #666;">階数: ${object.storeys}階</span>
            </div>`,
            style: {
              backgroundColor: 'transparent',
            },
          };
        },
      });

      // マップの移動に合わせてdeck.glを更新
      const moveHandler = () => {
        if (!map.current || !deck.current) return;
        const { lng, lat } = map.current.getCenter();
        deck.current.setProps({
          viewState: {
            longitude: lng,
            latitude: lat,
            zoom: map.current.getZoom(),
            pitch: map.current.getPitch(),
            bearing: map.current.getBearing(),
          },
        });
      };

      map.current.on('move', moveHandler);
    } else if (!is3DMode && deck.current) {
      deck.current.finalize();
      deck.current = null;
    }

    updateDeckLayers();
  }, [is3DMode, mapLoaded, updateDeckLayers]);

  // 建物データの変更を監視
  useEffect(() => {
    updateDeckLayers();
  }, [buildings, showBuildings, updateDeckLayers]);

  // スタイル変更（ナイトモード）
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // 初回マウント時はスキップ（初期スタイルは既にロード済み）
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const style = isNightMode
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

    // スタイル変更前にフラグをリセット
    setStyleLoaded(false);

    map.current.setStyle(style);

    // スタイル読み込み完了後にフラグを設定
    const onStyleLoad = () => {
      setStyleLoaded(true);
    };
    map.current.once('style.load', onStyleLoad);

    return () => {
      map.current?.off('style.load', onStyleLoad);
    };
  }, [isNightMode, mapLoaded]);

  // 道路データの表示（安全スコアに基づく色分け）
  useEffect(() => {
    if (!map.current || !mapLoaded || !styleLoaded || roads.length === 0) return;

    const m = map.current;

    // 既存のレイヤーを削除
    if (m.getLayer('safety-roads')) {
      m.removeLayer('safety-roads');
    }
    if (m.getSource('roads-source')) {
      m.removeSource('roads-source');
    }

    if (!showSafetyLayer) return;

    // 道路データをGeoJSON形式に変換
    const geojsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: roads.map((road) => ({
        type: 'Feature' as const,
        properties: {
          safetyScore: road.safetyScore || 70,
          color: getScoreColor(road.safetyScore || 70),
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: road.coordinates,
        },
      })),
    };

    m.addSource('roads-source', {
      type: 'geojson',
      data: geojsonData,
    });

    m.addLayer({
      id: 'safety-roads',
      type: 'line',
      source: 'roads-source',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-opacity': 0.6,
      },
    });
  }, [roads, mapLoaded, styleLoaded, showSafetyLayer, simulatedHour]);

  // ルート表示
  useEffect(() => {
    if (!map.current || !mapLoaded || !styleLoaded) return;

    const m = map.current;

    // 既存のルートレイヤーを削除
    ['recommended-route', 'fastest-route'].forEach((id) => {
      if (m.getLayer(id)) m.removeLayer(id);
      if (m.getSource(id)) m.removeSource(id);
    });

    routes.forEach((route) => {
      const sourceId = `${route.type}-route`;
      const isSelected = route.type === selectedRouteType;

      m.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geometry,
        },
      });

      m.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          // 安全ルート: 紫、最短ルート: オレンジ（安全スコアの色と区別）
          'line-color': route.type === 'recommended' ? '#8b5cf6' : '#f97316',
          'line-width': isSelected ? 8 : 5,
          'line-opacity': isSelected ? 0.9 : 0.6,
        },
      });
    });
  }, [routes, selectedRouteType, mapLoaded, styleLoaded]);

  // POIマーカーの表示
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // 既存のマーカーを削除
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // フィルタされたPOIを表示
    const filteredPOIs = pois.filter((poi) => visiblePoiTypes.includes(poi.type));

    filteredPOIs.forEach((poi) => {
      const iconConfig = POI_ICONS[poi.type] || { icon: '📍', color: '#6b7280' };

      const el = document.createElement('div');
      el.className = 'poi-marker';
      el.innerHTML = iconConfig.icon;
      el.style.fontSize = '24px';
      el.style.cursor = 'pointer';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([poi.lon, poi.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div class="p-2">
              <strong>${poi.name}</strong>
              ${poi.is_24h ? '<br><span class="text-green-600 text-sm">24時間営業</span>' : ''}
            </div>
          `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [pois, visiblePoiTypes, mapLoaded]);

  // 防犯カメラマーカーの表示
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // 既存のカメラマーカーを削除
    cameraMarkersRef.current.forEach((marker) => marker.remove());
    cameraMarkersRef.current = [];

    if (!showCameras || cameras.length === 0) return;

    cameras.forEach((camera) => {
      const el = document.createElement('div');
      el.className = 'camera-marker';
      el.innerHTML = '📹';
      el.style.fontSize = '20px';
      el.style.cursor = 'pointer';
      el.style.filter = 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([camera.lon, camera.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div class="p-2">
              <strong>防犯カメラ</strong>
              <br><span class="text-gray-600 text-sm">有効範囲: ${camera.effectiveRadius}m</span>
            </div>
          `)
        )
        .addTo(map.current!);

      cameraMarkersRef.current.push(marker);
    });
  }, [cameras, showCameras, mapLoaded]);

  // 現在地マーカー
  useEffect(() => {
    if (!map.current || !mapLoaded || !currentLocation) return;

    const el = document.createElement('div');
    el.className = 'current-location-marker';
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.backgroundColor = '#3b82f6';
    el.style.borderRadius = '50%';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([currentLocation.lng, currentLocation.lat])
      .addTo(map.current);

    return () => {
      marker.remove();
    };
  }, [currentLocation, mapLoaded]);

  // 目的地マーカー
  useEffect(() => {
    if (!map.current || !mapLoaded || !destination) return;

    const marker = new maplibregl.Marker({ color: '#ef4444' })
      .setLngLat([destination.lng, destination.lat])
      .addTo(map.current);

    // 目的地にフォーカス
    map.current.flyTo({
      center: [destination.lng, destination.lat],
      zoom: 15,
    });

    return () => {
      marker.remove();
    };
  }, [destination, mapLoaded]);

  // クリックで目的地を設定
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      useMapStore.getState().setDestination({ lat, lng }, '選択した地点');
    };

    map.current.on('click', handleClick);

    return () => {
      map.current?.off('click', handleClick);
    };
  }, [mapLoaded]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ minHeight: '100vh' }}
    />
  );
}
