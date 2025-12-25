import { Location, Route, POI, RoadSegment } from '@/types';

// 2点間の距離を計算（メートル）
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // 地球の半径（メートル）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ノードのキーを生成（座標を丸めて同じ位置のノードをまとめる）
function nodeKey(lon: number, lat: number): string {
  // 約10mの精度で丸める
  const precision = 4;
  return `${lon.toFixed(precision)},${lat.toFixed(precision)}`;
}

// グラフのエッジ
interface Edge {
  to: string;
  distance: number;
  safetyScore: number;
  coordinates: [number, number][];
}

// グラフを構築
function buildGraph(roads: RoadSegment[]): Map<string, Edge[]> {
  const graph = new Map<string, Edge[]>();

  for (const road of roads) {
    const coords = road.coordinates;
    if (coords.length < 2) continue;

    // 道路の各セグメントをエッジとして追加
    for (let i = 0; i < coords.length - 1; i++) {
      const from = coords[i];
      const to = coords[i + 1];
      const fromKey = nodeKey(from[0], from[1]);
      const toKey = nodeKey(to[0], to[1]);

      const distance = haversineDistance(from[1], from[0], to[1], to[0]);
      const safetyScore = road.safetyScore ?? 70;

      // 双方向エッジ
      if (!graph.has(fromKey)) graph.set(fromKey, []);
      if (!graph.has(toKey)) graph.set(toKey, []);

      graph.get(fromKey)!.push({
        to: toKey,
        distance,
        safetyScore,
        coordinates: [from, to],
      });

      graph.get(toKey)!.push({
        to: fromKey,
        distance,
        safetyScore,
        coordinates: [to, from],
      });
    }
  }

  return graph;
}

// 優先度付きキュー（最小ヒープ）
class PriorityQueue<T> {
  private heap: { priority: number; value: T }[] = [];

  push(value: T, priority: number): void {
    this.heap.push({ priority, value });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const result = this.heap[0].value;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return result;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].priority <= this.heap[index].priority) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }

      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

// グラフ内で最も近いノードを見つける
function findNearestNode(
  graph: Map<string, Edge[]>,
  lon: number,
  lat: number
): { key: string; distance: number } | null {
  let nearest: { key: string; distance: number } | null = null;

  const keys = Array.from(graph.keys());
  for (const key of keys) {
    const [nodeLon, nodeLat] = key.split(',').map(Number);
    const dist = haversineDistance(lat, lon, nodeLat, nodeLon);

    if (!nearest || dist < nearest.distance) {
      nearest = { key, distance: dist };
    }
  }

  return nearest;
}

// ダイクストラ法で最短経路を探索
// mode: 'distance' = 距離最小化, 'safety' = 安全スコア最大化（コスト反転）
function dijkstra(
  graph: Map<string, Edge[]>,
  startKey: string,
  endKey: string,
  mode: 'distance' | 'safety'
): { path: string[]; edges: Edge[]; totalDistance: number; totalSafetyScore: number } | null {
  const distances = new Map<string, number>();
  const previous = new Map<string, { node: string; edge: Edge } | null>();
  const pq = new PriorityQueue<string>();

  distances.set(startKey, 0);
  previous.set(startKey, null);
  pq.push(startKey, 0);

  while (!pq.isEmpty()) {
    const current = pq.pop()!;

    if (current === endKey) {
      // 経路を復元
      const path: string[] = [];
      const edges: Edge[] = [];
      let node: string | undefined = endKey;

      while (node) {
        path.unshift(node);
        const prev = previous.get(node);
        if (prev) {
          edges.unshift(prev.edge);
          node = prev.node;
        } else {
          node = undefined;
        }
      }

      // 総距離と平均安全スコアを計算
      const totalDistance = edges.reduce((sum, e) => sum + e.distance, 0);
      const totalSafetyScore = edges.length > 0
        ? edges.reduce((sum, e) => sum + e.safetyScore, 0) / edges.length
        : 70;

      return { path, edges, totalDistance, totalSafetyScore };
    }

    const currentDist = distances.get(current);
    if (currentDist === undefined) continue;

    const neighbors = graph.get(current) || [];

    for (const edge of neighbors) {
      let cost: number;

      if (mode === 'distance') {
        // 距離最小化：距離をそのままコストに
        cost = edge.distance;
      } else {
        // 安全スコア最大化：(100 - safetyScore) をコストに
        // 安全スコアが高いほどコストが低い
        // 距離も考慮して、短くて安全な道を選ぶ
        const safetyCost = (100 - edge.safetyScore) * 10; // 安全スコアの重み
        cost = edge.distance + safetyCost;
      }

      const newDist = currentDist + cost;
      const existingDist = distances.get(edge.to);

      if (existingDist === undefined || newDist < existingDist) {
        distances.set(edge.to, newDist);
        previous.set(edge.to, { node: current, edge });
        pq.push(edge.to, newDist);
      }
    }
  }

  return null; // 経路が見つからない
}

