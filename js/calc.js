// ブロック積（石積）擁壁の安定計算ロジック
// クーロンの主働土圧公式 + フローリッヒの地盤応力理論による上載荷重の等分布荷重換算
// + 示力線法による転倒照査 + 滑動照査 + 支持力照査

function deg2rad(d) {
  return (d * Math.PI) / 180;
}

function rad2deg(r) {
  return (r * 180) / Math.PI;
}

function cot(radians) {
  return 1 / Math.tan(radians);
}

function cosec(radians) {
  return 1 / Math.sin(radians);
}

// フローリッヒの台形荷重換算係数 Iw(x)  x = X/H
function frohlichIw(x) {
  return 1 + x * x - (2 / Math.PI) * (1 + x * x) * Math.atan(x) - (2 / Math.PI) * x;
}

// クーロンの主働土圧係数
// theta: 壁背面が水平面となす角(deg), phi: 内部摩擦角(deg)
// delta: 壁面摩擦角(deg), i: 地表面が水平面となす角(deg)
function coulombKA(thetaDeg, phiDeg, deltaDeg, iDeg) {
  const theta = deg2rad(thetaDeg);
  const phi = deg2rad(phiDeg);
  const delta = deg2rad(deltaDeg);
  const i = deg2rad(iDeg);

  const numerator = Math.pow(Math.sin(theta + phi), 2);
  const innerRatio =
    (Math.sin(phi + delta) * Math.sin(phi - i)) / (Math.sin(theta - delta) * Math.sin(theta + i));

  if (innerRatio < 0 || !Number.isFinite(innerRatio)) {
    throw new Error(
      "主働土圧係数が計算できません（内部摩擦角φが盛土傾斜角βより小さい、または壁形状が不正です）。"
    );
  }

  const bracket = 1 + Math.sqrt(innerRatio);
  const denominator = Math.pow(Math.sin(theta), 2) * Math.sin(theta - delta) * Math.pow(bracket, 2);

  if (denominator <= 0 || !Number.isFinite(denominator)) {
    throw new Error("主働土圧係数の計算中に不正な値が発生しました。入力値を確認してください。");
  }

  return numerator / denominator;
}

/**
 * ブロック積擁壁の安定計算メイン処理
 * @param {object} p 入力値一式
 * @returns {object} 計算結果一式
 */
function calcBlockWallStability(p) {
  const {
    H, // 擁壁高さ(m)
    n1, // 前面勾配 1:n1
    H0, // 盛土高(m)
    beta, // 盛土傾斜角(deg)
    gammaS, // 裏込土単位体積重量(kN/m3)
    phi, // 裏込土内部摩擦角(deg)
    b, // 壁体厚(m)
    gammaB, // ブロック積単位重量(kN/m3)
    q, // 載荷重(kN/m2)
    qa, // 許容支持力度(kN/m2)
    sigmaCk, // コンクリート設計基準強度(N/mm2) 参考表示のみ
    f, // 基礎地盤との摩擦係数
    Fs, // 滑動に対する必要安全率
    X1 = 0, // 擁壁天端からのり肩までの水平距離(m)
    baseWidthOverride = null, // 基礎幅Bの手動指定(m) nullなら自動計算
  } = p;

  if (H <= 0) throw new Error("擁壁高さHは正の値を入力してください。");
  if (n1 <= 0) throw new Error("前面勾配n1は正の値を入力してください。");
  if (b <= 0) throw new Error("壁体厚bは正の値を入力してください。");
  if (gammaS <= 0 || gammaB <= 0) throw new Error("単位体積重量は正の値を入力してください。");

  const delta = (2 / 3) * phi;
  const theta0Deg = rad2deg(Math.atan(1 / n1));
  const thetaDeg = 180 - theta0Deg;
  const iDeg = beta;

  const KA = coulombKA(thetaDeg, phi, delta, iDeg);

  // (1) 上載荷重の盛土換算
  const H1 = q / gammaS;
  const rawRatio = (H0 + H1) / H;
  const ratioCapped = rawRatio > 1;
  const effectiveH0H1 = Math.min(H0 + H1, H);

  // (2) 換算荷重（フローリッヒ）
  const X2 = effectiveH0H1 * Math.tan(deg2rad(beta));
  const X = X1 + X2 / 2;
  const Iw = frohlichIw(X / H);
  const qw = gammaS * effectiveH0H1 * Iw;

  const theta0Rad = deg2rad(theta0Deg);
  const thetaRad = deg2rad(thetaDeg);
  const iRad = deg2rad(iDeg);
  const cotTheta0 = cot(theta0Rad);
  const cosecTheta0 = cosec(theta0Rad);
  const sinRatio = Math.sin(thetaRad) / Math.sin(thetaRad + iRad);

  // 示力線法（転倒照査）の係数
  const A_coef = (KA * gammaS) / (6 * gammaB * b * cosecTheta0);
  const B_coef =
    (KA * qw * sinRatio) / (2 * gammaB * b * cosecTheta0) + cotTheta0 / 2;

  const Xh = (Y) => A_coef * Y * Y + B_coef * Y;
  const Xprime = (Y) => Y * cotTheta0 + (b * cosecTheta0) / 6;

  // 高さ方向の照査テーブル(0.2m刻み + 最終段でH)
  const table = [];
  const step = 0.2;
  let y = 0;
  while (y < H - 1e-9) {
    table.push(makeRow(y));
    y += step;
  }
  table.push(makeRow(H));

  function makeRow(Y) {
    const xp = Xprime(Y);
    const xh = Xh(Y);
    return { Y, Xprime: xp, Xh: xh, ok: xp >= xh - 1e-9 };
  }

  // 安定最大高さ Hmax（X'(Y) = Xh(Y) となる高さ）
  const C_coef = B_coef - cotTheta0;
  const D_coef = (b * cosecTheta0) / 6;
  let Hmax;
  if (Math.abs(A_coef) < 1e-12) {
    Hmax = C_coef !== 0 ? D_coef / -C_coef : Infinity;
  } else {
    const disc = C_coef * C_coef + 4 * A_coef * D_coef;
    Hmax = (-C_coef + Math.sqrt(disc)) / (2 * A_coef);
  }

  const overturnOK = table[table.length - 1].ok;

  // (2) 滑動に対する検討
  const RH = b * gammaB * H * cosecTheta0 * f;
  const sigmaH = (0.5 * KA * gammaS * H * H + KA * qw * sinRatio * H) * Math.sin(thetaRad);
  const slideRatio = RH / sigmaH;
  const slideOK = slideRatio >= Fs;

  // (3) 支持力に対する検討
  // 道路土工―擁壁工指針の直接基礎の考え方に従い、底面合力の偏心を
  // 考慮して地盤反力度を求める。Xh(H) は壁天端の中心を原点とした
  // 底面での合力位置、H*cot(theta0) は底面中心の位置である。
  const baseWidthComputed = b * cosecTheta0;
  const baseWidth = baseWidthOverride != null && baseWidthOverride > 0 ? baseWidthOverride : baseWidthComputed;
  const verticalForce = b * H * gammaB * cosecTheta0;
  const baseCenterX = H * cotTheta0;
  const resultantX = Xh(H);
  const eccentricity = resultantX - baseCenterX;
  const absEccentricity = Math.abs(eccentricity);
  const middleThirdLimit = baseWidth / 6;

  let qmax;
  let qmin;
  let contactWidth;
  let bearingDistribution;

  if (absEccentricity <= middleThirdLimit + 1e-12) {
    // 全幅接地（台形分布）
    const averagePressure = verticalForce / baseWidth;
    const eccentricityFactor = (6 * absEccentricity) / baseWidth;
    qmax = averagePressure * (1 + eccentricityFactor);
    qmin = averagePressure * (1 - eccentricityFactor);
    contactWidth = baseWidth;
    bearingDistribution = "trapezoidal";
  } else if (absEccentricity < baseWidth / 2) {
    // 引張反力を許容せず、圧縮側のみの三角形分布とする。
    contactWidth = 3 * (baseWidth / 2 - absEccentricity);
    qmax = (2 * verticalForce) / contactWidth;
    qmin = 0;
    bearingDistribution = "triangular";
  } else {
    // 合力が底面外にあり、静的な圧縮反力では釣り合わない。
    contactWidth = 0;
    qmax = Infinity;
    qmin = 0;
    bearingDistribution = "outside";
  }

  const bearingOK = Number.isFinite(qmax) && qmax <= qa;

  return {
    inputs: p,
    theta0Deg,
    thetaDeg,
    delta,
    KA,
    H1,
    rawRatio,
    ratioCapped,
    effectiveH0H1,
    X1,
    X2,
    X,
    Iw,
    qw,
    cotTheta0,
    cosecTheta0,
    sinRatio,
    A_coef,
    B_coef,
    table,
    Hmax,
    overturnOK,
    RH,
    sigmaH,
    slideRatio,
    slideOK,
    baseWidthComputed,
    baseWidth,
    verticalForce,
    baseCenterX,
    resultantX,
    eccentricity,
    absEccentricity,
    middleThirdLimit,
    contactWidth,
    qmin,
    qmax,
    bearingDistribution,
    bearingOK,
    sigmaCk,
    qa,
    Fs,
    overallOK: overturnOK && slideOK && bearingOK,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calcBlockWallStability, coulombKA, frohlichIw, deg2rad, rad2deg, cot, cosec };
}
