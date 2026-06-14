import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const LongTermEnsemblePrediction = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="Long-Term Ensemble"
    subtitle="Long-horizon combined model output"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default LongTermEnsemblePrediction;
