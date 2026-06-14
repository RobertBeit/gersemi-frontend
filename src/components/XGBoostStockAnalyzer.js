import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const XGBoostStockAnalyzer = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="XGBoost"
    subtitle="Boosted-tree model result"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default XGBoostStockAnalyzer;
