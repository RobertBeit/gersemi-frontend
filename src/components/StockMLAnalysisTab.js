import React, { useEffect, useMemo, useRef, useState } from 'react';
import StockSearchDropdown from './StockSearchDropdown';
import StockChart from './StockChart';
import StockTable from './StockTable';
import MLRunRecordsTable from './MLRunRecordsTable';
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
import {
  predictWithData,
  fetchMlJob,
  fetchMlJobResult,
} from '../services/mlJobsApi';
import { saveMlRunResult } from '../services/mlRunHistoryService';

const ALGORITHM_OPTIONS = [
  { id: 'randomForest', label: 'Random Forest', description: 'Fast tree-based directional model' },
  { id: 'linearRegression', label: 'Linear Regression', description: 'Linear trend baseline' },
  { id: 'institutionalLinearRegression', label: 'Institutional Regression', description: 'Regression with institutional indicators' },
  { id: 'ensemble', label: 'Ensemble', description: 'Combined model voting' },
  { id: 'longTermRandomForest', label: 'Long-Term Random Forest', description: 'Longer-horizon random forest' },
  { id: 'longTermNaiveBayes', label: 'Long-Term Naive Bayes', description: 'Longer-horizon Naive Bayes model' },
  { id: 'longTermEnsemble', label: 'Long-Term Ensemble', description: 'Long-horizon combined ensemble' },
  { id: 'longTermLSTM', label: 'Long-Term LSTM', description: 'Sequence-based neural prediction' },
  { id: 'xgboost', label: 'XGBoost', description: 'Gradient boosted tree model' },
  { id: 'bottomPeakLSTM', label: 'Bottom/Peak LSTM', description: 'LSTM detector for bottoms and peaks' },
];

const TAB_OPTIONS = [
  { id: 'chart', label: 'Chart', icon: '📊' },
  { id: 'table', label: 'Table', icon: '📋' },
];

const DEFAULT_START = (() => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split('T')[0];
})();

const DEFAULT_END = new Date().toISOString().split('T')[0];

const formatTime = (value) => (value ? new Date(value).toLocaleString() : 'N/A');

const formatAlgorithmLabel = (algorithmId) =>
  ALGORITHM_OPTIONS.find((option) => option.id === algorithmId)?.label || algorithmId;

const normalizeDateKey = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.includes('T') ? value.split('T')[0] : value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
};

const collectNumericMetrics = (node, path = '', output = []) => {
  if (!node || typeof node !== 'object') return output;

  if (Array.isArray(node)) {
    node.forEach((item, index) => collectNumericMetrics(item, `${path}[${index}]`, output));
    return output;
  }

  Object.entries(node).forEach(([key, value]) => {
    const nextPath = path ? `${path}.${key}` : key;
    if (typeof value === 'number' && Number.isFinite(value)) {
      output.push({ path: nextPath, key: key.toLowerCase(), value });
      return;
    }
    if (value && typeof value === 'object') {
      collectNumericMetrics(value, nextPath, output);
    }
  });

  return output;
};

const findMetricValue = (metricPool, candidates) => {
  for (const candidate of candidates) {
    const exact = metricPool.find((entry) => entry.key === candidate.toLowerCase());
    if (exact) return exact.value;
    const contains = metricPool.find((entry) => entry.key.includes(candidate.toLowerCase()));
    if (contains) return contains.value;
  }
  return null;
};

