import React from 'react';
import AlgorithmReadOnlyView from './AlgorithmReadOnlyView';

const InstitutionalRegressionTester = ({ stockData, jobStatus, jobResult, options }) => (
  <AlgorithmReadOnlyView
    title="Institutional Regression"
    subtitle="CAPM and factor-based regression analysis"
    stockData={stockData}
    jobStatus={jobStatus}
    jobResult={jobResult}
    options={options}
  />
);

export default InstitutionalRegressionTester;
