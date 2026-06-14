import React, { useState } from 'react';
import { resolveServiceBaseUrl } from '../services/runtimeEnv';

const RECENT_SEARCHES_KEY = 'senatorRecentSearches';
const MAX_RECENT_SEARCHES = 10;

const SENATOR_BASE_URL = resolveServiceBaseUrl({
  explicitUrl: process.env.REACT_APP_SENATOR_MICROSERVICE_BASE_URL,
  localUrl: process.env.REACT_APP_SENATOR_MICROSERVICE_BASE_URL_LOCAL,
  deployedUrl: process.env.REACT_APP_SENATOR_MICROSERVICE_BASE_URL_DEV,
  fallbackUrl: 'https://localhost:3001',
});

const TITLE_GRADIENT_PAIRS = [
  {
    background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.95) 0%, rgba(196, 181, 253, 0.95) 100%)',
    text: 'linear-gradient(120deg, #1e3a8a 0%, #4338ca 50%, #6d28d9 100%)',
    border: 'rgba(79, 70, 229, 0.45)',
  },
  {
    background: 'linear-gradient(135deg, rgba(204, 251, 241, 0.95) 0%, rgba(191, 219, 254, 0.95) 100%)',
    text: 'linear-gradient(120deg, #0f766e 0%, #0369a1 50%, #1d4ed8 100%)',
    border: 'rgba(14, 116, 144, 0.4)',
  },
  {
    background: 'linear-gradient(135deg, rgba(254, 240, 138, 0.9) 0%, rgba(254, 205, 211, 0.95) 100%)',
    text: 'linear-gradient(120deg, #b45309 0%, #be123c 55%, #7e22ce 100%)',
    border: 'rgba(190, 24, 93, 0.38)',
  },
  {
    background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.95) 0%, rgba(221, 214, 254, 0.95) 100%)',
    text: 'linear-gradient(120deg, #075985 0%, #3730a3 55%, #6d28d9 100%)',
    border: 'rgba(55, 48, 163, 0.4)',
  },
  {
    background: 'linear-gradient(135deg, rgba(209, 250, 229, 0.95) 0%, rgba(191, 219, 254, 0.95) 100%)',
    text: 'linear-gradient(120deg, #166534 0%, #0f766e 45%, #1d4ed8 100%)',
    border: 'rgba(21, 128, 61, 0.35)',
  },
  {
    background: 'linear-gradient(135deg, rgba(255, 228, 230, 0.95) 0%, rgba(224, 231, 255, 0.95) 100%)',
    text: 'linear-gradient(120deg, #be123c 0%, #7c3aed 60%, #1d4ed8 100%)',
    border: 'rgba(124, 58, 237, 0.38)',
  },
];

const parseReportDateToEpoch = (value) => {
  if (!value || typeof value !== 'string') return 0;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return 0;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const epoch = new Date(year, month - 1, day).getTime();
  return Number.isFinite(epoch) ? epoch : 0;
};

const hashString = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getTitleGradientStyle = (report, reportIdx) => {
  const seed = `${report?.senator || ''}|${report?.reportTitle || ''}|${report?.reportDate || ''}|${reportIdx}`;
  const pair = TITLE_GRADIENT_PAIRS[hashString(seed) % TITLE_GRADIENT_PAIRS.length];

  return {
    backgroundImage: pair.background,
    borderColor: pair.border,
    '--report-title-text-gradient': pair.text,
  };
};

