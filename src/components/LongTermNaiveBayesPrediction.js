// src/components/LongTermNaiveBayesPrediction.js
// Fixed version with correct metadata structure handling

import React, { useState, useEffect } from 'react';
import { 
  trainLongTermNaiveBayes, 
  prepareLatestLongTermNBFeatures,
  discretizeLongTermPredictionSample
} from '../services/backendPredictionJobs';
import { extractTechnicalFeatures } from '../services/technicalIndicators';

const LongTermNaiveBayesPrediction = ({ stockData, symbol, fromDate }) => {
  // Model state
  const [model, setModel] = useState(null);
  const [modelMetadata, setModelMetadata] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [modelTrained, setModelTrained] = useState(false);
  
  // Results state
  const [trainingResults, setTrainingResults] = useState(null);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  
  // Component state
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(true);
  const [showFeatureStats, setShowFeatureStats] = useState(false);
  
  // Model parameters - REDUCED DEFAULTS FOR BETTER PERFORMANCE
  const [modelParams, setModelParams] = useState({
    lookbackDays: 10,    // Reduced from 30
    targetDaysAhead: 5,
    bins: 3,             // Reduced from 7
    testSplit: 0.2
  });

  // Train Naive Bayes model
  const handleTrainModel = async () => {
    const requiredDataPoints = modelParams.lookbackDays + modelParams.targetDaysAhead + 252;
    
    if (!stockData || stockData.length < requiredDataPoints) {
      setError(`Insufficient data for Naive Bayes training. Need at least ${requiredDataPoints} days of stock data.`);
      return;
    }

    setIsTraining(true);
    setError('');

    try {
      console.log('🎯 Starting Long-Term Naive Bayes Training...');

      const result = trainLongTermNaiveBayes(
        stockData,
        modelParams.lookbackDays,
        modelParams.targetDaysAhead,
        modelParams.bins,
        modelParams.testSplit
      );

      setModel(result.model);
      setModelMetadata(result.metadata);
      setTrainingResults(result);
      setModelTrained(true);

      // Generate debug information
      const formattedData = {
        close: stockData.map(d => d.close),
        high: stockData.map(d => d.high),
        low: stockData.map(d => d.low),
        volume: stockData.map(d => d.volume),
        dates: stockData.map(d => d.date)
      };
      
      const technicalFeatures = extractTechnicalFeatures(formattedData);
      
      // FIXED: Handle both old and new metadata structures
      const targetStats = {
        min: result.metadata.targetMin,
        max: result.metadata.targetMax,
        range: result.metadata.targetRange || (result.metadata.targetMax - result.metadata.targetMin),
        binSize: result.metadata.targetBinSize || (result.metadata.targetRange / result.bins)
      };

      // FIXED: Handle feature count from different metadata structures
      let featureCount = 0;
      if (result.metadata.featureMins) {
        // Old structure
        featureCount = result.metadata.featureMins.length;
      } else if (result.metadata.featureStats) {
        // New structure
        featureCount = result.metadata.featureStats.length;
      } else {
        // Fallback - calculate from a sample
        try {
          const sampleFeatures = prepareLatestLongTermNBFeatures(stockData, modelParams.lookbackDays);
          featureCount = sampleFeatures.length;
        } catch (e) {
          featureCount = 'Unknown';
        }
      }

      setDebugInfo({
        totalStockData: stockData.length,
        technicalFeatures: technicalFeatures.length,
        trainingSamples: result.trainingSamples,
        testSamples: result.testSamples,
        priceRange: {
          min: Math.min(...stockData.map(d => d.close)),
          max: Math.max(...stockData.map(d => d.close)),
          current: stockData[stockData.length - 1].close
        },
        targetStats: targetStats,
        featureCount: featureCount,
        bins: result.bins,
        metrics: result.metrics
      });

      console.log('✅ Naive Bayes training completed:', result);
      console.log('🔍 Debug info generated:', debugInfo);

      // Auto-predict current state
      await handleMakePrediction();

    } catch (err) {
      console.error('❌ Naive Bayes training failed:', err);
      setError(`Naive Bayes training failed: ${err.message}`);
    } finally {
      setIsTraining(false);
    }
  };

  // Make Naive Bayes prediction
  const handleMakePrediction = async () => {
    if (!model || !modelMetadata) {
      setError('Naive Bayes model not trained yet');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔮 Making Naive Bayes prediction...');

      const features = prepareLatestLongTermNBFeatures(
        stockData, 
        modelParams.lookbackDays
      );

      console.log('Raw features prepared:', features.slice(0, 10)); // Show first 10 features

      const discretizedFeatures = discretizeLongTermPredictionSample(
        features, 
        modelMetadata
      );

      console.log('Discretized features:', discretizedFeatures.slice(0, 10)); // Show first 10 discretized

      const result = await model.predictWithConfidence([discretizedFeatures]);
      const prediction = result[0];

      const currentPrice = stockData[stockData.length - 1].close;
      const percentReturn = prediction.prediction;
      const predictedPrice = currentPrice * (1 + percentReturn);

      // Calculate target date
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + modelParams.targetDaysAhead);

      const enhancedPrediction = {
        percentReturn: percentReturn,
        predictedPrice: predictedPrice,
        currentPrice: currentPrice,
        priceChange: predictedPrice - currentPrice,
        confidence: prediction.confidence,
        stdDev: prediction.stdDev,
        confidenceInterval: [
          currentPrice * (1 + prediction.confidenceInterval[0]),
          currentPrice * (1 + prediction.confidenceInterval[1])
        ],
        targetDate: targetDate.toLocaleDateString(),
        daysAhead: modelParams.targetDaysAhead,
        symbol: symbol,
        timestamp: new Date(),
        
        // Debug information
        rawPrediction: prediction.prediction,
        rawConfidenceInterval: prediction.confidenceInterval,
        discretizedFeatures: discretizedFeatures,
        featureCount: features.length
      };

      setCurrentPrediction(enhancedPrediction);
      console.log('📊 Naive Bayes prediction result:', enhancedPrediction);

    } catch (err) {
      console.error('❌ Naive Bayes prediction failed:', err);
      setError(`Naive Bayes prediction failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="long-term-nb-prediction">
      {/* Header */}
      <div className="prediction-header glass-card">
        <h3>🎯 Long-Term Naive Bayes Debug</h3>
        <p>Standalone Naive Bayes regressor for debugging price prediction issues</p>
        
        <div className="model-status">
          <div className={`status-indicator ${modelTrained ? 'trained' : 'untrained'}`}>
            <span className="status-dot"></span>
            {modelTrained ? 
              `Naive Bayes Trained (${modelParams.lookbackDays} days lookback, ${modelParams.targetDaysAhead} days ahead)` : 
              'Naive Bayes Not Trained'
            }
          </div>
        </div>
      </div>

      {/* Debug Information */}
      {debugInfo && (
        <div className="debug-info glass-card">
          <div className="debug-header">
            <h4>🔍 Debug Information</h4>
            <button 
              className="toggle-debug"
              onClick={() => setShowDebugInfo(!showDebugInfo)}
            >
              {showDebugInfo ? 'Hide' : 'Show'} Debug Details
            </button>
          </div>
          
          {showDebugInfo && (
            <div className="debug-details">
              <div className="debug-section">
                <h5>Data Information</h5>
                <div className="debug-grid">
                  <div className="debug-item">
                    <span>Total Stock Data:</span>
                    <span>{debugInfo.totalStockData} days</span>
                  </div>
                  <div className="debug-item">
                    <span>Technical Features:</span>
                    <span>{debugInfo.technicalFeatures} samples</span>
                  </div>
                  <div className="debug-item">
                    <span>Training Samples:</span>
                    <span>{debugInfo.trainingSamples}</span>
                  </div>
                  <div className="debug-item">
                    <span>Test Samples:</span>
                    <span>{debugInfo.testSamples}</span>
                  </div>
                  <div className="debug-item">
                    <span>Feature Count:</span>
                    <span>{debugInfo.featureCount}</span>
                  </div>
                  <div className="debug-item">
                    <span>Bins:</span>
                    <span>{debugInfo.bins}</span>
                  </div>
                </div>
              </div>

              <div className="debug-section">
                <h5>Price Information</h5>
                <div className="debug-grid">
                  <div className="debug-item">
                    <span>Current Price:</span>
                    <span>{formatCurrency(debugInfo.priceRange.current)}</span>
                  </div>
                  <div className="debug-item">
                    <span>Price Range:</span>
                    <span>{formatCurrency(debugInfo.priceRange.min)} - {formatCurrency(debugInfo.priceRange.max)}</span>
                  </div>
                </div>
              </div>

              <div className="debug-section">
                <h5>Target Return Statistics</h5>
                <div className="debug-grid">
                  <div className="debug-item">
                    <span>Target Min:</span>
                    <span>{formatPercent(debugInfo.targetStats.min)}</span>
                  </div>
                  <div className="debug-item">
                    <span>Target Max:</span>
                    <span>{formatPercent(debugInfo.targetStats.max)}</span>
                  </div>
                  <div className="debug-item">
                    <span>Target Range:</span>
                    <span>{formatPercent(debugInfo.targetStats.range)}</span>
                  </div>
                  <div className="debug-item">
                    <span>Bin Size:</span>
                    <span>{formatPercent(debugInfo.targetStats.binSize)}</span>
                  </div>
                </div>
              </div>

              <div className="debug-section">
                <h5>Model Performance</h5>
                <div className="debug-grid">
                  <div className="debug-item">
                    <span>R² Score:</span>
                    <span className={debugInfo.metrics.r2 > 0 ? 'positive' : 'negative'}>
                      {(debugInfo.metrics.r2 * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="debug-item">
                    <span>RMSE:</span>
                    <span>{debugInfo.metrics.rmse.toFixed(2)}%</span>
                  </div>
                  <div className="debug-item">
                    <span>MAE:</span>
                    <span>{debugInfo.metrics.mae.toFixed(2)}%</span>
                  </div>
                  <div className="debug-item">
                    <span>MAPE:</span>
                    <span>{debugInfo.metrics.mape.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Training Section */}
      <div className="training-section glass-card">
        <h4>🚀 Naive Bayes Training</h4>
        
        <div className="quick-presets">
          <h5>Quick Presets:</h5>
          <div className="preset-buttons">
            <button 
              onClick={() => setModelParams({
                lookbackDays: 10,
                targetDaysAhead: 5,
                bins: 3,
                testSplit: 0.2
              })}
              className="preset-button conservative"
            >
              Conservative (10 days, 3 bins)
            </button>
            <button 
              onClick={() => setModelParams({
                lookbackDays: 15,
                targetDaysAhead: 5,
                bins: 5,
                testSplit: 0.2
              })}
              className="preset-button balanced"
            >
              Balanced (15 days, 5 bins)
            </button>
            <button 
              onClick={() => setModelParams({
                lookbackDays: 20,
                targetDaysAhead: 5,
                bins: 7,
                testSplit: 0.2
              })}
              className="preset-button aggressive"
            >
              Aggressive (20 days, 7 bins)
            </button>
          </div>
        </div>
        
        <div className="model-params">
          <div className="param-grid">
            <div className="param-group">
              <label>Lookback Days:</label>
              <input
                type="number"
                min="5"
                max="60"
                value={modelParams.lookbackDays}
                onChange={(e) => setModelParams(prev => ({
                  ...prev,
                  lookbackDays: parseInt(e.target.value)
                }))}
                disabled={isTraining}
              />
            </div>
            
            <div className="param-group">
              <label>Target Days Ahead:</label>
              <input
                type="number"
                min="1"
                max="30"
                value={modelParams.targetDaysAhead}
                onChange={(e) => setModelParams(prev => ({
                  ...prev,
                  targetDaysAhead: parseInt(e.target.value)
                }))}
                disabled={isTraining}
              />
            </div>
            
            <div className="param-group">
              <label>Bins:</label>
              <input
                type="number"
                min="3"
                max="15"
                value={modelParams.bins}
                onChange={(e) => setModelParams(prev => ({
                  ...prev,
                  bins: parseInt(e.target.value)
                }))}
                disabled={isTraining}
              />
            </div>
            
            <div className="param-group">
              <label>Test Split:</label>
              <input
                type="number"
                min="0.1"
                max="0.4"
                step="0.05"
                value={modelParams.testSplit}
                onChange={(e) => setModelParams(prev => ({
                  ...prev,
                  testSplit: parseFloat(e.target.value)
                }))}
                disabled={isTraining}
              />
            </div>
          </div>
        </div>

        <button 
          className={`train-button ${isTraining ? 'training' : ''}`}
          onClick={handleTrainModel}
          disabled={isTraining || !stockData || stockData.length < 300}
        >
          {isTraining ? (
            <>
              <div className="spinner"></div>
              Training...
            </>
          ) : (
            '🎯 Train Naive Bayes Model'
          )}
        </button>
        
        {!stockData || stockData.length < 300 ? (
          <div className="warning-message">
            ⚠️ Need at least 300 days of stock data for training
          </div>
        ) : null}
      </div>

      {/* Prediction Section */}
      {modelTrained && (
        <div className="prediction-section glass-card">
          <div className="prediction-header-controls">
            <h4>🔮 Naive Bayes Price Prediction</h4>
            
            <button 
              className="predict-button"
              onClick={handleMakePrediction}
              disabled={isLoading}
            >
              {isLoading ? 'Predicting...' : '🎯 Make Prediction'}
            </button>
          </div>

          {/* Current Prediction Display */}
          {currentPrediction && (
            <div className="nb-prediction-display">
              <div className="prediction-main">
                <div className="price-info">
                  <div className="current-price">
                    <span className="label">Current Price:</span>
                    <span className="value">{formatCurrency(currentPrediction.currentPrice)}</span>
                  </div>
                  
                  <div className="predicted-price">
                    <span className="label">Predicted Price ({currentPrediction.targetDate}):</span>
                    <span className={`value ${currentPrediction.percentReturn >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(currentPrediction.predictedPrice)}
                    </span>
                  </div>
                  
                  <div className="expected-return">
                    <span className="label">Expected Return:</span>
                    <span className={`value ${currentPrediction.percentReturn >= 0 ? 'positive' : 'negative'}`}>
                      {formatPercent(currentPrediction.percentReturn)}
                    </span>
                  </div>
                  
                  <div className="price-change">
                    <span className="label">Price Change:</span>
                    <span className={`value ${currentPrediction.priceChange >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(currentPrediction.priceChange)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confidence Information */}
              <div className="confidence-section">
                <h5>📊 Prediction Confidence</h5>
                <div className="confidence-details">
                  <div className="confidence-item">
                    <span>Model Confidence:</span>
                    <span>{(currentPrediction.confidence * 100).toFixed(1)}%</span>
                  </div>
                  
                  <div className="confidence-item">
                    <span>Price Range (95%):</span>
                    <span>
                      {formatCurrency(currentPrediction.confidenceInterval[0])} - 
                      {formatCurrency(currentPrediction.confidenceInterval[1])}
                    </span>
                  </div>
                  
                  <div className="confidence-item">
                    <span>Standard Deviation:</span>
                    <span>{formatPercent(currentPrediction.stdDev)}</span>
                  </div>
                </div>
              </div>

              {/* Feature Debug Information */}
              <div className="feature-debug">
                <div className="feature-header">
                  <h5>🔧 Feature Debug Information</h5>
                  <button 
                    className="toggle-features"
                    onClick={() => setShowFeatureStats(!showFeatureStats)}
                  >
                    {showFeatureStats ? 'Hide' : 'Show'} Feature Stats
                  </button>
                </div>
                
                {showFeatureStats && (
                  <div className="feature-stats">
                    <div className="feature-item">
                      <span>Raw Return Prediction:</span>
                      <span>{formatPercent(currentPrediction.rawPrediction)}</span>
                    </div>
                    <div className="feature-item">
                      <span>Raw Confidence Interval:</span>
                      <span>
                        {formatPercent(currentPrediction.rawConfidenceInterval[0])} - 
                        {formatPercent(currentPrediction.rawConfidenceInterval[1])}
                      </span>
                    </div>
                    <div className="feature-item">
                      <span>Features Used:</span>
                      <span>{currentPrediction.featureCount}</span>
                    </div>
                    <div className="feature-item">
                      <span>Discretized Features (first 10):</span>
                      <span className="feature-values">
                        [{currentPrediction.discretizedFeatures.slice(0, 10).join(', ')}...]
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Training Results */}
      {trainingResults && (
        <div className="training-results glass-card">
          <h4>📈 Training Results</h4>
          <div className="training-metrics">
            <div className="metric-section">
              <h5>Performance Metrics</h5>
              <div className="metric-grid">
                <div className="metric-item">
                  <span>R² Score:</span>
                  <span className={trainingResults.metrics.r2 > 0 ? 'positive' : 'negative'}>
                    {(trainingResults.metrics.r2 * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="metric-item">
                  <span>RMSE:</span>
                  <span>{trainingResults.metrics.rmse.toFixed(2)}%</span>
                </div>
                <div className="metric-item">
                  <span>MAE:</span>
                  <span>{trainingResults.metrics.mae.toFixed(2)}%</span>
                </div>
                <div className="metric-item">
                  <span>MAPE:</span>
                  <span>{trainingResults.metrics.mape.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            
            <div className="metric-section">
              <h5>Prediction Statistics</h5>
              <div className="metric-grid">
                <div className="metric-item">
                  <span>Mean Prediction:</span>
                  <span>{trainingResults.metrics.meanPrediction.toFixed(2)}%</span>
                </div>
                <div className="metric-item">
                  <span>Mean Actual:</span>
                  <span>{trainingResults.metrics.meanActual.toFixed(2)}%</span>
                </div>
                <div className="metric-item">
                  <span>Directional Accuracy:</span>
                  <span className={trainingResults.metrics.directionalAccuracy > 0.5 ? 'positive' : 'negative'}>
                    {((trainingResults.metrics.directionalAccuracy || 0.5) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
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
        <h5>ℹ️ Naive Bayes Debug Information</h5>
        <ul>
          <li><strong>Conservative preset:</strong> Good starting point with fewer features/bins</li>
          <li><strong>R² Score:</strong> Should be positive ({'>'}0%) for meaningful predictions</li>
          <li><strong>Directional Accuracy:</strong> Should be {'>'}50% for useful predictions</li>
          <li><strong>Feature Count:</strong> Lower is often better (reduces overfitting)</li>
          <li><strong>Bins:</strong> Fewer bins = more stable, more bins = more granular</li>
        </ul>
        
        <div className="disclaimer">
          <strong>🔧 Debug Mode:</strong> Start with Conservative preset and adjust based on R² score and directional accuracy.
        </div>
      </div>
    </div>
  );
};

export default LongTermNaiveBayesPrediction;