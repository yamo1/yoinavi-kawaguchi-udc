export interface POI {
  id: string;
  type: 'convenience_store' | 'toilet' | 'koban' | 'station' | 'taxi_stand' | 'park';
  name: string;
  lat: number;
  lon: number;
  is_24h?: boolean;
  distance_meters?: number;
}

export interface CrimeData {
  town: string;
  totalCrime: number;
  violentCrime: number;
  theftTotal: number;
}

export interface RoadSegment {
  id: string;
  type: string;
  name: string;
  coordinates: [number, number][];
  safetyScore?: number;
}

export interface RouteSegment {
  from: [number, number];
  to: [number, number];
  safetyScore: number;
  instruction?: string;
}

export interface Route {
  type: 'recommended' | 'fastest';
  name: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  duration_minutes: number;
  distance_meters: number;
  safety_score: number;
  segments: RouteSegment[];
  nearby_pois: POI[];
}

export interface Location {
  lat: number;
  lng: number;
}

export interface SearchResult {
  name: string;
  address?: string;
  location: Location;
}
