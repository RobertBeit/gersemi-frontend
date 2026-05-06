// src/services/api.js
// Multi-Provider Stock Data API Service with Automatic Fallbacks
// Uses: Alpha Vantage (primary) → Polygon.io (fallback) → Twelve Data (backup)

import axios from 'axios';

// ============================================================================
// API Configuration - Using environment variables
// ============================================================================
const ALPHA_VANTAGE_KEY = process.env.REACT_APP_ALPHA_VANTAGE_KEY ;
const POLYGON_KEY = process.env.REACT_APP_MASSIVE_KEY ;
const TWELVE_DATA_KEY = process.env.REACT_APP_TWELVE_DATA_KEY ;

const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';
const POLYGON_URL = 'https://api.polygon.io';
const TWELVE_DATA_URL = 'https://api.twelvedata.com';

// ============================================================================
// Caching Layer - Reduces API calls by 90%+
// ============================================================================
class CacheManager {
  constructor() {
    this.memoryCache = new Map();
  }

  // Generate cache key
  generateKey(type, symbol, ...params) {
    return `${type}_${symbol}_${params.join('_')}`;
  }

  // Get from cache (localStorage for historical, memory for real-time)
  get(key, maxAgeMinutes = 1440) { // Default 24 hours
    try {
      // Check memory cache first
      if (this.memoryCache.has(key)) {
        const cached = this.memoryCache.get(key);
        const age = Date.now() - cached.timestamp;
        if (age < maxAgeMinutes * 60 * 1000) {
          console.log(`Cache HIT (memory): ${key}, age: ${Math.floor(age / 1000)}s`);
          return cached.data;
        }
        this.memoryCache.delete(key);
      }

      // Check localStorage for historical data
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        const age = Date.now() - parsed.timestamp;
        if (age < maxAgeMinutes * 60 * 1000) {
          console.log(`Cache HIT (storage): ${key}, age: ${Math.floor(age / 60000)}min`);
          return parsed.data;
        }
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }
    return null;
  }

  // Set cache (localStorage for historical, memory for real-time)
  set(key, data, useLocalStorage = true) {
    try {
      const cached = {
        data,
        timestamp: Date.now()
      };

      // Always set in memory cache
      this.memoryCache.set(key, cached);

      // Also set in localStorage for historical data
      if (useLocalStorage) {
        localStorage.setItem(key, JSON.stringify(cached));
      }

      console.log(`Cache SET: ${key}`);
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }

  // Clear old cache entries
  cleanup() {
    try {
      const keys = Object.keys(localStorage);
      let removed = 0;
      keys.forEach(key => {
        if (key.startsWith('historical_') || key.startsWith('quote_')) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            const age = Date.now() - item.timestamp;
            if (age > 7 * 24 * 60 * 60 * 1000) { // Older than 7 days
              localStorage.removeItem(key);
              removed++;
            }
          } catch (e) {
            localStorage.removeItem(key);
            removed++;
          }
        }
      });
      if (removed > 0) {
        console.log(`Cache cleanup: removed ${removed} old entries`);
      }
    } catch (error) {
      console.warn('Cache cleanup error:', error);
    }
  }
}

const cache = new CacheManager();