// エッジリストから座標配列を生成
function edgesToCoordinates(edges: Edge[]): [number, number][] {
  if (edges.length === 0) return [];

  const coords: [number, number][] = [];
  for (const edge of edges) {
    if (coords.length === 0) {
      coords.push(edge.coordinates[0]);
    }
    coords.push(edge.coordinates[1]);
  }

  return coords;
}

// ルート計算のメイン関数
export async function calculateRoutes(
  origin: Location,
  destination: Location,
  roads: RoadSegment[],
  pois: POI[]
): Promise<Route[]> {
  const routes: Route[] = [];

  // グラフを構築
  const graph = buildGraph(roads);

  if (graph.size === 0) {
    console.warn('No roads available for routing');
    return routes;
  }

  // 始点と終点に最も近いノードを見つける
  const startNode = findNearestNode(graph, origin.lng, origin.lat);
  const endNode = findNearestNode(graph, destination.lng, destination.lat);

  if (!startNode || !endNode) {
    console.warn('Could not find nearest nodes');
    return routes;
  }

  // 始点/終点からノードまでが遠すぎる場合は警告
  if (startNode.distance > 500 || endNode.distance > 500) {
    console.warn('Start or end point is far from road network');
  }

  // 周辺POIを取得
  const nearbyPOIs = pois.filter((poi) => {
    const dist = haversineDistance(
      (origin.lat + destination.lat) / 2,
      (origin.lng + destination.lng) / 2,
      poi.lat,
      poi.lon
    );
    return dist < 500;
  }).slice(0, 5);

  // 最短ルート（距離最小化）
  const shortestPath = dijkstra(graph, startNode.key, endNode.key, 'distance');

  if (shortestPath) {
    const coordinates = edgesToCoordinates(shortestPath.edges);
    // 始点と終点を追加
    coordinates.unshift([origin.lng, origin.lat]);
    coordinates.push([destination.lng, destination.lat]);

    const durationMinutes = Math.round(shortestPath.totalDistance / 1000 / 4 * 60); // 4km/h

    routes.push({
      type: 'fastest',
      name: '最短ルート',
      geometry: {
        type: 'LineString',
        coordinates,
      },
      duration_minutes: durationMinutes,
      distance_meters: Math.round(shortestPath.totalDistance),
      safety_score: Math.round(shortestPath.totalSafetyScore),
      segments: [],
      nearby_pois: nearbyPOIs,
    });
  }

  // 安全ルート（安全スコア最大化）
  const safePath = dijkstra(graph, startNode.key, endNode.key, 'safety');

  if (safePath) {
    const coordinates = edgesToCoordinates(safePath.edges);
    // 始点と終点を追加
    coordinates.unshift([origin.lng, origin.lat]);
    coordinates.push([destination.lng, destination.lat]);

    const durationMinutes = Math.round(safePath.totalDistance / 1000 / 4 * 60); // 4km/h

    routes.push({
      type: 'recommended',
      name: '安全優先ルート',
      geometry: {
        type: 'LineString',
        coordinates,
      },
      duration_minutes: durationMinutes,
      distance_meters: Math.round(safePath.totalDistance),
      safety_score: Math.round(safePath.totalSafetyScore),
      segments: [],
      nearby_pois: nearbyPOIs,
    });
  }

  return routes;
}

// 2点間の距離をエクスポート
export { haversineDistance };
