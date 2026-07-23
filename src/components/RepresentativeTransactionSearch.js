import React, { useMemo, useState } from "react";
import { resolveServiceBaseUrl } from "../services/runtimeEnv";
import representativeData from "../data/representatives.json";

const REPRESENTATIVE_BASE_URL = resolveServiceBaseUrl({
  explicitUrl: process.env.REACT_APP_SENATOR_MICROSERVICE_BASE_URL,
  localUrl: process.env.REACT_APP_SENATOR_MICROSERVICE_BASE_URL_LOCAL,
  deployedUrl: process.env.REACT_APP_SENATOR_MICROSERVICE_BASE_URL_DEV,
  fallbackUrl: "https://localhost:3001",
});

const RepresentativeTransactionSearch = () => {
  const [representativeName, setRepresentativeName] = useState("");
  const [lastName, setLastName] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [filingYear, setFilingYear] = useState("");
  const [startDate, setStartDate] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const representatives = useMemo(() => representativeData?.members || [], []);

  const stateOptions = useMemo(() => {
    const map = new Map();
    representatives.forEach((member) => {
      if (member.stateCode && member.stateName) {
        map.set(member.stateCode, member.stateName);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, name]) => ({ code, name }));
  }, [representatives]);

  const handleRepresentativePick = (value) => {
    setRepresentativeName(value);
    const picked = representatives.find((member) => member.officialName === value || member.formalName === value);
    if (picked) {
      setLastName(picked.lastName || "");
      setState(picked.stateCode || "");
      const numericDistrict = String(picked.district || "").match(/\d+/)?.[0] || "";
      setDistrict(numericDistrict);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);

    try {
      const params = new URLSearchParams();
      if (lastName.trim()) params.append("lastName", lastName.trim());
      if (state.trim()) params.append("state", state.trim());
      if (district.trim()) params.append("district", district.trim());
      if (filingYear.trim()) params.append("filingYear", filingYear.trim());
      if (startDate.trim()) params.append("startDate", startDate.trim());
      if (endDate.trim()) params.append("endDate", endDate.trim());

      const url = `${REPRESENTATIVE_BASE_URL}/api/representative-transactions?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResults(data.results || []);
    } catch (searchError) {
      setError(`Error: ${searchError.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="senator-search-container representative-search-container">
      <div className="senator-search-form">
        <h2>🏛️ Representative Transaction Search</h2>
        <form onSubmit={handleSearch}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="representativeName">Representative:</label>
              <input
                id="representativeName"
                type="text"
                value={representativeName}
                onChange={(event) => handleRepresentativePick(event.target.value)}
                placeholder="Type a representative name"
                list="representative-list"
              />
              <datalist id="representative-list">
                {representatives.slice(0, 1200).map((member) => (
                  <option key={member.bioguideID} value={member.officialName} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name:</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Leave empty for breadth search"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="state">State:</label>
              <select id="state" value={state} onChange={(event) => setState(event.target.value)}>
                <option value="">All states</option>
                {stateOptions.map((option) => (
                  <option key={option.code} value={option.code}>{`${option.code} - ${option.name}`}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="district">District:</label>
              <input
                id="district"
                type="text"
                value={district}
                onChange={(event) => setDistrict(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="e.g., 7"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="filingYear">Filing Year (optional):</label>
              <input
                id="filingYear"
                type="text"
                value={filingYear}
                onChange={(event) => setFilingYear(event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                placeholder="YYYY"
              />
            </div>
            <div className="form-group">
              <label htmlFor="startDate">Start Date:</label>
              <input id="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="endDate">End Date:</label>
              <input id="endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="primary-button">
            {loading ? "Searching..." : "Search Representative Transactions"}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}
      </div>

      {results.length > 0 && (
        <div className="senator-results">
          <h3>{`Representative Results (${results.length} reports found)`}</h3>
          {results.map((report) => (
            <div key={report.reportUrl} className="report-section">
              <div className="report-header">
                <h4 className="report-title-highlight">
                  <span className="report-title-gradient-text">{`${report.reportTitle} - ${report.representative || "Unknown"}`}</span>
                </h4>
                <span className="filed-date filed-date--strong">Filed: {report.reportDate}</span>
                <span className="filed-date">{`Type: ${report.filerType || "member"}`}</span>
                <span className="filed-date">{`Office: ${report.office || "Unknown"}`}</span>
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
                    {report.transactions.map((transaction, index) => (
                      <tr key={`${report.reportUrl}-${index}`}>
                        <td>{transaction.transactionDate}</td>
                        <td><strong>{transaction.ticker}</strong></td>
                        <td>{transaction.assetName}</td>
                        <td>{transaction.type}</td>
                        <td>{transaction.owner}</td>
                        <td>{transaction.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="no-transactions">No parsed transactions found in this report</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RepresentativeTransactionSearch;
