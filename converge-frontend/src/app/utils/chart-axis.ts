export interface AxisBarScaleResult {
  yMin: number;
  yMid: number;
  yMax: number;
  yMinLabel: string;
  yMidLabel: string;
  yMaxLabel: string;
  heightsPx: number[];
}

export function formatChartAxisTick(value: number, span: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) {
    const decimals = span > 0 && span < 250_000 ? 2 : 1;
    return (value / 1_000_000).toFixed(decimals) + 'M';
  }
  if (value >= 1_000) {
    const decimals = (span > 0 && span < 20_000) || value < 100_000 ? 1 : 0;
    return (value / 1_000).toFixed(decimals) + 'K';
  }
  return Math.round(value).toLocaleString('en-IN');
}

/**
 * Computes an honest Y-axis range and corresponding pixel bar heights inside a container
 * of heightPx. Zooms the baseline when all points are closely clustered positive numbers so
 * sync-to-sync growth remains legible while matching the printed Y-axis labels accurately.
 */
export function computeAxisBarScale(values: number[], heightPx: number): AxisBarScaleResult {
  const positives = values.filter(v => v > 0);
  if (positives.length === 0) {
    return {
      yMin: 0,
      yMid: 0,
      yMax: 0,
      yMinLabel: '0',
      yMidLabel: '—',
      yMaxLabel: '—',
      heightsPx: values.map(() => 4)
    };
  }

  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const useZoomedBaseline = minVal > 0 && maxVal > minVal && (maxVal - minVal) / maxVal < 0.25;

  const yMax = maxVal;
  const yMin = useZoomedBaseline
    ? Math.max(0, Math.floor(minVal - (maxVal - minVal) * 0.4))
    : 0;
  const span = Math.max(1, yMax - yMin);
  const yMid = Math.round(yMin + span / 2);

  const heightsPx = values.map(v => {
    if (v <= 0) return 4;
    if (yMax === yMin) return Math.round(heightPx * 0.72);
    const ratio = (v - yMin) / span;
    return Math.max(6, Math.min(heightPx, Math.round(ratio * heightPx)));
  });

  return {
    yMin,
    yMid,
    yMax,
    yMinLabel: formatChartAxisTick(yMin, span),
    yMidLabel: formatChartAxisTick(yMid, span),
    yMaxLabel: formatChartAxisTick(yMax, span),
    heightsPx
  };
}

export function formatShortAxisDate(dateValue?: string | null): string {
  if (!dateValue) return '';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(parsed);
}

export function formatSyncAxisLabel(index: number, capturedAt?: string | null, includeTime = false): string {
  const prefix = `#${index + 1}`;
  if (!capturedAt) return prefix;
  const parsed = new Date(capturedAt);
  if (Number.isNaN(parsed.getTime())) return prefix;
  if (includeTime) {
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(parsed);
    return `${prefix} · ${time}`;
  }
  return `${prefix} · ${formatShortAxisDate(capturedAt)}`;
}