const SenatorTransactionSearch = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);

  const today = new Date().toISOString().split('T')[0];
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const defaultStartDate = oneMonthAgo.toISOString().split('T')[0];

  React.useEffect(() => {
    if (!startDate) setStartDate(defaultStartDate);
    if (!endDate) setEndDate(today);
  }, [defaultStartDate, today, startDate, endDate]);

  React.useEffect(() => {
    try {
      const cachedSearches = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (cachedSearches) {
        const parsed = JSON.parse(cachedSearches);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to read recent searches from localStorage', err);
    }
  }, []);

  const saveRecentSearch = (search) => {
    try {
      const searchKey = `${search.firstName.toLowerCase()}|${search.lastName.toLowerCase()}|${search.startDate}|${search.endDate}`;
      const updated = [search, ...recentSearches.filter((item) => {
        const itemKey = `${item.firstName.toLowerCase()}|${item.lastName.toLowerCase()}|${item.startDate}|${item.endDate}`;
        return itemKey !== searchKey;
      })].slice(0, MAX_RECENT_SEARCHES);

      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save recent search to localStorage', err);
    }
  };

  const applyRecentSearch = (search) => {
    setFirstName(search.firstName || '');
    setLastName(search.lastName || '');
    setStartDate(search.startDate || defaultStartDate);
    setEndDate(search.endDate || today);
  };

  const firstNameSuggestions = [...new Set(
    recentSearches
      .map((search) => search.firstName)
      .filter(Boolean)
  )];

  const lastNameSuggestions = [...new Set(
    recentSearches
      .map((search) => search.lastName)
      .filter(Boolean)
  )];

  const sortedResults = [...results].sort(
    (a, b) => parseReportDateToEpoch(b?.reportDate) - parseReportDateToEpoch(a?.reportDate)
  );

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);

    if (!startDate || !endDate) {
      setError('Start date and end date are required');
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (firstName) params.append('firstName', firstName);
      if (lastName) params.append('lastName', lastName);
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      const url = `${SENATOR_BASE_URL}/api/senator-transactions?${params.toString()}`;

      console.log('Requesting:', url);

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResults(data.results || []);
      saveRecentSearch({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        startDate,
        endDate,
      });
      console.log(`Found ${data.count || 0} results`);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="senator-search-container">
      <div className="senator-search-form">
        <h2>🏛️ Senator Transaction Search</h2>
        <form onSubmit={handleSearch}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name:</label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g., John (leave blank for all)"
                list="recent-first-names"
              />
              <datalist id="recent-first-names">
                {firstNameSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name:</label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g., Smith (leave blank for all)"
                list="recent-last-names"
              />
              <datalist id="recent-last-names">
                {lastNameSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>

          {recentSearches.length > 0 && (
            <div className="form-row">
              <div className="form-group" style={{ width: '100%' }}>
                <label>Recent Searches:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {recentSearches.slice(0, 5).map((search, idx) => {
                    const label = search.firstName || search.lastName
                      ? `${search.firstName} ${search.lastName}`.trim()
                      : 'All Senators';
                    return (
                      <button
                        key={`${label}-${search.startDate}-${search.endDate}-${idx}`}
                        type="button"
                        onClick={() => applyRecentSearch(search)}
                        className="primary-button"
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                      >
                        {label} ({search.startDate} → {search.endDate})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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

          <button type="submit" disabled={loading} className="primary-button">
            {loading ? (
              <>
                <span className="loading-spinner-small"></span>
                Searching...
              </>
            ) : (
              <>
                <span className="button-icon">🔍</span>
                Search Transactions
              </>
            )}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}
      </div>

      {sortedResults.length > 0 && (
        <div className="senator-results">
          <h3>
            {firstName || lastName ? `Results for ${firstName} ${lastName}` : 'All Senator Transactions'} ({sortedResults.length} reports found)
          </h3>
          
      {sortedResults.map((report, reportIdx) => (
            <div key={reportIdx} className="report-section">
              <div className="report-header">
                <h4 className="report-title-highlight" style={getTitleGradientStyle(report, reportIdx)}>
                  <span className="report-title-gradient-text">{`${report.reportTitle} - ${report.senator || 'Unknown'}`}</span>
                </h4>
                <span className="filed-date filed-date--strong">Filed: {report.reportDate}</span>
                {report.reportUrl && (
                  <a href={report.reportUrl} target="_blank" rel="noopener noreferrer" className="view-original">
                    View Official Document
                  </a>
                )}
              </div>

              {report.transactions && report.transactions.length > 0 ? (
                <table className="transactions-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ticker</th>
                      <th>Asset Name</th>
                      <th>Type</th>
                      <th>Owner</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.transactions.map((tx, txIdx) => (
                      <tr key={txIdx}>
                        <td>{tx.transactionDate}</td>
                        <td><strong>{tx.ticker}</strong></td>
                        <td>{tx.assetName}</td>
                        <td>{tx.type}</td>
                        <td>{tx.owner}</td>
                        <td>{tx.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="no-transactions">No transactions found in this report</p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && sortedResults.length === 0 && !error && (
        <div className="no-results">
          <p>Enter senator details and click search to view transactions</p>
        </div>
      )}
    </div>
  );
};

export default SenatorTransactionSearch;
