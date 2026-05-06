// src/components/StockForm.js
// Updated form component with searchable stock dropdown

import React, { useState } from 'react';
import StockSearchDropdown from './StockSearchDropdown';

const StockForm = ({ onSubmit, isLoading }) => {
  const [symbol, setSymbol] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (symbol && startDate && endDate) {
      onSubmit({ symbol: symbol.toUpperCase(), startDate, endDate });
    }
  };

  // Get today's date for the max date attribute
  const today = new Date().toISOString().split('T')[0];
  
  // Get default start date (1 year ago)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const defaultStartDate = oneYearAgo.toISOString().split('T')[0];

  // Set default dates if not already set
  React.useEffect(() => {
    if (!startDate) {
      setStartDate(defaultStartDate);
    }
    if (!endDate) {
      setEndDate(today);
    }
  }, [defaultStartDate, today, startDate, endDate]);

  return (
    <div className="stock-form">
      <h2>Stock Market Analysis</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="symbol">Stock Symbol:</label>
          <StockSearchDropdown
            value={symbol}
            onChange={setSymbol}
            placeholder="Search for stocks (e.g., AAPL, MSFT, GOOGL)..."
          />
          <div className="form-hint">
            💡 Start typing to search popular stocks or enter any symbol directly
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="startDate">Start Date:</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={today}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="endDate">End Date:</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              max={today}
              min={startDate}
              required
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button type="submit" disabled={isLoading || !symbol} className="primary-button">
            {isLoading ? (
              <>
                <span className="loading-spinner-small"></span>
                Analyzing...
              </>
            ) : (
              <>
                <span className="button-icon">🚀</span>
                Analyze Stock
              </>
            )}
          </button>
          
          {symbol && (
            <div className="selected-stock-info">
              <span className="selected-label">Selected:</span>
              <span className="selected-symbol">{symbol.toUpperCase()}</span>
            </div>
          )}
        </div>
      </form>
      
      <div className="form-footer">
        <div className="data-source">
          <span className="data-badge">📊 Powered by Alpha Vantage API</span>
        </div>
        <div className="feature-highlights">
          <span className="feature">🤖 AI Predictions</span>
          <span className="feature">📈 Technical Analysis</span>
          <span className="feature">🎯 Bottom/Peak Detection</span>
        </div>
      </div>
    </div>
  );
};

export default StockForm;