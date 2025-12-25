'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/UI/Header';
import SearchBox from '@/components/Search/SearchBox';
import RoutePanel from '@/components/RouteInfo/RoutePanel';
import ControlPanel from '@/components/UI/ControlPanel';
import TimeSimulator from '@/components/UI/TimeSimulator';
import View3DControls from '@/components/UI/View3DControls';
import { useMapStore, Building } from '@/stores/mapStore';
import { calculateRoutes } from '@/lib/routing';
import {
  calculateRoadSafetyScores,
  CrimePoint,
  CameraPoint,
  LandUseArea,
} from '@/lib/safety-score';
import { POI, RoadSegment } from '@/types';
import { Loader2, Menu, X } from 'lucide-react';

// MapViewを動的インポート（SSR無効化）
const MapView = dynamic(() => import('@/components/Map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
    </div>
  ),
});

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [rawRoads, setRawRoads] = useState<RoadSegment[]>([]);

  const {
    setPois,
    setCrimes,
    setCameras,
    setLandUseAreas,
    setRoads,
    setBuildings,
    setRoutes,
    currentLocation,
    destination,
    roads,
    pois,
    crimes,
    cameras,
    buildings,
    landUseAreas,
    setIsLoading,
    simulatedHour,
  } = useMapStore();

  // データ読み込み
  useEffect(() => {
    async function loadData() {
      try {
        // POIデータ
        const poisRes = await fetch('/data/pois.json');
        const poisData: POI[] = await poisRes.json();
        setPois(poisData);

        // 犯罪データ（改良版）
        const crimesRes = await fetch('/data/crimes.json');
        const crimesData: CrimePoint[] = await crimesRes.json();
        setCrimes(crimesData);
        console.log(`Loaded ${crimesData.length} crime records`);

        // 防犯カメラデータ
        try {
          const camerasRes = await fetch('/data/cameras.json');
          const camerasData: CameraPoint[] = await camerasRes.json();
          setCameras(camerasData);
          console.log(`Loaded ${camerasData.length} cameras`);
        } catch (e) {
          console.log('Camera data not available:', e);
          setCameras([]);
        }

        // 土地利用データ
        try {
          const landUseRes = await fetch('/data/landuse.json');
          const landUseGeoJSON = await landUseRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const landUseData: LandUseArea[] = landUseGeoJSON.features.map((f: any) => ({
            id: f.properties.id,
            code: f.properties.code,
            name: f.properties.name,
            safetyScore: f.properties.safetyScore,
            polygon: f.geometry.coordinates[0],
            center: [
              f.geometry.coordinates[0].reduce((s: number, c: number[]) => s + c[0], 0) / f.geometry.coordinates[0].length,
              f.geometry.coordinates[0].reduce((s: number, c: number[]) => s + c[1], 0) / f.geometry.coordinates[0].length,
            ],
          }));
          setLandUseAreas(landUseData);
          console.log(`Loaded ${landUseData.length} land use areas`);
        } catch (e) {
          console.log('Land use data not available:', e);
          setLandUseAreas([]);
        }

        // 道路データ
        const roadsRes = await fetch('/data/roads.json');
        const roadsGeoJSON = await roadsRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const roadSegments: RoadSegment[] = roadsGeoJSON.features.map((f: any) => ({
          id: f.properties.id,
          type: f.properties.highway,
          name: f.properties.name || '',
          coordinates: f.geometry.coordinates,
        }));

        setRawRoads(roadSegments);

        // 建物データ
        let buildingsData: Building[] = [];
        try {
          const buildingsRes = await fetch('/data/buildings.json');
          const buildingsGeoJSON = await buildingsRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          buildingsData = buildingsGeoJSON.features.map((f: any) => ({
            id: f.properties.id,
            polygon: f.geometry.coordinates[0],
            height: f.properties.height,
            storeys: f.properties.storeys,
            usage: f.properties.usage,
            usageCode: f.properties.usageCode,
          }));
          setBuildings(buildingsData);
          console.log(`Loaded ${buildingsData.length} buildings`);
        } catch (e) {
          console.log('Building data not available:', e);
          setBuildings([]);
        }

        // 安全スコアを計算（全データ読み込み後）
        // 初回は空配列でも動くように
        const scoredRoads = calculateRoadSafetyScores(
          roadSegments,
          crimesData,
          [], // cameras - will be updated
          buildingsData,
          [], // landUse - will be updated
          simulatedHour
        );
        setRoads(scoredRoads);

        setDataLoaded(true);
      } catch (error) {
        console.error('Data loading error:', error);
      }
    }

    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPois, setCrimes, setCameras, setLandUseAreas, setRoads, setBuildings]);

  // 時間帯変更時または関連データ読み込み後に安全スコアを再計算
  useEffect(() => {
    if (!dataLoaded || rawRoads.length === 0) return;

    const scoredRoads = calculateRoadSafetyScores(
      rawRoads,
      crimes,
      cameras,
      buildings,
      landUseAreas,
      simulatedHour
    );
    setRoads(scoredRoads);
  }, [simulatedHour, dataLoaded, rawRoads, crimes, cameras, buildings, landUseAreas, setRoads]);

  // ルート計算
  useEffect(() => {
    async function calcRoutes() {
      if (!currentLocation || !destination || !dataLoaded) return;

      setIsLoading(true);
      try {
        const calculatedRoutes = await calculateRoutes(
          currentLocation,
          destination,
          roads,
          pois
        );
        setRoutes(calculatedRoutes);
      } catch (error) {
        console.error('Route calculation error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    calcRoutes();
  }, [currentLocation, destination, dataLoaded, roads, pois, setRoutes, setIsLoading]);

  return (
    <div className="h-screen flex flex-col">
      <Header />

      <div className="flex-1 relative overflow-hidden">
        {/* 地図 */}
        <div className="absolute inset-0">
          <MapView />
        </div>

        {/* サイドバートグルボタン（モバイル） */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-20 lg:hidden bg-white p-2 rounded-lg shadow-lg"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* サイドバー */}
        <div
          className={`absolute top-0 left-0 h-full w-80 bg-gray-50 shadow-xl z-10 transform transition-transform duration-300 overflow-y-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <div className="p-4 space-y-4 pt-16 lg:pt-4">
            <SearchBox />
            <RoutePanel />
            <TimeSimulator />
            <View3DControls />
            <ControlPanel />

            {/* 使い方 */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-bold text-gray-800 mb-2">使い方</h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>「現在地を取得」または地図上をクリック</li>
                <li>目的地を検索または地図上でクリック</li>
                <li>安全ルートと最短ルートを比較</li>
                <li>周辺のコンビニ・交番をチェック</li>
                <li>時間帯を変更して安全度を確認</li>
              </ol>
            </div>

            {/* データソース */}
            <div className="bg-gray-100 rounded-lg p-3 text-xs text-gray-500">
              <p className="font-medium mb-1">データソース</p>
              <ul className="space-y-0.5">
                <li>・犯罪データ: 埼玉県警 川口市</li>
                <li>・防犯カメラ: 川口市</li>
                <li>・道路データ: OpenStreetMap</li>
                <li>・建物/土地利用: PLATEAU 川口市 2024</li>
                <li>・地図: CARTO / OpenStreetMap</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
