// Linear Regression Timeframe Tester Component
// src/components/LinearRegressionTester.js
// Tests linear regression across different timeframes to find optimal prediction horizon

import React, { useState, useEffect } from 'react';
import { 
  trainLinearRegressionMultiTimeframe,
  trainLinearRegression,
  predictWithLinearRegression
} from '../services/backendPredictionJobs';

const LinearRegressionTester = ({ stockData, symbol, fromDate }) => {
  // Testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [testResults, setTestResults] = useState(null);
  const [currentTest, setCurrentTest] = useState('');
  
  // Results state
  const [bestModel, setBestModel] = useState(null);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(1);
  
  // Component state
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [showFeatureImportance, setShowFeatureImportance] = useState(false);
  
  // Test configuration
  const [testConfig, setTestConfig] = useState({
    timeframes: [1, 2, 3, 5, 7, 10, 15, 22],
    lookbackDays: 20,
    testSplit: 0.2
  });

  // Performance ranking helper
  const rankPerformance = (results) => {
    if (!results) return [];
    
    return Object.entries(results.results)
      .filter(([_, result]) => !result.error && result.testStats)
      .map(([timeframe, result]) => ({
        timeframe: parseInt(timeframe),
        r2: result.testStats.r2,
        mae: result.testStats.mae,
        directionalAccuracy: result.testStats.directionalAccuracy,
        combinedScore: result.testStats.r2 * 0.4 + result.testStats.directionalAccuracy * 0.6,
        result: result
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore);
  };

  // Run multi-timeframe test with TensorFlow.js
  const handleRunTest = async () => {
    if (!stockData || stockData.length < 300) {
      setError('Insufficient data for testing. Need at least 300 days of stock data.');
      return;
    }

    setIsTesting(true);
    setError('');
    setTestProgress(0);
    setCurrentTest('Initializing TensorFlow.js GPU-accelerated tests...');

    try {
      console.log('🚀 Starting TensorFlow.js Multi-Timeframe Analysis...');
      console.log(`💾 Backend: ${window.tf?.getBackend ? window.tf.getBackend() : 'CPU'}`);
      
      // Show progressive updates during async training
      let currentTimeframe = 0;
      const updateProgress = () => {
        if (currentTimeframe < testConfig.timeframes.length) {
          const progress = Math.floor((currentTimeframe / testConfig.timeframes.length) * 90);
          setTestProgress(progress);
          setCurrentTest(`Training ${testConfig.timeframes[currentTimeframe]}-day TensorFlow model... (${currentTimeframe + 1}/${testConfig.timeframes.length})`);
          currentTimeframe++;
          setTimeout(updateProgress, 2000); // Update every 2 seconds
        }
      };
      
      // Start progress updates
      setTimeout(updateProgress, 500);
      
      const results = await trainLinearRegressionMultiTimeframe(
        stockData,
        testConfig.timeframes,
        testConfig.lookbackDays,
        testConfig.testSplit
      );

      setTestProgress(100);
      setCurrentTest('TensorFlow.js analysis complete!');
      
      setTestResults(results);
      setBestModel(results.bestModel);
      setSelectedTimeframe(results.bestTimeframe);
      
      console.log('✅ TensorFlow.js multi-timeframe analysis completed:', results);

      // Auto-predict with best model
      if (results.bestModel && !results.bestModel.error) {
        await handleMakePrediction(results.bestModel.model, results.bestTimeframe);
      }

    } catch (err) {
      console.error('❌ TensorFlow.js testing failed:', err);
      setError(`TensorFlow.js testing failed: ${err.message}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => {
        setTestProgress(0);
        setCurrentTest('');
      }, 3000);
    }
  };

  // Make prediction with TensorFlow.js model
  const handleMakePrediction = async (model = null, timeframe = null) => {
    const modelToUse = model || (testResults?.results[selectedTimeframe]?.model);
    const timeframeToUse = timeframe || selectedTimeframe;
    
    if (!modelToUse || !modelToUse.trained) {
      setError('No trained TensorFlow.js model available for prediction');
      return;
    }

    try {
      console.log(`🔮 Making ${timeframeToUse}-day TensorFlow.js prediction...`);
      
      const prediction = await predictWithLinearRegression(
        modelToUse,
        stockData,
        testConfig.lookbackDays
      );

      const enhancedPrediction = {
        ...prediction,
        symbol: symbol,
        targetDaysAhead: timeframeToUse,
        modelType: 'TensorFlow.js Linear Regression',
        tensorflowBackend: window.tf?.getBackend ? window.tf.getBackend() : 'CPU',
        r2Score: testResults?.results[timeframeToUse]?.testStats?.r2 || 0,
        correlation: testResults?.results[timeframeToUse]?.testStats?.correlation || 0,
        overfitting: testResults?.results[timeframeToUse]?.overfitting || 1,
        predictionId: Date.now()
      };

      setCurrentPrediction(enhancedPrediction);
      console.log('📊 TensorFlow.js prediction result:', enhancedPrediction);

    } catch (err) {
      console.error('❌ TensorFlow.js prediction failed:', err);
      setError(`Prediction failed: ${err.message}`);
    }
  };

  // Select different timeframe
  const handleTimeframeSelect = (timeframe) => {
    setSelectedTimeframe(timeframe);
    setCurrentPrediction(null);
    
    if (testResults?.results[timeframe]?.model) {
      handleMakePrediction(testResults.results[timeframe].model, timeframe);
    }
  };

  // Format number helpers
  const formatPercent = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
  };

  const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value, decimals = 3) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  // Get performance color
  const getPerformanceColor = (value, type = 'r2') => {
    if (typeof value !== 'number') return 'gray';
    
    if (type === 'r2') {
      if (value > 0.1) return 'green';
      if (value > 0.05) return 'orange';
      return 'red';
    } else if (type === 'directional') {
      if (value > 0.6) return 'green';
      if (value > 0.52) return 'orange';
      return 'red';
    }
    
    return 'gray';
  };

  const rankedResults = rankPerformance(testResults);

  return (
    <div className="linear-regression-tester">
      {/* Header */}
      <div className="tester-header glass-card">
        <h3>🧠 TensorFlow.js Linear Regression Analysis</h3>
        <p>GPU-accelerated linear regression performance across different prediction horizons</p>
        
        {/* TensorFlow.js Status */}
        <div className="tensorflow-status">
          <span className="tf-backend">
            Backend: {window.tf?.getBackend ? window.tf.getBackend() : 'CPU'} 
            {window.tf?.getBackend && window.tf.getBackend() !== 'cpu' ? ' 🚀' : ''}
          </span>
          <span className="tf-version">
            TensorFlow.js {window.tf?.version ? `v${window.tf.version.tfjs}` : 'Available'}
          </span>
        </div>
        
        {testResults && (
          <div className="test-summary">
            <span>Tested: {testResults.summary.successfulTimeframes}/{testResults.summary.totalTimeframes} timeframes</span>
            <span>Best: {testResults.bestTimeframe} days</span>
            <span>Best R²: {formatNumber(testResults.summary.bestR2)}</span>
            <span>Best Dir.Acc: {formatPercent(testResults.summary.bestDirectionalAccuracy)}</span>
            <span>Short-term Avg: {formatNumber(testResults.summary.avgShortTerm)}</span>
            <span>Long-term Avg: {formatNumber(testResults.summary.avgLongTerm)}</span>
          </div>
        )}
      </div>

      {/* Test Configuration */}
      <div className="test-config glass-card">
        <h4>🔧 Test Configuration</h4>
        
        <div className="config-options">
          <div className="config-item">
            <label>Timeframes to Test (days):</label>
            <div className="timeframe-chips">
              {testConfig.timeframes.map(days => (
                <span key={days} className="chip">{days}d</span>
              ))}
            </div>
          </div>
          
          <div className="config-item">
            <label>Lookback Days:</label>
            <input
              type="number"
              min="10"
              max="60"
              value={testConfig.lookbackDays}
              onChange={(e) => setTestConfig(prev => ({
                ...prev,
                lookbackDays: parseInt(e.target.value)
              }))}
              disabled={isTesting}
            />
          </div>
          
          <div className="config-item">
            <label>Test Split:</label>
            <input
              type="number"
              min="0.1"
              max="0.5"
              step="0.05"
              value={testConfig.testSplit}
              onChange={(e) => setTestConfig(prev => ({
                ...prev,
                testSplit: parseFloat(e.target.value)
              }))}
              disabled={isTesting}
            />
          </div>
        </div>

        <button 
          className={`test-button ${isTesting ? 'testing' : ''}`}
          onClick={handleRunTest}
          disabled={isTesting || !stockData || stockData.length < 300}
        >
          {isTesting ? (
            <>
              <div className="spinner"></div>
              Training TensorFlow.js... {testProgress}%
            </>
          ) : (
            '🚀 Run TensorFlow.js Multi-Timeframe Analysis'
          )}
        </button>

        {isTesting && (
          <div className="test-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${testProgress}%` }}
              ></div>
            </div>
            <p className="progress-message">{currentTest}</p>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {testResults && rankedResults.length > 0 && (
        <div className="results-summary glass-card">
          <h4>📈 Performance Ranking</h4>
          
          <div className="ranking-table">
            <div className="table-header">
              <span>Rank</span>
              <span>Timeframe</span>
              <span>R² Score</span>
              <span>MAE</span>
              <span>Dir. Accuracy</span>
              <span>Combined Score</span>
              <span>Status</span>
            </div>
            
            {rankedResults.map((item, index) => (
              <div 
                key={item.timeframe} 
                className={`table-row ${selectedTimeframe === item.timeframe ? 'selected' : ''}`}
                onClick={() => handleTimeframeSelect(item.timeframe)}
              >
                <span className="rank">#{index + 1}</span>
                <span className="timeframe">{item.timeframe} days</span>
                <span className={`r2 ${getPerformanceColor(item.r2, 'r2')}`}>
                  {formatNumber(item.r2)}
                </span>
                <span className="mae">{formatNumber(item.mae, 4)}</span>
                <span className={`directional ${getPerformanceColor(item.directionalAccuracy, 'directional')}`}>
                  {formatPercent(item.directionalAccuracy)}
                </span>
                <span className="combined">{formatNumber(item.combinedScore)}</span>
                <span className="status">
                  {index === 0 ? '🏆 Best' : '✅ Good'}
                </span>
              </div>
            ))}
          </div>
          
          <div className="key-insights">
            <h5>🔍 Key Insights</h5>
            <ul>
              <li>
                <strong>Best Timeframe:</strong> {testResults.bestTimeframe} days 
                (R²: {formatNumber(testResults.summary.bestR2)}, 
                Dir.Acc: {formatPercent(testResults.summary.bestDirectionalAccuracy)})
              </li>
              <li>
                <strong>Short-term (1-3 days):</strong> {
                  rankedResults.filter(r => r.timeframe <= 3).length > 0 ? 
                  `Avg R²: ${formatNumber(rankedResults.filter(r => r.timeframe <= 3).reduce((sum, r) => sum + r.r2, 0) / rankedResults.filter(r => r.timeframe <= 3).length)}` :
                  'No short-term results'
                }
              </li>
              <li>
                <strong>Long-term (15+ days):</strong> {
                  rankedResults.filter(r => r.timeframe >= 15).length > 0 ? 
                  `Avg R²: ${formatNumber(rankedResults.filter(r => r.timeframe >= 15).reduce((sum, r) => sum + r.r2, 0) / rankedResults.filter(r => r.timeframe >= 15).length)}` :
                  'No long-term results'
                }
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Current Prediction */}
      {currentPrediction && (
        <div className="prediction-section glass-card">
          <h4>🧠 TensorFlow.js Prediction ({selectedTimeframe} days)</h4>
          
          <div className="prediction-display">
            <div className="prediction-main">
              <div className="price-info">
                <div className="current-price">
                  <span className="label">Current Price:</span>
                  <span className="value">{formatCurrency(currentPrediction.currentPrice)}</span>
                </div>
                
                <div className="predicted-price">
                  <span className="label">Predicted Price ({selectedTimeframe} days):</span>
                  <span className={`value ${currentPrediction.predictedReturn >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(currentPrediction.predictedPrice)}
                  </span>
                </div>
                
                <div className="expected-return">
                  <span className="label">Expected Return:</span>
                  <span className={`value ${currentPrediction.predictedReturn >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercent(currentPrediction.predictedReturn)}
                  </span>
                </div>
                
                <div className="model-confidence">
                  <span className="label">Model Confidence:</span>
                  <span className="value">{formatPercent(currentPrediction.confidence)}</span>
                </div>
                
                <div className="tf-backend">
                  <span className="label">Computed on:</span>
                  <span className="value">{currentPrediction.tensorflowBackend}</span>
                </div>
              </div>
            </div>
            
            {testResults?.results[selectedTimeframe] && (
              <div className="model-performance">
                <h5>📊 TensorFlow.js Model Performance ({selectedTimeframe} days)</h5>
                <div className="performance-metrics">
                  <div className="metric">
                    <span className="metric-label">R² Score:</span>
                    <span className="metric-value">{formatNumber(testResults.results[selectedTimeframe].testStats.r2)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Correlation:</span>
                    <span className="metric-value">{formatNumber(testResults.results[selectedTimeframe].testStats.correlation)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">MAE:</span>
                    <span className="metric-value">{formatNumber(testResults.results[selectedTimeframe].testStats.mae, 4)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">MAPE:</span>
                    <span className="metric-value">{formatNumber(testResults.results[selectedTimeframe].testStats.mape, 2)}%</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Directional Accuracy:</span>
                    <span className="metric-value">{formatPercent(testResults.results[selectedTimeframe].testStats.directionalAccuracy)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Overfitting Ratio:</span>
                    <span className={`metric-value ${testResults.results[selectedTimeframe].overfitting > 1.2 ? 'red' : 'green'}`}>
                      {formatNumber(testResults.results[selectedTimeframe].overfitting, 2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature Importance */}
      {testResults?.results[selectedTimeframe]?.featureImportance && (
        <div className="feature-importance glass-card">
          <div className="feature-header">
            <h4>🎯 Feature Importance ({selectedTimeframe} days)</h4>
            <button 
              className="toggle-features"
              onClick={() => setShowFeatureImportance(!showFeatureImportance)}
            >
              {showFeatureImportance ? 'Hide' : 'Show'} Top Features
            </button>
          </div>
          
          {showFeatureImportance && (
            <div className="feature-list">
              {testResults.results[selectedTimeframe].featureImportance.map((feature, index) => (
                <div key={index} className="feature-item">
                  <span className="feature-rank">#{index + 1}</span>
                  <span className="feature-name">{feature.feature}</span>
                  <span className="feature-weight">
                    Weight: {formatNumber(feature.weight, 4)}
                  </span>
                  <span className="feature-importance">
                    Importance: {formatNumber(feature.importance, 4)}
                  </span>
                  <div className="importance-bar">
                    <div 
                      className="importance-fill"
                      style={{ width: `${(feature.importance / testResults.results[selectedTimeframe].featureImportance[0].importance) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detailed Results */}
      {testResults && (
        <div className="detailed-results glass-card">
          <div className="details-header">
            <h4>📋 Detailed Results</h4>
            <button 
              className="toggle-details"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide' : 'Show'} All Results
            </button>
          </div>
          
          {showDetails && (
            <div className="all-results">
              {Object.entries(testResults.results).map(([timeframe, result]) => (
                <div key={timeframe} className="result-item">
                  <h5>{timeframe} Days Prediction</h5>
                  {result.error ? (
                    <div className="error-result">
                      <span>❌ Error: {result.error}</span>
                    </div>
                  ) : (
                    <div className="success-result">
                      <div className="result-metrics">
                        <span>Train: {result.trainSamples} samples</span>
                        <span>Test: {result.testSamples} samples</span>
                        <span>R²: {formatNumber(result.testStats.r2)}</span>
                        <span>MAE: {formatNumber(result.testStats.mae, 4)}</span>
                        <span>RMSE: {formatNumber(result.testStats.rmse, 4)}</span>
                        <span>Dir.Acc: {formatPercent(result.testStats.directionalAccuracy)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* Info Panel */}
      <div className="info-panel glass-card">
        <h5>ℹ️ About TensorFlow.js Linear Regression Analysis</h5>
        <ul>
          <li><strong>🧠 TensorFlow.js:</strong> GPU-accelerated machine learning with automatic differentiation</li>
          <li><strong>📊 R² Score:</strong> Explains variance in returns (higher = better, {'>'}0.1 is good for finance)</li>
          <li><strong>📈 Correlation:</strong> Linear relationship strength between predictions and actual returns</li>
          <li><strong>📉 MAE/MAPE:</strong> Mean Absolute (Percentage) Error in predictions (lower = better)</li>
          <li><strong>🎯 Directional Accuracy:</strong> Correct up/down predictions ({'>'}52% beats random)</li>
          <li><strong>⚖️ Overfitting Ratio:</strong> Test MAE / Train MAE (closer to 1.0 = better generalization)</li>
          <li><strong>🔍 Feature Engineering:</strong> Enhanced with momentum, volatility, and divergence signals</li>
        </ul>
        
        <div className="tensorflow-advantages">
          <strong>🚀 TensorFlow.js Advantages:</strong>
          <ul>
            <li>GPU acceleration for faster training (if available)</li>
            <li>Automatic gradient computation and optimization</li>
            <li>Built-in regularization to prevent overfitting</li>
            <li>Memory-efficient tensor operations</li>
            <li>Numerical stability improvements</li>
          </ul>
        </div>
        
        <div className="hypothesis-testing">
          <strong>🧪 Research Question:</strong> This analysis tests whether linear regression 
          performs better for short-term (1-3 days) vs longer-term (10+ days) stock predictions 
          using GPU-accelerated TensorFlow.js with enhanced feature engineering.
        </div>
      </div>
    </div>
  );
};

export default LinearRegressionTester;