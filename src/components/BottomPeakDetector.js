import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const BottomPeakDetector = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="Bottom/Peak LSTM"
    subtitle="Bottom and peak detection from queued backend job"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default BottomPeakDetector;
