import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const LongTermRandomForestPrediction = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="Long-Term Random Forest"
    subtitle="Long-horizon class prediction"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default LongTermRandomForestPrediction;
