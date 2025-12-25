/**
 * 安全スコア計算モジュール（改良版）
 *
 * 4要素モデル:
 * - 犯罪リスク (Crime): カーネル密度推定による犯罪発生リスク
 * - カメラ被覆 (Camera): 防犯カメラの抑止効果
 * - 影/見通し (Shadow): 建物による死角・暗さ
 * - 土地利用 (LandUse): 周辺の土地利用による人通り推定
 */

import { RoadSegment } from '@/types';
import { Building } from '@/stores/mapStore';

// ========== 型定義 ==========

export interface CrimePoint {
  id: string;
  type: string;
  weight: number;
  lat: number;
  lon: number;
}

export interface CameraPoint {
  id: string;
  lat: number;
  lon: number;
  effectiveRadius: number;  // 最大有効距離(m)
  decayConstant: number;    // 減衰定数σ(m)
}

export interface LandUseArea {
  id: string;
  code: string;
  name: string;
  safetyScore: number;
  polygon: [number, number][];
  center: [number, number];
}

export interface SafetyScoreBreakdown {
  total: number;
  crime: number;
  camera: number;
  shadow: number;
  landUse: number;
}

// ========== 定数 ==========

// 重み係数
const WEIGHTS = {
  crime: 0.50,    // α: 犯罪リスクの重み
  shadow: 0.20,   // γ: 影/見通しの重み
  landUse: 0.30,  // δ: 土地利用の重み
};

// カメラによる犯罪リスク軽減率（最大50%軽減）
const CAMERA_CRIME_REDUCTION_MAX = 0.5;

// カーネル密度推定のバンド幅(m)
const CRIME_BANDWIDTH = 150;

// カメラパラメータ
const CAMERA_MAX_RADIUS = 80;    // R: 最大有効距離(m)
const CAMERA_DECAY_SIGMA = 30;   // σ: 減衰定数(m)

// 建物影響パラメータ
const BUILDING_MAX_DISTANCE = 50; // 建物影響の最大距離(m)

// 正規化用の分位点
const QUANTILE_LOW = 0.05;
const QUANTILE_HIGH = 0.95;

// ========== ユーティリティ関数 ==========

/**
 * 2点間の距離を計算（ハーバーサイン公式、メートル単位）
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // 地球の半径（メートル）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 分位点正規化（外れ値に強い）
 */
