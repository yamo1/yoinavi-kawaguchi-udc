const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/kawaguchi');
const PUBLIC_DIR = path.join(__dirname, '../public/data');

// 防犯カメラデータをパース
function parseCameraData(csvPath) {
  console.log(`防犯カメラデータを読み込み中: ${csvPath}`);
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const cameras = [];

  // ヘッダー解析（全角スペースに注意）
  const header = lines[0].split(',').map(h => h.trim().replace(/\s+/g, ''));
  console.log(`  ヘッダー: ${header.join(', ')}`);

  const idIdx = header.findIndex(h => h.includes('ID') || h.includes('id'));
  const addressIdx = header.findIndex(h => h.includes('住所'));
  const latIdx = header.findIndex(h => h.includes('緯度'));
  const lonIdx = header.findIndex(h => h.includes('経度'));

  console.log(`  インデックス: ID=${idIdx}, 住所=${addressIdx}, 緯度=${latIdx}, 経度=${lonIdx}`);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());

    const id = values[idIdx] || `cam_${i}`;
    const address = values[addressIdx] || '';
    // 全角スペースを除去してパース
    const lat = parseFloat((values[latIdx] || '').replace(/\s+/g, ''));
    const lon = parseFloat((values[lonIdx] || '').replace(/\s+/g, ''));

    if (isNaN(lat) || isNaN(lon)) {
      console.log(`  警告: 行${i}の座標が不正 (lat=${values[latIdx]}, lon=${values[lonIdx]})`);
      continue;
    }

    cameras.push({
      id: `camera_${id}`,
      address,
      lat,
      lon,
      // カメラの有効パラメータ
      effectiveRadius: 80,  // 最大有効距離(m)
      decayConstant: 30,    // 減衰定数σ(m)
    });
  }

  return cameras;
}

// メイン処理
console.log('防犯カメラデータの処理を開始...');

// 出力ディレクトリ作成
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const cameraPath = path.join(DATA_DIR, '西川口_防犯カメラ.csv');
if (fs.existsSync(cameraPath)) {
  const cameras = parseCameraData(cameraPath);

  // JSON形式で保存
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'cameras.json'),
    JSON.stringify(cameras, null, 2)
  );

  console.log(`\n防犯カメラ: ${cameras.length}台`);

  // 座標範囲
  if (cameras.length > 0) {
    const lats = cameras.map(c => c.lat);
    const lons = cameras.map(c => c.lon);
    console.log(`\n座標範囲:`);
    console.log(`  緯度: ${Math.min(...lats).toFixed(6)} ~ ${Math.max(...lats).toFixed(6)}`);
    console.log(`  経度: ${Math.min(...lons).toFixed(6)} ~ ${Math.max(...lons).toFixed(6)}`);
  }

} else {
  console.log(`防犯カメラファイルが見つかりません: ${cameraPath}`);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'cameras.json'), JSON.stringify([]));
}

console.log('\n防犯カメラデータの処理完了！');
