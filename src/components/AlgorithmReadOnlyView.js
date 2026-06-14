import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
} from 'recharts';

const formatValue = (value) => {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4);
  }
  if (value === null || value === undefined) return 'N/A';
  return String(value);
};

const normalizeDateKey = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.includes('T') ? value.split('T')[0] : value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
};

const getFirstNumericValue = (sources, keys = []) => {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }
  }
  return null;
};

const formatMetricValue = (value, metricKey) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  if (metricKey === 'r2') return value.toFixed(4);
  if (['accuracy', 'recall', 'f1', 'precision', 'directionalAccuracy', 'valAccuracy', 'avgBottomProb', 'avgPeakProb'].includes(metricKey)) {
    const normalized = value <= 1 ? value * 100 : value;
    return `${normalized.toFixed(2)}%`;
  }
  return value.toFixed(4);
};

const buildPerformanceCards = (jobResult) => {
  if (!jobResult || typeof jobResult !== 'object') return [];

  const sources = [jobResult.metrics, jobResult.testStats, jobResult.finalMetrics, jobResult.trainingResult?.metrics, jobResult.summary, jobResult.training, jobResult];

  const confusion =
    jobResult?.metrics?.confusionMatrix ||
    jobResult?.testStats?.confusionMatrix ||
    jobResult?.confusionMatrix ||
    null;

  let derived = {};
  if (Array.isArray(confusion) && confusion.length >= 2) {
    const tn = Number(confusion?.[0]?.[0] ?? 0);
    const fp = Number(confusion?.[0]?.[1] ?? 0);
    const fn = Number(confusion?.[1]?.[0] ?? 0);
    const tp = Number(confusion?.[1]?.[1] ?? 0);
    const total = tn + fp + fn + tp;
    if (total > 0) {
      const precision = tp + fp > 0 ? tp / (tp + fp) : null;
      const recall = tp + fn > 0 ? tp / (tp + fn) : null;
      const accuracy = (tp + tn) / total;
      const f1 = precision !== null && recall !== null && precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : null;
      derived = { precision, recall, accuracy, f1 };
    }
  }

  const primary = [
    { key: 'r2', label: 'R²', value: getFirstNumericValue(sources, ['r2', 'rSquared']) },
    { key: 'accuracy', label: 'Accuracy', value: getFirstNumericValue(sources, ['accuracy', 'valAccuracy', 'finalAccuracy']) ?? derived.accuracy ?? null },
    { key: 'recall', label: 'Recall', value: getFirstNumericValue(sources, ['recall']) ?? derived.recall ?? null },
    { key: 'f1', label: 'F1 Score', value: getFirstNumericValue(sources, ['f1', 'f1Score']) ?? derived.f1 ?? null },
  ].filter((card) => card.value !== null);

  const secondary = [
    { key: 'precision', label: 'Precision', value: getFirstNumericValue(sources, ['precision']) ?? derived.precision ?? null },
    { key: 'mae', label: 'MAE', value: getFirstNumericValue(sources, ['mae', 'valMAE']) },
    { key: 'rmse', label: 'RMSE', value: getFirstNumericValue(sources, ['rmse']) },
    { key: 'directionalAccuracy', label: 'Directional Accuracy', value: getFirstNumericValue(sources, ['directionalAccuracy']) },
  ].filter((card) => card.value !== null);

  const summary = jobResult?.summary || {};
  const training = jobResult?.training || {};
  if (jobResult?.algorithm === 'bottomPeakLSTM') {
    const predictions = Array.isArray(jobResult?.predictions) ? jobResult.predictions : [];
    const avgBottomProb = predictions.length
      ? predictions.reduce((sum, item) => sum + (Number(item.bottomProb) || 0), 0) / predictions.length
      : null;
    const avgPeakProb = predictions.length
      ? predictions.reduce((sum, item) => sum + (Number(item.peakProb) || 0), 0) / predictions.length
      : null;

    return [
      { key: 'accuracy', label: 'Accuracy', value: training.finalAccuracy ?? getFirstNumericValue(sources, ['accuracy']) ?? null },
      { key: 'valAccuracy', label: 'Validation Accuracy', value: training.finalValidationAccuracy ?? null },
      { key: 'avgBottomProb', label: 'Avg Bottom Probability', value: avgBottomProb },
      { key: 'avgPeakProb', label: 'Avg Peak Probability', value: avgPeakProb },
      { key: 'bottomsDetected', label: 'Bottoms Detected', value: summary.bottomsDetected ?? null },
      { key: 'peaksDetected', label: 'Peaks Detected', value: summary.peaksDetected ?? null },
      { key: 'predictionRows', label: 'Prediction Points', value: summary.predictionRows ?? null },
      { key: 'threshold', label: 'Threshold', value: summary.threshold ?? null },
      { key: 'finalLoss', label: 'Final Loss', value: training.finalLoss ?? null },
      { key: 'finalValidationLoss', label: 'Validation Loss', value: training.finalValidationLoss ?? null },
    ].filter((card) => card.value !== null);
  }

  return [...primary, ...secondary];
};

