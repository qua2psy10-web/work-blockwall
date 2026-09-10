const form = document.getElementById("calc-form");
const resultsEl = document.getElementById("results");
const errorEl = document.getElementById("error-box");
const baseWidthOverrideInput = document.getElementById("baseWidthOverride");
const baseWidthAutoLabel = document.getElementById("baseWidthAutoValue");

function num(id) {
  const v = document.getElementById(id).value;
  return v === "" ? NaN : parseFloat(v);
}

function fmt(v, digits = 3) {
  if (!Number.isFinite(v)) return "―";
  return v.toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function readInputs() {
  return {
    H: num("H"),
    n1: num("n1"),
    H0: num("H0"),
    beta: num("beta"),
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
  };
}

function judgeBadge(ok) {
  return `<span class="badge ${ok ? "badge-ok" : "badge-ng"}">${ok ? "OK" : "NG"}</span>`;
}

function bearingDistributionLabel(type) {
  if (type === "trapezoidal") return "全幅接地（台形分布）";
  if (type === "triangular") return "部分接地（三角形分布）";
  return "合力が底面外（支持不能）";
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
    <div class="summary-banner ${r.overallOK ? "summary-ok" : "summary-ng"}">
      ${r.overallOK ? "総合判定：安全（すべての照査項目でOK）" : "総合判定：要見直し（NG項目があります）"}
    </div>

    <section class="card">
      <h2>形状・角度</h2>
      <table class="kv">
        <tr><th>壁背面角 θ<sub>0</sub></th><td>${fmt(r.theta0Deg)} °</td></tr>
        <tr><th>クーロン式用角 θ (=180-θ<sub>0</sub>)</th><td>${fmt(r.thetaDeg)} °</td></tr>
        <tr><th>壁面摩擦角 δ (=2φ/3)</th><td>${fmt(r.delta)} °</td></tr>
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
        <tr><th>底面鉛直合力 ΣV</th><td>${fmt(r.verticalForce)} kN/m</td></tr>
        <tr><th>底面中心位置</th><td>${fmt(r.baseCenterX)} m</td></tr>
        <tr><th>合力作用位置 Xh</th><td>${fmt(r.resultantX)} m</td></tr>
        <tr><th>偏心距離 e (=Xh−底面中心)</th><td>${fmt(r.eccentricity)} m（|e|≦B/6=${fmt(r.middleThirdLimit)} m）</td></tr>
        <tr><th>地盤反力分布</th><td>${bearingDistributionLabel(r.bearingDistribution)}</td></tr>
        <tr><th>有効接地幅</th><td>${fmt(r.contactWidth)} m</td></tr>
        <tr><th>最小地盤反力 q<sub>min</sub></th><td>${fmt(r.qmin)} kN/m²</td></tr>
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
  `;

  baseWidthAutoLabel.textContent = `自動計算値: ${fmt(r.baseWidthComputed)} m`;
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
      if (k === "baseWidthOverride") continue;
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

document.getElementById("reset-defaults").addEventListener("click", () => {
  form.reset();
  baseWidthOverrideInput.value = "";
  errorEl.hidden = true;
  resultsEl.hidden = true;
});

// 初期表示（サンプル：資料の計算例と同条件）
form.dispatchEvent(new Event("submit"));
