// Deterministic scorer: parser output vs expected.
// Returns per-field booleans + a composite 0..1 score.
// Designed to be charitable on numeric tolerance but strict on hallucinations.

const norm = (s) => (s ?? '').toString().normalize('NFKC').replace(/\s+/g, '').toLowerCase();

function foodSetMatch(actualFoods = [], expectedFoods = []) {
  // Match by normalized name. Order-insensitive.
  const expSet = new Set(expectedFoods.map((f) => norm(f.name)));
  const actSet = new Set((actualFoods || []).map((f) => norm(f.name)));

  let matched = 0;
  for (const n of expSet) if (actSet.has(n)) matched += 1;
  const recall = expSet.size === 0 ? (actSet.size === 0 ? 1 : 0) : matched / expSet.size;
  const precision = actSet.size === 0 ? (expSet.size === 0 ? 1 : 0) : matched / actSet.size;
  const hallucinated = [...actSet].filter((n) => !expSet.has(n));

  // Per-food quantity/unit accuracy among matched foods
  let qtyHits = 0;
  let unitHits = 0;
  let considered = 0;
  for (const exp of expectedFoods) {
    const act = (actualFoods || []).find((f) => norm(f.name) === norm(exp.name));
    if (!act) continue;
    considered += 1;
    if (exp.quantity !== undefined && Math.abs((act.quantity ?? 0) - exp.quantity) < 0.05) qtyHits += 1;
    if (exp.unit !== undefined && norm(act.unit) === norm(exp.unit)) unitHits += 1;
  }
  const qtyAcc = considered === 0 ? 1 : qtyHits / considered;
  const unitAcc = considered === 0 ? 1 : unitHits / considered;

  return { recall, precision, qtyAcc, unitAcc, hallucinated };
}

export function scoreCase(actual, expected) {
  const breakdown = {};

  // Food set
  const foodResult = foodSetMatch(actual?.parsedFoods || [], expected?.parsedFoods || []);
  breakdown.foodRecall = foodResult.recall;
  breakdown.foodPrecision = foodResult.precision;
  breakdown.quantityAcc = foodResult.qtyAcc;
  breakdown.unitAcc = foodResult.unitAcc;
  breakdown.hallucinatedFoods = foodResult.hallucinated;

  // Glucose value
  const expG = expected?.glucoseValue ?? null;
  const actG = actual?.glucoseValue ?? null;
  if (expG === null) {
    breakdown.glucose = actG === null || actG === undefined ? 1 : 0; // hallucinated glucose
  } else {
    breakdown.glucose = actG === expG ? 1 : 0;
  }

  // measType (only score if expected sets one explicitly)
  if (expected?.detectedMeasType !== undefined) {
    breakdown.measType = (actual?.detectedMeasType || 'random') === expected.detectedMeasType ? 1 : 0;
  } else {
    breakdown.measType = null;
  }

  // detectedTime
  if (expected?.detectedTime !== undefined) {
    if (expected.detectedTime === null) {
      breakdown.time = !actual?.detectedTime ? 1 : 0;
    } else {
      breakdown.time = actual?.detectedTime === expected.detectedTime ? 1 : 0;
    }
  } else {
    breakdown.time = null;
  }

  // needsClarification (only check if expected explicit)
  if (expected?.needsClarification !== undefined) {
    breakdown.needsClarification = !!actual?.needsClarification === !!expected.needsClarification ? 1 : 0;
  } else {
    breakdown.needsClarification = null;
  }

  // Composite (weighted average across the metrics that were applicable)
  const weights = {
    foodRecall: 0.20,
    foodPrecision: 0.15,
    quantityAcc: 0.15,
    unitAcc: 0.10,
    glucose: 0.20,
    measType: 0.10,
    time: 0.05,
    needsClarification: 0.05,
  };

  let totalW = 0;
  let totalS = 0;
  for (const [k, w] of Object.entries(weights)) {
    const v = breakdown[k];
    if (v === null || v === undefined) continue;
    totalW += w;
    totalS += w * v;
  }
  const composite = totalW === 0 ? 0 : totalS / totalW;

  return { composite, breakdown };
}

export function summarize(results) {
  const n = results.length;
  if (n === 0) return null;
  const avg = (key) => {
    const vals = results.map((r) => r.score?.breakdown?.[key]).filter((v) => v !== null && v !== undefined);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const composite = results.reduce((a, b) => a + (b.score?.composite || 0), 0) / n;
  const fails = results.filter((r) => (r.score?.composite || 0) < 0.7);
  return {
    n,
    composite,
    pass: n - fails.length,
    fail: fails.length,
    foodRecall: avg('foodRecall'),
    foodPrecision: avg('foodPrecision'),
    quantityAcc: avg('quantityAcc'),
    unitAcc: avg('unitAcc'),
    glucose: avg('glucose'),
    measType: avg('measType'),
    time: avg('time'),
    needsClarification: avg('needsClarification'),
  };
}
