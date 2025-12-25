const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/kawaguchi');
const PUBLIC_DIR = path.join(__dirname, '../public/data');

// 出力ディレクトリ作成
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 歩行可能な道路タイプ
const WALKABLE_HIGHWAYS = new Set([
  'motorway', 'motorway_link',
  'trunk', 'trunk_link',
  'primary', 'primary_link',
  'secondary', 'secondary_link',
  'tertiary', 'tertiary_link',
  'residential',
  'unclassified',
  'living_street',
  'pedestrian',
  'footway',
  'path',
  'service',
  'track',
  'cycleway',
  'steps',
  'construction'
]);

// OSMデータをパース（ストリーミング方式）
function parseOSM(osmPath) {
  const content = fs.readFileSync(osmPath, 'utf-8');
  const nodes = new Map();
  const ways = [];
  const pois = [];

  // 1. まずすべてのノードを収集
  console.log('  ノードを解析中...');
  const nodePattern2 = /<node[^>]*>/g;
  let m;
  let nodeCount = 0;

  while ((m = nodePattern2.exec(content)) !== null) {
    const nodeTag = m[0];
    const idMatch = nodeTag.match(/id="(\d+)"/);
    const latMatch = nodeTag.match(/lat="([^"]+)"/);
    const lonMatch = nodeTag.match(/lon="([^"]+)"/);

    if (idMatch && latMatch && lonMatch) {
      nodes.set(idMatch[1], {
        lat: parseFloat(latMatch[1]),
        lon: parseFloat(lonMatch[1])
      });
      nodeCount++;
    }

    // ノードのタグをチェック（POI）
    if (nodeTag.endsWith('/>')) {
      continue; // 自己閉じタグ
    }

    const closeIdx = content.indexOf('</node>', m.index);
    if (closeIdx > 0 && closeIdx < m.index + 5000) {
      const nodeContent = content.substring(m.index, closeIdx + 7);

      // タグを抽出
      const tags = {};
      const tagPattern = /<tag\s+k="([^"]+)"\s+v="([^"]+)"\s*\/>/g;
      let tagM;
      while ((tagM = tagPattern.exec(nodeContent)) !== null) {
        tags[tagM[1]] = tagM[2];
      }

      if (idMatch && latMatch && lonMatch) {
        const lat = parseFloat(latMatch[1]);
        const lon = parseFloat(lonMatch[1]);
        const id = idMatch[1];

        // コンビニ
        if (tags.shop === 'convenience') {
          pois.push({
            id: `node_${id}`,
            type: 'convenience_store',
            name: tags.name || tags['name:ja'] || 'コンビニ',
            lat, lon,
            is_24h: true
          });
        }

        // トイレ
        if (tags.amenity === 'toilets') {
          pois.push({
            id: `node_${id}`,
            type: 'toilet',
            name: tags.name || '公衆トイレ',
            lat, lon
          });
        }

        // 交番
        if (tags.amenity === 'police') {
          pois.push({
            id: `node_${id}`,
            type: 'koban',
            name: tags.name || '交番',
            lat, lon
          });
        }

        // 駅
        if (tags.railway === 'station' || tags.public_transport === 'station') {
          pois.push({
            id: `node_${id}`,
            type: 'station',
            name: tags.name || '駅',
            lat, lon
          });
        }
      }
    }
  }
  console.log(`    ${nodeCount}ノード`);

  // 2. Wayを収集
  console.log('  道路を解析中...');
  const wayPattern = /<way[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g;
  let wayMatch;

  while ((wayMatch = wayPattern.exec(content)) !== null) {
    const wayId = wayMatch[1];
    const wayContent = wayMatch[2];

    // タグを抽出
    const tags = {};
    const tagPattern = /<tag\s+k="([^"]+)"\s+v="([^"]+)"\s*\/>/g;
    let tagM;
    while ((tagM = tagPattern.exec(wayContent)) !== null) {
      tags[tagM[1]] = tagM[2];
    }

    // 道路かどうかチェック
    if (!tags.highway || !WALKABLE_HIGHWAYS.has(tags.highway)) {
      continue;
    }

    // ノード参照を抽出
    const ndPattern = /<nd\s+ref="(\d+)"\s*\/>/g;
    const nodeRefs = [];
    let ndM;
    while ((ndM = ndPattern.exec(wayContent)) !== null) {
      nodeRefs.push(ndM[1]);
    }

    // 座標に変換
    const coordinates = [];
    for (const ref of nodeRefs) {
      const node = nodes.get(ref);
      if (node) {
        coordinates.push([node.lon, node.lat]);
      }
    }

    if (coordinates.length >= 2) {
      ways.push({
        id: wayId,
        type: tags.highway,
        name: tags.name || '',
        coordinates
      });
    }
  }

  console.log(`    ${ways.length}道路`);
  return { nodes, ways, pois };
}

// 犯罪データをパース（川口市のひったくりデータ）
function parseCrimeData(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const crimeData = [];
  const townCounts = {};

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length < 8) continue;

    const city = values[6]; // 市区町村
    const town = values[7]; // 町丁目

    // 川口市のデータのみ
    if (!city.includes('川口市')) continue;

    const key = town || city;
    townCounts[key] = (townCounts[key] || 0) + 1;
  }

  // 町丁目ごとの犯罪数をリストに変換
  for (const [town, count] of Object.entries(townCounts)) {
    crimeData.push({
      town: town.replace('川口市', ''),
      totalCrime: count,
      violentCrime: 0,
      theftTotal: count // ひったくりは窃盗
    });
  }

  return crimeData;
}

// メイン処理
console.log('川口市データ処理を開始...');

// OSMデータ
const osmPath = path.join(DATA_DIR, 'map.osm');
if (fs.existsSync(osmPath)) {
  console.log('OSMデータを処理中...');
  const { ways, pois } = parseOSM(osmPath);

  // 道路データをGeoJSON形式で保存
  const roadsGeoJSON = {
    type: 'FeatureCollection',
    features: ways.map(w => ({
      type: 'Feature',
      properties: {
        id: w.id,
        highway: w.type,
        name: w.name
      },
      geometry: {
        type: 'LineString',
        coordinates: w.coordinates
      }
    }))
  };
  fs.writeFileSync(path.join(PUBLIC_DIR, 'roads.json'), JSON.stringify(roadsGeoJSON));
  console.log(`  道路合計: ${ways.length}件`);

  // 道路タイプ別の統計
  const typeStats = {};
  ways.forEach(w => {
    typeStats[w.type] = (typeStats[w.type] || 0) + 1;
  });
  console.log('  道路タイプ別:');
  Object.entries(typeStats).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });

  // POIデータ
  fs.writeFileSync(path.join(PUBLIC_DIR, 'pois.json'), JSON.stringify(pois, null, 2));
  console.log(`  POI: ${pois.length}件`);
} else {
  console.log(`OSMファイルが見つかりません: ${osmPath}`);
}

// 犯罪データ
const crimePath = path.join(DATA_DIR, 'saitama_2024hittakuri.csv');
if (fs.existsSync(crimePath)) {
  console.log('犯罪データを処理中...');
  const crimeData = parseCrimeData(crimePath);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'crime.json'), JSON.stringify(crimeData, null, 2));
  console.log(`  犯罪データ: ${crimeData.length}件`);
} else {
  // 空の犯罪データを作成
  fs.writeFileSync(path.join(PUBLIC_DIR, 'crime.json'), JSON.stringify([]));
  console.log('  犯罪データなし（空ファイル作成）');
}

console.log('川口市データ処理完了！');