// ============================================================================
// Alpha Vantage API Functions (Primary Provider)
// ============================================================================
const fetchFromAlphaVantage = async (symbol, startDate, endDate) => {
  console.log(`[Alpha Vantage] Fetching ${symbol} from ${startDate} to ${endDate}`);
  
  const response = await axios.get(ALPHA_VANTAGE_URL, {
    params: {
      function: 'TIME_SERIES_DAILY_ADJUSTED',
      symbol: symbol.toUpperCase(),
      outputsize: 'full',
      apikey: ALPHA_VANTAGE_KEY
    },
    timeout: 30000
  });

  // Check for errors
  if (response.data['Error Message']) {
    throw new Error(`Alpha Vantage: ${response.data['Error Message']}`);
  }
  if (response.data['Note']) {
    throw new Error(`Alpha Vantage rate limit: ${response.data['Note']}`);
  }
  if (response.data['Information']) {
    throw new Error(`Alpha Vantage: ${response.data['Information']}`);
  }
  if (!response.data['Time Series (Daily)']) {
    throw new Error('Alpha Vantage: No time series data in response');
  }

  const timeSeriesData = response.data['Time Series (Daily)'];
  
  // Convert to array and filter by date range
  const rawData = Object.entries(timeSeriesData)
    .filter(([date]) => date >= startDate && date <= endDate)
    .map(([date, values]) => ({
      date,
      raw_open: parseFloat(values['1. open']) || 0,
      raw_high: parseFloat(values['2. high']) || 0,
      raw_low: parseFloat(values['3. low']) || 0,
      raw_close: parseFloat(values['4. close']) || 0,
      adjusted_close: parseFloat(values['5. adjusted close']) || 0,
      volume: parseInt(values['6. volume']) || 0,
      dividend_amount: parseFloat(values['7. dividend amount']) || 0,
      split_coefficient: parseFloat(values['8. split coefficient']) || 1
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (rawData.length === 0) {
    throw new Error(`No data found for ${symbol} in date range`);
  }

  // Apply cumulative split adjustments to OHLC data
  return applyFullSplitAdjustment(rawData);
};

// ============================================================================
// Polygon.io API Functions (Fallback Provider)
// ============================================================================
const fetchFromPolygon = async (symbol, startDate, endDate) => {
  console.log(`[Polygon.io] Fetching ${symbol} from ${startDate} to ${endDate}`);
  
  try {
    const response = await axios.get(`${POLYGON_URL}/v2/aggs/ticker/${symbol.toUpperCase()}/range/1/day/${startDate}/${endDate}`, {
      params: {
        adjusted: 'true',
        sort: 'asc',
        apiKey: POLYGON_KEY
      },
      timeout: 30000
    });

    if (response.data.status === 'ERROR') {
      throw new Error(`Polygon.io: ${response.data.error || 'Unknown error'}`);
    }

    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`Polygon.io: No data found for ${symbol}`);
    }

    // Convert Polygon data to our format
    const stockData = response.data.results.map(item => {
      const date = new Date(item.t).toISOString().split('T')[0];
      return {
        date,
        open: item.o,
        high: item.h,
        low: item.l,
        close: item.c,
        volume: item.v,
        raw_open: item.o,
        raw_high: item.h,
        raw_low: item.l,
        raw_close: item.c,
        adjusted_close: item.c,
        split_coefficient: 1,
        dividend_amount: 0,
        adjustment_factor: 1
      };
    });

    console.log(`[Polygon.io] Successfully fetched ${stockData.length} data points`);
    return stockData;
  } catch (error) {
    if (error.response) {
      throw new Error(`Polygon.io: HTTP ${error.response.status} - ${error.response.data?.message || error.message}`);
    }
    throw error;
  }
};

// ============================================================================
// Twelve Data API Functions (Backup Provider)
// ============================================================================
const fetchFromTwelveData = async (symbol, startDate, endDate) => {
  console.log(`[Twelve Data] Fetching ${symbol} from ${startDate} to ${endDate}`);
  
  const response = await axios.get(`${TWELVE_DATA_URL}/time_series`, {
    params: {
      symbol: symbol.toUpperCase(),
      interval: '1day',
      start_date: startDate,
      end_date: endDate,
      apikey: TWELVE_DATA_KEY,
      format: 'JSON'
    },
    timeout: 30000
  });

  if (response.data.status === 'error') {
    throw new Error(`Twelve Data: ${response.data.message || 'Unknown error'}`);
  }

  if (!response.data.values || response.data.values.length === 0) {
    throw new Error(`Twelve Data: No data found for ${symbol}`);
  }

  // Convert Twelve Data format to our format
  const stockData = response.data.values
    .map(item => ({
      date: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseInt(item.volume) || 0,
      raw_open: parseFloat(item.open),
      raw_high: parseFloat(item.high),
      raw_low: parseFloat(item.low),
      raw_close: parseFloat(item.close),
      adjusted_close: parseFloat(item.close),
      split_coefficient: 1,
      dividend_amount: 0,
      adjustment_factor: 1
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  console.log(`[Twelve Data] Successfully fetched ${stockData.length} data points`);
  return stockData;
};

// ============================================================================
// Main API Function - Historical Stock Data with Automatic Fallbacks
// ============================================================================
export const fetchStockData = async (symbol, startDate, endDate) => {
  try {
    console.log(`\n=== Fetching stock data for ${symbol} ===`);
    console.log(`Date range: ${startDate} to ${endDate}`);

    // Check cache first (24 hour cache for historical data)
    const cacheKey = cache.generateKey('historical', symbol, startDate, endDate);
    const cached = cache.get(cacheKey, 1440); // 24 hours
    if (cached) {
      return cached;
    }

    // Try providers in order: Alpha Vantage → Polygon → Twelve Data
    const providers = [
      { name: 'Alpha Vantage', fetch: fetchFromAlphaVantage },
      { name: 'Polygon.io', fetch: fetchFromPolygon },
      { name: 'Twelve Data', fetch: fetchFromTwelveData }
    ];

    let lastError = null;

    for (const provider of providers) {
      try {
        const data = await provider.fetch(symbol, startDate, endDate);
        console.log(`✓ ${provider.name} succeeded with ${data.length} data points`);
        
        // Cache the successful result
        cache.set(cacheKey, data, true);
        
        return data;
      } catch (error) {
        console.warn(`✗ ${provider.name} failed:`, error.message);
        lastError = error;
        
        // If rate limit, wait a bit before trying next provider
        if (error.message.includes('rate limit')) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // All providers failed
    throw new Error(`All API providers failed. Last error: ${lastError?.message || 'Unknown error'}`);

  } catch (error) {
    console.error('Error in fetchStockData:', error);
    throw error;
  }
};

// ============================================================================
// Real-time Quote Functions with Fallbacks
// ============================================================================
const fetchQuoteFromPolygon = async (symbol) => {
  const response = await axios.get(`${POLYGON_URL}/v2/aggs/ticker/${symbol.toUpperCase()}/prev`, {
    params: { adjusted: 'true', apiKey: POLYGON_KEY },
    timeout: 10000
  });

  if (response.data.results && response.data.results.length > 0) {
    const quote = response.data.results[0];
    return {
      symbol: symbol.toUpperCase(),
      price: quote.c,
      open: quote.o,
      high: quote.h,
      low: quote.l,
      volume: quote.v,
      previousClose: quote.c,
      timestamp: new Date(quote.t)
    };
  }
  throw new Error('No quote data from Polygon');
};

const fetchQuoteFromAlphaVantage = async (symbol) => {
  const response = await axios.get(ALPHA_VANTAGE_URL, {
    params: {
      function: 'GLOBAL_QUOTE',
      symbol: symbol.toUpperCase(),
      apikey: ALPHA_VANTAGE_KEY
    },
    timeout: 10000
  });

  const quote = response.data['Global Quote'];
  if (!quote || !quote['05. price']) {
    throw new Error('No quote data from Alpha Vantage');
  }

  return {
    symbol: symbol.toUpperCase(),
    price: parseFloat(quote['05. price']),
    open: parseFloat(quote['02. open']),
    high: parseFloat(quote['03. high']),
    low: parseFloat(quote['04. low']),
    volume: parseInt(quote['06. volume']),
    previousClose: parseFloat(quote['08. previous close']),
    change: parseFloat(quote['09. change']),
    changesPercentage: parseFloat(quote['10. change percent']?.replace('%', '')),
    timestamp: new Date()
  };
};

const fetchQuoteFromTwelveData = async (symbol) => {
  const response = await axios.get(`${TWELVE_DATA_URL}/quote`, {
    params: {
      symbol: symbol.toUpperCase(),
      apikey: TWELVE_DATA_KEY
    },
    timeout: 10000
  });

  if (response.data && response.data.close) {
    return {
      symbol: symbol.toUpperCase(),
      price: parseFloat(response.data.close),
      open: parseFloat(response.data.open),
      high: parseFloat(response.data.high),
      low: parseFloat(response.data.low),
      volume: parseInt(response.data.volume) || 0,
      previousClose: parseFloat(response.data.previous_close),
      timestamp: new Date()
    };
  }
  throw new Error('No quote data from Twelve Data');
};

export const fetchCurrentQuote = async (symbol) => {
  try {
    // Check cache first (1 minute cache for real-time quotes)
    const cacheKey = cache.generateKey('quote', symbol);
    const cached = cache.get(cacheKey, 1); // 1 minute
    if (cached) {
      return cached;
    }

    // Try providers in order: Polygon → Alpha Vantage → Twelve Data
    const providers = [
      { name: 'Polygon.io', fetch: fetchQuoteFromPolygon },
      { name: 'Alpha Vantage', fetch: fetchQuoteFromAlphaVantage },
      { name: 'Twelve Data', fetch: fetchQuoteFromTwelveData }
    ];

    for (const provider of providers) {
      try {
        const quote = await provider.fetch(symbol);
        console.log(`✓ ${provider.name} quote succeeded`);
        
        // Cache with short TTL (don't use localStorage for real-time)
        cache.set(cacheKey, quote, false);
        
        return quote;
      } catch (error) {
        console.warn(`✗ ${provider.name} quote failed:`, error.message);
      }
    }

    throw new Error('All quote providers failed');
  } catch (error) {
    console.error('Error fetching current quote:', error);
    return null;
  }
};

// ============================================================================
// Dividend & Split Data (from Alpha Vantage historical data)
// ============================================================================
export const fetchDividendData = async (symbol) => {
  try {
    // Get 5 years of historical data to extract dividends
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const data = await fetchStockData(symbol, startDate, endDate);
    
    // Extract dividend events
    const dividends = data
      .filter(d => d.dividend_amount > 0)
      .map(d => ({
        date: d.date,
        dividend: d.dividend_amount
      }));

    return dividends;
  } catch (error) {
    console.error('Error fetching dividend data:', error);
    return [];
  }
};

export const fetchSplitsData = async (symbol) => {
  try {
    // Get 5 years of historical data to extract splits
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const data = await fetchStockData(symbol, startDate, endDate);
    
    // Extract split events
    const splits = data
      .filter(d => d.split_coefficient !== 1)
      .map(d => ({
        date: d.date,
        ratio: d.split_coefficient,
        type: d.split_coefficient > 1 ? 'split' : 'reverse_split',
        description: `${d.split_coefficient}:1 ${d.split_coefficient > 1 ? 'Stock Split' : 'Reverse Split'}`
      }));

    return splits;
  } catch (error) {
    console.error('Error fetching splits data:', error);
    return [];
  }
};

// ============================================================================
// Real-time Data Manager for Intraday Predictions
// ============================================================================
export class RealTimeDataManager {
  constructor(symbol) {
    this.symbol = symbol;
    this.currentData = null;
    this.lastUpdate = null;
    this.updateInterval = null;
    this.subscribers = [];
  }

  startRealTimeUpdates(intervalMinutes = 1) {
    this.stopRealTimeUpdates();
    
    const updateData = async () => {
      try {
        const quote = await fetchCurrentQuote(this.symbol);
        if (quote) {
          this.currentData = {
            currentPrice: quote.price,
            currentVolume: quote.volume,
            dayOpen: quote.open,
            dayHigh: quote.high,
            dayLow: quote.low,
            previousClose: quote.previousClose,
            change: quote.change,
            changePercent: quote.changesPercentage,
            timestamp: new Date(),
            marketCap: quote.marketCap,
            avgVolume: quote.avgVolume
          };
          this.lastUpdate = new Date();
          this.notifySubscribers(this.currentData);
        }
      } catch (error) {
        console.error('Error updating real-time data:', error);
      }
    };

    updateData();
    this.updateInterval = setInterval(updateData, intervalMinutes * 60 * 1000);
    return this;
  }

  stopRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    if (this.currentData) {
      callback(this.currentData);
    }
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  notifySubscribers(data) {
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in subscriber callback:', error);
      }
    });
  }

  getCurrentData() {
    if (!this.currentData) return null;
    return {
      currentPrice: this.currentData.currentPrice,
      currentVolume: this.currentData.currentVolume,
      timestamp: this.currentData.timestamp,
      isStale: this.isDataStale()
    };
  }

  isDataStale() {
    if (!this.lastUpdate) return true;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.lastUpdate < fiveMinutesAgo;
  }

  isMarketOpen() {
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return false;
    
    const marketOpen = new Date(now);
    marketOpen.setHours(9, 30, 0, 0);
    const marketClose = new Date(now);
    marketClose.setHours(16, 0, 0, 0);
    
    return now >= marketOpen && now <= marketClose;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================
export const getCurrentPriceAndVolume = async (symbol) => {
  try {
    const quote = await fetchCurrentQuote(symbol);
    if (quote) {
      return {
        currentPrice: quote.price,
        currentVolume: quote.volume,
        timestamp: new Date()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting current price and volume:', error);
    return null;
  }
};

export const isMarketOpen = () => {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  
  const marketOpen = new Date(now);
  marketOpen.setHours(9, 30, 0, 0);
  const marketClose = new Date(now);
  marketClose.setHours(16, 0, 0, 0);
  
  return now >= marketOpen && now <= marketClose;
};

export const createRealTimeDataHook = (symbol) => {
  const manager = new RealTimeDataManager(symbol);
  return {
    manager,
    startUpdates: (intervalMinutes = 1) => manager.startRealTimeUpdates(intervalMinutes),
    stopUpdates: () => manager.stopRealTimeUpdates(),
    subscribe: (callback) => manager.subscribe(callback),
    getCurrentData: () => manager.getCurrentData(),
    isMarketOpen: () => manager.isMarketOpen()
  };
};

// ============================================================================
// Split Adjustment Algorithm
// ============================================================================
export const applyFullSplitAdjustment = (rawData) => {
  if (!rawData || rawData.length === 0) return [];

  // Calculate cumulative split coefficient (working backwards from most recent)
  const dataWithCumulativeSplits = [...rawData];
  let cumulativeSplitCoefficient = 1;

  for (let i = dataWithCumulativeSplits.length - 1; i >= 0; i--) {
    cumulativeSplitCoefficient *= dataWithCumulativeSplits[i].split_coefficient || 1;
    dataWithCumulativeSplits[i].cumulative_split_coefficient = cumulativeSplitCoefficient;
  }

  // Apply adjustments
  return dataWithCumulativeSplits.map(item => {
    const raw_close = item.raw_close || item.close;
    const adjusted_close = item.adjusted_close || item.close;
    const adjustment_factor = raw_close > 0 ? adjusted_close / raw_close : 1;

    return {
      date: item.date,
      open: (item.raw_open || item.open) * adjustment_factor,
      high: (item.raw_high || item.high) * adjustment_factor,
      low: (item.raw_low || item.low) * adjustment_factor,
      close: adjusted_close,
      volume: item.volume,
      raw_open: item.raw_open || item.open,
      raw_high: item.raw_high || item.high,
      raw_low: item.raw_low || item.low,
      raw_close: raw_close,
      split_coefficient: item.split_coefficient || 1,
      dividend_amount: item.dividend_amount || 0,
      adjustment_factor: adjustment_factor,
      alpha_vantage_adjusted_close: adjusted_close,
      cumulative_split_coefficient: item.cumulative_split_coefficient
    };
  });
};

// Compatibility functions
export const applyAdjustmentUsingAlphaVantageClose = (rawData) => {
  return applyFullSplitAdjustment(rawData);
};

export const detectStockSplits = (stockData) => {
  const splits = [];
  for (let i = 1; i < stockData.length; i++) {
    const current = stockData[i];
    if (current.split_coefficient && current.split_coefficient !== 1) {
      splits.push({
        date: current.date,
        ratio: current.split_coefficient,
        type: current.split_coefficient > 1 ? 'split' : 'reverse_split',
        description: `${current.split_coefficient}:1 Stock Split`
      });
    }
  }
  return splits;
};

export const validateAdjustments = (stockData) => {
  const issues = [];
  for (let i = 1; i < stockData.length; i++) {
    const prev = stockData[i - 1];
    const curr = stockData[i];
    
    const priceChange = Math.abs((curr.close - prev.close) / prev.close);
    if (priceChange > 0.5) {
      issues.push({
        date: curr.date,
        type: 'large_price_change',
        price_change_percent: (priceChange * 100).toFixed(2),
        prev_close: prev.close,
        curr_close: curr.close
      });
    }
    
    if (curr.close > curr.high || curr.close < curr.low || 
        curr.open > curr.high || curr.open < curr.low) {
      issues.push({
        date: curr.date,
        type: 'invalid_ohlc_relationship',
        open: curr.open,
        high: curr.high,
        low: curr.low,
        close: curr.close
      });
    }
  }
  return issues;
};

// ============================================================================
// Test & Monitoring Functions
// ============================================================================
export const testApiConnection = async () => {
  try {
    console.log('\n=== Testing Multi-Provider API Connection ===');
    
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const testData = await fetchStockData('AAPL', startDate, endDate);

    if (testData && testData.length > 0) {
      return {
        success: true,
        message: 'Multi-provider API connection successful',
        dataPoints: testData.length,
        sampleData: testData[testData.length - 1],
        dateRange: { start: testData[0].date, end: testData[testData.length - 1].date },
        providers: 'Alpha Vantage → Polygon.io → Twelve Data',
        cacheStatus: 'Active (24h historical, 1min quotes)'
      };
    }

    return {
      success: false,
      message: 'No data returned from any provider'
    };

  } catch (error) {
    console.error('API Test Error:', error);
    return {
      success: false,
      message: 'Multi-provider API test failed',
      details: error.message,
      helpText: 'Check API keys in .env file'
    };
  }
};

export const checkApiUsage = async () => {
  try {
    const testResult = await testApiConnection();
    return {
      success: testResult.success,
      message: testResult.success ? 
        'API working with multi-provider fallbacks and caching' : 
        'API test failed',
      details: testResult
    };
  } catch (error) {
    return {
      success: false,
      message: 'Unable to check API usage',
      error: error.message
    };
  }
};

// Cleanup old cache on load
cache.cleanup();

console.log('✓ Multi-Provider Stock API loaded');
console.log('  Primary: Alpha Vantage (25 calls/day)');
console.log('  Fallback: Polygon.io (5 calls/min)');
console.log('  Backup: Twelve Data (800 calls/day)');
console.log('  Cache: 24h (historical), 1min (quotes)');