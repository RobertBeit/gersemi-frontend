import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const EnsemblePrediction = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="Ensemble"
    subtitle="Weighted ensemble model result"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default EnsemblePrediction;