function quantileNormalize(
  values: number[],
  qLow: number = QUANTILE_LOW,
  qHigh: number = QUANTILE_HIGH
): { normalize: (x: number) => number; q05: number; q95: number } {
  if (values.length === 0) {
    return { normalize: () => 0.5, q05: 0, q95: 1 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const lowIdx = Math.floor(sorted.length * qLow);
  const highIdx = Math.floor(sorted.length * qHigh);
  const q05 = sorted[lowIdx] || sorted[0];
  const q95 = sorted[highIdx] || sorted[sorted.length - 1];

  const range = q95 - q05;
  if (range === 0) {
    return { normalize: () => 0.5, q05, q95 };
  }

  return {
    normalize: (x: number) => Math.max(0, Math.min(1, (x - q05) / range)),
    q05,
    q95,
  };
}

/**
 * 点がポリゴン内にあるかチェック（レイキャスティング法）
 */
function pointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

// ========== 指標計算関数 ==========

/**
 * 犯罪リスク指標を計算（カーネル密度推定）
 * 高いほど危険
 */
export function calculateCrimeIndex(
  evalLat: number,
  evalLon: number,
  crimes: CrimePoint[],
  bandwidth: number = CRIME_BANDWIDTH
): number {
  let crimeIndex = 0;

  for (const crime of crimes) {
    const distance = haversineDistance(evalLat, evalLon, crime.lat, crime.lon);

    // ガウシアンカーネル
    const kernel = Math.exp(-(distance * distance) / (2 * bandwidth * bandwidth));
    crimeIndex += crime.weight * kernel;
  }

  return crimeIndex;
}

/**
 * カメラ被覆指標を計算
 * 高いほど安全
 */
export function calculateCameraIndex(
  evalLat: number,
  evalLon: number,
  cameras: CameraPoint[],
  maxRadius: number = CAMERA_MAX_RADIUS,
  sigma: number = CAMERA_DECAY_SIGMA
): number {
  let cameraIndex = 0;

  for (const camera of cameras) {
    const distance = haversineDistance(evalLat, evalLon, camera.lat, camera.lon);

    // 最大有効距離内のみ
    if (distance <= maxRadius) {
      // 指数減衰
      cameraIndex += Math.exp(-distance / sigma);
    }
  }

  return cameraIndex;
}

/**
 * 影/見通し指標を計算（建物による死角）
 * 高いほど危険（見通しが悪い）
 */
export function calculateShadowIndex(
  evalLat: number,
  evalLon: number,
  buildings: Building[],
  maxDistance: number = BUILDING_MAX_DISTANCE
): number {
  let shadowIndex = 0;

  for (const building of buildings) {
    if (!building.polygon || building.polygon.length === 0) continue;

    // 建物中心座標を計算
    const centerLon = building.polygon.reduce((sum, p) => sum + p[0], 0) / building.polygon.length;
    const centerLat = building.polygon.reduce((sum, p) => sum + p[1], 0) / building.polygon.length;

    const distance = haversineDistance(evalLat, evalLon, centerLat, centerLon);

    if (distance <= maxDistance) {
      // 建物の高さと面積に基づく影響
      const height = building.height || 5;
      const distanceFactor = 1 - (distance / maxDistance);

      // 高い建物ほど影響大
      shadowIndex += (height / 30) * distanceFactor;
    }
  }

  return shadowIndex;
}

/**
 * 土地利用指標を計算
 * 高いほど安全
 */
export function calculateLandUseIndex(
  evalLon: number,
  evalLat: number,
  landUseAreas: LandUseArea[]
): number {
  // 評価点が含まれる土地利用を探す
  for (const area of landUseAreas) {
    if (pointInPolygon([evalLon, evalLat], area.polygon)) {
      return area.safetyScore;
    }
  }

  // 見つからない場合はデフォルト値
  return 0.5;
}

// ========== 時間帯補正 ==========

/**
 * 時間帯による補正係数を取得
 */
export function getTimeMultiplier(hour: number): {
  overall: number;
  shadowMultiplier: number;
  cameraMultiplier: number;
} {
  if (hour >= 0 && hour < 6) {
    // 深夜
    return { overall: 0.5, shadowMultiplier: 3.0, cameraMultiplier: 2.0 };
  } else if (hour >= 6 && hour < 18) {
    // 日中
    return { overall: 1.0, shadowMultiplier: 0.3, cameraMultiplier: 1.0 };
  } else if (hour >= 18 && hour < 20) {
    // 夕方
    return { overall: 0.9, shadowMultiplier: 1.5, cameraMultiplier: 1.0 };
  } else if (hour >= 20 && hour < 22) {
    // 夜
    return { overall: 0.8, shadowMultiplier: 2.0, cameraMultiplier: 1.2 };
  } else {
    // 22-24時
    return { overall: 0.7, shadowMultiplier: 2.5, cameraMultiplier: 1.5 };
  }
}

/**
 * 時間帯の説明を取得
 */
export function getTimeDescription(hour: number): string {
  if (hour >= 0 && hour < 5) {
    return '深夜（非常に暗い）';
  } else if (hour >= 5 && hour < 7) {
    return '早朝（やや暗い）';
  } else if (hour >= 7 && hour < 10) {
    return '朝（通勤時間帯）';
  } else if (hour >= 10 && hour < 17) {
    return '日中（明るい）';
  } else if (hour >= 17 && hour < 19) {
    return '夕方（薄暗い）';
  } else if (hour >= 19 && hour < 22) {
    return '夜（暗い）';
  } else {
    return '深夜前（かなり暗い）';
  }
}

// ========== メイン計算関数 ==========

/**
 * 道路セグメントの安全スコアを一括計算
 */
export function calculateRoadSafetyScores(
  roads: RoadSegment[],
  crimes: CrimePoint[],
  cameras: CameraPoint[],
  buildings: Building[],
  landUseAreas: LandUseArea[],
  simulatedHour?: number | null
): RoadSegment[] {
  if (roads.length === 0) return roads;

  const hour = simulatedHour ?? new Date().getHours();
  const timeMultiplier = getTimeMultiplier(hour);

  // 各道路の生スコアを計算
  const rawScores = roads.map(road => {
    // 道路の中心座標を取得
    const midIdx = Math.floor(road.coordinates.length / 2);
    const [centerLon, centerLat] = road.coordinates[midIdx] || road.coordinates[0];

    // 近隣の建物をフィルタ（パフォーマンス最適化）
    const nearbyBuildings = buildings.filter(b => {
      if (!b.polygon || b.polygon.length === 0) return false;
      const bCenterLon = b.polygon.reduce((sum, p) => sum + p[0], 0) / b.polygon.length;
      const bCenterLat = b.polygon.reduce((sum, p) => sum + p[1], 0) / b.polygon.length;
      return Math.abs(bCenterLon - centerLon) < 0.001 &&
             Math.abs(bCenterLat - centerLat) < 0.001;
    });

    // 各指標を計算
    const crimeRaw = calculateCrimeIndex(centerLat, centerLon, crimes);
    const cameraRaw = calculateCameraIndex(centerLat, centerLon, cameras);
    const shadowRaw = calculateShadowIndex(centerLat, centerLon, nearbyBuildings);
    const landUseRaw = calculateLandUseIndex(centerLon, centerLat, landUseAreas);

    return {
      road,
      centerLat,
      centerLon,
      crimeRaw,
      cameraRaw: cameraRaw * timeMultiplier.cameraMultiplier,
      shadowRaw: shadowRaw * timeMultiplier.shadowMultiplier,
      landUseRaw,
    };
  });

  // 分位点正規化用のデータを収集
  const crimeValues = rawScores.map(s => s.crimeRaw);
  const cameraValues = rawScores.map(s => s.cameraRaw);
  const shadowValues = rawScores.map(s => s.shadowRaw);

  const crimeNormalizer = quantileNormalize(crimeValues);
  const cameraNormalizer = quantileNormalize(cameraValues);
  const shadowNormalizer = quantileNormalize(shadowValues);

  // 正規化して最終スコアを計算
  return rawScores.map(({ road, crimeRaw, cameraRaw, shadowRaw, landUseRaw }) => {
    const crimeNorm = crimeNormalizer.normalize(crimeRaw);
    const cameraNorm = cameraNormalizer.normalize(cameraRaw);
    const shadowNorm = shadowNormalizer.normalize(shadowRaw);
    const landUseNorm = landUseRaw; // 既に0-1

    // カメラによる犯罪リスク軽減（カメラがあるほど犯罪リスクを低減）
    // cameraNorm=1 → 犯罪リスク50%軽減, cameraNorm=0 → 軽減なし
    const cameraProtection = cameraNorm * CAMERA_CRIME_REDUCTION_MAX;
    const effectiveCrimeRisk = crimeNorm * (1 - cameraProtection);

    // 安全スコア計算（新モデル）
    // - 犯罪リスク: カメラで軽減された後の値を使用
    // - 影/見通し: 低いほど安全
    // - 土地利用: 高いほど安全
    const safetyScore = 100 * (
      WEIGHTS.crime * (1 - effectiveCrimeRisk) +
      WEIGHTS.shadow * (1 - shadowNorm) +
      WEIGHTS.landUse * landUseNorm
    );

    // 時間帯補正を適用
    const adjustedScore = safetyScore * timeMultiplier.overall;

    // 50-100の範囲にマッピング
    const finalScore = 50 + (adjustedScore / 100) * 50;

    return {
      ...road,
      safetyScore: Math.round(Math.max(50, Math.min(100, finalScore))),
    };
  });
}

/**
 * 単一地点の安全スコアを詳細に計算（デバッグ/表示用）
 */
export function calculatePointSafetyScore(
  lat: number,
  lon: number,
  crimes: CrimePoint[],
  cameras: CameraPoint[],
  buildings: Building[],
  landUseAreas: LandUseArea[],
  simulatedHour?: number | null
): SafetyScoreBreakdown {
  const hour = simulatedHour ?? new Date().getHours();
  const timeMultiplier = getTimeMultiplier(hour);

  // 近隣の建物をフィルタ
  const nearbyBuildings = buildings.filter(b => {
    if (!b.polygon || b.polygon.length === 0) return false;
    const bCenterLon = b.polygon.reduce((sum, p) => sum + p[0], 0) / b.polygon.length;
    const bCenterLat = b.polygon.reduce((sum, p) => sum + p[1], 0) / b.polygon.length;
    return Math.abs(bCenterLon - lon) < 0.001 &&
           Math.abs(bCenterLat - lat) < 0.001;
  });

  const crimeRaw = calculateCrimeIndex(lat, lon, crimes);
  const cameraRaw = calculateCameraIndex(lat, lon, cameras) * timeMultiplier.cameraMultiplier;
  const shadowRaw = calculateShadowIndex(lat, lon, nearbyBuildings) * timeMultiplier.shadowMultiplier;
  const landUseRaw = calculateLandUseIndex(lon, lat, landUseAreas);

  // 簡易正規化（単一点の場合）
  const crimeNorm = Math.min(1, crimeRaw / 10);
  const cameraNorm = Math.min(1, cameraRaw / 3);
  const shadowNorm = Math.min(1, shadowRaw / 5);
  const landUseNorm = landUseRaw;

  // カメラによる犯罪リスク軽減
  const cameraProtection = cameraNorm * CAMERA_CRIME_REDUCTION_MAX;
  const effectiveCrimeRisk = crimeNorm * (1 - cameraProtection);

  const crimeScore = 100 * (1 - effectiveCrimeRisk);
  const cameraScore = 100 * cameraNorm;  // 表示用
  const shadowScore = 100 * (1 - shadowNorm);
  const landUseScore = 100 * landUseNorm;

  const total = (
    WEIGHTS.crime * (1 - effectiveCrimeRisk) +
    WEIGHTS.shadow * (1 - shadowNorm) +
    WEIGHTS.landUse * landUseNorm
  ) * 100 * timeMultiplier.overall;

  return {
    total: Math.round(Math.max(0, Math.min(100, total))),
    crime: Math.round(crimeScore),
    camera: Math.round(cameraScore),
    shadow: Math.round(shadowScore),
    landUse: Math.round(landUseScore),
  };
}

// ========== UI用ユーティリティ ==========

/**
 * 安全スコアを色に変換
 */
export function getScoreColor(score: number): string {
  if (score >= 90) {
    return '#22c55e'; // 緑（安全）
  } else if (score >= 80) {
    return '#84cc16'; // 黄緑（やや安全）
  } else if (score >= 70) {
    return '#eab308'; // 黄（注意）
  } else if (score >= 60) {
    return '#f97316'; // オレンジ（要注意）
  } else {
    return '#ef4444'; // 赤（危険）
  }
}

/**
 * 安全スコアのラベルを取得
 */
export function getScoreLabel(score: number): string {
  if (score >= 90) {
    return '安全';
  } else if (score >= 80) {
    return 'やや安全';
  } else if (score >= 70) {
    return '注意';
  } else if (score >= 60) {
    return '要注意';
  } else {
    return '危険';
  }
}

// 後方互換性のためのエクスポート
export { haversineDistance };
