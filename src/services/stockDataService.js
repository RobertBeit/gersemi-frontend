// src/services/stockDataService.js
// Service to fetch stock data from the backend microservice

import axios from 'axios';
import { resolveServiceBaseUrl } from './runtimeEnv';

const BASE_URL = resolveServiceBaseUrl({
  explicitUrl: process.env.REACT_APP_BACKEND_ML_URL,
  localUrl: process.env.REACT_APP_BACKEND_ML_URL_LOCAL,
  deployedUrl: process.env.REACT_APP_BACKEND_ML_URL_DEV,
  fallbackUrl: 'https://localhost:3004',
});

/**
 * Fetch historical stock data from the backend
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of stock data objects
 */
export const fetchStockDataFromBackend = async (symbol, startDate, endDate) => {
  const url = `${BASE_URL}/api/predict/stock-data`;
  
  console.log('=== Backend Service Request ===');
  console.log('ML backend URL (local):', process.env.REACT_APP_BACKEND_ML_URL_LOCAL);
  console.log('ML backend URL (dev):', process.env.REACT_APP_BACKEND_ML_URL_DEV);
  console.log('Resolved BASE_URL:', BASE_URL);
  console.log('Full URL:', url);
  console.log('Params:', { symbol: symbol.toUpperCase(), startDate, endDate });
  
  try {
    const response = await axios.get(url, {
      params: {
        symbol: symbol.toUpperCase(),
        startDate,
        endDate,
        includeIntraday: true,
      },
      timeout: 120000,
    });

    console.log('✓ Response status:', response.status);
    console.log('✓ Response data:', response.data);

    if (response.data && response.data.data) {
      console.log(`✓ Backend returned ${response.data.data.length} data points`);
      return response.data.data;
    }

    console.error('✗ Invalid response format:', response.data);
    throw new Error('Invalid response format from ML backend');
  } catch (error) {
    console.error('=== Backend Service Error ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
      throw new Error(
        `Backend error (${error.response.status}): ${error.response.data?.error || error.response.statusText}`
      );
    }
    
    if (error.request) {
      console.error('Request was made but no response received');
      console.error('Request details:', error.request);
    }
    
    if (error.code === 'ECONNREFUSED') {
      throw new Error('ML backend is not running. Please start it on port 3004 or set REACT_APP_BACKEND_ML_URL to your deployed service URL.');
    }
    
    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      throw new Error(`Network error: Cannot connect to ${BASE_URL}. Check if ML backend is running and CORS is configured.`);
    }
    
    throw new Error(error.message || 'Failed to fetch stock data from ML backend');
  }
};
