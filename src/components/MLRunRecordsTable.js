import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteRunRecord,
  isDeterministicRunRecordId,
  migrateRunRecordId,
  searchRunRecords,
  updateRunRecord,
} from '../services/mlRunHistoryService';
import '../styles/MlRunRecordsTable.css';

const DEFAULT_FILTERS = {
  symbol: '',
  algorithm: '',
  status: '',
  jobId: '',
  searchText: '',
  createdFrom: '',
  createdTo: '',
  limit: 100,
};

const buildSearchCriteria = (filters) => ({
  ...filters,
  createdFrom: filters.createdFrom ? `${filters.createdFrom}T00:00:00.000Z` : '',
  createdTo: filters.createdTo ? `${filters.createdTo}T23:59:59.999Z` : '',
});

const toDisplayDate = (isoString) => {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const toPercent = (value, digits = 2) => (
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(digits)}%`
    : 'N/A'
);

const formatMetricValue = (value, label = '') => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return String(value);

  const normalizedLabel = String(label).toLowerCase();
  if (normalizedLabel.includes('accuracy') || normalizedLabel.includes('probability') || normalizedLabel.includes('confidence')) {
    const needsPercent = value <= 1;
    return needsPercent ? toPercent(value * 100) : toPercent(value);
  }

  if (normalizedLabel.includes('loss')) {
    return value.toFixed(4);
  }

  if (normalizedLabel.includes('threshold')) {
    return value.toFixed(3);
  }

  if (normalizedLabel.includes('days')) {
    return `${value.toFixed(0)} day(s)`;
  }

  return value.toFixed(4);
};

const normalizePerformanceCards = (cards = []) => cards
  .map((card) => ({
    label: card?.label || card?.key || 'Metric',
    value: card?.displayValue || formatMetricValue(card?.value, card?.label || card?.key),
  }))
  .filter((card) => card.value !== 'N/A' && card.label);

const normalizeForecastCards = (cards = []) => cards
  .map((card) => ({
    label: card?.label || card?.key || 'Forecast',
    value: card?.value,
  }))
  .filter((card) => card.value !== null && card.value !== undefined);

const getForecastMap = (record) => {
  const map = new Map();
  normalizeForecastCards(record?.predictionForecast || []).forEach((card) => {
    map.set(card.label, card.value);
  });
  return map;
};

const renderMetricList = (items = []) => {
  if (!items.length) {
    return <div className="ml-runs-history__empty-inline">No metrics saved.</div>;
  }

  return (
    <div className="ml-runs-history__metric-list">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="ml-runs-history__metric-chip">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
};

const renderForecastSummary = (record) => {
  const forecastMap = getForecastMap(record);
  const horizon = forecastMap.get('Prediction Horizon') || forecastMap.get('Horizon') || 'N/A';
  const asOf = forecastMap.get('As Of') || 'N/A';
  const targetDate = forecastMap.get('Target Date') || 'N/A';
  const currentPrice = forecastMap.get('Current Price') || forecastMap.get('Last Close') || 'N/A';
  const predictedPrice = forecastMap.get('Predicted Price') || 'N/A';
  const expectedChange = forecastMap.get('Expected Change') || 'N/A';
  const direction = forecastMap.get('Direction') || 'N/A';
  const confidence = forecastMap.get('Confidence') || 'N/A';
  const priceSource = forecastMap.get('Price Source') || 'N/A';

  return (
    <div className="ml-runs-history__forecast-grid">
      <div><span>Horizon</span><strong>{horizon}</strong></div>
      <div><span>As Of</span><strong>{asOf}</strong></div>
      <div><span>Target</span><strong>{targetDate}</strong></div>
      <div><span>Current</span><strong>{currentPrice}</strong></div>
      <div><span>Predicted</span><strong>{predictedPrice}</strong></div>
      <div><span>Change</span><strong>{expectedChange}</strong></div>
      <div><span>Direction</span><strong>{direction}</strong></div>
      <div><span>Confidence</span><strong>{confidence}</strong></div>
      <div><span>Source</span><strong>{priceSource}</strong></div>
    </div>
  );
};

const renderRecordSummary = (record) => {
  const performanceItems = normalizePerformanceCards(record?.algorithmPerformance || []);
  const forecastItems = normalizeForecastCards(record?.predictionForecast || []);
  const hasPerformance = performanceItems.length > 0;
  const hasForecast = forecastItems.length > 0;

  if (!hasPerformance && !hasForecast) {
    return <div className="ml-runs-history__empty-inline">No summary data saved.</div>;
  }

  return (
    <div className="ml-runs-history__summary-card">
      {hasForecast && (
        <div className="ml-runs-history__summary-section">
          <div className="ml-runs-history__summary-section-title">Prediction Forecast</div>
          {renderForecastSummary(record)}
        </div>
      )}

      {hasPerformance && (
        <div className="ml-runs-history__summary-section">
          <div className="ml-runs-history__summary-section-title">Performance Statistics</div>
          {renderMetricList(performanceItems)}
        </div>
      )}
    </div>
  );
};

const MLRunRecordsTable = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noteDraftById, setNoteDraftById] = useState({});
  const [activeId, setActiveId] = useState('');
  const hasAttemptedIdMigrationRef = useRef(false);

  const loadRecords = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError('');

    try {
      let result = await searchRunRecords(buildSearchCriteria(nextFilters));

      if (!hasAttemptedIdMigrationRef.current) {
        hasAttemptedIdMigrationRef.current = true;
        const legacyRecords = result.filter((record) => !isDeterministicRunRecordId(record));

        if (legacyRecords.length > 0) {
          await Promise.all(legacyRecords.map((record) => migrateRunRecordId(record)));
          result = await searchRunRecords(buildSearchCriteria(nextFilters));
        }
      }

      setRecords(result);
      setNoteDraftById((prev) => {
        const next = { ...prev };
        result.forEach((record) => {
          if (typeof next[record.id] === 'undefined') {
            next[record.id] = record.userNote || '';
          }
        });
        return next;
      });
    } catch (searchError) {
      setError(searchError.message || 'Failed to load run history records.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadRecords(DEFAULT_FILTERS);
  }, [loadRecords]);

  const uniqueAlgorithms = useMemo(
    () => [...new Set(records.map((record) => record.algorithm).filter(Boolean))].sort(),
    [records]
  );

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'symbol' ? value.toUpperCase() : value,
    }));
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadRecords(filters);
  };

  const handleReset = async () => {
    setFilters(DEFAULT_FILTERS);
    await loadRecords(DEFAULT_FILTERS);
  };

  const handleSaveNote = async (recordId) => {
    setActiveId(recordId);
    setError('');

    try {
      const saved = await updateRunRecord(recordId, {
        userNote: noteDraftById[recordId] || '',
      });
      setRecords((prev) => prev.map((record) => (record.id === recordId ? saved : record)));
    } catch (updateError) {
      setError(updateError.message || 'Failed to update record.');
    } finally {
      setActiveId('');
    }
  };

  const handleDelete = async (recordId) => {
    const confirmDelete = window.confirm('Delete this run record? This cannot be undone.');
    if (!confirmDelete) return;

    setActiveId(recordId);
    setError('');

    try {
      await deleteRunRecord(recordId);
      setRecords((prev) => prev.filter((record) => record.id !== recordId));
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete record.');
    } finally {
      setActiveId('');
    }
  };

  return (
    <section className="ml-runs-history glass-card">
      <div className="ml-runs-history__header">
        <div>
          <h3>ML Run History</h3>
          <p>Search, query, edit, and delete persisted run records.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => loadRecords(filters)} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <form className="ml-runs-history__filters" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Symbol"
          value={filters.symbol}
          onChange={(event) => handleFilterChange('symbol', event.target.value)}
        />
        <select
          value={filters.algorithm}
          onChange={(event) => handleFilterChange('algorithm', event.target.value)}
        >
          <option value="">All Algorithms</option>
          {uniqueAlgorithms.map((algorithm) => (
            <option key={algorithm} value={algorithm}>{algorithm}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(event) => handleFilterChange('status', event.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="queued">queued</option>
          <option value="running">running</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
        </select>
        <input
          type="text"
          placeholder="Job ID"
          value={filters.jobId}
          onChange={(event) => handleFilterChange('jobId', event.target.value)}
        />
        <input
          type="text"
          placeholder="Search text"
          value={filters.searchText}
          onChange={(event) => handleFilterChange('searchText', event.target.value)}
        />
        <input
          type="date"
          value={filters.createdFrom}
          onChange={(event) => handleFilterChange('createdFrom', event.target.value || '')}
          title="Created from"
        />
        <input
          type="date"
          value={filters.createdTo}
          onChange={(event) => handleFilterChange('createdTo', event.target.value || '')}
          title="Created to"
        />
        <input
          type="number"
          min="1"
          max="500"
          value={filters.limit}
          onChange={(event) => handleFilterChange('limit', Number(event.target.value) || 100)}
          title="Result limit"
        />
        <button type="submit" className="primary-button" disabled={loading}>Search</button>
        <button type="button" className="secondary-button" onClick={handleReset} disabled={loading}>Reset</button>
      </form>

      {error && (
        <div className="analysis-error-banner analysis-error-banner--warning">
          <strong>Run History Error</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="ml-runs-history__table-wrap">
        <table className="ml-runs-history__table">
          <thead>
            <tr>
              <th>Record Key</th>
              <th>Created</th>
              <th>Symbol</th>
              <th>Algorithm</th>
              <th>Status</th>
              <th>Summary</th>
              <th>Error</th>
              <th>Note (Update)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={9} className="ml-runs-history__empty">No records found for the current query.</td>
              </tr>
            )}
            {records.map((record) => {
              const isBusy = activeId === record.id;

              return (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  <td>{toDisplayDate(record.createdAt)}</td>
                  <td>{record.symbol || 'N/A'}</td>
                  <td>{record.algorithm || 'N/A'}</td>
                  <td>{record.status || 'N/A'}</td>
                  <td className="ml-runs-history__summary-cell">
                    {renderRecordSummary(record)}
                  </td>
                  <td className="ml-runs-history__error-cell">{record.error || 'None'}</td>
                  <td>
                    <input
                      className="ml-runs-history__note-input"
                      type="text"
                      value={noteDraftById[record.id] ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setNoteDraftById((prev) => ({ ...prev, [record.id]: value }));
                      }}
                      placeholder="Add note"
                    />
                    <button
                      type="button"
                      className="secondary-button ml-runs-history__inline-btn"
                      onClick={() => handleSaveNote(record.id)}
                      disabled={isBusy}
                    >
                      Save
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="danger-button ml-runs-history__inline-btn"
                      onClick={() => handleDelete(record.id)}
                      disabled={isBusy}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MLRunRecordsTable;
