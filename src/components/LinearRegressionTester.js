import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const LinearRegressionTester = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="Linear Regression"
    subtitle="Multi-feature linear forecasting"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default LinearRegressionTester;
