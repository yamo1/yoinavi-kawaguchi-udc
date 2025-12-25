const fs = require('fs');
const path = require('path');

const CITYGML_DIR = path.join(__dirname, '../../data/kawaguchi/11203_kawaguchi-shi_pref_2024_citygml_1_op/udx/bldg');
const PUBLIC_DIR = path.join(__dirname, '../public/data');

// 川口市南部のバウンディングボックス（OSMデータと同じ範囲）
const BOUNDS = {
  minLat: 35.7909,
  maxLat: 35.8235,
  minLon: 139.6915,
  maxLon: 139.7617
};

// 建物用途コードのマッピング
const USAGE_CODES = {
  '401': '業務施設',
  '402': '商業施設',
  '403': '宿泊施設',
  '404': '商業系複合施設',
  '411': '住宅',
  '412': '共同住宅',
  '413': '店舗等併用住宅',
  '414': '店舗等併用共同住宅',
  '421': '医療施設',
  '422': '教育施設',
  '431': '運輸倉庫施設',
  '441': '工場',
  '451': '官公庁施設',
  '452': '文化施設',
  '453': '体育館',
  '461': '農林漁業施設',
  '471': '供給処理施設',
  '472': '防衛施設',
  '499': 'その他'
};

// GMLファイルから建物データを抽出
function extractBuildings(gmlPath) {
  console.log(`  処理中: ${path.basename(gmlPath)}`);
  const content = fs.readFileSync(gmlPath, 'utf-8');
  const buildings = [];

  // 建物ブロックを抽出
  const buildingPattern = /<bldg:Building[^>]*gml:id="([^"]+)"[^>]*>([\s\S]*?)<\/bldg:Building>/g;
  let match;

  while ((match = buildingPattern.exec(content)) !== null) {
    const buildingId = match[1];
    const buildingContent = match[2];

    try {
      // 高さを取得
      const heightMatch = buildingContent.match(/<bldg:measuredHeight[^>]*>([^<]+)<\/bldg:measuredHeight>/);
      const height = heightMatch ? parseFloat(heightMatch[1]) : 5;

      // 階数を取得
      const storeysMatch = buildingContent.match(/<bldg:storeysAboveGround>(\d+)<\/bldg:storeysAboveGround>/);
      const storeys = storeysMatch ? parseInt(storeysMatch[1]) : 1;

      // 用途を取得
      const usageMatch = buildingContent.match(/<bldg:usage[^>]*>(\d+)<\/bldg:usage>/);
      const usageCode = usageMatch ? usageMatch[1] : '499';
      const usage = USAGE_CODES[usageCode] || 'その他';

      // lod0RoofEdgeから座標を抽出（より簡単なポリゴン）
      const roofEdgeMatch = buildingContent.match(/<bldg:lod0RoofEdge>([\s\S]*?)<\/bldg:lod0RoofEdge>/);
      if (!roofEdgeMatch) continue;

      const posListMatch = roofEdgeMatch[1].match(/<gml:posList>([^<]+)<\/gml:posList>/);
      if (!posListMatch) continue;

      const coords = posListMatch[1].trim().split(/\s+/).map(parseFloat);
      if (coords.length < 6) continue;

      // 座標を [lon, lat] のペアに変換
      const polygon = [];
      for (let i = 0; i < coords.length; i += 3) {
        const lat = coords[i];
        const lon = coords[i + 1];
        // z座標は無視

        // バウンディングボックスチェック
        if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat ||
            lon < BOUNDS.minLon || lon > BOUNDS.maxLon) {
          break;
        }
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

      buildings.push({
        id: buildingId,
        polygon,
        height: Math.max(height, 3),
        storeys,
        usage,
        usageCode,
        center: [centerLon, centerLat]
      });
    } catch (e) {
      // パースエラーは無視
    }
  }

  return buildings;
}

// メイン処理
console.log('川口市CityGMLデータの処理を開始...');

if (!fs.existsSync(CITYGML_DIR)) {
  console.log(`CityGMLディレクトリが見つかりません: ${CITYGML_DIR}`);
  // 空のbuildings.jsonを作成
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'buildings.json'),
    JSON.stringify({ type: 'FeatureCollection', features: [] })
  );
  console.log('空の建物データファイルを作成しました');
  process.exit(0);
}

const allBuildings = [];

// すべてのGMLファイルを処理
const gmlFiles = fs.readdirSync(CITYGML_DIR).filter(f => f.endsWith('.gml'));
console.log(`${gmlFiles.length}個のGMLファイルを処理します...`);

for (const gmlFile of gmlFiles) {
  const gmlPath = path.join(CITYGML_DIR, gmlFile);
  const buildings = extractBuildings(gmlPath);
  allBuildings.push(...buildings);
  if (buildings.length > 0) {
    console.log(`    抽出: ${buildings.length}棟`);
  }
}

console.log(`\n合計: ${allBuildings.length}棟の建物を抽出`);

// GeoJSON形式で保存
const geojson = {
  type: 'FeatureCollection',
  features: allBuildings.map(b => ({
    type: 'Feature',
    properties: {
      id: b.id,
      height: b.height,
      storeys: b.storeys,
      usage: b.usage,
      usageCode: b.usageCode
    },
    geometry: {
      type: 'Polygon',
      coordinates: [b.polygon]
    }
  }))
};

fs.writeFileSync(
  path.join(PUBLIC_DIR, 'buildings.json'),
  JSON.stringify(geojson)
);

// 用途別の統計
const usageStats = {};
allBuildings.forEach(b => {
  usageStats[b.usage] = (usageStats[b.usage] || 0) + 1;
});
console.log('\n用途別統計:');
Object.entries(usageStats)
  .sort((a, b) => b[1] - a[1])
  .forEach(([usage, count]) => {
    console.log(`  ${usage}: ${count}棟`);
  });

console.log('\n川口市CityGMLデータの処理完了！');
