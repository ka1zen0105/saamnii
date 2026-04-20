/**
 * Adds a scaled normal PDF overlay to histogram buckets for charting.
 * @param {{ percentage: string, count: number }[]} buckets
 * @returns {{ label: string, count: number, curve: number }[]}
 */
export function addNormalCurveOverlay(buckets) {
  if (!Array.isArray(buckets) || buckets.length !== 20) {
    return [];
  }

  const mids = buckets.map((_, i) => (i === 19 ? 97.5 : i * 5 + 2.5));
  const counts = buckets.map((b) => b.count);
  const N = counts.reduce((a, b) => a + b, 0);
  if (N === 0) {
    return buckets.map((b, i) => ({
      label: b.percentage,
      count: b.count,
      curve: 0,
    }));
  }

  let mean = 0;
  for (let i = 0; i < mids.length; i += 1) {
    mean += mids[i] * counts[i];
  }
  mean /= N;

  let varSum = 0;
  for (let i = 0; i < mids.length; i += 1) {
    varSum += counts[i] * (mids[i] - mean) ** 2;
  }
  const variance = varSum / N;
  const sigma = Math.sqrt(Math.max(variance, 1e-6));

  const pdf = (x) =>
    Math.exp(-0.5 * ((x - mean) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

  const pdfs = mids.map((m) => pdf(m));
  const maxC = Math.max(...counts, 1);
  const maxP = Math.max(...pdfs, 1e-9);
  const scale = maxC / maxP;

  return buckets.map((b, i) => ({
    label: b.percentage,
    count: b.count,
    curve: scale * pdf(mids[i]),
  }));
}
