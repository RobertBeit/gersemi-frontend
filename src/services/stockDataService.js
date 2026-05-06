// src/services/stockDataService.js
// Service to fetch stock data from the backend microservice

import axios from 'axios';

const BASE_URL = process.env.REACT_APP_MICROSERVICE_BASE_URL_DEV;

/**
 * Fetch historical stock data from the backend
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of stock data objects
 */
export const fetchStockDataFromBackend = async (symbol, startDate, endDate) => {
  const url = `${BASE_URL}/api/stocks`;
  
  console.log('=== Backend Service Request ===');
  console.log('BASE_URL from env:', process.env.REACT_APP_MICROSERVICE_BASE_URL_LOCAL);
  console.log('Resolved BASE_URL:', BASE_URL);
  console.log('Full URL:', url);
  console.log('Params:', { symbol: symbol.toUpperCase(), startDate, endDate });
  
  try {
    const response = await axios.get(url, {
      params: {
        symbol: symbol.toUpperCase(),
        startDate,
        endDate,
      },
      timeout: 30000,
    });

    console.log('✓ Response status:', response.status);
    console.log('✓ Response data:', response.data);

    if (response.data && response.data.data) {
      console.log(`✓ Backend returned ${response.data.data.length} data points`);
      return response.data.data;
    }

    console.error('✗ Invalid response format:', response.data);
    throw new Error('Invalid response format from backend');
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
      throw new Error('Backend server is not running. Please start the backend on port 3001.');
    }
    
    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      throw new Error(`Network error: Cannot connect to ${BASE_URL}. Check if backend is running and CORS is configured.`);
    }
    
    throw new Error(error.message || 'Failed to fetch stock data from backend');
  }
};
