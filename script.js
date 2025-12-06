const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const bufferCanvas = document.createElement('canvas');
const bufferCtx = bufferCanvas.getContext('2d');

// パラメータを大幅に削減
const controls = {
  scale: document.getElementById('scale'),
  distortion: document.getElementById('distortion'),
  complexity: document.getElementById('complexity'),
  contrast: document.getElementById('contrast'),
};

const display = {
  scale: document.getElementById('scale-value'),
  distortion: document.getElementById('distortion-value'),
  complexity: document.getElementById('complexity-value'),
  contrast: document.getElementById('contrast-value'),
};
const seedDisplay = document.getElementById('seed-display');
let currentSeed = 20251028;

function syncDisplay() {
  Object.entries(display).forEach(([key, el]) => {
    el.textContent = parseFloat(controls[key].value).toFixed(1);
  });
  if (seedDisplay) seedDisplay.textContent = currentSeed;
}

// --- ユーティリティ ---
// Mulberry32 PRNG (乱数生成器)
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value Noise (2D)
function valueNoise(x, y, rng) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  // シンプルなハッシュ関数
  const hash = (a, b) => {
    a = a >>> 0; b = b >>> 0;
    let h = (a * 1664525 ^ b * 1622650073) + 1013904223;
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 0xFFFFFFFF;
  };
  const n00 = hash(xi, yi);
  const n10 = hash(xi + 1, yi);
  const n01 = hash(xi, yi + 1);
  const n11 = hash(xi + 1, yi + 1);
  // スムーズな補間 (quintic curve)
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const u = fade(xf);
  const v = fade(yf);
  const nx0 = n00 * (1 - u) + n10 * u;
  const nx1 = n01 * (1 - u) + n11 * u;
  return nx0 * (1 - v) + nx1 * v;
}

// FBM (Fractal Brownian Motion) - 指定した座標のノイズ値を計算
function fbm(x, y, octaves, rng) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  // オクターブを重ね合わせて複雑なノイズを作る
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise(x * frequency, y * frequency, rng);
    frequency *= 2.0; // 周波数を倍に
    amplitude *= 0.5; // 振幅を半分に
  }
  // 結果がおよそ0〜1の範囲になるように調整 (厳密ではないが実用上十分)
  return value / (1 - Math.pow(0.5, octaves));
}

// コサインパレットによる色生成 (滑らかなグラデーション)
// t: 0〜1の値, a,b,c,d: パレットパラメータ(RGBベクトル)
function cosinePalette(t, a, b, c, d) {
  const rgb = [];
  for(let i=0; i<3; i++) {
    // color = a + b * cos( 2π * (c * t + d) )
    rgb[i] = a[i] + b[i] * Math.cos(6.28318 * (c[i] * t + d[i]));
    rgb[i] = Math.min(1, Math.max(0, rgb[i])); // 0-1にクランプ
  }
  return rgb;
}

// --- メイン生成関数 ---
function generateMarble(w, h, params) {
  const { seed, scale, distortion, complexity, contrast } = params;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  
  // 乱数生成器の初期化
  const rngBase = mulberry32(seed);
  // 各FBMレイヤーで少し異なる乱数を使うためのサブRNG
  const rngQx = mulberry32(rngBase() * 0xffffffff);
  const rngQy = mulberry32(rngBase() * 0xffffffff);
  const rngRx = mulberry32(rngBase() * 0xffffffff);
  const rngRy = mulberry32(rngBase() * 0xffffffff);
  const rngFinal = mulberry32(rngBase() * 0xffffffff);

  // 色のパレット定義 (大理石っぽい色調)
  const palA = [0.5, 0.5, 0.5];
  const palB = [0.5, 0.5, 0.5];
  const palC = [1.0, 1.0, 1.0];
  const palD = [0.00, 0.33, 0.67]; // 位相をずらして色相変化を作る

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 1. 座標の正規化とスケーリング
      // アスペクト比を考慮して、短い辺が基準になるようにする
      const aspectRatio = w / h;
      let px = (x / w) * scale * (aspectRatio > 1 ? aspectRatio : 1);
      let py = (y / h) * scale * (aspectRatio < 1 ? 1 / aspectRatio : 1);

      // --- ドメインワーピング (Domain Warping) ---
      // 座標をノイズの値でずらすことを繰り返すことで、渦巻くような歪みを作る。

      // 第1段階の歪みベクトル q を計算
      let qx = fbm(px, py, complexity, rngQx);
      let qy = fbm(px + 5.2, py + 1.3, complexity, rngQy); // 座標を少しずらして別のノイズを得る

      // 第2段階の歪みベクトル r を計算
      // 元の座標に q を加えた場所のノイズをサンプリングする
      let rx = fbm(px + distortion * qx, py + distortion * qy, complexity, rngRx);
      let ry = fbm(px + distortion * qx + 1.7, py + distortion * qy + 9.2, complexity, rngRy);

      // 最終的な模様の値 f を計算
      // さらに r で座標をずらしてサンプリング。これが強いクネクネ感を生む。
      let f = fbm(px + distortion * rx, py + distortion * ry, complexity, rngFinal);
      
      // --- 色付け ---
      
      // コントラスト調整 (シグモイド関数風のカーブでメリハリをつける)
      // f は0~1付近の値なので、中心を0.5として強調する
      f = (f - 0.5) * contrast + 0.5;
      f = Math.min(1.0, Math.max(0.0, f)); // 0-1にクランプ

      // 計算した値 f を使ってパレットから色を取得
      // fの値を少し変換して色の変化にバリエーションを持たせる
      const colorVal = f + 0.6 * rx; // 歪み成分も色に少し影響させる
      const rgb = cosinePalette(colorVal, palA, palB, palC, palD);

      // ピクセルデータへの書き込み
      const idx = (x + y * w) * 4;
      data[idx] = rgb[0] * 255;     // R
      data[idx + 1] = rgb[1] * 255; // G
      data[idx + 2] = rgb[2] * 255; // B
      data[idx + 3] = 255;          // A
    }
  }
  return imgData;
}

// --- レンダリングとイベントハンドラ ---
function render() {
  const width = 600; // 描画サイズ
  const height = 800;
  
  // 現在のパラメータを取得
  const params = {
    seed: currentSeed,
    scale: parseFloat(controls.scale.value),
    distortion: parseFloat(controls.distortion.value),
    complexity: parseInt(controls.complexity.value, 10),
    contrast: parseFloat(controls.contrast.value),
  };
  
  syncDisplay();
  
  // メインのキャンバスサイズを設定
  canvas.width = width;
  canvas.height = height;
  
  // 画像生成（時間がかかる場合があるので非同期的に処理しても良いが、今回はシンプルに同期実行）
  // 低解像度で計算してから拡大表示するアプローチもアリだが、高品質な出力を優先。
  const imgData = generateMarble(width, height, params);
  ctx.putImageData(imgData, 0, 0);
}

// イベントリスナーの設定
Object.values(controls).forEach((input) => {
  // スライダーを動かしたときにリアルタイム更新（重い場合は 'change' イベントに変更）
  input.addEventListener('input', render); 
});

document.getElementById('regenerate').addEventListener('click', render);

document.getElementById('randomize').addEventListener('click', () => {
  currentSeed = Math.floor(Math.random() * 100000) + 1;
  // パラメータもランダムにしてみる
  controls.scale.value = (Math.random() * 3 + 1).toFixed(1);
  controls.distortion.value = (Math.random() * 1.5 + 0.2).toFixed(2);
  controls.contrast.value = (Math.random() * 1.5 + 0.8).toFixed(1);
  render();
});

document.getElementById('export').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `marble_${controls.seed.value}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// 初期描画
render();
