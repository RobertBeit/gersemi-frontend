import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const LongTermNaiveBayesPrediction = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="Long-Term Naive Bayes"
    subtitle="Long-horizon probabilistic regression"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default LongTermNaiveBayesPrediction;
