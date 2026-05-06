// src/components/StockSearchDropdown.js
// Searchable dropdown component for stock selection

import React, { useState, useRef, useEffect } from 'react';

// Popular stocks data - you can expand this list
const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication Services' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology' },
  { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology' },
  { symbol: 'ORCL', name: 'Oracle Corporation', sector: 'Technology' },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology' },
  { symbol: 'PYPL', name: 'PayPal Holdings Inc.', sector: 'Financial Services' },
  { symbol: 'INTC', name: 'Intel Corporation', sector: 'Technology' },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.', sector: 'Technology' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services' },
  { symbol: 'BAC', name: 'Bank of America Corp.', sector: 'Financial Services' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services' },
  { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial Services' },
  { symbol: 'HD', name: 'Home Depot Inc.', sector: 'Consumer Discretionary' },
  { symbol: 'DIS', name: 'Walt Disney Co.', sector: 'Communication Services' },
  { symbol: 'KO', name: 'Coca-Cola Co.', sector: 'Consumer Staples' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Staples' },
  { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer Discretionary' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare' },
  { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare' },
  { symbol: 'MRK', name: 'Merck & Co. Inc.', sector: 'Healthcare' },
  { symbol: 'T', name: 'AT&T Inc.', sector: 'Communication Services' },
  { symbol: 'VZ', name: 'Verizon Communications', sector: 'Communication Services' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp.', sector: 'Energy' },
  { symbol: 'CVX', name: 'Chevron Corporation', sector: 'Energy' },
  { symbol: 'IBM', name: 'International Business Machines', sector: 'Technology' },
  { symbol: 'UBER', name: 'Uber Technologies Inc.', sector: 'Technology' },
  { symbol: 'LYFT', name: 'Lyft Inc.', sector: 'Technology' },
  { symbol: 'SPOT', name: 'Spotify Technology S.A.', sector: 'Communication Services' },
  { symbol: 'SQ', name: 'Block Inc.', sector: 'Technology' },
  { symbol: 'ROKU', name: 'Roku Inc.', sector: 'Communication Services' },
  { symbol: 'ZM', name: 'Zoom Video Communications', sector: 'Technology' },
  { symbol: 'SNAP', name: 'Snap Inc.', sector: 'Communication Services' },
  { symbol: 'TWTR', name: 'Twitter Inc.', sector: 'Communication Services' },
  { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Technology' },
  { symbol: 'COIN', name: 'Coinbase Global Inc.', sector: 'Financial Services' },
  { symbol: 'GME', name: 'GameStop Corp.', sector: 'Consumer Discretionary' },
  { symbol: 'AMC', name: 'AMC Entertainment Holdings', sector: 'Communication Services' },
  { symbol: 'BB', name: 'BlackBerry Limited', sector: 'Technology' },
  { symbol: 'MRNA', name: 'Moderna Inc.', sector: 'Healthcare' },
  { symbol: 'BNTX', name: 'BioNTech SE', sector: 'Healthcare' },
  { symbol: 'RBLX', name: 'Roblox Corporation', sector: 'Communication Services' }
];

const StockSearchDropdown = ({ value, onChange, placeholder = "Search stocks..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [filteredStocks, setFilteredStocks] = useState(POPULAR_STOCKS);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Filter stocks based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredStocks(POPULAR_STOCKS);
    } else {
      const filtered = POPULAR_STOCKS.filter(stock =>
        stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.sector.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStocks(filtered);
    }
    setHighlightedIndex(-1);
  }, [searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update search term when value prop changes
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
    
    // If user types a valid stock symbol directly, call onChange
    if (newValue.length >= 1 && newValue.length <= 5 && /^[A-Za-z]+$/.test(newValue)) {
      onChange(newValue.toUpperCase());
    }
  };

  const handleStockSelect = (stock) => {
    setSearchTerm(stock.symbol);
    setIsOpen(false);
    onChange(stock.symbol);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredStocks.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredStocks.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredStocks[highlightedIndex]) {
          handleStockSelect(filteredStocks[highlightedIndex]);
        } else if (searchTerm.length >= 1 && /^[A-Za-z]+$/.test(searchTerm)) {
          onChange(searchTerm.toUpperCase());
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  const getSectorColor = (sector) => {
    const colors = {
      'Technology': 'var(--accent-primary)',
      'Healthcare': 'var(--accent-green)',
      'Financial Services': 'var(--accent-secondary)',
      'Consumer Discretionary': 'var(--accent-orange)',
      'Consumer Staples': 'var(--accent-yellow)',
      'Communication Services': 'var(--accent-red)',
      'Energy': '#ff6b35',
      'default': 'var(--text-muted)'
    };
    return colors[sector] || colors.default;
  };

  return (
    <div className="stock-search-dropdown" ref={dropdownRef}>
      <div className="search-input-container">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="search-input"
          autoComplete="off"
        />
        <button
          type="button"
          className="dropdown-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle dropdown"
        >
          <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
        </button>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-header">
            {searchTerm ? (
              <span>Results for "{searchTerm}" ({filteredStocks.length})</span>
            ) : (
              <span>Popular Stocks</span>
            )}
          </div>
          
          <div className="dropdown-list">
            {filteredStocks.length > 0 ? (
              filteredStocks.map((stock, index) => (
                <div
                  key={stock.symbol}
                  className={`dropdown-item ${highlightedIndex === index ? 'highlighted' : ''}`}
                  onClick={() => handleStockSelect(stock)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="stock-info">
                    <div className="stock-main">
                      <span className="stock-symbol">{stock.symbol}</span>
                      <span className="stock-name">{stock.name}</span>
                    </div>
                    <div className="stock-meta">
                      <span 
                        className="stock-sector"
                        style={{ color: getSectorColor(stock.sector) }}
                      >
                        {stock.sector}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="dropdown-item no-results">
                <span>No stocks found</span>
                {searchTerm && /^[A-Za-z]+$/.test(searchTerm) && (
                  <button
                    className="use-custom-button"
                    onClick={() => {
                      onChange(searchTerm.toUpperCase());
                      setIsOpen(false);
                    }}
                  >
                    Use "{searchTerm.toUpperCase()}" anyway
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="dropdown-footer">
            <span>Type any stock symbol or search from popular stocks</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockSearchDropdown;