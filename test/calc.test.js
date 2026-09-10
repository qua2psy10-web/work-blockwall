const test = require("node:test");
const assert = require("node:assert/strict");
const { calcBlockWallStability } = require("../js/calc");

const defaults = {
  H: 3.768,
  n1: 0.5,
  H0: 0,
  beta: 0,
  gammaS: 19,
  phi: 30,
  b: 0.5,
  gammaB: 23,
  q: 5,
  qa: 200,
  sigmaCk: 18,
  f: 0.6,
  Fs: 1.5,
  baseWidthOverride: null,
};

test("標準例は偏心を考慮し、合力が底面外なら支持力NGとする", () => {
  const result = calcBlockWallStability(defaults);

  assert.equal(result.bearingDistribution, "outside");
  assert.equal(result.qmax, Infinity);
  assert.equal(result.bearingOK, false);
});

test("中央1/3内では全幅の台形反力になる", () => {
  const result = calcBlockWallStability({ ...defaults, baseWidthOverride: 3 });

  assert.ok(Math.abs(result.eccentricity) < result.baseWidth / 6);
  assert.equal(result.bearingDistribution, "trapezoidal");
  assert.ok(result.qmax >= result.qmin);
  assert.ok(result.qmin >= 0);
  assert.ok(
    Math.abs((result.qmax + result.qmin) / 2 - result.verticalForce / result.baseWidth) < 1e-9
  );
});

test("中央1/3外では引張を無視した三角形反力になる", () => {
  const result = calcBlockWallStability({ ...defaults, baseWidthOverride: 1.5 });

  assert.equal(result.bearingDistribution, "triangular");
  assert.equal(result.qmin, 0);
  assert.ok(Number.isFinite(result.qmax));
  assert.ok(result.contactWidth > 0 && result.contactWidth < result.baseWidth);
});
