import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const StockPrediction = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="Short-Term Prediction"
    subtitle="Queue-first short horizon predictor"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default StockPrediction;
