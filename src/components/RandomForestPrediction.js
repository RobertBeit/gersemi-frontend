import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const RandomForestPrediction = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="Random Forest"
    subtitle="Short-horizon directional classification"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default RandomForestPrediction;
