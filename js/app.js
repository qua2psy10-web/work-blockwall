const form = document.getElementById("calc-form");
const resultsEl = document.getElementById("results");
const errorEl = document.getElementById("error-box");
const baseWidthOverrideInput = document.getElementById("baseWidthOverride");
const baseWidthAutoLabel = document.getElementById("baseWidthAutoValue");
const modelDiagramEl = document.getElementById("model-diagram");
const betaFromN2Label = document.getElementById("betaFromN2");
const slopeWarningEl = document.getElementById("slope-warning");

function num(id) {
  const v = document.getElementById(id).value;
  return v === "" ? NaN : parseFloat(v);
}

function fmt(v, digits = 3) {
  if (!Number.isFinite(v)) return "―";
  return v.toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// 盛土傾斜を前面勾配と同じ「1:n2」形式で受け取り、角度βに変換する。
// 空欄・0以下は水平(β=0°)として扱う。
function n2ToBetaDeg() {
  const n2 = num("n2");
  if (!Number.isFinite(n2) || n2 <= 0) return 0;
  return rad2deg(Math.atan(1 / n2));
}

function readInputs() {
  return {
    H: num("H"),
    n1: num("n1"),
    H0: num("H0"),
    beta: n2ToBetaDeg(),
    gammaS: num("gammaS"),
    phi: num("phi"),
    b: num("b"),
    gammaB: num("gammaB"),
    q: num("q"),
    qa: num("qa"),
    sigmaCk: num("sigmaCk"),
    f: num("f"),
    Fs: num("Fs"),
    baseWidthOverride: baseWidthOverrideInput.value === "" ? null : parseFloat(baseWidthOverrideInput.value),
    n2Raw: document.getElementById("n2").value === "" ? null : num("n2"),
    wallName: document.getElementById("wallName").value,
  };
}

function judgeBadge(ok) {
  return `<span class="badge ${ok ? "badge-ok" : "badge-ng"}">${ok ? "OK" : "NG"}</span>`;
}

// 入力欄の値から擁壁断面の概略図(SVG)を組み立てる。
// 壁体は厚さb(法線方向)・勾配1:n1の平行四辺形（クーロン式のθ0=atan(1/n1)で傾く1枚の板）とみなす。
function renderModelDiagram(p) {
  const { H, n1, H0, beta, b, q } = p;
  if (![H, n1, H0, beta, b, q].every(Number.isFinite) || H <= 0 || n1 <= 0 || b <= 0) {
    return '<p class="note">H・n1・H0・β・b・q に数値を入力すると概略図が表示されます。</p>';
  }

  const betaRad = deg2rad(beta);
  const sinTheta0 = 1 / Math.sqrt(1 + n1 * n1);
  const B = b / sinTheta0; // 壁厚bをn1勾配に投影した水平換算幅

  const backTop = { x: 0, y: 0 };
  const backBottom = { x: -n1 * H, y: H };
  const frontTop = { x: -B, y: 0 };
  const frontBottom = { x: -B - n1 * H, y: H };

  const betaRun = beta > 0.01 ? H0 / Math.tan(betaRad) : 0;
  const slopeTop = { x: betaRun, y: -H0 };
  const flatLen = Math.max(1.5, H * 0.55);
  const flatEnd = { x: slopeTop.x + flatLen, y: -H0 };

  const frontGroundLen = Math.max(1.0, H * 0.3);
  const frontGroundEnd = { x: frontBottom.x - frontGroundLen, y: H };

  const pts = [backTop, backBottom, frontTop, frontBottom, slopeTop, flatEnd, frontGroundEnd];
  const xMin = Math.min(...pts.map((pt) => pt.x));
  const xMax = Math.max(...pts.map((pt) => pt.x));
  const yMin = Math.min(...pts.map((pt) => pt.y));
  const yMax = Math.max(...pts.map((pt) => pt.y));

  const marginM = Math.max(H, 1) * 0.22;
  const marginTop = marginM * 1.7; // 上載荷重の矢印・ラベル分の余白
  const worldW = xMax - xMin + marginM * 2;
  const worldH = yMax - yMin + marginTop + marginM;

  const pxW = 480;
  const scale = pxW / worldW;
  const pxH = worldH * scale;

  const toPx = (pt) => ({
    x: (pt.x - xMin + marginM) * scale,
    y: (pt.y - yMin + marginTop) * scale,
  });
  const P = (pt) => `${toPx(pt).x.toFixed(1)},${toPx(pt).y.toFixed(1)}`;

  const wallPoly = [backTop, frontTop, frontBottom, backBottom].map(P).join(" ");
  const soilPoly = [backTop, slopeTop, flatEnd, { x: flatEnd.x, y: H }, backBottom].map(P).join(" ");

  // 上載荷重qの矢印（等間隔）
  const arrowCount = 5;
  let arrows = "";
  for (let i = 0; i < arrowCount; i++) {
    const t = (i + 0.5) / arrowCount;
    const ax = slopeTop.x + (flatEnd.x - slopeTop.x) * t;
    const top = toPx({ x: ax, y: -H0 - marginM * 0.55 });
    const bottom = toPx({ x: ax, y: -H0 });
    arrows += `<line x1="${top.x}" y1="${top.y}" x2="${bottom.x}" y2="${bottom.y}" class="load-arrow" marker-end="url(#arrowhead)" />`;
  }

  const groundLineTop = toPx({ x: slopeTop.x, y: -H0 - marginM * 0.55 });
  const groundLineEnd = toPx({ x: flatEnd.x, y: -H0 - marginM * 0.55 });

  const backTopPx = toPx(backTop);
  const backBottomPx = toPx(backBottom);
  const frontTopPx = toPx(frontTop);
  const slopeTopPx = toPx(slopeTop);

  // 寸法線: H (擁壁高さ、左端に縦線)
  const dimX = toPx({ x: xMin, y: 0 }).x - 14;
  const hDimTop = toPx({ x: xMin, y: 0 });
  const hDimBottom = toPx({ x: xMin, y: H });

  const labelQ = toPx({ x: (slopeTop.x + flatEnd.x) / 2, y: -H0 - marginM * 0.75 });

  return `
    <svg viewBox="0 0 ${pxW.toFixed(1)} ${pxH.toFixed(1)}" class="model-svg" role="img" aria-label="擁壁断面概略図">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto">
          <path d="M0,0 L8,0 L4,7 Z" class="load-arrow-head" />
        </marker>
        <pattern id="soil-hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" class="soil-hatch-line" />
        </pattern>
      </defs>

      <polygon points="${soilPoly}" class="soil-fill" />
      <polygon points="${soilPoly}" fill="url(#soil-hatch)" />

      <line x1="${toPx(frontGroundEnd).x}" y1="${toPx(frontGroundEnd).y}" x2="${toPx(frontBottom).x}" y2="${toPx(frontBottom).y}" class="ground-line" />
      <line x1="${groundLineTop.x}" y1="${groundLineTop.y}" x2="${groundLineEnd.x}" y2="${groundLineEnd.y}" class="ground-line" />
      ${arrows}
      <text x="${labelQ.x}" y="${labelQ.y - 4}" class="diagram-text" text-anchor="middle">q=${fmt(q, 2)} kN/m²</text>

      <polygon points="${wallPoly}" class="wall-fill" />
      <polygon points="${wallPoly}" class="wall-outline" />

      <line x1="${hDimTop.x}" y1="${hDimTop.y}" x2="${dimX}" y2="${hDimTop.y}" class="dim-line" />
      <line x1="${hDimBottom.x}" y1="${hDimBottom.y}" x2="${dimX}" y2="${hDimBottom.y}" class="dim-line" />
      <line x1="${dimX}" y1="${hDimTop.y}" x2="${dimX}" y2="${hDimBottom.y}" class="dim-line" marker-start="url(#arrowhead)" marker-end="url(#arrowhead)" />
      <text x="${dimX - 6}" y="${(hDimTop.y + hDimBottom.y) / 2}" class="diagram-text" text-anchor="end" transform="rotate(-90 ${dimX - 6} ${(hDimTop.y + hDimBottom.y) / 2})">H=${fmt(H, 3)}m</text>

      <text x="${(backTopPx.x + frontTopPx.x) / 2}" y="${backTopPx.y - 6}" class="diagram-text" text-anchor="middle">b=${fmt(b, 3)}m</text>
      <text x="${(backTopPx.x + backBottomPx.x) / 2 + 10}" y="${(backTopPx.y + backBottomPx.y) / 2}" class="diagram-text" text-anchor="start">1:${fmt(n1, 2)}</text>

      ${
        H0 > 0
          ? `<text x="${(backTopPx.x + slopeTopPx.x) / 2 + 6}" y="${(backTopPx.y + slopeTopPx.y) / 2}" class="diagram-text" text-anchor="start">H0=${fmt(H0, 2)}m, β=${fmt(beta, 1)}°</text>`
          : ""
      }
    </svg>
  `;
}

function render(result) {
  const r = result;
  const p = r.inputs;

  const tableRows = r.table
    .map(
      (row) => `<tr class="${row.ok ? "" : "row-ng"}">
        <td>${fmt(row.Y, 3)}</td>
        <td>${fmt(row.Xprime, 3)}</td>
        <td>${fmt(row.Xh, 3)}</td>
        <td>${judgeBadge(row.ok)}</td>
      </tr>`
    )
    .join("");

  resultsEl.innerHTML = `
    <div class="print-actions">
      <button type="button" id="print-pdf-btn" class="secondary">🖨 PDF出力（印刷）</button>
    </div>

    <div class="screen-only">
    <div class="summary-banner ${r.overallOK ? "summary-ok" : "summary-ng"}">
      ${r.overallOK ? "総合判定：安全（すべての照査項目でOK）" : "総合判定：要見直し（NG項目があります）"}
    </div>

    <section class="card">
      <h2>入力した設計条件</h2>
      <table class="kv">
        <tr><th>裏込め土 単位体積重量 γs</th><td>${fmt(p.gammaS)} kN/m³</td></tr>
        <tr><th>裏込め土 内部摩擦角 φ</th><td>${fmt(p.phi, 1)} °</td></tr>
        <tr><th>壁体厚 t (b)</th><td>${fmt(p.b)} m</td></tr>
        <tr><th>ブロック積単位重量 γb</th><td>${fmt(p.gammaB)} kN/m³</td></tr>
        <tr><th>活荷重 q</th><td>${fmt(p.q)} kN/m²</td></tr>
        <tr><th>擁壁高さ H</th><td>${fmt(p.H, 3)} m</td></tr>
        <tr><th>前面勾配</th><td>1:${fmt(p.n1, 2)}</td></tr>
        <tr><th>盛土高 H0</th><td>${fmt(p.H0, 2)} m</td></tr>
        <tr><th>盛土傾斜</th><td>${p.n2Raw != null ? `1:${fmt(p.n2Raw, 2)}` : "水平（0）"}</td></tr>
        <tr><th>許容支持力度 qa</th><td>${fmt(p.qa)} kN/m²</td></tr>
        <tr><th>基礎地盤との摩擦係数 f</th><td>${fmt(p.f, 2)}</td></tr>
        <tr><th>滑動に対する必要安全率 Fs</th><td>${fmt(p.Fs, 2)}</td></tr>
      </table>
      <div class="diagram-wrap">${renderModelDiagram({ H: p.H, n1: p.n1, H0: p.H0, beta: p.beta, b: p.b, q: p.q })}</div>
    </section>

    <section class="card">
      <h2>形状・角度</h2>
      <table class="kv">
        <tr><th>壁背面角 θ<sub>0</sub></th><td>${fmt(r.theta0Deg)} °</td></tr>
        <tr><th>クーロン式用角 θ (=180-θ<sub>0</sub>)</th><td>${fmt(r.thetaDeg)} °</td></tr>
        <tr><th>壁面摩擦角 δ (=2φ/3)</th><td>${fmt(r.delta)} °</td></tr>
        <tr><th>盛土傾斜角 β (=地表面角 i)</th><td>${fmt(p.beta)} °</td></tr>
        <tr><th>主働土圧係数 K<sub>A</sub></th><td>${fmt(r.KA, 4)}</td></tr>
      </table>
    </section>

    <section class="card">
      <h2>荷重計算（上載荷重の等分布荷重換算）</h2>
      <table class="kv">
        <tr><th>換算盛土高さ H<sub>1</sub> (=q/γs)</th><td>${fmt(r.H1)} m</td></tr>
        <tr><th>(H0+H1)/H</th><td>${fmt(r.rawRatio)} ${r.ratioCapped ? "（1に補正して計算）" : ""}</td></tr>
        <tr><th>仮想距離 X2</th><td>${fmt(r.X2)} m</td></tr>
        <tr><th>仮想距離 X (=X1+X2/2)</th><td>${fmt(r.X)} m</td></tr>
        <tr><th>台形荷重換算係数 Iw</th><td>${fmt(r.Iw, 4)}</td></tr>
        <tr><th>盛土荷重の換算等分布荷重 qw</th><td>${fmt(r.qw)} kN/m²</td></tr>
      </table>
    </section>

    <section class="card">
      <h2>(1) 転倒に対する検討（示力線法）</h2>
      <p class="note">照査方法：示力線が断面の中央1/3の範囲内にあること（X' ≧ Xh）</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>高さ Y (m)</th><th>ミドルサード X' (m)</th><th>合力位置 Xh (m)</th><th>判定</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <table class="kv">
        <tr><th>安定最大高さ H<sub>max</sub></th><td>${fmt(r.Hmax)} m</td></tr>
        <tr><th>転倒判定（H=${fmt(p.H,3)}mにて）</th><td>${judgeBadge(r.overturnOK)}</td></tr>
      </table>
    </section>

    <section class="card">
      <h2>(2) 滑動に対する検討</h2>
      <table class="kv">
        <tr><th>滑動抵抗力 R<sub>H</sub></th><td>${fmt(r.RH)} kN/m</td></tr>
        <tr><th>全水平力 ΣH</th><td>${fmt(r.sigmaH)} kN/m</td></tr>
        <tr><th>R<sub>H</sub>/ΣH</th><td>${fmt(r.slideRatio, 2)}（必要安全率 Fs=${fmt(p.Fs,2)}）</td></tr>
        <tr><th>滑動判定</th><td>${judgeBadge(r.slideOK)}</td></tr>
      </table>
    </section>

    <section class="card">
      <h2>(3) 支持力に対する検討</h2>
      <table class="kv">
        <tr><th>基礎幅 B（自動計算値: ${fmt(r.baseWidthComputed)} m）</th><td>${fmt(r.baseWidth)} m</td></tr>
        <tr><th>最大地盤反力 q<sub>max</sub></th><td>${fmt(r.qmax)} kN/m²</td></tr>
        <tr><th>許容地盤支持力 q<sub>a</sub></th><td>${fmt(p.qa)} kN/m²</td></tr>
        <tr><th>支持力判定</th><td>${judgeBadge(r.bearingOK)}</td></tr>
      </table>
    </section>

    <section class="card">
      <h2>参考：許容応力度</h2>
      <table class="kv">
        <tr><th>コンクリート設計基準強度 σck</th><td>${fmt(p.sigmaCk, 2)} N/mm²（表示のみ・本計算では未使用）</td></tr>
      </table>
    </section>

    <section class="card">
      <h2>示力線図</h2>
      <div class="diagram-wrap">${renderDiagram(r, p)}</div>
    </section>
    </div>

    <div class="print-report">${buildPrintReport(r, p)}</div>
  `;

  baseWidthAutoLabel.textContent = `自動計算値: ${fmt(r.baseWidthComputed)} m`;
}

// 添付資料と同じ体裁（設計条件→荷重計算→安定計算の番号立て、数値代入式）で
// 印刷／PDF出力用のレポートHTMLを組み立てる。画面表示はrender()内の.screen-onlyが担う。
function buildPrintReport(r, p) {
  const wallName = p.wallName && p.wallName.trim() ? p.wallName.trim() : "（名称未設定）";
  const sinTheta = Math.sin(deg2rad(r.thetaDeg));
  const lastRow = r.table[r.table.length - 1];

  const tableRows = r.table
    .map(
      (row, i) => `<tr class="${row.ok ? "" : "row-ng"}">
        <td>${i + 1}</td>
        <td>${fmt(row.Y, 3)}</td>
        <td>${fmt(row.Xprime, 3)}</td>
        <td>${fmt(row.Xh, 3)}</td>
        <td>${row.ok ? "OK" : "NG"}</td>
      </tr>`
    )
    .join("");

  return `
    <h1 class="print-title">ブロック積（石積）擁壁安定計算</h1>
    <p class="print-subtitle">擁壁名称：${wallName}</p>

    <section class="print-section">
      <h2>１．設計条件</h2>

      <div class="print-subsection">
        <h3>(1) 裏込め土</h3>
        <p>単位体積重量　γs = ${fmt(p.gammaS)} kN/m³</p>
        <p>内部摩擦角　φ = ${fmt(p.phi, 1)}°</p>
      </div>

      <div class="print-subsection">
        <h3>(2) 壁体</h3>
        <p>壁体厚　t(b) = ${fmt(p.b)} m</p>
        <p>ブロック積単位重量　γb = ${fmt(p.gammaB)} kN/m³</p>
      </div>

      <div class="print-subsection">
        <h3>(3) 載荷重</h3>
        <p>活荷重　q = ${fmt(p.q)} kN/m²</p>
      </div>

      <div class="print-subsection">
        <h3>(4) 安定条件</h3>
        <p>転倒：示力線が断面の中央1/3から出ない</p>
        <p>許容支持力度　qa = ${fmt(p.qa)} kN/m²</p>
        <p>滑動に対する必要安全率　Fs = ${fmt(p.Fs, 2)}</p>
        <p>基礎地盤との摩擦係数　f = ${fmt(p.f, 2)}</p>
      </div>

      <div class="print-subsection">
        <h3>(5) 許容応力度</h3>
        <p>コンクリートの設計基準強度　σck = ${fmt(p.sigmaCk, 1)} N/mm²（参考表示のみ）</p>
      </div>

      <div class="print-subsection">
        <h3>(6) 形状寸法</h3>
        <p>ブロック積擁壁高　H = ${fmt(p.H, 3)} m</p>
        <p>ブロック積前面勾配　1:n1 = 1:${fmt(p.n1, 2)}</p>
        <p>盛土高　H0 = ${fmt(p.H0, 3)} m</p>
        <p>盛土傾斜　${p.n2Raw != null ? `1:n2 = 1:${fmt(p.n2Raw, 2)}（β=${fmt(p.beta, 1)}°）` : `水平（β=0°）`}</p>
      </div>

      <div class="diagram-wrap">${renderModelDiagram({ H: p.H, n1: p.n1, H0: p.H0, beta: p.beta, b: p.b, q: p.q })}</div>
    </section>

    <section class="print-section print-page-break">
      <h2>２．荷重計算</h2>
      <p>上載荷重を盛土高に換算し、盛土荷重として扱い、さらにこの盛土荷重を等分布荷重に換算する。</p>

      <div class="print-subsection">
        <h3>(1) 上載荷重の盛土換算</h3>
        <p>H1 = q／γs = ${fmt(p.q)}／${fmt(p.gammaS)} = ${fmt(r.H1)} m</p>
        <p>(H0+H1)／H = (${fmt(p.H0, 3)}＋${fmt(r.H1)})／${fmt(p.H, 3)} = ${fmt(r.rawRatio)} ${r.ratioCapped ? "＞1のため1として計算" : "≦1"}</p>
      </div>

      <div class="print-subsection">
        <h3>(2) 換算荷重（フローリッヒの地盤応力理論）</h3>
        <p>X2 = (H0+H1)・tanβ = ${fmt(r.effectiveH0H1)}×tan${fmt(p.beta, 1)}° = ${fmt(r.X2)} m</p>
        <p>X = X1＋X2／2 = ${fmt(r.X1)}＋${fmt(r.X2)}／2 = ${fmt(r.X)} m</p>
        <p>台形荷重換算係数　Iw(X／H=${fmt(r.X / p.H, 3)}) = ${fmt(r.Iw, 4)}</p>
        <p>qw = γ・(H0+H1)・Iw = ${fmt(p.gammaS)}×${fmt(r.effectiveH0H1)}×${fmt(r.Iw, 4)} ≒ ${fmt(r.qw)} kN/m²</p>
      </div>
    </section>

    <section class="print-section print-page-break">
      <h2>３．安定計算</h2>

      <div class="print-subsection">
        <h3>(1) 転倒に対する検討（示力線法）</h3>
        <p>ブロック積底部の示力線位置Xhがミドルサードの内側にあることを確認する。</p>
        <p>θ=${fmt(r.thetaDeg)}°、φ=${fmt(p.phi, 1)}°、δ(=2φ/3)=${fmt(r.delta)}°、i(=β)=${fmt(p.beta, 1)}° をクーロンの主働土圧公式に代入すると、</p>
        <p>KA ≒ ${fmt(r.KA, 4)}</p>
        <p>Xh = [KA・γs／(6・γb・b・cosecθ0)]×H² ＋ [(KA・qw・sinθ／sin(θ+i))／(2・γb・b・cosecθ0) ＋ cotθ0／2]×H</p>
        <p>　= [(${fmt(r.KA, 4)}×${fmt(p.gammaS)})／(6×${fmt(p.gammaB)}×${fmt(p.b)}×${fmt(r.cosecTheta0, 3)})]×${fmt(p.H, 3)}²
          ＋ [(${fmt(r.KA, 4)}×${fmt(r.qw)}×${fmt(r.sinRatio, 3)})／(2×${fmt(p.gammaB)}×${fmt(p.b)}×${fmt(r.cosecTheta0, 3)}) ＋ ${fmt(r.cotTheta0, 3)}／2]×${fmt(p.H, 3)}</p>
        <p>　≒ ${fmt(lastRow.Xh)} m</p>
        <p>X' = H・cotθ0 ＋ b・cosecθ0／6 = ${fmt(p.H, 3)}×${fmt(r.cotTheta0, 3)} ＋ ${fmt(p.b)}×${fmt(r.cosecTheta0, 3)}／6 ≒ ${fmt(lastRow.Xprime)} m</p>
        <p>X' ${r.overturnOK ? "≧" : "＜"} Xh ・・・ ${r.overturnOK ? "OK　転倒に対して安定である。" : "NG　転倒に対して要検討である。"}</p>
        <p>従って、安定最大高さ　Hmax = ${fmt(r.Hmax)} m</p>
      </div>

      <div class="print-subsection print-page-break">
        <h3>示力線法による合力位置の計算表</h3>
        <p class="note">照査方法：示力線が断面の中央1/3から出ない</p>
        <div class="table-wrap">
          <table class="data-table print-calc-table">
            <thead><tr><th>NO</th><th>高さ Y (m)</th><th>断面幅 X' (m)</th><th>合力位置 Xh (m)</th><th>安定条件 X'≧Xh</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>

      <div class="print-subsection print-page-break">
        <h3>示力線図</h3>
        <div class="diagram-wrap">${renderDiagram(r, p)}</div>
      </div>

      <div class="print-subsection print-page-break">
        <h3>(2) 滑動に対する検討</h3>
        <p>RH／ΣH ≧ Fs</p>
        <p>RH = ΣV・f = b・γb・H・cosecθ0・f</p>
        <p>　= ${fmt(p.b)}×${fmt(p.gammaB)}×${fmt(p.H, 3)}×${fmt(r.cosecTheta0, 3)}×${fmt(p.f, 2)} ≒ ${fmt(r.RH, 2)} kN/m</p>
        <p>ΣH = [1／2・KA・γs・H² ＋ KA・qw・sinθ／sin(θ+i)・H]・sinθ</p>
        <p>　= [1／2×${fmt(r.KA, 4)}×${fmt(p.gammaS)}×${fmt(p.H, 3)}² ＋ ${fmt(r.KA, 4)}×${fmt(r.qw)}×${fmt(r.sinRatio, 3)}×${fmt(p.H, 3)}]×${fmt(sinTheta, 3)} ≒ ${fmt(r.sigmaH, 2)} kN/m</p>
        <p>RH／ΣH = ${fmt(r.RH, 2)}／${fmt(r.sigmaH, 2)} ≒ ${fmt(r.slideRatio, 2)} ${r.slideOK ? "＞" : "＜"} ${fmt(p.Fs, 2)}
          ・・・ ${r.slideOK ? "OK　安全率以上で安全である。" : "NG　必要安全率を満たさない。"}</p>
      </div>

      <div class="print-subsection">
        <h3>(3) 支持力に対する検討</h3>
        <p>qmax ≦ qa</p>
        <p>qmax = (b・H・γb・cosecθ0)／B = (${fmt(p.b)}×${fmt(p.H, 3)}×${fmt(p.gammaB)}×${fmt(r.cosecTheta0, 3)})／${fmt(r.baseWidth, 3)} ≒ ${fmt(r.qmax, 2)} kN/m²</p>
        <p>qmax ${r.bearingOK ? "＜" : "≧"} qa=${fmt(p.qa)} ・・・ ${r.bearingOK ? "OK　許容地盤支持力以下で安全である。" : "NG　許容地盤支持力を超える。"}</p>
      </div>
    </section>

    <p class="print-footer-note">総合判定：${r.overallOK ? "安全（すべての照査項目でOK）" : "要見直し（NG項目があります）"}</p>
  `;
}

function renderDiagram(r, p) {
  const H = p.H;
  const width = 420;
  const height = 460;
  const marginTop = 30;
  const marginBottom = 40;
  const marginLeft = 90;
  const plotH = height - marginTop - marginBottom;
  const scaleY = plotH / H;

  const maxX = Math.max(r.table[r.table.length - 1].Xprime, 0.1) * 1.15;
  const plotW = width - marginLeft - 30;
  const scaleX = plotW / maxX;

  const yToPx = (Y) => marginTop + Y * scaleY;
  const xToPx = (X) => marginLeft + X * scaleX;

  const primePoints = r.table.map((row) => `${xToPx(row.Xprime)},${yToPx(row.Y)}`).join(" ");
  const hPoints = r.table.map((row) => `${xToPx(row.Xh)},${yToPx(row.Y)}`).join(" ");

  // グリッド線（高さ方向、1m刻み）
  let gridLines = "";
  for (let g = 0; g <= H; g += 1) {
    const py = yToPx(g);
    gridLines += `<line x1="${marginLeft}" y1="${py}" x2="${width - 20}" y2="${py}" class="grid-line" />`;
    gridLines += `<text x="${width - 15}" y="${py + 4}" class="axis-label">${g.toFixed(1)}</text>`;
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="diagram-svg" role="img" aria-label="示力線図">
      ${gridLines}
      <line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${height - marginBottom}" class="axis-line" />
      <polyline points="${primePoints}" class="line-prime" />
      <polyline points="${hPoints}" class="line-xh" />
      <text x="${marginLeft - 70}" y="${marginTop - 10}" class="axis-title">合力位置(m)</text>
      <text x="${width - 45}" y="${height - marginBottom + 25}" class="axis-title">高さ(m)</text>
      <g transform="translate(${marginLeft + 10}, ${height - 15})">
        <line x1="0" y1="-4" x2="20" y2="-4" class="line-prime" />
        <text x="24" y="0" class="legend-label">ミドルサード X'</text>
        <line x1="150" y1="-4" x2="170" y2="-4" class="line-xh" />
        <text x="174" y="0" class="legend-label">合力位置 Xh</text>
      </g>
    </svg>
  `;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  errorEl.textContent = "";
  try {
    const inputs = readInputs();
    for (const [k, v] of Object.entries(inputs)) {
      if (k === "baseWidthOverride" || k === "n2Raw" || k === "wallName") continue;
      if (!Number.isFinite(v)) {
        throw new Error("すべての入力欄に数値を入力してください。");
      }
    }
    const result = calcBlockWallStability(inputs);
    render(result);
    resultsEl.hidden = false;
  } catch (err) {
    errorEl.textContent = err.message || String(err);
    errorEl.hidden = false;
    resultsEl.hidden = true;
  }
});

resultsEl.addEventListener("click", (e) => {
  if (e.target.closest("#print-pdf-btn")) {
    window.print();
  }
});

document.getElementById("reset-defaults").addEventListener("click", () => {
  form.reset();
  baseWidthOverrideInput.value = "";
  errorEl.hidden = true;
  resultsEl.hidden = true;
  updateModelDiagram();
});

function updateModelDiagram() {
  const beta = n2ToBetaDeg();
  betaFromN2Label.textContent = `β = ${fmt(beta, 1)} °`;
  modelDiagramEl.innerHTML = renderModelDiagram({
    H: num("H"),
    n1: num("n1"),
    H0: num("H0"),
    beta,
    b: num("b"),
    q: num("q"),
  });

  const H0 = num("H0");
  const n2 = num("n2");
  slopeWarningEl.hidden = !(Number.isFinite(H0) && H0 <= 0 && Number.isFinite(n2) && n2 > 0);
}

["H", "n1", "H0", "n2", "b", "q"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updateModelDiagram);
});

// 初期表示（サンプル：資料の計算例と同条件）
updateModelDiagram();
form.dispatchEvent(new Event("submit"));
