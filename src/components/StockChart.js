import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';

const StockChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="no-data">No data to display</div>;
  }

  // Custom tooltip to show all OHLC values
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="date">{format(new Date(label), 'MMM dd, yyyy')}</p>
          <p className="open">Open: ${payload[0].payload.open.toFixed(2)}</p>
          <p className="high">High: ${payload[0].payload.high.toFixed(2)}</p>
          <p className="low">Low: ${payload[0].payload.low.toFixed(2)}</p>
          <p className="close">Close: ${payload[0].payload.close.toFixed(2)}</p>
          <p className="volume">Volume: {payload[0].payload.volume.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="stock-chart">
      <h3>Price Chart</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(new Date(date), 'MM/dd')}
          />
          <YAxis domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="open"
            stroke="#8884d8"
            dot={false}
            name="Open"
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#82ca9d"
            dot={false}
            name="Close"
          />
          <Line
            type="monotone"
            dataKey="high"
            stroke="#ff7300"
            dot={false}
            name="High"
          />
          <Line
            type="monotone"
            dataKey="low"
            stroke="#0088fe"
            dot={false}
            name="Low"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;