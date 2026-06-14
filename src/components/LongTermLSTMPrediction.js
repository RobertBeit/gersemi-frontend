import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const LongTermLSTMPrediction = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="Long-Term LSTM"
    subtitle="Sequence model result for longer horizon"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default LongTermLSTMPrediction;
