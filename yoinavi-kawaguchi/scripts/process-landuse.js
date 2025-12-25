const fs = require('fs');
const path = require('path');

const LANDUSE_DIR = path.join(__dirname, '../../data/kawaguchi/11203_kawaguchi-shi_pref_2024_citygml_1_op/udx/luse');
const PUBLIC_DIR = path.join(__dirname, '../public/data');

// 川口市南部のバウンディングボックス
const BOUNDS = {
  minLat: 35.7909,
  maxLat: 35.8235,
  minLon: 139.6915,
  maxLon: 139.7617
};

// 土地利用コードのマッピング（PLATEAUコードリストより）
const LANDUSE_CODES = {
  '201': { name: '田（水田）', safetyScore: 0.2 },
  '202': { name: '畑', safetyScore: 0.2 },
  '203': { name: '山林', safetyScore: 0.1 },
  '204': { name: '水面', safetyScore: 0.3 },
  '205': { name: 'その他自然地', safetyScore: 0.15 },
  '211': { name: '住宅用地', safetyScore: 0.6 },
  '212': { name: '商業用地', safetyScore: 1.0 },
  '213': { name: '工業用地', safetyScore: 0.3 },
  '214': { name: '公益施設用地', safetyScore: 0.8 },
  '215': { name: '道路用地', safetyScore: 0.7 },
  '216': { name: '交通施設用地', safetyScore: 0.5 },
  '217': { name: '公共空地（公園）', safetyScore: 0.8 },
  '218': { name: 'その他公的施設', safetyScore: 0.5 },
  '219': { name: '農林漁業施設', safetyScore: 0.3 },
  '220': { name: 'ゴルフ場', safetyScore: 0.4 },
  '221': { name: '太陽光発電', safetyScore: 0.2 },
  '222': { name: '平面駐車場', safetyScore: 0.3 },
  '223': { name: 'その他都市的土地', safetyScore: 0.4 },
  '224': { name: '低未利用土地', safetyScore: 0.2 },
  '231': { name: '不明', safetyScore: 0.5 },
  '251': { name: '可住地', safetyScore: 0.5 },
  '252': { name: '非可住地', safetyScore: 0.3 },
  '260': { name: '農地', safetyScore: 0.2 },
  '261': { name: '宅地', safetyScore: 0.6 },
  '262': { name: '道路・鉄軌道敷', safetyScore: 0.7 },
  '263': { name: '空地', safetyScore: 0.3 },
};

// GMLファイルから土地利用データを抽出
function extractLandUse(gmlPath) {
  console.log(`  処理中: ${path.basename(gmlPath)}`);
  const content = fs.readFileSync(gmlPath, 'utf-8');
  const landUseAreas = [];

  // LandUseブロックを抽出
  const landUsePattern = /<luse:LandUse[^>]*gml:id="([^"]+)"[^>]*>([\s\S]*?)<\/luse:LandUse>/g;
  let match;

  while ((match = landUsePattern.exec(content)) !== null) {
    const landUseId = match[1];
    const landUseContent = match[2];

    try {
      // 土地利用コードを取得
      const classMatch = landUseContent.match(/<luse:class[^>]*>(\d+)<\/luse:class>/);
      const code = classMatch ? classMatch[1] : '231';
      const landUseInfo = LANDUSE_CODES[code] || { name: '不明', safetyScore: 0.5 };

      // 詳細土地利用コードを取得（より詳細な分類）
      const orgLandUseMatch = landUseContent.match(/<uro:orgLandUse[^>]*>(\d+)<\/uro:orgLandUse>/);
      const orgCode = orgLandUseMatch ? orgLandUseMatch[1] : null;

      // ポリゴン座標を抽出
      const posListMatch = landUseContent.match(/<gml:posList>([^<]+)<\/gml:posList>/);
      if (!posListMatch) continue;

      const coords = posListMatch[1].trim().split(/\s+/).map(parseFloat);
      if (coords.length < 6) continue;

      // 座標を [lon, lat] のペアに変換
      const polygon = [];
      let inBounds = true;

      for (let i = 0; i < coords.length; i += 3) {
        const lat = coords[i];
        const lon = coords[i + 1];
        // z座標は無視

        polygon.push([lon, lat]);
      }

      if (polygon.length < 3) continue;

      // 中心座標を計算
      const centerLon = polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length;
      const centerLat = polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length;

      // バウンディングボックス内かチェック
      if (centerLat < BOUNDS.minLat || centerLat > BOUNDS.maxLat ||
          centerLon < BOUNDS.minLon || centerLon > BOUNDS.maxLon) {
        continue;
      }

      // ポリゴンの面積を概算（簡易計算）
      let area = 0;
      for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        area += polygon[i][0] * polygon[j][1];
        area -= polygon[j][0] * polygon[i][1];
      }
      area = Math.abs(area / 2) * 111000 * 111000; // 度からm²への概算変換

      landUseAreas.push({
        id: landUseId,
        code,
        name: landUseInfo.name,
        safetyScore: landUseInfo.safetyScore,
        orgCode,
        polygon,
        center: [centerLon, centerLat],
        area, // m²
      });
    } catch (e) {
      // パースエラーは無視
    }
  }

  return landUseAreas;
}

