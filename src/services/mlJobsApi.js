import { resolveServiceBaseUrl } from './runtimeEnv';

const BASE_URL = resolveServiceBaseUrl({
  explicitUrl: process.env.REACT_APP_BACKEND_ML_URL,
  localUrl: process.env.REACT_APP_BACKEND_ML_URL_LOCAL,
  deployedUrl: process.env.REACT_APP_BACKEND_ML_URL_DEV,
  fallbackUrl: 'https://localhost:3004',
});

const parseJson = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
};

export const enqueueMlJob = async ({ service, method, args = [], metadata = {} }) => {
  const response = await fetch(`${BASE_URL}/api/ml-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, method, args, metadata }),
  });

  return parseJson(response);
};

/**
 * Predict with automatic data fetch from data backend.
 * ML backend handles data retrieval, UI only sends symbol+algorithm+dates.
 *
 * @param {string} symbol - e.g. "AAPL"
 * @param {string} algorithm - e.g. "linearRegression"
 * @param {string} startDate - "YYYY-MM-DD"
 * @param {string} endDate - "YYYY-MM-DD"
 * @param {object} options - algorithm-specific options
 * @param {object} metadata - optional metadata
 * @returns {Promise} job with id, status, etc.
 */
export const predictWithData = async ({
  symbol,
  algorithm,
  startDate,
  endDate,
  options = {},
  metadata = {},
}) => {
  const response = await fetch(`${BASE_URL}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol,
      algorithm,
      startDate,
      endDate,
      options,
      metadata,
    }),
  });

  return parseJson(response);
};

export const fetchMlJobs = async () => {
  const response = await fetch(`${BASE_URL}/api/ml-jobs`);
  return parseJson(response);
};

export const fetchMlJob = async (jobId) => {
  const response = await fetch(`${BASE_URL}/api/ml-jobs/${encodeURIComponent(jobId)}`);
  return parseJson(response);
};

export const fetchMlJobResult = async (jobId) => {
  const response = await fetch(`${BASE_URL}/api/ml-jobs/${encodeURIComponent(jobId)}/result`);
  return parseJson(response);
};

export const cancelMlJob = async (jobId) => {
  const response = await fetch(`${BASE_URL}/api/ml-jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
  return parseJson(response);
};

export const waitForMlJobCompletion = async (jobId, options = {}) => {
  const timeoutMs = options.timeoutMs || 20 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs || 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = await fetchMlJob(jobId);
    if (job.status === 'completed') {
      return fetchMlJobResult(jobId);
    }
    if (job.status === 'failed' || job.status === 'cancelled') {
      const result = await fetchMlJobResult(jobId);
      throw new Error(result.error || `ML job ${job.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Timed out waiting for ML job completion');
};