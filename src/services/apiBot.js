import { resolveServiceBaseUrl } from './runtimeEnv';

const BOT_BASE_URL = resolveServiceBaseUrl({
  explicitUrl: process.env.REACT_APP_BOT_BASE_URL,
  localUrl: process.env.REACT_APP_BOT_BASE_URL_LOCAL,
  deployedUrl: process.env.REACT_APP_BOT_BASE_URL_DEV,
  fallbackUrl: 'http://localhost:3002',
});

const parseJsonResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
};

export const startPaperTradingBot = async (symbol) => {
  const response = await fetch(`${BOT_BASE_URL}/api/bot/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ symbol }),
  });

  return parseJsonResponse(response);
};

export const stopPaperTradingBot = async (symbol) => {
  const response = await fetch(`${BOT_BASE_URL}/api/bot/stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ symbol }),
  });

  return parseJsonResponse(response);
};

export const getPaperTradingBotStatus = async (symbol, options = {}) => {
  const query = new URLSearchParams();
  if (options.sinceUpdatedAt) {
    query.set('sinceUpdatedAt', options.sinceUpdatedAt);
  }

  const qs = query.toString();
  const response = await fetch(
    `${BOT_BASE_URL}/api/bot/status/${encodeURIComponent(symbol)}${qs ? `?${qs}` : ''}`
  );
  return parseJsonResponse(response);
};