// メイン処理
console.log('川口市土地利用データの処理を開始...');

// 出力ディレクトリ作成
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

if (!fs.existsSync(LANDUSE_DIR)) {
  console.log(`土地利用ディレクトリが見つかりません: ${LANDUSE_DIR}`);
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'landuse.json'),
    JSON.stringify({ type: 'FeatureCollection', features: [] })
  );
  console.log('空の土地利用データファイルを作成しました');
  process.exit(0);
}

const allLandUse = [];

// すべてのGMLファイルを処理
const gmlFiles = fs.readdirSync(LANDUSE_DIR).filter(f => f.endsWith('.gml'));
console.log(`${gmlFiles.length}個のGMLファイルを処理します...`);

for (const gmlFile of gmlFiles) {
  const gmlPath = path.join(LANDUSE_DIR, gmlFile);
  const landUseAreas = extractLandUse(gmlPath);
  allLandUse.push(...landUseAreas);
  console.log(`    抽出: ${landUseAreas.length}区画`);
}

console.log(`\n合計: ${allLandUse.length}区画の土地利用データを抽出`);

// GeoJSON形式で保存
const geojson = {
  type: 'FeatureCollection',
  features: allLandUse.map(lu => ({
    type: 'Feature',
    properties: {
      id: lu.id,
      code: lu.code,
      name: lu.name,
      safetyScore: lu.safetyScore,
      area: lu.area,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [lu.polygon]
    }
  }))
};

fs.writeFileSync(
  path.join(PUBLIC_DIR, 'landuse.json'),
  JSON.stringify(geojson)
);

// 土地利用別の統計
const luseStats = {};
allLandUse.forEach(lu => {
  luseStats[lu.name] = (luseStats[lu.name] || 0) + 1;
});
console.log('\n土地利用別統計:');
Object.entries(luseStats)
  .sort((a, b) => b[1] - a[1])
  .forEach(([name, count]) => {
    console.log(`  ${name}: ${count}区画`);
  });

// 安全スコア分布
const scoreDistribution = { high: 0, medium: 0, low: 0 };
allLandUse.forEach(lu => {
  if (lu.safetyScore >= 0.7) scoreDistribution.high++;
  else if (lu.safetyScore >= 0.4) scoreDistribution.medium++;
  else scoreDistribution.low++;
});
console.log('\n安全スコア分布:');
console.log(`  高 (0.7以上): ${scoreDistribution.high}区画`);
console.log(`  中 (0.4-0.7): ${scoreDistribution.medium}区画`);
console.log(`  低 (0.4未満): ${scoreDistribution.low}区画`);

console.log('\n川口市土地利用データの処理完了！');