const extractMetricPairs = (jobResult) => {
  if (!jobResult || typeof jobResult !== 'object') return [];

  const metricSources = [
    jobResult.metrics,
    jobResult.testStats,
    jobResult.finalMetrics,
    jobResult.summary,
    jobResult.training,
  ].filter((source) => source && typeof source === 'object');

  const pairs = [];
  metricSources.forEach((source) => {
    Object.entries(source).forEach(([key, value]) => {
      if (pairs.length >= 10) return;
      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        pairs.push([key, value]);
      }
    });
  });

  return pairs;
};

const toChartData = (stockData, jobResult) => {
  const base = (stockData || []).map((row) => ({
    date: row.date,
    close: row.close,
    bottomProb: 0,
    peakProb: 0,
    bottomProbPct: 0,
    peakProbPct: 0,
    isBottom: false,
    isPeak: false,
  }));

  if (!jobResult || !Array.isArray(jobResult.predictions)) {
    return base;
  }

  const byDate = new Map(
    jobResult.predictions
      .map((row) => [normalizeDateKey(row.date), row])
      .filter(([key]) => Boolean(key))
  );
  const mappedByDate = base.map((row) => ({
    ...row,
    predictedPrice: byDate.get(normalizeDateKey(row.date))?.predictedPrice,
    bottomProb: byDate.get(normalizeDateKey(row.date))?.bottomProb ?? 0,
    peakProb: byDate.get(normalizeDateKey(row.date))?.peakProb ?? 0,
    bottomProbPct: (byDate.get(normalizeDateKey(row.date))?.bottomProb ?? 0) * 100,
    peakProbPct: (byDate.get(normalizeDateKey(row.date))?.peakProb ?? 0) * 100,
    isBottom: Boolean(byDate.get(normalizeDateKey(row.date))?.isBottom),
    isPeak: Boolean(byDate.get(normalizeDateKey(row.date))?.isPeak),
  }));

  const hasMappedProbabilities = mappedByDate.some((row) => row.bottomProb > 0 || row.peakProb > 0);
  if (hasMappedProbabilities) {
    return mappedByDate;
  }

  const fallback = [...mappedByDate];
  const predictions = jobResult.predictions || [];
  const startIndex = Math.max(0, fallback.length - predictions.length);
  predictions.forEach((prediction, index) => {
    const targetIndex = startIndex + index;
    if (!fallback[targetIndex]) return;
    fallback[targetIndex] = {
      ...fallback[targetIndex],
      predictedPrice: prediction.predictedPrice,
      bottomProb: typeof prediction.bottomProb === 'number' ? prediction.bottomProb : 0,
      peakProb: typeof prediction.peakProb === 'number' ? prediction.peakProb : 0,
      bottomProbPct: typeof prediction.bottomProb === 'number' ? prediction.bottomProb * 100 : 0,
      peakProbPct: typeof prediction.peakProb === 'number' ? prediction.peakProb * 100 : 0,
      isBottom: Boolean(prediction.isBottom),
      isPeak: Boolean(prediction.isPeak),
    };
  });

  return fallback;
};

const tooltipFormatter = (value, name) => {
  if (value === undefined || value === null) return ['N/A', name];
  if (name.includes('Prob %')) return [`${Number(value).toFixed(2)}%`, name];
  if (name.includes('Prob')) return [`${(Number(value) * 100).toFixed(2)}%`, name];
  if (name.toLowerCase().includes('price') || name === 'Close') return [`$${Number(value).toFixed(2)}`, name];
  return [Number(value).toFixed(4), name];
};

const AlgorithmReadOnlyView = ({
  title,
  subtitle,
  stockData = [],
  jobStatus,
  jobResult,
  options = {},
}) => {
  const chartData = toChartData(stockData, jobResult);
  const hasBottomPeakProbabilities = jobResult?.algorithm === 'bottomPeakLSTM';
  const hasPredictedPrice = chartData.some((row) => typeof row.predictedPrice === 'number');
  const performanceCards = buildPerformanceCards(jobResult);
  const metricPairs = extractMetricPairs(jobResult);
  const optionPairs = Object.entries(options || {});

  return (
    <div className="analysis-job-detail glass-card">
      <div className="analysis-job-detail__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle || 'Queue-driven analysis view'}</p>
        </div>
        {jobStatus && <span className={`status status-${jobStatus}`}>{jobStatus}</span>}
      </div>

      <div className="analysis-status-banner">
        This view is read-only in the new architecture. Configure parameters in the main Stock & ML Analysis form, then run Analyze Stock.
      </div>

      {optionPairs.length > 0 && (
        <div className="analysis-job-meta-grid">
          {optionPairs.map(([key, value]) => (
            <div key={`opt-${key}`}>
              <span>{key}</span>
              <strong>{formatValue(value)}</strong>
            </div>
          ))}
        </div>
      )}

      {metricPairs.length > 0 && (
        <div className="analysis-job-meta-grid">
          {metricPairs.map(([key, value]) => (
            <div key={`metric-${key}`}>
              <span>{key}</span>
              <strong>{formatValue(value)}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="analysis-performance-panel">
        <h4>Algorithm Performance</h4>
        <div className="analysis-performance-grid">
          {performanceCards.map((card) => (
            <div key={`${title}-${card.key}`} className="analysis-performance-card">
              <span>{card.label}</span>
              <strong>{formatMetricValue(card.value, card.key)}</strong>
            </div>
          ))}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="analysis-visual-panel">
          <h4>{hasBottomPeakProbabilities ? 'Price + Bottom/Peak Probabilities' : 'Result Chart'}</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="price" domain={['auto', 'auto']} />
              {hasBottomPeakProbabilities && (
                <YAxis yAxisId="prob" orientation="right" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
              )}
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Line type="monotone" yAxisId="price" dataKey="close" stroke="#00d4ff" dot={false} name="Close" strokeWidth={2} />
              {hasPredictedPrice && (
                <Line type="monotone" yAxisId="price" dataKey="predictedPrice" stroke="#7c3aed" dot={false} name="Predicted" strokeWidth={1} />
              )}
              {hasBottomPeakProbabilities && (
                <>
                  <Line type="monotone" yAxisId="prob" dataKey="bottomProbPct" stroke="#00c896" dot={false} name="Bottom Prob %" strokeWidth={2} />
                  <Line type="monotone" yAxisId="prob" dataKey="peakProbPct" stroke="#ff4757" dot={false} name="Peak Prob %" strokeWidth={2} />
                  {chartData.map((entry) => entry.isBottom ? (
                    <ReferenceDot key={`readonly-bottom-${entry.date}`} x={entry.date} y={entry.close} yAxisId="price" r={4} fill="#00c896" />
                  ) : null)}
                  {chartData.map((entry) => entry.isPeak ? (
                    <ReferenceDot key={`readonly-peak-${entry.date}`} x={entry.date} y={entry.close} yAxisId="price" r={4} fill="#ff4757" />
                  ) : null)}
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <details className="analysis-raw-details">
        <summary>Raw Result (debug)</summary>
        <div className="analysis-job-result-block">
          <pre>{jobResult ? JSON.stringify(jobResult, null, 2) : 'No queue result available yet.'}</pre>
        </div>
      </details>
    </div>
  );
};

export default AlgorithmReadOnlyView;
