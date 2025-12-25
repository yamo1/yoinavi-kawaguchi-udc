const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/kawaguchi');
const PUBLIC_DIR = path.join(__dirname, '../public/data');

// 手口別重み（UDC安全率.pdfに基づく）
const CRIME_WEIGHTS = {
  'ひったくり': 5,
  '強盗': 6,
  '路上強盗': 6,
  'すり': 4,
  '暴行': 4,
  '傷害': 4,
  '不審者': 2,
  '声かけ': 2,
  '侵入窃盗': 5,
  '空き巣': 5,
  '忍込み': 5,
  '車上ねらい': 3,
  '部品ねらい': 3,
  '自動車盗': 4,
  'オートバイ盗': 3,
  '自転車盗': 1,
  '自動販売機ねらい': 2,
  '万引き': 2,
  '器物損壊': 2,
};

// デフォルト重み
const DEFAULT_WEIGHT = 1;

// 犯罪データをパース
function parseCrimeData(csvPath) {
  console.log(`犯罪データを読み込み中: ${csvPath}`);
  const content = fs.readFileSync(csvPath, 'utf-8');
  // Windows改行コードを処理
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const crimes = [];

  // ヘッダー解析
  const header = lines[0].split(',').map(h => h.trim());
  const crimeTypeIdx = header.findIndex(h => h.includes('手口'));
  const latIdx = header.findIndex(h => h === 'lat');
  const lonIdx = header.findIndex(h => h === 'lon');
  const areaIdx = header.findIndex(h => h.includes('町丁目'));

  console.log(`  ヘッダー: 手口=${crimeTypeIdx}, lat=${latIdx}, lon=${lonIdx}`);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',');
    const crimeType = values[crimeTypeIdx]?.trim();
    const lat = parseFloat(values[latIdx]);
    const lon = parseFloat(values[lonIdx]);
    const area = values[areaIdx]?.trim() || '';

    if (isNaN(lat) || isNaN(lon)) continue;

    // 重みを取得
    let weight = DEFAULT_WEIGHT;
    for (const [key, w] of Object.entries(CRIME_WEIGHTS)) {
      if (crimeType && crimeType.includes(key)) {
        weight = w;
        break;
      }
    }

    crimes.push({
      id: `crime_${i}`,
      type: crimeType,
      weight,
      lat,
      lon,
      area,
    });
  }

  return crimes;
}

// メイン処理
console.log('犯罪データの処理を開始...');

// 出力ディレクトリ作成
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const crimePath = path.join(DATA_DIR, '川口市犯罪.csv');
if (fs.existsSync(crimePath)) {
  const crimes = parseCrimeData(crimePath);

  // JSON形式で保存
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'crimes.json'),
    JSON.stringify(crimes, null, 2)
  );

  console.log(`\n犯罪データ: ${crimes.length}件`);

  // 手口別統計
  const typeStats = {};
  crimes.forEach(c => {
    typeStats[c.type] = (typeStats[c.type] || 0) + 1;
  });
  console.log('\n手口別統計:');
  Object.entries(typeStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const weight = CRIME_WEIGHTS[type] || DEFAULT_WEIGHT;
      console.log(`  ${type}: ${count}件 (重み: ${weight})`);
    });

  // 重み付き合計
  const weightedTotal = crimes.reduce((sum, c) => sum + c.weight, 0);
  console.log(`\n重み付き合計: ${weightedTotal}`);

} else {
  console.log(`犯罪データファイルが見つかりません: ${crimePath}`);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'crimes.json'), JSON.stringify([]));
}

console.log('\n犯罪データの処理完了！');