const deriveFromConfusionMatrix = (resultPreview) => {
  const matrix =
    resultPreview?.metrics?.confusionMatrix ||
    resultPreview?.testStats?.confusionMatrix ||
    resultPreview?.confusionMatrix ||
    null;

  if (!Array.isArray(matrix) || matrix.length < 2) {
    return {};
  }

  const tn = Number(matrix?.[0]?.[0] ?? 0);
  const fp = Number(matrix?.[0]?.[1] ?? 0);
  const fn = Number(matrix?.[1]?.[0] ?? 0);
  const tp = Number(matrix?.[1]?.[1] ?? 0);
  const total = tn + fp + fn + tp;
  if (total <= 0) return {};

  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const accuracy = (tp + tn) / total;
  const f1 = precision !== null && recall !== null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : null;

  return { precision, recall, accuracy, f1 };
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

const buildPerformanceCards = (resultPreview, algorithmId) => {
  if (!resultPreview || typeof resultPreview !== 'object') {
    return [];
  }

  const metricPool = collectNumericMetrics(resultPreview);
  const derived = deriveFromConfusionMatrix(resultPreview);

  const primaryCards = [
    { key: 'r2', label: 'R²', value: findMetricValue(metricPool, ['r2', 'rsquared', 'r_squared']) },
    { key: 'accuracy', label: 'Accuracy', value: findMetricValue(metricPool, ['accuracy', 'valaccuracy', 'finalaccuracy']) ?? derived.accuracy ?? null },
    { key: 'recall', label: 'Recall', value: findMetricValue(metricPool, ['recall']) ?? derived.recall ?? null },
    { key: 'f1', label: 'F1 Score', value: findMetricValue(metricPool, ['f1', 'f1score']) ?? derived.f1 ?? null },
  ].filter((card) => card.value !== null);

  const secondaryCards = [
    { key: 'precision', label: 'Precision', value: findMetricValue(metricPool, ['precision']) ?? derived.precision ?? null },
    { key: 'mae', label: 'MAE', value: findMetricValue(metricPool, ['mae', 'valmae']) },
    { key: 'rmse', label: 'RMSE', value: findMetricValue(metricPool, ['rmse']) },
    { key: 'directionalAccuracy', label: 'Directional Accuracy', value: findMetricValue(metricPool, ['directionalaccuracy']) },
  ].filter((card) => card.value !== null);

  if (algorithmId === 'bottomPeakLSTM') {
    const summary = resultPreview?.summary || {};
    const training = resultPreview?.training || {};
    const predictions = Array.isArray(resultPreview?.predictions) ? resultPreview.predictions : [];
    const avgBottomProb = predictions.length
      ? predictions.reduce((sum, item) => sum + (Number(item.bottomProb) || 0), 0) / predictions.length
      : null;
    const avgPeakProb = predictions.length
      ? predictions.reduce((sum, item) => sum + (Number(item.peakProb) || 0), 0) / predictions.length
      : null;

    // For bottom/peak, show signal-specific performance instead of generic regression/classification metrics.
    return [
      { key: 'accuracy', label: 'Accuracy', value: training.finalAccuracy ?? findMetricValue(metricPool, ['accuracy']) ?? null },
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

  return [...primaryCards, ...secondaryCards];
};

const ALGORITHM_PARAM_FIELDS = {
  randomForest: [
    { key: 'lookbackDays', label: 'Lookback Days', type: 'number', min: 2, max: 60, step: 1 },
    { key: 'nTrees', label: 'Trees', type: 'number', min: 10, max: 400, step: 10 },
    { key: 'testSplit', label: 'Test Split', type: 'number', min: 0.1, max: 0.4, step: 0.05 },
  ],
  linearRegression: [
    { key: 'targetDaysAhead', label: 'Days Ahead', type: 'number', min: 1, max: 30, step: 1 },
    { key: 'lookbackDays', label: 'Lookback Days', type: 'number', min: 5, max: 60, step: 1 },
    { key: 'testSplit', label: 'Test Split', type: 'number', min: 0.1, max: 0.4, step: 0.05 },
  ],
  institutionalLinearRegression: [
    { key: 'modelType', label: 'Model Type', type: 'select', options: ['capm', 'fama_french_3', 'multi_factor'] },
  ],
  ensemble: [
    { key: 'naiveBayesWeight', label: 'Naive Bayes Weight', type: 'number', min: 0, max: 1, step: 0.1 },
    { key: 'randomForestWeight', label: 'Random Forest Weight', type: 'number', min: 0, max: 1, step: 0.1 },
    { key: 'lstmWeight', label: 'LSTM Weight', type: 'number', min: 0, max: 1, step: 0.1 },
  ],
  longTermRandomForest: [
    { key: 'lookbackDays', label: 'Lookback Days', type: 'number', min: 10, max: 90, step: 1 },
    { key: 'targetDaysAhead', label: 'Days Ahead', type: 'number', min: 5, max: 90, step: 1 },
    { key: 'nTrees', label: 'Trees', type: 'number', min: 20, max: 400, step: 10 },
  ],
  longTermNaiveBayes: [
    { key: 'lookbackDays', label: 'Lookback Days', type: 'number', min: 3, max: 60, step: 1 },
    { key: 'targetDaysAhead', label: 'Days Ahead', type: 'number', min: 3, max: 90, step: 1 },
    { key: 'bins', label: 'Bins', type: 'number', min: 2, max: 10, step: 1 },
  ],
  longTermEnsemble: [
    { key: 'lookbackDays', label: 'Lookback Days', type: 'number', min: 10, max: 90, step: 1 },
    { key: 'targetDaysAhead', label: 'Days Ahead', type: 'number', min: 5, max: 90, step: 1 },
    { key: 'randomForestWeight', label: 'RF Weight', type: 'number', min: 0, max: 1, step: 0.1 },
    { key: 'lstmWeight', label: 'LSTM Weight', type: 'number', min: 0, max: 1, step: 0.1 },
  ],
  longTermLSTM: [
    { key: 'sequenceLength', label: 'Sequence Length', type: 'number', min: 10, max: 90, step: 1 },
    { key: 'targetDaysAhead', label: 'Days Ahead', type: 'number', min: 3, max: 90, step: 1 },
    { key: 'epochs', label: 'Epochs', type: 'number', min: 5, max: 120, step: 5 },
    { key: 'batchSize', label: 'Batch Size', type: 'number', min: 8, max: 128, step: 8 },
  ],
  xgboost: [
    { key: 'targetColumn', label: 'Target', type: 'select', options: ['target_return_1d', 'target_return_5d'] },
    { key: 'testSplit', label: 'Test Split', type: 'number', min: 0.1, max: 0.4, step: 0.05 },
    { key: 'maxDepth', label: 'Max Depth', type: 'number', min: 2, max: 12, step: 1 },
  ],
  bottomPeakLSTM: [
    { key: 'epochs', label: 'Epochs', type: 'number', min: 5, max: 100, step: 5 },
    { key: 'batchSize', label: 'Batch Size', type: 'number', min: 8, max: 128, step: 8 },
    { key: 'threshold', label: 'Signal Threshold', type: 'number', min: 0.5, max: 0.95, step: 0.05 },
  ],
};

const DEFAULT_ALGORITHM_OPTIONS = {
  randomForest: { lookbackDays: 5, nTrees: 50, testSplit: 0.2 },
  linearRegression: { targetDaysAhead: 1, lookbackDays: 20, testSplit: 0.2 },
  institutionalLinearRegression: { modelType: 'multi_factor' },
  ensemble: { naiveBayesWeight: 0.3, randomForestWeight: 0.4, lstmWeight: 0.3 },
  longTermRandomForest: { lookbackDays: 30, targetDaysAhead: 22, nTrees: 100, testSplit: 0.2, maxSelectedFeatures: 50 },
  longTermNaiveBayes: { lookbackDays: 10, targetDaysAhead: 5, bins: 3, testSplit: 0.2 },
  longTermEnsemble: { lookbackDays: 30, targetDaysAhead: 5, randomForestWeight: 0.4, lstmWeight: 0.6 },
  longTermLSTM: { sequenceLength: 40, targetDaysAhead: 5, epochs: 50, batchSize: 32 },
  xgboost: { targetColumn: 'target_return_1d', testSplit: 0.2, maxDepth: 2 },
  bottomPeakLSTM: { epochs: 20, batchSize: 32, threshold: 0.7 },
};

const buildAlgorithmChartData = (stockData, algorithmId, resultPreview) => {
  const base = (stockData || []).map((row) => ({
    date: row.date,
    close: row.close,
    hasPrediction: false,
    bottomProb: algorithmId === 'bottomPeakLSTM' ? 0 : undefined,
    peakProb: algorithmId === 'bottomPeakLSTM' ? 0 : undefined,
    bottomProbPct: algorithmId === 'bottomPeakLSTM' ? 0 : undefined,
    peakProbPct: algorithmId === 'bottomPeakLSTM' ? 0 : undefined,
    isBottom: false,
    isPeak: false,
  }));

  if (!resultPreview || !Array.isArray(resultPreview.predictions)) {
    return base;
  }

  const predictionByDate = new Map(
    (resultPreview.predictions || [])
      .map((item) => [normalizeDateKey(item.date), item])
      .filter(([key]) => Boolean(key))
  );

  const unmatchedPredictions = [];
  let dateMatchedCount = 0;

  const mappedByDate = base.map((row) => {
    const prediction = predictionByDate.get(normalizeDateKey(row.date));
    if (!prediction) {
      return row;
    }

    dateMatchedCount += 1;

    return {
      ...row,
      hasPrediction: true,
      predictedPrice: prediction.predictedPrice,
      bottomProb: typeof prediction.bottomProb === 'number' ? prediction.bottomProb : row.bottomProb,
      peakProb: typeof prediction.peakProb === 'number' ? prediction.peakProb : row.peakProb,
      bottomProbPct: typeof prediction.bottomProb === 'number' ? prediction.bottomProb * 100 : row.bottomProbPct,
      peakProbPct: typeof prediction.peakProb === 'number' ? prediction.peakProb * 100 : row.peakProbPct,
      isBottom: prediction.isBottom,
      isPeak: prediction.isPeak,
    };
  });

  (resultPreview.predictions || []).forEach((prediction) => {
    const predictionDate = normalizeDateKey(prediction.date);
    if (!predictionDate) return;
    if (mappedByDate.some((row) => normalizeDateKey(row.date) === predictionDate)) return;

    unmatchedPredictions.push({
      date: predictionDate,
      close: typeof prediction.price === 'number' ? prediction.price : (typeof prediction.predictedPrice === 'number' ? prediction.predictedPrice : null),
      hasPrediction: true,
      predictedPrice: prediction.predictedPrice,
      bottomProb: typeof prediction.bottomProb === 'number' ? prediction.bottomProb : 0,
      peakProb: typeof prediction.peakProb === 'number' ? prediction.peakProb : 0,
      bottomProbPct: typeof prediction.bottomProb === 'number' ? prediction.bottomProb * 100 : 0,
      peakProbPct: typeof prediction.peakProb === 'number' ? prediction.peakProb * 100 : 0,
      isBottom: Boolean(prediction.isBottom),
      isPeak: Boolean(prediction.isPeak),
    });
  });

  if (algorithmId !== 'bottomPeakLSTM' || dateMatchedCount > 0) {
    const withPredictions = [...mappedByDate, ...unmatchedPredictions]
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const predictionSummary = resultPreview?.predictionSummary || null;
    const targetDate = normalizeDateKey(predictionSummary?.targetDate);
    const summaryPredictedPrice = predictionSummary && typeof predictionSummary.predictedPrice === 'number'
      ? predictionSummary.predictedPrice
      : null;

    if (!targetDate || summaryPredictedPrice === null) {
      return withPredictions;
    }

    const alreadyExists = withPredictions.some((row) => normalizeDateKey(row.date) === targetDate);
    if (alreadyExists) {
      return withPredictions.map((row) => (
        normalizeDateKey(row.date) === targetDate
          ? { ...row, hasPrediction: true, predictedPrice: summaryPredictedPrice }
          : row
      ));
    }

    return [
      ...withPredictions,
      {
        date: targetDate,
        close: typeof predictionSummary.currentPrice === 'number' ? predictionSummary.currentPrice : null,
        hasPrediction: true,
        predictedPrice: summaryPredictedPrice,
        isForecastTarget: true,
      },
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  // Fallback: if dates do not align exactly, map predictions onto the tail of the series.
  const fallback = [...mappedByDate];
  const predictions = resultPreview.predictions || [];
  const startIndex = Math.max(0, fallback.length - predictions.length);
  predictions.forEach((prediction, index) => {
    const targetIndex = startIndex + index;
    if (!fallback[targetIndex]) return;
    fallback[targetIndex] = {
      ...fallback[targetIndex],
      hasPrediction: true,
      predictedPrice: prediction.predictedPrice,
      bottomProb: typeof prediction.bottomProb === 'number' ? prediction.bottomProb : 0,
      peakProb: typeof prediction.peakProb === 'number' ? prediction.peakProb : 0,
      bottomProbPct: typeof prediction.bottomProb === 'number' ? prediction.bottomProb * 100 : 0,
      peakProbPct: typeof prediction.peakProb === 'number' ? prediction.peakProb * 100 : 0,
      isBottom: Boolean(prediction.isBottom),
      isPeak: Boolean(prediction.isPeak),
    };
  });

  const withFallback = [...fallback, ...unmatchedPredictions]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const predictionSummary = resultPreview?.predictionSummary || null;
  const targetDate = normalizeDateKey(predictionSummary?.targetDate);
  const summaryPredictedPrice = predictionSummary && typeof predictionSummary.predictedPrice === 'number'
    ? predictionSummary.predictedPrice
    : null;

  if (!targetDate || summaryPredictedPrice === null) {
    return withFallback;
  }

  const alreadyExists = withFallback.some((row) => normalizeDateKey(row.date) === targetDate);
  if (alreadyExists) {
    return withFallback.map((row) => (
      normalizeDateKey(row.date) === targetDate
        ? { ...row, hasPrediction: true, predictedPrice: summaryPredictedPrice }
        : row
    ));
  }

  return [
    ...withFallback,
    {
      date: targetDate,
      close: typeof predictionSummary.currentPrice === 'number' ? predictionSummary.currentPrice : null,
      hasPrediction: true,
      predictedPrice: summaryPredictedPrice,
      isForecastTarget: true,
    },
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

const formatCurrency = (value) => (typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(2)}` : 'N/A');
const formatPercent = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}%` : 'N/A');

const buildPredictionCards = (resultPreview, algorithmId) => {
  const summary = resultPreview?.predictionSummary;
  if (!summary || typeof summary !== 'object') {
    return [];
  }

  const currentPriceLabel = summary.currentPriceLabel || 'Current Price';

  const cards = [
    { key: 'horizon', label: 'Prediction Horizon', value: summary.horizonDays ? `${summary.horizonDays} day(s)` : 'N/A' },
    { key: 'asOf', label: 'As Of', value: summary.asOfDate || 'N/A' },
    { key: 'targetDate', label: 'Target Date', value: summary.targetDate || 'N/A' },
    { key: 'currentPrice', label: currentPriceLabel, value: formatCurrency(summary.currentPrice) },
    { key: 'predictedPrice', label: 'Predicted Price', value: formatCurrency(summary.predictedPrice) },
    { key: 'changePct', label: 'Expected Change', value: formatPercent(summary.percentChange) },
    { key: 'direction', label: 'Direction', value: summary.direction || 'N/A' },
    { key: 'confidence', label: 'Confidence', value: formatPercent(typeof summary.confidence === 'number' ? summary.confidence * 100 : null) },
    { key: 'priceSource', label: 'Price Source', value: summary.priceSource || 'unknown' },
  ];

  if (algorithmId === 'bottomPeakLSTM') {
    const details = summary.details || {};
    cards.push(
      { key: 'bottomProb', label: 'Bottom Probability', value: formatPercent(typeof details.bottomProbability === 'number' ? details.bottomProbability * 100 : null) },
      { key: 'peakProb', label: 'Peak Probability', value: formatPercent(typeof details.peakProbability === 'number' ? details.peakProbability * 100 : null) }
    );
  }

  return cards;
};

const buildPersistedRunRecord = ({ job, symbol, startDate, endDate }) => {
  const performanceCards = buildPerformanceCards(job?.resultPreview, job?.algorithm)
    .map((card) => ({
      key: card.key,
      label: card.label,
      value: card.value,
      displayValue: formatMetricValue(card.value, card.key),
    }));

  const forecastCards = buildPredictionCards(job?.resultPreview, job?.algorithm)
    .map((card) => ({
      key: card.key,
      label: card.label,
      value: card.value,
    }));

  const predictionSummary = job?.resultPreview?.predictionSummary || null;
  const createdAt = job?.createdAt || new Date().toISOString();

  return {
    jobId: job?.id,
    symbol: symbol || job?.metadata?.symbol || null,
    algorithm: job?.algorithm || null,
    label: job?.label || formatAlgorithmLabel(job?.algorithm),
    status: job?.status || null,
    createdAt,
    updatedAt: createdAt,
    queuedAt: job?.createdAt || null,
    startedAt: job?.startedAt || null,
    finishedAt: job?.finishedAt || null,
    startDate: startDate || job?.metadata?.startDate || null,
    endDate: endDate || job?.metadata?.endDate || null,
    batchId: job?.metadata?.batchId || null,
    queueIndex: typeof job?.queueIndex === 'number' ? job.queueIndex : null,
    options: job?.options || {},
    optionsCount: Object.keys(job?.options || {}).length,
    algorithmPerformance: performanceCards,
    predictionForecast: forecastCards,
    predictedPrice: typeof predictionSummary?.predictedPrice === 'number' ? predictionSummary.predictedPrice : null,
    currentPrice: typeof predictionSummary?.currentPrice === 'number' ? predictionSummary.currentPrice : null,
    targetDate: predictionSummary?.targetDate || null,
    direction: predictionSummary?.direction || null,
    confidence: typeof predictionSummary?.confidence === 'number' ? predictionSummary.confidence : null,
    error: job?.error || null,
  };
};

const chartTooltipContent = ({ active, payload, label, algorithmId }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload || {};

  return (
    <div className="analysis-tooltip">
      <div className="analysis-tooltip__title">{label}</div>
      <div>Close: {typeof point.close === 'number' ? `$${point.close.toFixed(2)}` : 'N/A'}</div>
      {typeof point.predictedPrice === 'number' && (
        <div>Predicted: ${point.predictedPrice.toFixed(2)}</div>
      )}
      {algorithmId === 'bottomPeakLSTM' && (
        <>
          <div>Bottom Probability: {`${(point.bottomProbPct ?? 0).toFixed(2)}%`}</div>
          <div>Peak Probability: {`${(point.peakProbPct ?? 0).toFixed(2)}%`}</div>
        </>
      )}
    </div>
  );
};

const tooltipFormatter = (value, name) => {
  if (value === undefined || value === null) {
    return ['N/A', name];
  }

  if (name.includes('Prob %')) {
    return [`${Number(value).toFixed(2)}%`, name];
  }

  if (name.includes('Prob')) {
    return [`${(Number(value) * 100).toFixed(2)}%`, name];
  }

  if (name.toLowerCase().includes('price') || name === 'Close') {
    return [`$${Number(value).toFixed(2)}`, name];
  }

  return [Number(value).toFixed(4), name];
};

const renderAlgorithmSummary = (resultPreview) => {
  if (!resultPreview || typeof resultPreview !== 'object') {
    return null;
  }

  const metrics = resultPreview.metrics || resultPreview.testStats || resultPreview.finalMetrics || null;
  const training = {
    trainSamples: resultPreview.trainingSamples ?? resultPreview.trainSamples,
    testSamples: resultPreview.testSamples,
    lookbackDays: resultPreview.lookbackDays,
    targetDaysAhead: resultPreview.targetDaysAhead,
  };

  const metricEntries = metrics && typeof metrics === 'object'
    ? Object.entries(metrics).filter(([, value]) => typeof value === 'number').slice(0, 6)
    : [];

  const trainingEntries = Object.entries(training).filter(([, value]) => value !== undefined && value !== null);

  if (metricEntries.length === 0 && trainingEntries.length === 0) {
    return null;
  }

  return (
    <div className="analysis-job-meta-grid">
      {metricEntries.map(([key, value]) => (
        <div key={`metric-${key}`}>
          <span>{key}</span>
          <strong>{Number(value).toFixed(4)}</strong>
        </div>
      ))}
      {trainingEntries.map(([key, value]) => (
        <div key={`training-${key}`}>
          <span>{key}</span>
          <strong>{String(value)}</strong>
        </div>
      ))}
    </div>
  );
};

const DEFAULT_PREDICTION_SORT = { column: 'date', direction: 'desc' };

const getPredictionSortValue = (row, column) => {
  if (column === 'date') {
    const timestamp = Date.parse(row.date);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
  if (column === 'close') {
    return typeof row.close === 'number' ? row.close : Number.NEGATIVE_INFINITY;
  }
  if (column === 'predictedPrice') {
    return typeof row.predictedPrice === 'number' ? row.predictedPrice : Number.NEGATIVE_INFINITY;
  }
  if (column === 'bottomProbPct') {
    return typeof row.bottomProbPct === 'number' ? row.bottomProbPct : Number.NEGATIVE_INFINITY;
  }
  if (column === 'peakProbPct') {
    return typeof row.peakProbPct === 'number' ? row.peakProbPct : Number.NEGATIVE_INFINITY;
  }
  if (column === 'isBottom') {
    return row.isBottom ? 1 : 0;
  }
  if (column === 'isPeak') {
    return row.isPeak ? 1 : 0;
  }
  return 0;
};

const sortPredictionRows = (rows, sortConfig) => {
  const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const left = getPredictionSortValue(a, sortConfig.column);
    const right = getPredictionSortValue(b, sortConfig.column);

    if (left < right) return -1 * directionMultiplier;
    if (left > right) return 1 * directionMultiplier;

    const leftDate = Date.parse(a.date);
    const rightDate = Date.parse(b.date);
    if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate) && leftDate !== rightDate) {
      return rightDate - leftDate;
    }

    return String(a.date).localeCompare(String(b.date));
  });
};

const StockMLAnalysisTab = () => {
  const [symbol, setSymbol] = useState('');
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [endDate, setEndDate] = useState(DEFAULT_END);
  const [pendingAlgorithm, setPendingAlgorithm] = useState(ALGORITHM_OPTIONS[0].id);
  const [selectedAlgorithms, setSelectedAlgorithms] = useState([]);
  const [algorithmOptions, setAlgorithmOptions] = useState(DEFAULT_ALGORITHM_OPTIONS);
  const [stockData, setStockData] = useState([]);
  const [currentStock, setCurrentStock] = useState('');
  const [activeView, setActiveView] = useState('chart');
  const [analysisJobs, setAnalysisJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [isLoadingMarketData, setIsLoadingMarketData] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [queueMessage, setQueueMessage] = useState('');
  const [predictionTableSortByAlgorithm, setPredictionTableSortByAlgorithm] = useState({});
  const persistedRunIdsRef = useRef(new Set());

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const activeJobs = useMemo(
    () => analysisJobs.filter((job) => job.status === 'queued' || job.status === 'running'),
    [analysisJobs]
  );

  const queueCounts = useMemo(() => ({
    queued: analysisJobs.filter((job) => job.status === 'queued').length,
    running: analysisJobs.filter((job) => job.status === 'running').length,
    completed: analysisJobs.filter((job) => job.status === 'completed').length,
    failed: analysisJobs.filter((job) => job.status === 'failed').length,
  }), [analysisJobs]);

  const selectedAlgorithmMeta = useMemo(
    () => selectedAlgorithms.map((algorithmId, index) => ({
      algorithmId,
      label: formatAlgorithmLabel(algorithmId),
      index,
    })),
    [selectedAlgorithms]
  );

  const handleAddAlgorithm = () => {
    if (!pendingAlgorithm) return;
    setSelectedAlgorithms((prev) => {
      if (prev.includes(pendingAlgorithm)) return prev;
      const next = [...prev, pendingAlgorithm];
      if (!selectedJobId || selectedJobId === 'chart') {
        setSelectedJobId(pendingAlgorithm);
      }
      return next;
    });
    setAlgorithmOptions((prev) => ({
      ...prev,
      [pendingAlgorithm]: prev[pendingAlgorithm] || DEFAULT_ALGORITHM_OPTIONS[pendingAlgorithm] || {},
    }));
  };

  const handleRemoveAlgorithm = (algorithmId) => {
    setSelectedAlgorithms((prev) => prev.filter((item) => item !== algorithmId));
    setAnalysisJobs((prev) => prev.filter((job) => job.algorithm !== algorithmId || job.status !== 'queued'));
    setSelectedJobId((current) => {
      if (current !== algorithmId) return current;
      const remaining = selectedAlgorithms.filter((item) => item !== algorithmId);
      return remaining[0] || 'chart';
    });
  };

  const queueSelectedAlgorithms = async ({ stockSymbol, rangeStart, rangeEnd }) => {
    const batchId = `${stockSymbol}-${Date.now()}`;
    const queued = [];

    for (let index = 0; index < selectedAlgorithms.length; index += 1) {
      const algorithm = selectedAlgorithms[index];
      const metadata = {
        batchId,
        queueIndex: index,
        algorithm,
        symbol: stockSymbol,
        startDate: rangeStart,
        endDate: rangeEnd,
      };

      try {
        setQueueMessage(`Queueing ${formatAlgorithmLabel(algorithm)} (${index + 1}/${selectedAlgorithms.length})...`);
        const options = algorithmOptions[algorithm] || {};
        const job = await predictWithData({
          symbol: stockSymbol,
          algorithm,
          startDate: rangeStart,
          endDate: rangeEnd,
          options,
          metadata,
        });

        if (queued.length === 0 && Array.isArray(job?.stockData)) {
          setStockData(job.stockData);
        }

        queued.push({
          id: job.id,
          algorithm,
          label: formatAlgorithmLabel(algorithm),
          status: job.status || 'queued',
          createdAt: job.createdAt,
          startedAt: job.startedAt || null,
          finishedAt: job.finishedAt || null,
          error: job.error || null,
          resultPreview: null,
          queueIndex: index,
          options,
          metadata,
        });
        setAnalysisJobs([...queued]);
        setSelectedJobId((current) => (current === 'chart' ? algorithm : current));
      } catch (error) {
        queued.push({
          id: `local-error-${algorithm}-${Date.now()}`,
          algorithm,
          label: formatAlgorithmLabel(algorithm),
          status: 'failed',
          createdAt: new Date().toISOString(),
          startedAt: null,
          finishedAt: new Date().toISOString(),
          error: error.message || `Failed to queue ${formatAlgorithmLabel(algorithm)}`,
          resultPreview: null,
          queueIndex: index,
          options: algorithmOptions[algorithm] || {},
          metadata,
        });
        setAnalysisJobs([...queued]);
        setQueueError(error.message || `Failed to queue ${formatAlgorithmLabel(algorithm)}`);
      }
    }

    setQueueMessage(`Queued ${queued.length} job(s) for ${stockSymbol}`);
    setIsQueueing(false);
  };

  const updateAlgorithmOption = (algorithmId, key, rawValue, type) => {
    const value = type === 'number' ? Number(rawValue) : rawValue;
    setAlgorithmOptions((prev) => ({
      ...prev,
      [algorithmId]: {
        ...(prev[algorithmId] || {}),
        [key]: value,
      },
    }));
  };

  const handleAnalyzeStock = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setQueueError('');
    setQueueMessage('');

    if (!symbol.trim()) {
      setSubmitError('Please enter a stock symbol.');
      return;
    }

    if (!startDate || !endDate) {
      setSubmitError('Please select both start and end dates.');
      return;
    }

    if (selectedAlgorithms.length === 0) {
      setSubmitError('Select at least one algorithm to queue.');
      return;
    }

    setIsLoadingMarketData(true);
    setIsQueueing(true);
    setAnalysisJobs([]);
    setSelectedJobId(selectedAlgorithms[0] || 'chart');

    const normalizedSymbol = symbol.trim().toUpperCase();

    try {
      setCurrentStock(normalizedSymbol);
      setStockData([]);
      setActiveView('chart');
      await queueSelectedAlgorithms({
        stockSymbol: normalizedSymbol,
        rangeStart: startDate,
        rangeEnd: endDate,
      });
    } catch (error) {
      const message = error.message || 'Failed to analyze stock';
      setSubmitError(message);
      setQueueError(message);
      setIsQueueing(false);
    } finally {
      setIsLoadingMarketData(false);
    }
  };

  useEffect(() => {
    if (activeJobs.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const updatedJobs = await Promise.all(analysisJobs.map(async (job) => {
          if (!job.id || !['queued', 'running'].includes(job.status)) {
            return job;
          }

          try {
            const latest = await fetchMlJob(job.id);
            const terminal = latest.status === 'completed' || latest.status === 'failed' || latest.status === 'cancelled';
            let resultPreview = job.resultPreview;
            let jobError = latest.error || job.error || null;

            if (terminal) {
              try {
                const resultWrapper = await fetchMlJobResult(job.id);
                resultPreview = resultWrapper?.result ?? resultWrapper?.job?.result ?? null;
                jobError = resultWrapper?.error || jobError;
              } catch (resultError) {
                jobError = jobError || resultError.message;
              }
            }

            return {
              ...job,
              status: latest.status,
              startedAt: latest.startedAt,
              finishedAt: latest.finishedAt,
              error: jobError,
              resultPreview,
            };
          } catch (pollError) {
            return {
              ...job,
              error: pollError.message || 'Failed to refresh job status',
            };
          }
        }));

        if (!cancelled) {
          setAnalysisJobs(updatedJobs);

          updatedJobs.forEach((job) => {
            const isTerminal = ['completed', 'failed', 'cancelled'].includes(job.status);
            if (!isTerminal || !job.id || persistedRunIdsRef.current.has(job.id)) {
              return;
            }

            persistedRunIdsRef.current.add(job.id);
            const runRecord = buildPersistedRunRecord({
              job,
              symbol: currentStock,
              startDate,
              endDate,
            });

            saveMlRunResult(runRecord).catch((firestoreError) => {
              console.error(`Failed to persist ML run ${job.id}:`, firestoreError);
              persistedRunIdsRef.current.delete(job.id);
            });
          });
        }
      } catch (pollError) {
        if (!cancelled) {
          setQueueError(pollError.message || 'Failed to refresh analysis queue');
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [analysisJobs, activeJobs.length, currentStock, startDate, endDate]);

  useEffect(() => {
    if (!selectedJobId && selectedAlgorithms.length > 0) {
      setSelectedJobId(selectedAlgorithms[0]);
    }
  }, [selectedAlgorithms, selectedJobId]);

  const selectedJob = analysisJobs.find((job) => job.id === selectedJobId || job.algorithm === selectedJobId);

  return (
    <div className="stock-ml-analysis-tab analysis-workspace">
      <section className="analysis-form-card glass-card">
        <div className="analysis-form-header">
          <div>
            <h2>Stock Market Analysis</h2>
            <p>Pick a symbol, date range, and one or more algorithms. Jobs will queue in the order selected.</p>
          </div>
          <div className="analysis-form-summary">
            <strong>{queueCounts.running + queueCounts.queued}</strong>
            <span>Active Jobs</span>
          </div>
        </div>

        <form className="analysis-form" onSubmit={handleAnalyzeStock}>
          <div className="analysis-form-grid">
            <div className="form-group">
              <label htmlFor="analysis-symbol">Stock Symbol</label>
              <StockSearchDropdown
                value={symbol}
                onChange={setSymbol}
                placeholder="Search or enter a symbol"
              />
            </div>

            <div className="form-group">
              <label htmlFor="analysis-start-date">Start Date</label>
              <input
                id="analysis-start-date"
                type="date"
                value={startDate}
                min="1990-01-01"
                max={today}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="analysis-end-date">End Date</label>
              <input
                id="analysis-end-date"
                type="date"
                value={endDate}
                min={startDate}
                max={today}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="analysis-algorithm-picker">
            <div className="form-group algorithm-picker-input">
              <label htmlFor="algorithm-select">Algorithms</label>
              <div className="algorithm-picker-row">
                <select
                  id="algorithm-select"
                  value={pendingAlgorithm}
                  onChange={(event) => setPendingAlgorithm(event.target.value)}
                >
                  {ALGORITHM_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="secondary-button" onClick={handleAddAlgorithm}>
                  Add
                </button>
              </div>
              <div className="form-hint">Add multiple algorithms. They will run top-to-bottom in the order shown below.</div>
            </div>

            <div className="selected-algorithm-tabs">
              {selectedAlgorithmMeta.length === 0 && (
                <div className="selected-algorithm-empty">No algorithms selected yet.</div>
              )}
              {selectedAlgorithmMeta.map(({ algorithmId, label, index }) => (
                <button
                  key={algorithmId}
                  type="button"
                  className={selectedJobId === algorithmId ? 'algorithm-tab active' : 'algorithm-tab'}
                  onClick={() => setSelectedJobId(algorithmId)}
                >
                  <span className="algorithm-tab__index">{index + 1}</span>
                  <span className="algorithm-tab__label">{label}</span>
                  <span
                    className="algorithm-tab__remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemoveAlgorithm(algorithmId);
                    }}
                    role="button"
                    aria-label={`Remove ${label}`}
                    tabIndex={0}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedAlgorithmMeta.length > 0 && (
            <div className="analysis-advanced-config">
              <h4>Advanced Parameters (Queue Source of Truth)</h4>
              <p>These settings are applied when you click Analyze Stock. Individual result tabs are now read-only.</p>
              <div className="analysis-advanced-grid">
                {selectedAlgorithmMeta.map(({ algorithmId, label }) => {
                  const fields = ALGORITHM_PARAM_FIELDS[algorithmId] || [];
                  const values = algorithmOptions[algorithmId] || {};

                  return (
                    <div key={`${algorithmId}-params`} className="analysis-advanced-card">
                      <h5>{label}</h5>
                      {fields.length === 0 && <span className="analysis-advanced-empty">No advanced parameters for this algorithm.</span>}
                      {fields.map((field) => (
                        <label key={`${algorithmId}-${field.key}`} className="analysis-advanced-field">
                          <span>{field.label}</span>
                          {field.type === 'select' ? (
                            <select
                              value={values[field.key] ?? ''}
                              onChange={(event) => updateAlgorithmOption(algorithmId, field.key, event.target.value, field.type)}
                            >
                              {(field.options || []).map((option) => (
                                <option key={`${algorithmId}-${field.key}-${option}`} value={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="number"
                              min={field.min}
                              max={field.max}
                              step={field.step}
                              value={values[field.key] ?? ''}
                              onChange={(event) => updateAlgorithmOption(algorithmId, field.key, event.target.value, field.type)}
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="analysis-form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={isLoadingMarketData || isQueueing || !symbol.trim()}
            >
              {isLoadingMarketData || isQueueing ? 'Analyzing...' : 'Analyze Stock'}
            </button>
            <div className="analysis-form-hints">
              <span>Queue order is preserved.</span>
              <span>Errors are shown inline per job.</span>
            </div>
          </div>
        </form>
      </section>

      {submitError && (
        <div className="analysis-error-banner">
          <strong>Analysis Error</strong>
          <p>{submitError}</p>
        </div>
      )}

      {queueError && !submitError && (
        <div className="analysis-error-banner analysis-error-banner--warning">
          <strong>Queue Warning</strong>
          <p>{queueError}</p>
        </div>
      )}

      {queueMessage && (
        <div className="analysis-status-banner">
          {queueMessage}
        </div>
      )}

      {stockData.length > 0 && (
        <section className="results">
          <h2>
            <span className="stock-symbol">{currentStock}</span> Analysis Dashboard
          </h2>

          {selectedJob && (
            <div className="analysis-job-detail glass-card analysis-job-detail--compact">
              <div className="analysis-job-detail__header">
                <div>
                  <h3>{selectedJob.label || formatAlgorithmLabel(selectedJob.algorithm)}</h3>
                  <p>{selectedJob.status}</p>
                </div>
                <span className={`status status-${selectedJob.status}`}>{selectedJob.status}</span>
              </div>

              {selectedJob.error && (
                <div className="analysis-job-error">
                  <strong>Latest Error</strong>
                  <p>{selectedJob.error}</p>
                </div>
              )}
            </div>
          )}

          <div className="tab-navigation">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                className={activeView === tab.id ? 'active' : ''}
                onClick={() => setActiveView(tab.id)}
                type="button"
              >
                {tab.icon} {tab.label}
              </button>
            ))}
            {selectedAlgorithmMeta.map(({ algorithmId, label, index }) => (
              <button
                key={`${algorithmId}-view`}
                className={activeView === algorithmId ? 'active' : ''}
                onClick={() => setActiveView(algorithmId)}
                type="button"
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {activeView === 'chart' && <StockChart data={stockData} />}
            {activeView === 'table' && <StockTable data={stockData} />}

            {selectedAlgorithmMeta.map(({ algorithmId, label }) => {
              const job = analysisJobs.find((item) => item.algorithm === algorithmId);
              const chartData = buildAlgorithmChartData(stockData, algorithmId, job?.resultPreview);
              const predictionRows = chartData.filter((entry) => entry.hasPrediction);
              const forecastCards = buildPredictionCards(job?.resultPreview, algorithmId);
              const sortConfig = predictionTableSortByAlgorithm[algorithmId] || DEFAULT_PREDICTION_SORT;
              const sortedPredictionRows = sortPredictionRows(predictionRows, sortConfig);

              const handlePredictionSort = (column) => {
                setPredictionTableSortByAlgorithm((prev) => {
                  const current = prev[algorithmId] || DEFAULT_PREDICTION_SORT;
                  const nextDirection = current.column === column && current.direction === 'desc' ? 'asc' : 'desc';
                  return {
                    ...prev,
                    [algorithmId]: {
                      column,
                      direction: nextDirection,
                    },
                  };
                });
              };

              const renderSortArrow = (column) => {
                if (sortConfig.column !== column) return '↕';
                return sortConfig.direction === 'asc' ? '↑' : '↓';
              };

              if (activeView !== algorithmId) {
                return null;
              }

              return (
                <div key={algorithmId} className="analysis-job-detail glass-card">
                  <div className="analysis-job-detail__header">
                    <div>
                      <h3>{label}</h3>
                      <p>{job ? `Status: ${job.status}` : 'Waiting to be queued'}</p>
                    </div>
                    {job && <span className={`status status-${job.status}`}>{job.status}</span>}
                  </div>

                  {!job && (
                    <div className="analysis-empty-state">
                      This algorithm has not been queued yet.
                    </div>
                  )}

                  {job && (
                    <>
                      {job.error && (
                        <div className="analysis-job-error">
                          <strong>Job Error</strong>
                          <p>{job.error}</p>
                        </div>
                      )}

                      <div className="analysis-job-meta-grid">
                        <div>
                          <span>Queued</span>
                          <strong>{formatTime(job.createdAt)}</strong>
                        </div>
                        <div>
                          <span>Started</span>
                          <strong>{formatTime(job.startedAt)}</strong>
                        </div>
                        <div>
                          <span>Finished</span>
                          <strong>{formatTime(job.finishedAt)}</strong>
                        </div>
                        <div>
                          <span>Batch Index</span>
                          <strong>{job.queueIndex + 1}</strong>
                        </div>
                        <div>
                          <span>Options</span>
                          <strong>{Object.keys(job.options || {}).length}</strong>
                        </div>
                      </div>

                      {renderAlgorithmSummary(job.resultPreview)}

                      <div className="analysis-performance-panel">
                        <h4>Algorithm Performance</h4>
                        <div className="analysis-performance-grid">
                          {buildPerformanceCards(job.resultPreview, algorithmId).map((card) => (
                            <div key={`${algorithmId}-${card.key}`} className="analysis-performance-card">
                              <span>{card.label}</span>
                              <strong>{formatMetricValue(card.value, card.key)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="analysis-performance-panel">
                        <h4>Prediction Forecast</h4>
                        {forecastCards.length === 0 ? (
                          <div className="analysis-empty-state">No forecast summary available yet for this algorithm.</div>
                        ) : (
                          <div className="analysis-performance-grid">
                            {forecastCards.map((card) => (
                              <div key={`${algorithmId}-prediction-${card.key}`} className="analysis-performance-card">
                                <span>{card.label}</span>
                                <strong>{card.value}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="analysis-visual-panel">
                        <h4>Prediction Chart</h4>
                        <ResponsiveContainer width="100%" height={320}>
                          <LineChart data={chartData} margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" allowDuplicatedCategory={false} />
                            <YAxis yAxisId="price" domain={['auto', 'auto']} />
                            {algorithmId === 'bottomPeakLSTM' && (
                              <YAxis yAxisId="prob" orientation="right" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                            )}
                            <Tooltip content={(props) => chartTooltipContent({ ...props, algorithmId })} formatter={tooltipFormatter} />
                            <Legend />
                            <Line type="monotone" yAxisId="price" dataKey="close" stroke="#00d4ff" dot={false} activeDot={{ r: 5 }} name="Close" strokeWidth={2} />
                            {chartData.some((entry) => typeof entry.predictedPrice === 'number') && (
                              <Line type="monotone" yAxisId="price" dataKey="predictedPrice" stroke="#7c3aed" dot={false} activeDot={{ r: 4 }} name="Predicted Price" strokeWidth={1} />
                            )}
                            {algorithmId === 'bottomPeakLSTM' && (
                              <>
                                <Line type="monotone" yAxisId="prob" dataKey="bottomProbPct" stroke="#00c896" dot={false} activeDot={{ r: 4 }} name="Bottom Prob %" strokeWidth={2} />
                                <Line type="monotone" yAxisId="prob" dataKey="peakProbPct" stroke="#ff4757" dot={false} activeDot={{ r: 4 }} name="Peak Prob %" strokeWidth={2} />
                                {chartData.map((entry) => entry.isBottom ? (
                                  <ReferenceDot key={`bp-bottom-${entry.date}`} x={entry.date} y={entry.close} yAxisId="price" r={4} fill="#00c896" />
                                ) : null)}
                                {chartData.map((entry) => entry.isPeak ? (
                                  <ReferenceDot key={`bp-peak-${entry.date}`} x={entry.date} y={entry.close} yAxisId="price" r={4} fill="#ff4757" />
                                ) : null)}
                              </>
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="analysis-prediction-table-panel">
                        <h4>Prediction Rows Used In Chart</h4>
                        {predictionRows.length === 0 ? (
                          <div className="analysis-empty-state">No prediction rows available for this algorithm yet.</div>
                        ) : (
                          <div className="analysis-prediction-table-wrap">
                            <table className="analysis-prediction-table">
                              <thead>
                                <tr>
                                  <th>
                                    <button type="button" className="analysis-table-sort-button" onClick={() => handlePredictionSort('date')}>
                                      Date {renderSortArrow('date')}
                                    </button>
                                  </th>
                                  <th>
                                    <button type="button" className="analysis-table-sort-button" onClick={() => handlePredictionSort('close')}>
                                      Close {renderSortArrow('close')}
                                    </button>
                                  </th>
                                  {algorithmId === 'bottomPeakLSTM' && (
                                    <th>
                                      <button type="button" className="analysis-table-sort-button" onClick={() => handlePredictionSort('bottomProbPct')}>
                                        Bottom % {renderSortArrow('bottomProbPct')}
                                      </button>
                                    </th>
                                  )}
                                  {algorithmId === 'bottomPeakLSTM' && (
                                    <th>
                                      <button type="button" className="analysis-table-sort-button" onClick={() => handlePredictionSort('peakProbPct')}>
                                        Peak % {renderSortArrow('peakProbPct')}
                                      </button>
                                    </th>
                                  )}
                                  <th>
                                    <button type="button" className="analysis-table-sort-button" onClick={() => handlePredictionSort('predictedPrice')}>
                                      Predicted {renderSortArrow('predictedPrice')}
                                    </button>
                                  </th>
                                  {algorithmId === 'bottomPeakLSTM' && (
                                    <th>
                                      <button type="button" className="analysis-table-sort-button" onClick={() => handlePredictionSort('isBottom')}>
                                        Bottom {renderSortArrow('isBottom')}
                                      </button>
                                    </th>
                                  )}
                                  {algorithmId === 'bottomPeakLSTM' && (
                                    <th>
                                      <button type="button" className="analysis-table-sort-button" onClick={() => handlePredictionSort('isPeak')}>
                                        Peak {renderSortArrow('isPeak')}
                                      </button>
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {sortedPredictionRows.map((row, index) => (
                                  <tr key={`${algorithmId}-prediction-row-${row.date}-${index}`}>
                                    <td>{row.date}</td>
                                    <td>{typeof row.close === 'number' ? `$${row.close.toFixed(2)}` : 'N/A'}</td>
                                    {algorithmId === 'bottomPeakLSTM' && <td>{typeof row.bottomProbPct === 'number' ? `${row.bottomProbPct.toFixed(2)}%` : 'N/A'}</td>}
                                    {algorithmId === 'bottomPeakLSTM' && <td>{typeof row.peakProbPct === 'number' ? `${row.peakProbPct.toFixed(2)}%` : 'N/A'}</td>}
                                    <td>{typeof row.predictedPrice === 'number' ? `$${row.predictedPrice.toFixed(2)}` : 'N/A'}</td>
                                    {algorithmId === 'bottomPeakLSTM' && <td>{row.isBottom ? 'Yes' : 'No'}</td>}
                                    {algorithmId === 'bottomPeakLSTM' && <td>{row.isPeak ? 'Yes' : 'No'}</td>}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <details className="analysis-raw-details">
                        <summary>Raw Queue Result (debug)</summary>
                        <div className="analysis-job-result-block">
                          <pre>
                            {job.resultPreview
                              ? JSON.stringify(job.resultPreview, null, 2)
                              : 'Result will appear here when the job completes.'}
                          </pre>
                        </div>
                      </details>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {stockData.length > 0 && (
        <div className="real-time-status">
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span className="status-text">Analysis ready for {currentStock}</span>
          </div>
        </div>
      )}

      <MLRunRecordsTable />
    </div>
  );
};

export default StockMLAnalysisTab;
