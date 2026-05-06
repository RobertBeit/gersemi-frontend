import React from 'react';

const StockTable = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="no-data">No data to display</div>;
  }

  return (
    <div className="stock-table">
      <h3>Historical Stock Data</h3>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Open</th>
              <th>High</th>
              <th>Low</th>
              <th>Close</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.date}>
                <td>{item.date}</td>
                <td>${item.open.toFixed(2)}</td>
                <td>${item.high.toFixed(2)}</td>
                <td>${item.low.toFixed(2)}</td>
                <td>${item.close.toFixed(2)}</td>
                <td>{item.volume.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StockTable;