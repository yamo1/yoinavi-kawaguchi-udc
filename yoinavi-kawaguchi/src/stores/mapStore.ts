import { create } from 'zustand';
import { POI, Route, Location, RoadSegment } from '@/types';
import { CrimePoint, CameraPoint, LandUseArea } from '@/lib/safety-score';

export interface Building {
  id: string;
  polygon: [number, number][];
  height: number;
  storeys: number;
  usage: string;
  usageCode: string;
}

interface MapState {
  // 現在地
  currentLocation: Location | null;
  setCurrentLocation: (location: Location | null) => void;

  // 目的地
  destination: Location | null;
  destinationName: string;
  setDestination: (location: Location | null, name?: string) => void;

  // ルート
  routes: Route[];
  setRoutes: (routes: Route[]) => void;
  selectedRouteType: 'recommended' | 'fastest';
  setSelectedRouteType: (type: 'recommended' | 'fastest') => void;

  // POI
  pois: POI[];
  setPois: (pois: POI[]) => void;
  visiblePoiTypes: string[];
  togglePoiType: (type: string) => void;

  // 犯罪データ（改良版）
  crimes: CrimePoint[];
  setCrimes: (crimes: CrimePoint[]) => void;

  // 防犯カメラデータ
  cameras: CameraPoint[];
  setCameras: (cameras: CameraPoint[]) => void;

  // 土地利用データ
  landUseAreas: LandUseArea[];
  setLandUseAreas: (areas: LandUseArea[]) => void;

  // 道路データ
  roads: RoadSegment[];
  setRoads: (roads: RoadSegment[]) => void;

  // 建物データ（PLATEAU）
  buildings: Building[];
  setBuildings: (buildings: Building[]) => void;

  // UI状態
  isNightMode: boolean;
  toggleNightMode: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  showSafetyLayer: boolean;
  toggleSafetyLayer: () => void;
  showCameras: boolean;
  toggleCameras: () => void;

  // 3D表示
  is3DMode: boolean;
  toggle3DMode: () => void;
  showBuildings: boolean;
  toggleBuildings: () => void;

  // 時間帯シミュレーション
  simulatedHour: number | null; // nullは現在時刻
  setSimulatedHour: (hour: number | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  // 現在地
  currentLocation: null,
  setCurrentLocation: (location) => set({ currentLocation: location }),

  // 目的地
  destination: null,
  destinationName: '',
  setDestination: (location, name = '') => set({ destination: location, destinationName: name }),

  // ルート
  routes: [],
  setRoutes: (routes) => set({ routes }),
  selectedRouteType: 'recommended',
  setSelectedRouteType: (type) => set({ selectedRouteType: type }),

  // POI
  pois: [],
  setPois: (pois) => set({ pois }),
  visiblePoiTypes: ['convenience_store', 'toilet', 'koban', 'station'],
  togglePoiType: (type) =>
    set((state) => ({
      visiblePoiTypes: state.visiblePoiTypes.includes(type)
        ? state.visiblePoiTypes.filter((t) => t !== type)
        : [...state.visiblePoiTypes, type],
    })),

  // 犯罪データ（改良版）
  crimes: [],
  setCrimes: (crimes) => set({ crimes }),

  // 防犯カメラデータ
  cameras: [],
  setCameras: (cameras) => set({ cameras }),

  // 土地利用データ
  landUseAreas: [],
  setLandUseAreas: (areas) => set({ landUseAreas: areas }),

  // 道路データ
  roads: [],
  setRoads: (roads) => set({ roads }),

  // 建物データ
  buildings: [],
  setBuildings: (buildings) => set({ buildings }),

  // UI状態
  isNightMode: false,
  toggleNightMode: () => set((state) => ({ isNightMode: !state.isNightMode })),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  showSafetyLayer: true,
  toggleSafetyLayer: () => set((state) => ({ showSafetyLayer: !state.showSafetyLayer })),
  showCameras: true,
  toggleCameras: () => set((state) => ({ showCameras: !state.showCameras })),

  // 3D表示
  is3DMode: true,
  toggle3DMode: () => set((state) => ({ is3DMode: !state.is3DMode })),
  showBuildings: true,
  toggleBuildings: () => set((state) => ({ showBuildings: !state.showBuildings })),

  // 時間帯シミュレーション
  simulatedHour: null,
  setSimulatedHour: (hour) => set({ simulatedHour: hour }),
}));
